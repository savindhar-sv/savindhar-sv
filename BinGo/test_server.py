import json
import tempfile
import threading
import unittest
from contextlib import closing
from http.client import HTTPConnection
from pathlib import Path

from server import LIVE_SECONDS, create_server


class TruckLocationAPITest(unittest.TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        database_path = Path(self.temp_directory.name) / "test.sqlite3"
        self.server = create_server("127.0.0.1", 0, "test-driver-token", database_path)
        self.server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()
        self.base_url = self.server.server_address

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.server_thread.join()
        self.temp_directory.cleanup()

    def request(self, method, path, body=None, token=None, content_type="application/json"):
        connection = HTTPConnection(*self.base_url, timeout=3)
        headers = {}
        if body is not None:
            headers["Content-Type"] = content_type
        if token is not None:
            headers["Authorization"] = "Bearer " + token
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        data = response.read()
        connection.close()
        return response.status, json.loads(data) if data else None

    def test_location_requires_a_valid_driver_token(self):
        body = json.dumps({"latitude": 11.0, "longitude": 76.9})
        for token in (None, "incorrect"):
            with self.subTest(token=token):
                status, result = self.request(
                    "POST", "/api/trucks/TN%2037%20AB%204812/location", body, token
                )
                self.assertEqual(status, 401)
                self.assertIn("error", result)

    def test_driver_location_is_published_and_can_be_removed(self):
        body = json.dumps({"latitude": 11.004, "longitude": 76.961, "accuracy_m": 8.5})
        path = "/api/trucks/TN%2037%20AB%204812/location"
        status, posted = self.request("POST", path, body, "test-driver-token")
        self.assertEqual(status, 200)
        self.assertEqual(posted["truck_id"], "TN 37 AB 4812")

        status, result = self.request("GET", "/api/trucks")
        self.assertEqual(status, 200)
        self.assertEqual(result["live_seconds"], LIVE_SECONDS)
        self.assertEqual(result["trucks"][0]["latitude"], 11.004)
        self.assertEqual(result["trucks"][0]["accuracy_m"], 8.5)
        self.assertEqual(result["trucks"][0]["status"], "live")

        status, removed = self.request("DELETE", path, token="test-driver-token")
        self.assertEqual(status, 200)
        self.assertEqual(removed["status"], "ok")
        self.assertEqual(self.request("GET", "/api/trucks")[1]["trucks"], [])

    def test_invalid_coordinates_are_rejected(self):
        for latitude, longitude in ((91, 76), (11, -181), (float("nan"), 76), (True, 76)):
            with self.subTest(latitude=latitude, longitude=longitude):
                body = json.dumps({"latitude": latitude, "longitude": longitude})
                status, result = self.request(
                    "POST",
                    "/api/trucks/Truck-1/location",
                    body,
                    "test-driver-token",
                )
                self.assertEqual(status, 400)
                self.assertIn("error", result)

    def test_location_requires_json(self):
        status, result = self.request(
            "POST",
            "/api/trucks/Truck-1/location",
            '{"latitude":11,"longitude":76}',
            "test-driver-token",
            content_type="text/plain",
        )
        self.assertEqual(status, 415)
        self.assertIn("error", result)

    def test_health_endpoint_is_available(self):
        status, result = self.request("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(result, {"status": "ok"})

    def test_server_refuses_to_start_without_driver_token(self):
        with self.assertRaisesRegex(ValueError, "BINGO_DRIVER_TOKEN"):
            create_server("127.0.0.1", 0, "", Path(self.temp_directory.name) / "unused.sqlite3")


if __name__ == "__main__":
    unittest.main()
