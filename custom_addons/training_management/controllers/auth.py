from odoo import _, http
from odoo.exceptions import AccessDenied
from odoo.http import request

from .common import api_error_response, api_response, handle_api_errors


class OperationalAuthController(http.Controller):
    """Odoo-native session authentication only (ADR-005). No parallel
    password/token store; res.users.authenticate() remains the single
    identity/credential authority."""

    @http.route("/api/v1/auth/login", type="json2", auth="public", methods=["POST"])
    @handle_api_errors
    def login(self, request_id, login=None, password=None, **kwargs):
        if not login or not password:
            fields = {}
            if not login:
                fields["login"] = [_("This field is required.")]
            if not password:
                fields["password"] = [_("This field is required.")]
            return api_error_response(
                "VALIDATION_ERROR",
                _("login and password are required."),
                422,
                fields=fields,
                request_id=request_id,
            )

        credential = {"login": login, "password": password, "type": "password"}
        try:
            request.session.authenticate(request.env, credential)
        except AccessDenied:
            # Never reveal whether the account exists (PROJECT_SPEC
            # section 10.1); Odoo's own login-cooldown protection
            # (res.users._assert_can_auth) raises the same exception
            # with no distinct code, so it is intentionally not
            # distinguished from a wrong password here (see ADR-005).
            return api_error_response(
                "UNAUTHENTICATED",
                _("Invalid login or password."),
                401,
                request_id=request_id,
            )

        return api_response(
            data=request.env.user._get_operational_profile(), request_id=request_id
        )

    @http.route("/api/v1/auth/logout", type="json2", auth="user", methods=["POST"])
    @handle_api_errors
    def logout(self, request_id, **kwargs):
        request.session.logout(keep_db=True)
        return api_response(data={"logged_out": True}, request_id=request_id)

    @http.route("/api/v1/auth/me", type="json2", auth="user", methods=["GET"])
    @handle_api_errors
    def me(self, request_id, **kwargs):
        return api_response(
            data=request.env.user._get_operational_profile(), request_id=request_id
        )

    @http.route(
        "/api/v1/auth/password/forgot", type="json2", auth="public", methods=["POST"]
    )
    @handle_api_errors
    def password_forgot(self, request_id, login=None, **kwargs):
        """Standard Odoo functionality only: res.users.reset_password()
        (auth_signup, already installed transitively via "mail") sends
        the signup-token reset email using Odoo's own template -- no
        parallel token store (M10 closes a gap left open since M4;
        PROJECT_SPEC section 10.1 requires this endpoint).

        Always returns the same generic success message regardless of
        whether the login/email actually matches an account, so this
        endpoint cannot be used to enumerate registered users.
        """
        if not login:
            return api_error_response(
                "VALIDATION_ERROR",
                _("login is required."),
                422,
                fields={"login": [_("This field is required.")]},
                request_id=request_id,
            )
        try:
            request.env["res.users"].sudo().reset_password(login)
        except Exception:  # noqa: BLE001 -- deliberately not
            # distinguished from success; see docstring above.
            pass
        return api_response(
            data={
                "message": _(
                    "If an account exists for this login, a password "
                    "reset email has been sent."
                )
            },
            request_id=request_id,
        )

    @http.route(
        "/api/v1/auth/password/reset", type="json2", auth="public", methods=["POST"]
    )
    @handle_api_errors
    def password_reset(self, request_id, token=None, password=None, **kwargs):
        """Consumes the signup token from password_forgot() above via
        the same standard res.users.signup() mechanism auth_signup's own
        portal reset page uses -- no parallel token/reset mechanism."""
        fields = {}
        if not token:
            fields["token"] = [_("This field is required.")]
        if not password:
            fields["password"] = [_("This field is required.")]
        if fields:
            return api_error_response(
                "VALIDATION_ERROR",
                _("token and password are required."),
                422,
                fields=fields,
                request_id=request_id,
            )
        try:
            request.env["res.users"].sudo().signup({"password": password}, token)
        except Exception:
            # Invalid/expired token or a rejected password -- never
            # echo the underlying exception verbatim (it may be a plain
            # Exception, not one of build_error_response()'s mapped
            # types, and could otherwise fall through to a raw 500).
            return api_error_response(
                "VALIDATION_ERROR",
                _("This password reset link is invalid or has expired."),
                422,
                request_id=request_id,
            )
        return api_response(data={"reset": True}, request_id=request_id)
