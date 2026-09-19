"""Thin re-export so controller modules can `from .common import ...`.

The actual implementation lives in api_common.py (addon root) because
it is also needed by models/ir_http.py, outside the controllers
package -- see that module's docstring for why.
"""
from ..api_common import (  # noqa: F401
    api_error_response,
    api_response,
    apply_request_locale,
    build_error_response,
    get_or_create_request_id,
    handle_api_errors,
    make_envelope,
)
