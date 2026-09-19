from odoo.tests.common import tagged

from .common import OperationalApiCase


@tagged("post_install", "-at_install", "training_management_api")
class TestOperationalApiAuth(OperationalApiCase):
    def test_login_success(self):
        resp = self.api_post(
            "/auth/login",
            {"login": "opapi_trainee", "password": "Test1234!"},
        )
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIsNone(body["error"])
        self.assertEqual(body["data"]["roles"], ["trainee"])
        self.assertIn("survey.submit_own", body["data"]["capabilities"])
        # Never a raw res.users/res.partner read() (M4 point 7).
        self.assertNotIn("login", body["data"])
        self.assertNotIn("password", body["data"])

    def test_login_wrong_password(self):
        resp = self.api_post(
            "/auth/login",
            {"login": "opapi_trainee", "password": "wrong-password"},
        )
        self.assertEqual(resp.status_code, 401)
        body = resp.json()
        self.assertIsNone(body["data"])
        self.assertEqual(body["error"]["code"], "UNAUTHENTICATED")

    def test_login_missing_fields(self):
        resp = self.api_post("/auth/login", {"login": "opapi_trainee"})
        self.assertEqual(resp.status_code, 422)
        body = resp.json()
        self.assertEqual(body["error"]["code"], "VALIDATION_ERROR")
        self.assertIn("password", body["error"]["fields"])

    def test_me_without_session_returns_clean_401(self):
        resp = self.api_get("/auth/me")
        self.assertEqual(resp.status_code, 401)
        body = resp.json()
        self.assertEqual(body["error"]["code"], "UNAUTHENTICATED")
        # No stack trace / internal detail leaked (verified live during
        # implementation that Odoo's own default handler leaks a full
        # traceback in a "debug" key for this exact scenario).
        self.assertNotIn("debug", body)
        self.assertNotIn("Traceback", str(body))

    def test_me_with_session(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/auth/me")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["data"]["roles"], ["trainee"])

    def test_logout_then_me_is_unauthenticated(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_post("/auth/logout")
        self.assertEqual(resp.status_code, 200)
        resp2 = self.api_get("/auth/me")
        self.assertEqual(resp2.status_code, 401)

    def test_error_envelope_shape(self):
        resp = self.api_get("/auth/me")
        body = resp.json()
        self.assertIn("data", body)
        self.assertIn("meta", body)
        self.assertIn("error", body)
        self.assertIn("request_id", body["meta"])
        self.assertIsNone(body["data"])
        for key in ("code", "message", "fields"):
            self.assertIn(key, body["error"])

    def test_success_envelope_shape(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/auth/me")
        body = resp.json()
        self.assertIsNone(body["error"])
        self.assertIn("request_id", body["meta"])
        self.assertIsNotNone(body["data"])

    def test_request_id_propagation_custom(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/auth/me", headers={"X-Request-ID": "custom-req-id-1"})
        self.assertEqual(resp.json()["meta"]["request_id"], "custom-req-id-1")
        self.assertEqual(resp.headers.get("X-Request-ID"), "custom-req-id-1")

    def test_request_id_generated_when_missing(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/auth/me")
        request_id = resp.json()["meta"]["request_id"]
        self.assertTrue(request_id)
        self.assertEqual(resp.headers.get("X-Request-ID"), request_id)

    def test_request_id_generated_when_invalid(self):
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get(
            "/auth/me", headers={"X-Request-ID": "not valid! has spaces/slashes\\"}
        )
        request_id = resp.json()["meta"]["request_id"]
        self.assertNotEqual(request_id, "not valid! has spaces/slashes\\")
        self.assertTrue(request_id.startswith("req_"))

    def test_locale_header_accepted_without_error(self):
        # Full Arabic-message verification requires the ar_001 language
        # to be loaded in the database (an operational prerequisite
        # documented in ADR-005, not something this test loads); this
        # confirms the header is accepted and handled without error.
        self.authenticate("opapi_trainee", "Test1234!")
        resp = self.api_get("/auth/me", headers={"Accept-Language": "ar"})
        self.assertEqual(resp.status_code, 200)
        resp_en = self.api_get("/auth/me", headers={"Accept-Language": "en"})
        self.assertEqual(resp_en.status_code, 200)

    def test_session_required_endpoint_without_login(self):
        resp = self.api_get("/dashboard/trainee")
        self.assertEqual(resp.status_code, 401)

    def test_unauthenticated_with_bare_language_header_returns_clean_401(self):
        # Regression test (M4): a bare "ar" Accept-Language header on an
        # UNauthenticated request is expanded by Odoo's own
        # Request.default_lang() via babel aliasing to "ar_SY" -- not
        # "ar_001", the only Arabic locale this project installs --
        # *before* apply_request_locale() has a chance to run in the
        # pre-dispatch-authentication-failure path (IrHttp._handle_error).
        # Merely reading request.env.lang in that state used to raise
        # UserError("Invalid language code: ar_SY") from inside the
        # error-handling code itself, reproducing the exact traceback
        # leak this hook exists to prevent. Verified live and fixed by
        # making apply_request_locale() always force a known-active
        # lang and calling it from IrHttp._handle_error too.
        resp = self.api_get("/auth/me", headers={"Accept-Language": "ar"})
        self.assertEqual(resp.status_code, 401)
        body = resp.json()
        self.assertEqual(body["error"]["code"], "UNAUTHENTICATED")
        self.assertNotIn("debug", body)
        self.assertNotIn("Traceback", str(body))

    def test_unauthenticated_with_unrecognized_language_header_returns_clean_401(self):
        # Same failure mode, generalized: any unrecognized/garbage
        # Accept-Language value must degrade to the default language,
        # never leave an uninstalled lang in the request context.
        resp = self.api_get(
            "/auth/me", headers={"Accept-Language": "xx-Yy_totally-bogus"}
        )
        self.assertEqual(resp.status_code, 401)
        body = resp.json()
        self.assertEqual(body["error"]["code"], "UNAUTHENTICATED")
        self.assertNotIn("debug", body)
        self.assertNotIn("Traceback", str(body))

    # ---- password recovery (M10: PROJECT_SPEC section 10.1 required
    # this since M4; deferred there, closed here -- see
    # docs/adr/ADR-010-hardening-and-deployment-readiness.md) ----

    def test_password_forgot_missing_login_is_validation_error(self):
        resp = self.api_post("/auth/password/forgot", {})
        self.assertEqual(resp.status_code, 422)
        self.assertEqual(resp.json()["error"]["code"], "VALIDATION_ERROR")

    def test_password_forgot_does_not_reveal_account_existence(self):
        """Same generic success response for a real login and a
        nonexistent one -- this endpoint must never be usable to
        enumerate registered accounts."""
        resp_known = self.api_post(
            "/auth/password/forgot", {"login": "opapi_trainee"}
        )
        resp_unknown = self.api_post(
            "/auth/password/forgot", {"login": "no-such-login-at-all"}
        )
        self.assertEqual(resp_known.status_code, 200)
        self.assertEqual(resp_unknown.status_code, 200)
        self.assertEqual(
            resp_known.json()["data"]["message"],
            resp_unknown.json()["data"]["message"],
        )

    def test_password_reset_missing_fields_is_validation_error(self):
        resp = self.api_post("/auth/password/reset", {"token": "abc"})
        self.assertEqual(resp.status_code, 422)
        self.assertEqual(resp.json()["error"]["code"], "VALIDATION_ERROR")

    def test_password_reset_invalid_token_is_clean_validation_error(self):
        resp = self.api_post(
            "/auth/password/reset",
            {"token": "not-a-real-token", "password": "NewPass1234!"},
        )
        self.assertEqual(resp.status_code, 422)
        body = resp.json()
        self.assertEqual(body["error"]["code"], "VALIDATION_ERROR")
        self.assertNotIn("debug", body)
        self.assertNotIn("Traceback", str(body))

    def test_password_reset_valid_token_changes_password(self):
        partner = self.trainee_user.partner_id
        partner.sudo().signup_prepare(signup_type="reset")
        token = partner.sudo()._generate_signup_token()

        resp = self.api_post(
            "/auth/password/reset", {"token": token, "password": "NewPass1234!"}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["data"]["reset"])

        # The old password no longer works; the new one does.
        old_login = self.api_post(
            "/auth/login",
            {"login": "opapi_trainee", "password": "Test1234!"},
        )
        self.assertEqual(old_login.status_code, 401)
        new_login = self.api_post(
            "/auth/login",
            {"login": "opapi_trainee", "password": "NewPass1234!"},
        )
        self.assertEqual(new_login.status_code, 200)
