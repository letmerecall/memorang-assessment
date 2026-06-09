from unittest.mock import MagicMock, patch

import pytest

from agent.utils import _invoke_with_backoff, invoke_with_validation_retry


class TransientError(Exception):
    """Stand-in for OpenAI transient errors in tests."""


def test_invoke_with_backoff_retries_transient():
    calls = {"n": 0}

    def fn():
        calls["n"] += 1
        if calls["n"] < 3:
            raise TransientError("rate limited")
        return "ok"

    with patch("agent.utils._is_transient_error", side_effect=lambda e: isinstance(e, TransientError)):
        with patch("agent.utils.time.sleep"):
            assert _invoke_with_backoff(fn) == "ok"
    assert calls["n"] == 3


def test_invoke_with_backoff_raises_after_max():
    def fn():
        raise TransientError("rate limited")

    with patch("agent.utils._is_transient_error", side_effect=lambda e: isinstance(e, TransientError)):
        with patch("agent.utils.time.sleep"):
            with pytest.raises(TransientError):
                _invoke_with_backoff(fn)


def test_invoke_with_backoff_does_not_retry_non_transient():
    calls = {"n": 0}

    def fn():
        calls["n"] += 1
        raise ValueError("validation failed")

    with pytest.raises(ValueError, match="validation failed"):
        _invoke_with_backoff(fn)
    assert calls["n"] == 1


def test_validation_retry_still_one_feedback_retry():
    llm = MagicMock()
    llm.invoke.side_effect = ValueError("bad schema")

    with patch("agent.utils._invoke_with_backoff", side_effect=lambda fn: fn()):
        with pytest.raises(RuntimeError, match="bad schema"):
            invoke_with_validation_retry(
                llm,
                "prompt",
                lambda base, err: f"{base}\nretry",
                RuntimeError,
            )

    assert llm.invoke.call_count == 2
    assert "retry" in llm.invoke.call_args_list[1][0][0]
