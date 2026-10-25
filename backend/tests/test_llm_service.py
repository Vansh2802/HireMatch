import json

import httpx
import pytest
from pydantic import BaseModel

from app.core.config import settings
from app.services.llm_service import (
    LLMAuthenticationError,
    LLMError,
    LLMNotConfiguredError,
    LLMProviderError,
    LLMQuotaError,
    LLMRateLimitError,
    LLMResponseParsingError,
    LLMTimeoutError,
    OpenRouterClient,
)

MESSAGES = [{'role': 'user', 'content': 'Return JSON.'}]


class TinySchema(BaseModel):
    value: int


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(settings, 'openrouter_api_key', 'test-key')
    monkeypatch.setattr(settings, 'openrouter_model', 'test/model')


def make(handler, **kwargs) -> OpenRouterClient:
    http = httpx.Client(base_url='https://openrouter.ai/api/v1', transport=httpx.MockTransport(handler))
    return OpenRouterClient(http_client=http, sleep=lambda _: None, **kwargs)


def ok(content: str) -> httpx.Response:
    return httpx.Response(200, json={'choices': [{'message': {'content': content}}]})


def test_request_shape_and_fenced_json():
    seen = {}

    def handler(request):
        seen['body'] = json.loads(request.content)
        seen['auth'] = request.headers['authorization']
        assert request.url.path == '/api/v1/chat/completions'
        return ok('```json\n{"value": 7}\n```')

    assert make(handler).structured(MESSAGES, TinySchema).value == 7
    assert seen['auth'] == 'Bearer test-key'
    assert seen['body']['model'] == 'test/model'
    assert seen['body']['response_format'] == {'type': 'json_object'}
    assert seen['body']['temperature'] == 0


def test_json_embedded_in_prose_is_recovered():
    assert make(lambda r: ok('Here you go: {"value": 3} hope this helps')).structured(MESSAGES, TinySchema).value == 3


@pytest.mark.parametrize('status, error', [(401, LLMAuthenticationError), (403, LLMAuthenticationError), (402, LLMQuotaError),
                                           (404, LLMNotConfiguredError), (400, LLMProviderError)])
def test_non_retryable_errors_fail_immediately(status, error):
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(status, json={'error': {'message': 'nope'}})

    with pytest.raises(error):
        make(handler).complete_json(MESSAGES)
    assert len(calls) == 1


def test_transient_server_error_is_retried_then_succeeds():
    responses = iter([httpx.Response(502), httpx.Response(503), ok('{"value": 1}')])
    assert make(lambda r: next(responses)).complete_json(MESSAGES) == {'value': 1}


def test_retries_are_bounded():
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(500)

    with pytest.raises(LLMProviderError):
        make(handler).complete_json(MESSAGES)
    assert len(calls) == 3


def test_rate_limit_and_timeout_are_normalised():
    with pytest.raises(LLMRateLimitError):
        make(lambda r: httpx.Response(429, headers={'Retry-After': '0'})).complete_json(MESSAGES)
    with pytest.raises(LLMTimeoutError):
        make(lambda r: (_ for _ in ()).throw(httpx.ReadTimeout('timeout'))).complete_json(MESSAGES)


def test_total_time_budget_stops_retries():
    clock = iter([0.0, 0.0, 100.0, 100.0, 100.0])
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(503)

    client = make(handler, clock=lambda: next(clock), total_budget_seconds=10)
    with pytest.raises(LLMError):
        client.complete_json(MESSAGES)
    assert len(calls) == 1


def test_error_object_in_successful_response_is_a_provider_error():
    with pytest.raises(LLMProviderError):
        make(lambda r: httpx.Response(200, json={'error': {'code': 502, 'message': 'upstream'}})).complete_json(MESSAGES)


def test_empty_completion_is_rejected():
    with pytest.raises(LLMResponseParsingError):
        make(lambda r: ok('   ')).complete_json(MESSAGES)


def test_repairs_malformed_json_once():
    responses = iter([ok('{bad'), ok('{"value": 9}')])
    assert make(lambda r: next(responses)).structured(MESSAGES, TinySchema).value == 9


def test_reports_schema_failure_after_repair():
    with pytest.raises(LLMResponseParsingError):
        make(lambda r: ok('{"wrong": true}')).structured(MESSAGES, TinySchema)


def test_requires_server_side_configuration(monkeypatch):
    monkeypatch.setattr(settings, 'openrouter_api_key', None)
    with pytest.raises(LLMNotConfiguredError) as info:
        OpenRouterClient()
    # The message shown to users never names server environment variables.
    assert 'OPENROUTER' not in info.value.public_message


def test_public_messages_never_leak_configuration():
    for error in (LLMNotConfiguredError, LLMAuthenticationError, LLMQuotaError, LLMRateLimitError, LLMTimeoutError, LLMProviderError, LLMResponseParsingError):
        assert 'OPENROUTER' not in error.public_message and 'key' not in error.public_message.lower()
