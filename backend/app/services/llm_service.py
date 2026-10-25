"""OpenRouter chat-completions client with bounded retries and validated structured output.

Every exception raised here carries a ``public_message`` that is safe to show to users;
the exception's own message may contain operational detail and is only logged.
"""

from __future__ import annotations

import json
import logging
import random
import re
import time
from collections.abc import Callable
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import settings

logger = logging.getLogger(__name__)

ModelT = TypeVar('ModelT', bound=BaseModel)

MAX_ATTEMPTS = 3
MAX_RETRY_AFTER_SECONDS = 10.0


class LLMError(Exception):
    """Base class for LLM failures."""

    public_message = 'The AI extraction service failed. Please try again.'
    retryable_by_user = True


class LLMNotConfiguredError(LLMError):
    public_message = 'AI extraction is not configured on this server. Ask the administrator to configure it.'
    retryable_by_user = False


class LLMAuthenticationError(LLMError):
    public_message = 'The AI extraction service rejected the server credentials. Ask the administrator to check the configuration.'
    retryable_by_user = False


class LLMQuotaError(LLMError):
    public_message = 'The AI extraction service has no remaining credit. Ask the administrator to check the account.'
    retryable_by_user = False


class LLMRateLimitError(LLMError):
    public_message = 'The AI extraction service is busy. Please retry in a minute.'


class LLMTimeoutError(LLMError):
    public_message = 'The AI extraction service took too long to respond. Please retry.'


class LLMProviderError(LLMError):
    public_message = 'The AI extraction service is temporarily unavailable. Please retry.'


class LLMResponseParsingError(LLMError):
    public_message = 'The AI extraction service returned an unusable response. Please retry.'


def _json_content(payload: dict[str, Any]) -> dict[str, Any]:
    if isinstance(payload.get('error'), dict):
        raise LLMProviderError(f"Provider returned an error object: {payload['error'].get('code')}")
    choices = payload.get('choices')
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        raise LLMResponseParsingError('The LLM response did not include a completion.')
    if choices[0].get('finish_reason') == 'error':
        raise LLMProviderError('The provider reported an error while generating the completion.')

    message = choices[0].get('message')
    content = message.get('content') if isinstance(message, dict) else None
    if isinstance(content, list):
        content = ''.join(
            part.get('text', '') for part in content if isinstance(part, dict) and isinstance(part.get('text'), str)
        )
    if not isinstance(content, str) or not content.strip():
        raise LLMResponseParsingError('The LLM response did not include usable content.')

    cleaned = content.strip()
    fenced = re.search(r'```(?:json)?\s*(.*?)\s*```', cleaned, flags=re.IGNORECASE | re.DOTALL)
    if fenced:
        cleaned = fenced.group(1).strip()
    elif not cleaned.startswith('{'):
        first, last = cleaned.find('{'), cleaned.rfind('}')
        if first != -1 and last > first:
            cleaned = cleaned[first:last + 1]
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise LLMResponseParsingError('The LLM returned invalid JSON.') from exc
    if not isinstance(parsed, dict):
        raise LLMResponseParsingError('The LLM returned JSON with an unexpected shape.')
    return parsed


class OpenRouterClient:
    def __init__(
        self,
        *,
        http_client: httpx.Client | None = None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
        total_budget_seconds: float | None = None,
    ) -> None:
        if settings.llm_provider.lower() != 'openrouter':
            raise LLMNotConfiguredError('LLM_PROVIDER must be set to openrouter.')
        if not settings.openrouter_api_key:
            raise LLMNotConfiguredError('OPENROUTER_API_KEY is not configured.')
        if not settings.openrouter_model:
            raise LLMNotConfiguredError('OPENROUTER_MODEL is not configured.')

        self._sleep = sleep
        self._clock = clock
        self._deadline = clock() + (total_budget_seconds or settings.llm_total_budget_seconds)
        headers = {
            'Authorization': f'Bearer {settings.openrouter_api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': settings.openrouter_site_url,
            'X-Title': settings.app_name,
        }
        self._owns_client = http_client is None
        self._client = http_client or httpx.Client(
            base_url=settings.openrouter_base_url.rstrip('/'),
            headers=headers,
            timeout=httpx.Timeout(settings.llm_timeout_seconds, connect=10.0),
        )
        if http_client is not None:
            self._client.headers.update(headers)

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> 'OpenRouterClient':
        return self

    def __exit__(self, *_exc) -> None:
        self.close()

    def _remaining(self) -> float:
        return self._deadline - self._clock()

    def _backoff(self, attempt: int, retry_after: float | None = None) -> bool:
        """Sleep before the next attempt. Returns False if the time budget does not allow it."""
        delay = retry_after if retry_after is not None else (0.5 * (3 ** attempt)) + random.random() * 0.3
        delay = min(delay, MAX_RETRY_AFTER_SECONDS)
        if attempt + 1 >= MAX_ATTEMPTS or self._remaining() - delay < 2:
            return False
        self._sleep(delay)
        return True

    def complete_json(self, messages: list[dict[str, str]], *, json_mode: bool = True) -> dict[str, Any]:
        request_body: dict[str, Any] = {
            'model': settings.openrouter_model,
            'messages': messages,
            'temperature': 0,
        }
        if json_mode:
            request_body['response_format'] = {'type': 'json_object'}

        for attempt in range(MAX_ATTEMPTS):
            remaining = self._remaining()
            if remaining <= 1:
                raise LLMTimeoutError('The overall LLM time budget was exhausted.')
            try:
                response = self._client.post(
                    '/chat/completions',
                    json=request_body,
                    timeout=min(settings.llm_timeout_seconds, remaining),
                )
            except httpx.TimeoutException as exc:
                if self._backoff(attempt):
                    continue
                raise LLMTimeoutError('The OpenRouter request timed out.') from exc
            except httpx.RequestError as exc:
                if self._backoff(attempt):
                    continue
                raise LLMProviderError('The OpenRouter service could not be reached.') from exc

            status = response.status_code
            if status in (401, 403):
                raise LLMAuthenticationError(f'OpenRouter authentication failed ({status}).')
            if status == 402:
                raise LLMQuotaError('OpenRouter reported insufficient credits (402).')
            if status == 429:
                header = response.headers.get('Retry-After', '')
                retry_after = float(header) if header.replace('.', '', 1).isdigit() else None
                if self._backoff(attempt, retry_after):
                    continue
                raise LLMRateLimitError('OpenRouter rate limit reached.')
            if status in (408, 502, 503, 504) or status >= 500:
                if self._backoff(attempt):
                    continue
                raise LLMProviderError(f'OpenRouter returned a server error ({status}).')
            if status == 404:
                raise LLMNotConfiguredError('The configured OpenRouter model was not found (404).')
            if status >= 400:
                raise LLMProviderError(f'OpenRouter rejected the request ({status}).')

            try:
                payload = response.json()
            except ValueError as exc:
                raise LLMResponseParsingError('OpenRouter returned an invalid response body.') from exc
            if not isinstance(payload, dict):
                raise LLMResponseParsingError('OpenRouter returned an unexpected response body.')
            return _json_content(payload)

        raise LLMProviderError('OpenRouter request failed after bounded retries.')

    def structured(self, messages: list[dict[str, str]], schema: type[ModelT]) -> ModelT:
        """Request JSON matching ``schema``; one repair attempt on invalid JSON or schema mismatch."""
        attempt_messages = list(messages)
        last_error: Exception | None = None
        for attempt in range(2):
            try:
                return schema.model_validate(self.complete_json(attempt_messages))
            except (ValidationError, LLMResponseParsingError) as exc:
                last_error = exc
                logger.warning('LLM structured output invalid (attempt %s): %s', attempt + 1, type(exc).__name__)
                attempt_messages = [
                    *messages,
                    {
                        'role': 'user',
                        'content': (
                            'Your previous reply was not a valid JSON object matching the schema. '
                            'Return only one JSON object that matches the schema exactly. No markdown, no commentary.'
                        ),
                    },
                ]
        raise LLMResponseParsingError('The LLM response did not match the expected schema.') from last_error


def schema_instructions(schema: type[BaseModel]) -> str:
    return 'Return a single JSON object that validates against this JSON Schema:\n' + json.dumps(
        schema.model_json_schema(), separators=(',', ':')
    )
