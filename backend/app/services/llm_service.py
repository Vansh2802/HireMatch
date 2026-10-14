from __future__ import annotations

import json
import random
import re
import time
from collections.abc import Callable
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import settings

ModelT = TypeVar('ModelT', bound=BaseModel)


class LLMError(Exception):
    """Base class for safe, user-facing LLM failures."""


class LLMNotConfiguredError(LLMError):
    pass


class LLMAuthenticationError(LLMError):
    pass


class LLMRateLimitError(LLMError):
    pass


class LLMTimeoutError(LLMError):
    pass


class LLMProviderError(LLMError):
    pass


class LLMResponseParsingError(LLMError):
    pass


def _json_content(payload: dict[str, Any]) -> dict[str, Any]:
    choices = payload.get('choices')
    if not isinstance(choices, list) or not choices:
        raise LLMResponseParsingError('The LLM response did not include a completion.')

    message = choices[0].get('message')
    content = message.get('content') if isinstance(message, dict) else None
    if isinstance(content, list):
        content = ''.join(
            part.get('text', '') for part in content if isinstance(part, dict) and isinstance(part.get('text'), str)
        )
    if not isinstance(content, str) or not content.strip():
        raise LLMResponseParsingError('The LLM response did not include usable content.')

    cleaned = content.strip()
    fenced = re.fullmatch(r'```(?:json)?\s*(.*?)\s*```', cleaned, flags=re.IGNORECASE | re.DOTALL)
    if fenced:
        cleaned = fenced.group(1).strip()
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
    ) -> None:
        if settings.llm_provider.lower() != 'openrouter':
            raise LLMNotConfiguredError('LLM_PROVIDER must be set to openrouter.')
        if not settings.openrouter_api_key:
            raise LLMNotConfiguredError('OPENROUTER_API_KEY is not configured.')
        if not settings.openrouter_model:
            raise LLMNotConfiguredError('OPENROUTER_MODEL is not configured.')

        self._sleep = sleep
        headers = {
            'Authorization': f'Bearer {settings.openrouter_api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': settings.openrouter_site_url,
            'X-Title': settings.app_name,
        }
        self._client = http_client or httpx.Client(
            base_url=settings.openrouter_base_url.rstrip('/'),
            headers=headers,
            timeout=settings.llm_timeout_seconds,
        )
        if http_client is not None:
            self._client.headers.update(headers)

    def complete_json(self, messages: list[dict[str, str]]) -> dict[str, Any]:
        request_body = {
            'model': settings.openrouter_model,
            'messages': messages,
            'temperature': 0.2,
        }
        for attempt in range(2):
            try:
                response = self._client.post('/chat/completions', json=request_body)
            except httpx.TimeoutException as exc:
                if attempt == 0:
                    self._sleep(0.25 + random.random() * 0.25)
                    continue
                raise LLMTimeoutError('The OpenRouter request timed out.') from exc
            except httpx.RequestError as exc:
                if attempt == 0:
                    self._sleep(0.25 + random.random() * 0.25)
                    continue
                raise LLMProviderError('The OpenRouter service could not be reached.') from exc

            if response.status_code == 401 or response.status_code == 403:
                raise LLMAuthenticationError('OpenRouter authentication failed.')
            if response.status_code == 429:
                if attempt == 0:
                    retry_after = response.headers.get('Retry-After')
                    delay = float(retry_after) if retry_after and retry_after.isdigit() else 0.5
                    self._sleep(min(delay, 5.0))
                    continue
                raise LLMRateLimitError('OpenRouter rate limit reached. Try again later.')
            if response.status_code >= 500:
                if attempt == 0:
                    self._sleep(0.25 + random.random() * 0.25)
                    continue
                raise LLMProviderError('OpenRouter returned a server error.')
            if response.status_code >= 400:
                raise LLMProviderError(f'OpenRouter rejected the request ({response.status_code}).')

            try:
                payload = response.json()
            except ValueError as exc:
                raise LLMResponseParsingError('OpenRouter returned an invalid response body.') from exc
            if not isinstance(payload, dict):
                raise LLMResponseParsingError('OpenRouter returned an unexpected response body.')
            return _json_content(payload)

        raise LLMProviderError('OpenRouter request failed after bounded retries.')

    def structured(self, messages: list[dict[str, str]], schema: type[ModelT]) -> ModelT:
        repair_messages = list(messages)
        for attempt in range(2):
            try:
                return schema.model_validate(self.complete_json(repair_messages))
            except ValidationError as exc:
                if attempt == 1:
                    raise LLMResponseParsingError('The LLM response did not match the expected schema.') from exc
                repair_messages = [
                    *messages,
                    {
                        'role': 'user',
                        'content': 'Return only a valid JSON object matching the requested schema. Do not include markdown or commentary.',
                    },
                ]
            except LLMResponseParsingError:
                if attempt == 1:
                    raise
                repair_messages = [
                    *messages,
                    {
                        'role': 'user',
                        'content': 'Return only a valid JSON object matching the requested schema. Do not include markdown or commentary.',
                    },
                ]
        raise LLMResponseParsingError('The LLM response could not be validated.')
