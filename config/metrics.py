"""Compteurs au format Prometheus, sans dépendance supplémentaire."""
from django.core.cache import cache

COUNTERS = (
    'education_applications_created',
    'education_payments_confirmed',
    'education_api_errors',
)


def incr(name):
    if name not in COUNTERS:
        return
    key = f'metrics:{name}'
    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=None)


def render_prometheus():
    lines = []
    for name in COUNTERS:
        value = cache.get(f'metrics:{name}') or 0
        lines.append(f'# TYPE {name} counter')
        lines.append(f'{name} {int(value)}')
    return '\n'.join(lines) + '\n'
