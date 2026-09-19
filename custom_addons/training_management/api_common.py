"""Shared Operational API utilities (M4): response envelope, request-ID
handling, locale handling, and exception-to-HTTP-response mapping.

This lives outside both models/ and controllers/ because it is used by
both: controllers/common.py's handle_api_errors decorator wraps
exceptions raised *inside* a controller method, while
models/ir_http.py's IrHttp._handle_error override is needed for
exceptions raised by Odoo's own pre-dispatch authentication check --
before any controller method runs at all (see ADR-005: an
unauthenticated request to an auth='user' route never reaches the
controller/decorator; Odoo's ir.http._handle_error is the only hook
that sees it). Both call the exact same build_error_response() so the
envelope is identical either way.
"""
import functools
import logging
import re
import uuid

import werkzeug.exceptions

from odoo import _
from odoo.exceptions import (
    AccessDenied,
    AccessError,
    LockError,
    MissingError,
    UserError,
    ValidationError,
)
from odoo.http import SessionExpiredException, request

_logger = logging.getLogger(__name__)

# Only exceptions occurring under this prefix are converted to the
# {data, meta, error} envelope by IrHttp._handle_error; every other
# route keeps Odoo's own default error handling untouched.
API_PATH_PREFIX = "/api/v1/"

# A conservative, safe character set for an incoming client-supplied
# request ID (M4 point 5). Anything else is replaced, never echoed
# back unsanitized into logs/headers.
_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,128}$")

# Accept-Language -> installed Odoo language code. Verified against
# this project's own database during M1-M3 i18n work: Arabic loads as
# "ar_001" (Odoo's generic/default Arabic locale), English as "en_US".
_ACCEPT_LANGUAGE_TO_ODOO_LANG = {
    "ar": "ar_001",
    "en": "en_US",
}

# Always-installed fallback (Odoo's own base language). Verified live
# during M4: Odoo's *own* Request.default_lang()/best_lang (see
# odoo/http.py) uses babel.core.LOCALE_ALIASES to expand a bare
# language tag before our code ever runs, e.g. a plain "ar" Accept-
# Language header is expanded to "ar_SY" -- not "ar_001", the only
# Arabic locale this project actually installs. That guessed value is
# stored as the *default* context lang for a not-yet-authenticated
# request. Merely reading request.env.lang then raises UserError
# ("Invalid language code: ar_SY"), which happens inside the global
# _() call itself. This previously reproduced the exact traceback-leak
# bug IrHttp._handle_error exists to prevent, because it occurred
# while building the very error response for a pre-dispatch
# authentication failure. apply_request_locale() must therefore always
# set a known-active lang -- never merely leave Odoo's own guess in
# place -- and IrHttp._handle_error must call it before touching
# anything translated.
_DEFAULT_LANG = "en_US"

# Exception type -> (HTTP status, stable machine error code). Checked
# in order, most specific first, since several of these subclass
# UserError. A generic UserError (the type M2/M3 business logic raises
# for e.g. "day not open", "survey window closed") maps to 400
# BAD_REQUEST: it is a business-rule violation, not a payload
# validation failure (422) or a permission failure (403).
#
# SessionExpiredException is handled separately (see
# build_error_response): Odoo's own http_status for it is 403
# (verified: odoo/http.py sets `http_status = HTTPStatus.FORBIDDEN`),
# but this API maps "no/expired session" to 401 UNAUTHENTICATED
# specifically, which is the more conventional REST meaning and what
# PROJECT_SPEC section 11 asks for.
_ERROR_MAP = (
    (ValidationError, 422, "VALIDATION_ERROR"),
    (LockError, 409, "CONFLICT"),
    (MissingError, 404, "NOT_FOUND"),
    (AccessError, 403, "FORBIDDEN"),
    (AccessDenied, 403, "FORBIDDEN"),
    (UserError, 400, "BAD_REQUEST"),
)

# HTTP status -> stable code, for plain werkzeug HTTPExceptions (routing
# errors: unmatched path, disallowed method, etc.) that never subclass
# any Odoo exception above.
_HTTP_STATUS_TO_CODE = {
    400: "BAD_REQUEST",
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "BAD_REQUEST",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
}

# Odoo's own ir.rule/ACL-denial AccessError carries a long, whimsically
# worded, multi-paragraph default message that names the internal Odoo
# model (e.g. "training.day") -- verified live during M4 implementation
# (a supervisor requesting an unassigned day's attendance got a
# multi-line "Uh-oh! ... top-secret records ... training.day ...
# freshly baked cookies" message). That is not appropriate to surface
# through this API. This project's OWN AccessError messages (e.g. "You
# are not enrolled in this training day's program.") are short, single
# -line, and safe to show verbatim, so a length/newline heuristic
# distinguishes the two rather than replacing every AccessError
# message and losing the useful ones. The replacement text is
# translated at the point of use (build_error_response), never at
# import time, so it picks up the current request's language.
_MAX_VERBATIM_ACCESS_ERROR_LENGTH = 200


def is_api_request():
    return bool(request) and request.httprequest.path.startswith(API_PATH_PREFIX)


def get_or_create_request_id():
    """X-Request-ID handling (M4 point 5): accept a valid incoming ID,
    otherwise generate one. Single shared utility -- no controller
    duplicates this."""
    incoming = request.httprequest.headers.get("X-Request-ID")
    if incoming and _REQUEST_ID_RE.match(incoming):
        return incoming
    return "req_%s" % uuid.uuid4().hex


def apply_request_locale():
    """Accept-Language: ar / en (M4 point 6). Only switches the
    translation context for this request; never affects stored data or
    business calculations (M3's rating_value mapping is unaffected
    either way).

    Defensive by design, and unconditional: this always ends by setting
    context lang to an active, installed language -- either the
    requested ar_001/en_US, or _DEFAULT_LANG as a last resort -- rather
    than ever leaving whatever lang Odoo's own request-handling layer
    guessed by default. Two failure modes were verified live during M4:
    (1) requesting ar_001 on a database where it isn't installed/active
    breaks unrelated ORM calls; (2) Odoo's own Request.default_lang()
    expands a bare "ar"/"fr"/etc. Accept-Language tag via babel
    aliasing to an *uninstalled* regional variant (e.g. "ar_SY", not
    this project's "ar_001") and stores that as the request's default
    context lang before this function ever runs -- so simply doing
    nothing when the header is unrecognized is not safe.
    """
    header = request.httprequest.headers.get("Accept-Language", "")
    primary = header.split(",")[0].strip().split("-")[0].lower() if header else ""
    lang = _ACCEPT_LANGUAGE_TO_ODOO_LANG.get(primary, _DEFAULT_LANG)
    if not request.env["res.lang"].sudo().search_count(
        [("code", "=", lang), ("active", "=", True)]
    ):
        lang = _DEFAULT_LANG
    request.update_context(lang=lang)


def make_envelope(data=None, error=None, request_id=None):
    return {"data": data, "meta": {"request_id": request_id}, "error": error}


def api_response(data=None, status=200, request_id=None):
    request_id = request_id or get_or_create_request_id()
    body = make_envelope(data=data, request_id=request_id)
    return request.make_json_response(
        body, status=status, headers=[("X-Request-ID", request_id)]
    )


def api_error_response(code, message, status, fields=None, request_id=None):
    request_id = request_id or get_or_create_request_id()
    body = make_envelope(
        error={"code": code, "message": message, "fields": fields},
        request_id=request_id,
    )
    return request.make_json_response(
        body, status=status, headers=[("X-Request-ID", request_id)]
    )


def build_error_response(exc, request_id=None):
    """Map any exception to the standard error envelope. Used by both
    handle_api_errors (exceptions raised inside a controller method)
    and IrHttp._handle_error (exceptions raised earlier, during Odoo's
    own pre-dispatch authentication -- notably SessionExpiredException
    for an unauthenticated auth='user' request, which never reaches any
    controller method at all). Never leaks a stack trace or internal
    ORM detail."""
    request_id = request_id or get_or_create_request_id()
    if isinstance(exc, SessionExpiredException):
        return api_error_response(
            "UNAUTHENTICATED",
            _("Your session has expired. Please log in again."),
            401,
            request_id=request_id,
        )
    if isinstance(exc, werkzeug.exceptions.HTTPException):
        # Routing-level errors (e.g. an unmatched /api/v1/... path, a
        # disallowed HTTP method) never reach any Odoo/UserError
        # subclass -- they are plain werkzeug exceptions. Without this,
        # a simple 404 for a nonexistent endpoint would otherwise fall
        # through to the generic 500 branch below.
        status = exc.code or 500
        code = _HTTP_STATUS_TO_CODE.get(status, "BAD_REQUEST" if status < 500 else "INTERNAL_ERROR")
        return api_error_response(
            code, exc.description or exc.name, status, request_id=request_id
        )
    for exc_cls, status, code in _ERROR_MAP:
        if isinstance(exc, exc_cls):
            message = str(exc)
            if code == "FORBIDDEN" and (
                "\n" in message or len(message) > _MAX_VERBATIM_ACCESS_ERROR_LENGTH
            ):
                message = _("You do not have permission to access this resource.")
            return api_error_response(code, message, status, request_id=request_id)
    _logger.exception(
        "Unhandled error in operational API (request_id=%s)", request_id
    )
    return api_error_response(
        "INTERNAL_ERROR",
        _("An unexpected error occurred."),
        500,
        request_id=request_id,
    )


def handle_api_errors(func):
    """Shared error-mapping decorator (M4 point 4): every operational
    API endpoint uses this instead of re-implementing exception
    handling. Only catches exceptions raised *inside* the controller
    method itself; see IrHttp._handle_error for the earlier
    pre-dispatch-authentication case."""

    @functools.wraps(func)
    def wrapped(self, *args, **kwargs):
        apply_request_locale()
        request_id = get_or_create_request_id()
        try:
            return func(self, *args, request_id=request_id, **kwargs)
        except Exception as exc:  # noqa: BLE001 -- single, documented catch-all boundary
            return build_error_response(exc, request_id=request_id)

    return wrapped
