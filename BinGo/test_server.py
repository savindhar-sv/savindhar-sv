import base64
import json
import os
import tempfile
import threading
import time
import unittest
from contextlib import closing
from http.client import HTTPConnection
from pathlib import Path
from unittest.mock import patch

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
        arrival = int(time.time()) + 600
        body = json.dumps({
            "latitude": 11.004,
            "longitude": 76.961,
            "accuracy_m": 8.5,
            "estimated_arrival_at": arrival,
            "neighborhood": "RS Puram",
        })
        path = "/api/trucks/TN%2037%20AB%204812/location"
        status, posted = self.request("POST", path, body, "test-driver-token")
        self.assertEqual(status, 200)
        self.assertEqual(posted["truck_id"], "TN 37 AB 4812")

        status, result = self.request("GET", "/api/trucks")
        self.assertEqual(status, 200)
        self.assertEqual(result["live_seconds"], LIVE_SECONDS)
        self.assertEqual(result["trucks"][0]["latitude"], 11.004)
        self.assertEqual(result["trucks"][0]["accuracy_m"], 8.5)
        self.assertEqual(result["trucks"][0]["estimated_arrival_at"], arrival)
        self.assertEqual(result["trucks"][0]["neighborhood"], "RS Puram")
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

    def test_dumping_reports_publish_privacy_rounded_unverified_hotspots(self):
        status, user = self.request("POST", "/api/session", json.dumps({}))
        self.assertEqual(status, 201)
        status, report = self.request(
            "POST",
            "/api/reports",
            json.dumps({
                "category": "Plastic",
                "description": "Plastic dumped beside the public road.",
                "latitude": 11.0140672,
                "longitude": 76.9683931,
            }),
            user["token"],
        )
        self.assertEqual(status, 201)
        self.assertEqual(report["location_precision"], "approximately 100 metres")

        status, result = self.request("GET", "/api/reports")
        self.assertEqual(status, 200)
        self.assertEqual(len(result["reports"]), 1)
        hotspot = result["reports"][0]
        self.assertEqual(hotspot["category"], "Plastic")
        self.assertEqual(hotspot["latitude"], 11.014)
        self.assertEqual(hotspot["longitude"], 76.968)
        self.assertEqual(hotspot["status"], "unverified")
        self.assertNotIn("description", hotspot)
        self.assertNotIn("reporter_id", hotspot)

    def test_dumping_reports_reject_invalid_values_and_enforce_daily_limit(self):
        status, user = self.request("POST", "/api/session", json.dumps({}))
        self.assertEqual(status, 201)
        invalid = {
            "category": ["Plastic"],
            "description": "description",
            "latitude": 11.0,
            "longitude": 76.9,
        }
        status, result = self.request(
            "POST", "/api/reports", json.dumps(invalid), user["token"]
        )
        self.assertEqual(status, 400)
        self.assertIn("error", result)

        valid = json.dumps({
            "category": "Mixed waste",
            "description": "Waste on the roadside.",
            "latitude": 11.0,
            "longitude": 76.9,
        })
        for _ in range(5):
            status, _ = self.request("POST", "/api/reports", valid, user["token"])
            self.assertEqual(status, 201)
        status, result = self.request("POST", "/api/reports", valid, user["token"])
        self.assertEqual(status, 429)
        self.assertIn("error", result)

    def test_collection_schedule_requires_explicit_source_data(self):
        schedule_file = Path(self.temp_directory.name) / "collection_schedule.json"
        with patch.dict(os.environ, {"BINGO_COLLECTION_SCHEDULE_FILE": str(schedule_file)}):
            status, result = self.request("GET", "/api/schedule?neighborhood=RS%20Puram")
            self.assertEqual(status, 200)
            self.assertEqual(result["status"], "not_configured")

            schedule_file.write_text(json.dumps({
                "schedules": [{
                    "neighborhood": "RS Puram",
                    "waste_type": "Household waste",
                    "weekdays": ["Monday", "Thursday"],
                    "pickup_window": "06:00-09:00",
                    "source_url": "https://www.ccmc.gov.in/",
                    "verified_at": "2026-10-27",
                }]
            }), encoding="utf-8")
            status, result = self.request("GET", "/api/schedule?neighborhood=RS%20Puram")
        self.assertEqual(status, 200)
        self.assertEqual(result["status"], "configured")
        self.assertEqual(result["schedules"][0]["weekdays"], ["Monday", "Thursday"])
        self.assertEqual(result["schedules"][0]["source_url"], "https://www.ccmc.gov.in/")

    def test_official_dropoffs_require_verified_source_and_support_map_categories(self):
        dropoff_file = Path(self.temp_directory.name) / "dropoffs.json"
        with patch.dict(os.environ, {"BINGO_DROPOFFS_FILE": str(dropoff_file)}):
            status, result = self.request("GET", "/api/dropoffs")
            self.assertEqual(status, 200)
            self.assertEqual(result, {"status": "not_configured", "dropoffs": []})

            dropoff_file.write_text(json.dumps({
                "dropoffs": [{
                    "name": "Sample MCC",
                    "category": "mcc",
                    "latitude": 11.014,
                    "longitude": 76.968,
                    "source_url": "https://www.ccmc.gov.in/",
                    "verified_at": "2026-10-28",
                }]
            }), encoding="utf-8")
            status, result = self.request("GET", "/api/dropoffs")
        self.assertEqual(status, 200)
        self.assertEqual(result["status"], "configured")
        self.assertEqual(result["dropoffs"][0]["category"], "mcc")
        self.assertEqual(result["dropoffs"][0]["source_url"], "https://www.ccmc.gov.in/")

    def test_truck_arrival_requires_supported_neighborhood_and_future_timestamp(self):
        path = "/api/trucks/Truck-ETA/location"
        invalid_payloads = (
            {"latitude": 11.0, "longitude": 76.9, "estimated_arrival_at": 1, "neighborhood": "RS Puram"},
            {"latitude": 11.0, "longitude": 76.9, "estimated_arrival_at": 1},
        )
        for payload in invalid_payloads:
            status, result = self.request(
                "POST", path, json.dumps(payload), "test-driver-token"
            )
            self.assertEqual(status, 400)
            self.assertIn("error", result)

    def test_server_refuses_to_start_without_driver_token(self):
        with self.assertRaisesRegex(ValueError, "BINGO_DRIVER_TOKEN"):
            create_server("127.0.0.1", 0, "", Path(self.temp_directory.name) / "unused.sqlite3")

    def test_anonymous_item_exchange_messages_and_impact(self):
        status, giver = self.request("POST", "/api/session", json.dumps({"neighborhood": "RS Puram"}))
        self.assertEqual(status, 201)
        status, requester = self.request("POST", "/api/session", json.dumps({"neighborhood": "Gandhipuram"}))
        self.assertEqual(status, 201)
        public_key = base64.b64encode(bytes.fromhex(
            "046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"
            "4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"
        )).decode("ascii")
        status, key_result = self.request(
            "POST",
            "/api/session/encryption-key",
            json.dumps({"public_key": public_key}),
            giver["token"],
        )
        self.assertEqual(status, 200)
        self.assertEqual(key_result["status"], "saved")

        status, listing = self.request(
            "POST",
            "/api/items",
            json.dumps({
                "title": "Story books",
                "category": "Books",
                "photo_data": "data:image/jpeg;base64,ZmFrZQ==",
            }),
            giver["token"],
        )
        self.assertEqual(status, 201)
        status, items = self.request("GET", "/api/items")
        self.assertEqual(status, 200)
        self.assertEqual(items["items"][0]["neighborhood"], "RS Puram")
        self.assertNotIn("owner_id", items["items"][0])
        listing_id = listing["listing_id"]

        status, exchange = self.request(
            "POST",
            f"/api/items/{listing_id}/requests",
            token=requester["token"],
        )
        self.assertEqual(status, 201)
        exchange_id = exchange["exchange_id"]
        status, exchange_keys = self.request(
            "GET",
            f"/api/exchanges/{exchange_id}/keys",
            token=requester["token"],
        )
        self.assertEqual(status, 200)
        self.assertFalse(exchange_keys["ready"])

        encrypted = {
            "protocol": "ECDH-P256-AES-256-GCM-v1",
            "iv": base64.b64encode(bytes(12)).decode("ascii"),
            "ciphertext": base64.b64encode(bytes(32)).decode("ascii"),
        }
        status, rejected = self.request(
            "POST",
            f"/api/exchanges/{exchange_id}/messages",
            json.dumps({"encrypted": encrypted}),
            requester["token"],
        )
        self.assertEqual(status, 409)

        status, key_result = self.request(
            "POST",
            "/api/session/encryption-key",
            json.dumps({"public_key": public_key}),
            requester["token"],
        )
        self.assertEqual(status, 200)
        self.assertEqual(key_result["status"], "saved")
        status, exchange_keys = self.request(
            "GET",
            f"/api/exchanges/{exchange_id}/keys",
            token=requester["token"],
        )
        self.assertEqual(status, 200)
        self.assertTrue(exchange_keys["ready"])
        self.assertEqual(len(exchange_keys["public_keys"]), 2)

        status, rejected = self.request(
            "POST",
            f"/api/exchanges/{exchange_id}/messages",
            json.dumps({"message": "plaintext must not reach storage"}),
            requester["token"],
        )
        self.assertEqual(status, 400)
        self.assertIn("error", rejected)

        for index in range(10):
            status, message = self.request(
                "POST",
                f"/api/exchanges/{exchange_id}/messages",
                json.dumps({
                    "encrypted": {
                        "protocol": "ECDH-P256-AES-256-GCM-v1",
                        "iv": base64.b64encode(index.to_bytes(12, "big")).decode("ascii"),
                        "ciphertext": base64.b64encode(bytes([index]) * 32).decode("ascii"),
                    }
                }),
                requester["token"],
            )
            self.assertEqual(status, 201)
        status, thread = self.request(
            "GET",
            f"/api/exchanges/{exchange_id}/messages",
            token=giver["token"],
        )
        self.assertEqual(status, 200)
        self.assertEqual(
            json.loads(thread["messages"][0]["message"])["protocol"],
            "ECDH-P256-AES-256-GCM-v1",
        )
        self.assertNotIn("Can we meet at a public place?", thread["messages"][0]["message"])
        self.assertEqual(len(thread["messages"]), 10)

        status, completed = self.request(
            "PATCH",
            f"/api/exchanges/{exchange_id}",
            token=giver["token"],
        )
        self.assertEqual(status, 200)
        self.assertEqual(completed["diverted_kg"], 2.0)
        status, impact = self.request("GET", "/api/impact", token=requester["token"])
        self.assertEqual(status, 200)
        self.assertEqual(impact["diverted_kg"], 2.0)
        self.assertEqual(impact["completed_exchanges"], 1)
        self.assertEqual(impact["community_diverted_kg"], 2.0)

    def test_survey_aggregates_and_monthly_cost_per_active_user(self):
        status, user = self.request("POST", "/api/session", json.dumps({}))
        self.assertEqual(status, 201)
        status, submitted = self.request(
            "POST",
            "/api/survey",
            json.dumps({"visual_clarity": 4, "icon_readability": 5, "layout_appeal": 3}),
            user["token"],
        )
        self.assertEqual(status, 201)
        status, summary = self.request("GET", "/api/survey")
        self.assertEqual(status, 200)
        self.assertEqual(summary["response_count"], 1)
        self.assertEqual(summary["target_responses"], 10)
        self.assertEqual(summary["averages"], [4.0, 5.0, 3.0])

        with patch.dict(os.environ, {"BINGO_MONTHLY_PLATFORM_COST": "100"}):
            status, metrics = self.request("GET", "/api/metrics")
        self.assertEqual(status, 200)
        self.assertEqual(metrics["active_users_30d"], 1)
        self.assertEqual(metrics["cost_per_active_user"], 100)

    def test_session_neighborhood_is_coarse_and_updateable(self):
        status, user = self.request("POST", "/api/session", json.dumps({"neighborhood": "RS Puram"}))
        self.assertEqual(status, 201)
        self.assertNotIn("latitude", user)
        self.assertNotIn("longitude", user)

        status, updated = self.request(
            "PATCH",
            "/api/session",
            json.dumps({"neighborhood": "Race Course"}),
            user["token"],
        )
        self.assertEqual(status, 200)
        self.assertEqual(updated["neighborhood"], "Race Course")
        status, listing = self.request(
            "POST",
            "/api/items",
            json.dumps({
                "title": "Neighbourhood listing",
                "category": "Books",
                "photo_data": "data:image/jpeg;base64,ZmFrZQ==",
            }),
            user["token"],
        )
        self.assertEqual(status, 201)
        _, items = self.request("GET", "/api/items")
        created_item = next(item for item in items["items"] if item["listing_id"] == listing["listing_id"])
        self.assertEqual(created_item["neighborhood"], "Race Course")

    def test_exchange_conversations_are_private_to_participants(self):
        status, owner = self.request("POST", "/api/session", json.dumps({}))
        self.assertEqual(status, 201)
        status, requester = self.request("POST", "/api/session", json.dumps({}))
        self.assertEqual(status, 201)
        status, outsider = self.request("POST", "/api/session", json.dumps({}))
        self.assertEqual(status, 201)
        _, listing = self.request(
            "POST",
            "/api/items",
            json.dumps({
                "title": "Lamp",
                "category": "Home goods",
                "photo_data": "data:image/jpeg;base64,ZmFrZQ==",
            }),
            owner["token"],
        )
        _, exchange = self.request(
            "POST",
            f"/api/items/{listing['listing_id']}/requests",
            token=requester["token"],
        )
        status, result = self.request(
            "GET",
            f"/api/exchanges/{exchange['exchange_id']}/messages",
            token=outsider["token"],
        )
        self.assertEqual(status, 404)
        self.assertIn("error", result)
        status, result = self.request(
            "GET",
            f"/api/exchanges/{exchange['exchange_id']}/keys",
            token=outsider["token"],
        )
        self.assertEqual(status, 404)
        self.assertIn("error", result)


if __name__ == "__main__":
    unittest.main()
