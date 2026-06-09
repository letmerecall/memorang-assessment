import json
import os
from typing import Any, Callable, Type

from langchain_openai import ChatOpenAI


def _parse_resume(raw: Any) -> dict:
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return {}
    if isinstance(raw, dict):
        return raw
    return {}


def make_llm(
    *,
    temperature: float = 0,
    structured_output: type | None = None,
) -> ChatOpenAI:
    model = os.environ.get("OPENAI_MODEL", "openai/gpt-4.1")
    base_url = os.environ.get(
        "OPENAI_BASE_URL",
        "https://openrouter.ai/api/v1",
    )
    llm = ChatOpenAI(model=model, temperature=temperature, base_url=base_url)
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
        return llm.invoke(prompt)
    except Exception as first_err:
        retry_prompt = retry_suffix_fn(prompt, first_err)
        try:
            return llm.invoke(retry_prompt)
        except Exception as second_err:
            raise error_class(str(second_err)) from second_err


def invoke_with_content_retry(
    llm: ChatOpenAI,
    prompt: str,
    error_class: Type[Exception],
) -> str:
    try:
        return llm.invoke(prompt).content
    except Exception as first_err:
        retry_prompt = (
            f"{prompt}\n\nYour previous response failed: {first_err}. "
            "Please try again with a valid response."
        )
        try:
            return llm.invoke(retry_prompt).content
        except Exception as second_err:
            raise error_class(str(second_err)) from second_err
