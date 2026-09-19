from odoo.tests.common import tagged

from .common import OperationalApiCase


@tagged("post_install", "-at_install", "training_management_api")
class TestOperationalApiHealth(OperationalApiCase):
    def test_health_check_is_public_and_confirms_db_connectivity(self):
        # No self.authenticate(...) call -- this must work for a
        # completely anonymous caller (M10: load balancer/uptime
        # monitor), unlike every other /api/v1 endpoint.
        resp = self.api_get("/health")
        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertIsNone(body["error"])
        self.assertEqual(body["data"]["status"], "ok")
