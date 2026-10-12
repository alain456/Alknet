"""Interrupteurs lus dans l'environnement. Absents, ils restent fermés."""
import os

_ON = {'1', 'true', 'yes', 'on'}


def enabled(name, default=False):
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    return str(raw).strip().lower() in _ON
