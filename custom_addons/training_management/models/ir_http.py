import werkzeug.exceptions

from odoo import models

from ..api_common import apply_request_locale, build_error_response, is_api_request


class IrHttp(models.AbstractModel):
    _inherit = "ir.http"

    @classmethod
    def _match(cls, path_info):
        """A wrong-method request to a path that does exist (e.g. DELETE
        /api/v1/auth/me) never reaches _handle_error below: werkzeug's
        own Map.match() (called from this method's base implementation)
        raises MethodNotAllowed directly out of odoo.http.Request._serve_db,
        before request.dispatcher is ever switched from the default
        HttpDispatcher to Json2Dispatcher and before the
        service_model.retrying()/_update_served_exception() try block
        that normally routes exceptions into ir.http._handle_error even
        starts (see ADR-010 section 1). Root's own top-level WSGI handler
        then falls back to HttpDispatcher.handle_error(), which returns
        the werkzeug exception itself -- Werkzeug's raw HTML page -- for
        any HTTPException.

        Odoo's own equivalent case (_update_served_exception) works
        around this by pre-attaching `error_response` to the exception
        before it is raised, so Root.__call__'s `if not hasattr(exc,
        'error_response')` check short-circuits and never calls
        request.dispatcher.handle_error() at all. The same technique is
        applied here, scoped to /api/v1/* requests only.
        """
        try:
            return super()._match(path_info)
        except werkzeug.exceptions.MethodNotAllowed as exc:
            if is_api_request():
                apply_request_locale()
                exc.error_response = build_error_response(exc)
            raise

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
