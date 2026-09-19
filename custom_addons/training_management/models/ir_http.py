from odoo import models

from ..api_common import apply_request_locale, build_error_response, is_api_request


class IrHttp(models.AbstractModel):
    _inherit = "ir.http"

    @classmethod
    def _handle_error(cls, exception):
        """Verified Odoo 19 behavior (ADR-005): an exception raised by
        the framework's own pre-dispatch authentication check (e.g.
        SessionExpiredException for an unauthenticated auth='user'
        request) never reaches the controller method or its
        @handle_api_errors decorator -- it is only ever seen here, via
        this classmethod hook. Without this override, such a request
        under /api/v1/ falls through to Odoo's default
        Json2Dispatcher.handle_error(), which returns a raw
        serialize_exception() body (including a full traceback in
        "debug") instead of this project's {data, meta, error}
        envelope. Every other route (Odoo's own backend, other addons)
        is untouched.

        apply_request_locale() must run here too, before
        build_error_response() touches anything translated: a request
        that never reached a controller also never ran the
        @handle_api_errors decorator's own call to it, and Odoo's
        request-level default context can carry a lang value that
        isn't actually installed (verified live: a bare "ar"
        Accept-Language header babel-aliases to "ar_SY", not this
        project's "ar_001", and merely reading request.env.lang in that
        state raises UserError -- which previously reproduced the very
        traceback leak this hook exists to prevent).
        """
        if is_api_request():
            apply_request_locale()
            return build_error_response(exception)
        return super()._handle_error(exception)
