import httpx
import pytest
from pydantic import BaseModel

from app.core.config import settings
from app.services.llm_service import (
    LLMAuthenticationError,
    LLMNotConfiguredError,
    LLMRateLimitError,
    LLMResponseParsingError,
    LLMTimeoutError,
    OpenRouterClient,
)


class TinySchema(BaseModel):
    value: int


def client_for(handler):
    return httpx.Client(
        base_url='https://openrouter.ai/api/v1',
        transport=httpx.MockTransport(handler),
    )


def test_openrouter_parses_fenced_json_and_validates_schema(monkeypatch):
    monkeypatch.setattr(settings, 'openrouter_api_key', 'test-key')
    monkeypatch.setattr(settings, 'openrouter_model', 'test/model')

    def handler(request):
        assert request.url.path == '/api/v1/chat/completions'
        assert request.headers['authorization'] == 'Bearer test-key'
        return httpx.Response(200, json={'choices': [{'message': {'content': '```json\n{"value": 7}\n```'}}]})

    result = OpenRouterClient(http_client=client_for(handler), sleep=lambda _: None).structured(
        [{'role': 'user', 'content': 'Return JSON.'}], TinySchema
    )

    assert result.value == 7


def test_openrouter_rejects_authentication_failures(monkeypatch):
    monkeypatch.setattr(settings, 'openrouter_api_key', 'test-key')
    monkeypatch.setattr(settings, 'openrouter_model', 'test/model')

    client = OpenRouterClient(
        http_client=client_for(lambda request: httpx.Response(401, json={'error': {'message': 'bad key'}})),
        sleep=lambda _: None,
    )

    with pytest.raises(LLMAuthenticationError):
        client.complete_json([{'role': 'user', 'content': 'Return JSON.'}])


def test_openrouter_requires_server_side_configuration(monkeypatch):
    monkeypatch.setattr(settings, 'openrouter_api_key', None)

    with pytest.raises(LLMNotConfiguredError):
        OpenRouterClient()


def test_openrouter_repairs_malformed_json_once(monkeypatch):
    monkeypatch.setattr(settings, 'openrouter_api_key', 'test-key')
    monkeypatch.setattr(settings, 'openrouter_model', 'test/model')
    responses = iter([
        httpx.Response(200, json={'choices': [{'message': {'content': '{bad'}}]}),
        httpx.Response(200, json={'choices': [{'message': {'content': '{"value": 9}'}}]}),
    ])

    result = OpenRouterClient(
        http_client=client_for(lambda request: next(responses)),
        sleep=lambda _: None,
    ).structured([{'role': 'user', 'content': 'Return JSON.'}], TinySchema)

    assert result.value == 9


def test_openrouter_reports_schema_failure_after_repair(monkeypatch):
    monkeypatch.setattr(settings, 'openrouter_api_key', 'test-key')
    monkeypatch.setattr(settings, 'openrouter_model', 'test/model')
    client = OpenRouterClient(
        http_client=client_for(lambda request: httpx.Response(200, json={'choices': [{'message': {'content': '{"wrong": true}'}}]})),
        sleep=lambda _: None,
    )

    with pytest.raises(LLMResponseParsingError):
        client.structured([{'role': 'user', 'content': 'Return JSON.'}], TinySchema)


def test_openrouter_normalizes_rate_limit_and_timeout(monkeypatch):
    monkeypatch.setattr(settings, 'openrouter_api_key', 'test-key')
    monkeypatch.setattr(settings, 'openrouter_model', 'test/model')
    rate_client = OpenRouterClient(
        http_client=client_for(lambda request: httpx.Response(429, headers={'Retry-After': '0'})),
        sleep=lambda _: None,
    )
    timeout_client = OpenRouterClient(
        http_client=client_for(lambda request: (_ for _ in ()).throw(httpx.ReadTimeout('timeout'))),
        sleep=lambda _: None,
    )

    with pytest.raises(LLMRateLimitError):
        rate_client.complete_json([{'role': 'user', 'content': 'Return JSON.'}])
    with pytest.raises(LLMTimeoutError):
        timeout_client.complete_json([{'role': 'user', 'content': 'Return JSON.'}])
