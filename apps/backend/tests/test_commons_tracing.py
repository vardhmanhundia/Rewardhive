"""Tests for LangSmith tracing configuration (src.agents.commons.tracing)."""

import os

from src.agents.commons import tracing


def test_tracing_disabled_sets_env_false(monkeypatch):
    """With tracing off, the env flag is forced false and nothing else is set."""
    monkeypatch.setattr(tracing.settings, "LANGSMITH_TRACING", False)
    assert tracing.configure_langsmith() is False
    assert os.environ["LANGSMITH_TRACING"] == "false"


def test_tracing_enabled_exports_settings(monkeypatch):
    """With tracing on, settings are pushed into the LangSmith SDK env vars."""
    monkeypatch.setattr(tracing.settings, "LANGSMITH_TRACING", True)
    monkeypatch.setattr(tracing.settings, "LANGSMITH_API_KEY", "test-key")
    monkeypatch.setattr(tracing.settings, "LANGSMITH_PROJECT", "test-project")
    monkeypatch.setattr(tracing.settings, "LANGSMITH_ENDPOINT", "https://example.test")

    assert tracing.configure_langsmith() is True
    assert os.environ["LANGSMITH_TRACING"] == "true"
    assert os.environ["LANGSMITH_API_KEY"] == "test-key"
    assert os.environ["LANGSMITH_PROJECT"] == "test-project"
    assert os.environ["LANGSMITH_ENDPOINT"] == "https://example.test"


def test_traceable_is_a_noop_passthrough_when_disabled(monkeypatch):
    """A @traceable function returns its value normally even with tracing off."""
    monkeypatch.setattr(tracing.settings, "LANGSMITH_TRACING", False)
    tracing.configure_langsmith()

    @tracing.traceable
    def add(a: int, b: int) -> int:
        return a + b

    assert add(2, 3) == 5
