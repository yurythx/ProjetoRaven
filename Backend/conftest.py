import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def clear_cache_between_tests():
    """Clear Django cache before each test to prevent throttle state leaking between tests."""
    cache.clear()
    yield
    cache.clear()
