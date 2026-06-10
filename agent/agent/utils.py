import json
import os
import time
from typing import Any, Callable, Type

from langchain_openai import ChatOpenAI
from openai import APIConnectionError, APITimeoutError, InternalServerError, RateLimitError

_TRANSIENT_ERRORS = (
    RateLimitError,
    APIConnectionError,
    APITimeoutError,
    InternalServerError,
)


def _parse_resume(raw: Any) -> dict:
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return {}
    if isinstance(raw, dict):
        return raw
    return {}


def _is_transient_error(err: Exception) -> bool:
    if isinstance(err, _TRANSIENT_ERRORS):
        return True
    cause = err.__cause__
    return isinstance(cause, _TRANSIENT_ERRORS)


def _invoke_with_backoff(fn: Callable[[], Any], *, max_attempts: int = 3) -> Any:
    """Retry transient OpenAI/LangChain API errors with exponential backoff."""
    last_err: Exception | None = None
    for attempt in range(max_attempts):
        try:
            return fn()
        except Exception as err:
            if not _is_transient_error(err):
                raise
            last_err = err
            if attempt < max_attempts - 1:
                time.sleep(0.5 * (2**attempt))
    assert last_err is not None
    raise last_err


def make_llm(
    *,
    temperature: float = 0,
    structured_output: type | None = None,
    model: str | None = None,
) -> ChatOpenAI:
    resolved = model or os.environ.get("OPENAI_MODEL", "openai/gpt-4.1")
    base_url = os.environ.get(
        "OPENAI_BASE_URL",
        "https://openrouter.ai/api/v1",
    )
    llm = ChatOpenAI(model=resolved, temperature=temperature, base_url=base_url)
    if structured_output is not None:
        return llm.with_structured_output(structured_output)
    return llm


def invoke_with_validation_retry(
    llm: Any,
    prompt: str,
    retry_suffix_fn: Callable[[str, Exception], str],
    error_class: Type[Exception],
) -> Any:
    try:
        return _invoke_with_backoff(lambda: llm.invoke(prompt))
    except Exception as first_err:
        retry_prompt = retry_suffix_fn(prompt, first_err)
        try:
            return _invoke_with_backoff(lambda: llm.invoke(retry_prompt))
        except Exception as second_err:
            raise error_class(str(second_err)) from second_err


def invoke_with_content_retry(
    llm: ChatOpenAI,
    prompt: str,
    error_class: Type[Exception],
) -> str:
    try:
        return _invoke_with_backoff(lambda: llm.invoke(prompt).content)
    except Exception as first_err:
        retry_prompt = (
            f"{prompt}\n\nYour previous response failed: {first_err}. "
            "Please try again with a valid response."
        )
        try:
            return _invoke_with_backoff(lambda: llm.invoke(retry_prompt).content)
        except Exception as second_err:
            raise error_class(str(second_err)) from second_err
