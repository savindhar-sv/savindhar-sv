#!/usr/bin/env python3
"""BinGo's small, authenticated, SQLite-backed truck-location server."""

import hmac
import base64
import json
import math
import os
import re
import secrets
import sqlite3
import ssl
import sys
import time
import hashlib
import uuid
from contextlib import closing
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit


APP_DIRECTORY = Path(__file__).resolve().parent
DATABASE_PATH = Path(os.environ.get("BINGO_DATABASE", APP_DIRECTORY / "data" / "bingo.sqlite3"))
MAX_BODY_BYTES = 400 * 1024
LIVE_SECONDS = 90
MAX_POSITION_AGE_SECONDS = 24 * 60 * 60
TRUCK_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 -]{0,31}$")
ITEM_CATEGORIES = {"Books", "Clothes", "E-Waste", "Furniture", "Home goods", "Electronics", "Kids"}
DROP_OFF_CATEGORIES = {"mcc", "dry_kiosk", "dustbin"}
REPORT_CATEGORIES = {"Mixed waste", "Plastic", "Construction"}
COLLECTION_DAYS = {
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
}
P256_FIELD = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF
P256_CURVE_B = 0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B
DIVERTED_KG_BY_CATEGORY = {
    "Books": 2.0,
    "Clothes": 1.0,
    "E-Waste": 1.5,
    "Furniture": 3.0,
    "Home goods": 3.0,
    "Electronics": 1.5,
    "Kids": 1.0,
}
NEIGHBORHOODS = {"RS Puram", "Gandhipuram", "Saibaba Colony", "Race Course", "Coimbatore"}


def initialise_database(database_path):
    database_path = Path(database_path)
    database_path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(str(database_path), timeout=5)) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS truck_locations (
                truck_id TEXT PRIMARY KEY,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                accuracy_m REAL,
                neighborhood TEXT,
                estimated_arrival_at INTEGER,
                updated_at INTEGER NOT NULL
            )
            """
        )
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                user_id TEXT PRIMARY KEY,
                token_hash TEXT NOT NULL UNIQUE,
                neighborhood TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                last_active INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS listings (
                listing_id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL REFERENCES sessions(user_id),
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                photo_data TEXT NOT NULL,
                neighborhood TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'available',
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS exchanges (
                exchange_id TEXT PRIMARY KEY,
                listing_id TEXT NOT NULL REFERENCES listings(listing_id),
                requester_id TEXT NOT NULL REFERENCES sessions(user_id),
                owner_id TEXT NOT NULL REFERENCES sessions(user_id),
                status TEXT NOT NULL DEFAULT 'requested',
                diverted_kg REAL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                UNIQUE(listing_id, requester_id)
            );
            CREATE TABLE IF NOT EXISTS messages (
                message_id TEXT PRIMARY KEY,
                exchange_id TEXT NOT NULL REFERENCES exchanges(exchange_id),
                sender_id TEXT NOT NULL REFERENCES sessions(user_id),
                message TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS encryption_keys (
                user_id TEXT PRIMARY KEY REFERENCES sessions(user_id),
                public_key TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS user_surveys (
                user_id TEXT PRIMARY KEY REFERENCES sessions(user_id),
                visual_clarity INTEGER NOT NULL CHECK(visual_clarity BETWEEN 1 AND 5),
                icon_readability INTEGER NOT NULL CHECK(icon_readability BETWEEN 1 AND 5),
                layout_appeal INTEGER NOT NULL CHECK(layout_appeal BETWEEN 1 AND 5),
                submitted_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS dumping_reports (
                report_id TEXT PRIMARY KEY,
                reporter_id TEXT NOT NULL REFERENCES sessions(user_id),
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                created_at INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'unverified'
            );
            CREATE INDEX IF NOT EXISTS messages_exchange_time
                ON messages(exchange_id, created_at);
            CREATE INDEX IF NOT EXISTS dumping_reports_created
                ON dumping_reports(created_at);
            """
        )
        truck_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(truck_locations)")
        }
        if "neighborhood" not in truck_columns:
            connection.execute("ALTER TABLE truck_locations ADD COLUMN neighborhood TEXT")
        if "estimated_arrival_at" not in truck_columns:
            connection.execute(
                "ALTER TABLE truck_locations ADD COLUMN estimated_arrival_at INTEGER"
            )
        connection.commit()


class BingoRequestHandler(SimpleHTTPRequestHandler):
    driver_token = ""
    database_path = DATABASE_PATH
    server_version = "BinGo"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIRECTORY), **kwargs)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "geolocation=(self)")
        if self.client_address[0] not in {"127.0.0.1", "::1"} and self.request_is_secure():
            self.send_header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        super().end_headers()

    def log_message(self, format_string, *args):
        sys.stderr.write("BinGo request: %s\n" % (format_string % args))

    def request_is_secure(self):
        forwarded_proto = self.headers.get("X-Forwarded-Proto", "").split(",", 1)[0].strip().lower()
        if os.environ.get("BINGO_TRUST_PROXY") == "1" and forwarded_proto == "https":
            return True
        return self.client_address[0] in {"127.0.0.1", "::1"}

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "A valid Content-Length header is required."})
            return None
        if content_length < 1:
            self.send_json(400, {"error": "A JSON request body is required."})
            return None
        if content_length > MAX_BODY_BYTES:
            self.send_json(413, {"error": "Request body is too large."})
            return None
        if self.headers.get_content_type() != "application/json":
            self.send_json(415, {"error": "Requests must use application/json."})
            return None
        try:
            data = json.loads(self.rfile.read(content_length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"error": "Request body must contain valid JSON."})
            return None
        if not isinstance(data, dict):
            self.send_json(400, {"error": "Request body must be a JSON object."})
            return None
        return data

    def current_user(self):
        authorization = self.headers.get("Authorization", "")
        scheme, separator, token = authorization.partition(" ")
        if separator != " " or scheme.lower() != "bearer" or not token:
            return None
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            row = connection.execute(
                "SELECT user_id FROM sessions WHERE token_hash = ?",
                (token_hash,),
            ).fetchone()
            if row:
                connection.execute(
                    "UPDATE sessions SET last_active = ? WHERE user_id = ?",
                    (int(time.time()), row[0]),
                )
                connection.commit()
        return row[0] if row else None

    def require_user(self):
        user_id = self.current_user()
        if not user_id:
            self.send_json(401, {"error": "Create or restore a BinGo session to continue."})
            return None
        return user_id

    def parse_truck_location(self):
        route = urlsplit(self.path).path
        prefix = "/api/trucks/"
        suffix = "/location"
        if not route.startswith(prefix) or not route.endswith(suffix):
            return None

        truck_id = unquote(route[len(prefix):-len(suffix)]).strip()
        if not TRUCK_ID_PATTERN.fullmatch(truck_id):
            return None
        return truck_id

    def has_driver_access(self):
        authorization = self.headers.get("Authorization", "")
        scheme, separator, supplied_token = authorization.partition(" ")
        return (
            separator == " "
            and scheme.lower() == "bearer"
            and bool(self.driver_token)
            and hmac.compare_digest(supplied_token, self.driver_token)
        )

    def do_GET(self):
        route = urlsplit(self.path).path
        if self.client_address[0] not in {"127.0.0.1", "::1"} and not self.request_is_secure():
            self.send_response(308)
            self.send_header("Location", "https://" + self.headers.get("Host", "") + self.path)
            self.end_headers()
            return
        if route == "/api/health":
            self.send_json(200, {"status": "ok"})
            return
        if route == "/api/trucks":
            self.send_trucks()
            return
        if route == "/api/dropoffs":
            self.send_verified_dropoffs()
            return
        if route == "/api/reports":
            self.send_dumping_reports()
            return
        if route == "/api/schedule":
            self.send_collection_schedule()
            return
        if route == "/api/items":
            self.send_items()
            return
        if route == "/api/exchanges":
            self.send_exchanges()
            return
        if route.startswith("/api/exchanges/") and route.endswith("/keys"):
            self.send_exchange_keys(route[len("/api/exchanges/"):-len("/keys")])
            return
        if route.startswith("/api/exchanges/") and route.endswith("/messages"):
            self.send_messages(route[len("/api/exchanges/"):-len("/messages")])
            return
        if route == "/api/impact":
            self.send_impact()
            return
        if route == "/api/metrics":
            self.send_metrics()
            return
        if route == "/api/survey":
            self.send_survey_summary()
            return
        super().do_GET()

    def do_PATCH(self):
        if not self.request_is_secure():
            self.send_json(426, {"error": "HTTPS is required for account and exchange data."})
            return
        route = urlsplit(self.path).path
        if route == "/api/session":
            user_id = self.require_user()
            if not user_id:
                return
            data = self.read_json()
            if data is None:
                return
            neighborhood = data.get("neighborhood")
            if not isinstance(neighborhood, str) or neighborhood not in NEIGHBORHOODS:
                self.send_json(400, {"error": "Choose a supported neighbourhood area."})
                return
            with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
                connection.execute(
                    "UPDATE sessions SET neighborhood = ? WHERE user_id = ?",
                    (neighborhood, user_id),
                )
                connection.commit()
            self.send_json(200, {"status": "ok", "neighborhood": neighborhood})
            return
        prefix = "/api/exchanges/"
        if not route.startswith(prefix):
            self.send_json(404, {"error": "Endpoint not found."})
            return
        user_id = self.require_user()
        if not user_id:
            return
        exchange_id = route[len(prefix):]
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            row = connection.execute(
                """
                SELECT e.status, l.category, l.status
                FROM exchanges e JOIN listings l ON l.listing_id = e.listing_id
                WHERE e.exchange_id = ? AND (e.requester_id = ? OR e.owner_id = ?)
                """,
                (exchange_id, user_id, user_id),
            ).fetchone()
            if not row:
                self.send_json(404, {"error": "Exchange not found."})
                return
            if row[0] != "completed":
                if row[2] != "available":
                    self.send_json(409, {"error": "This item has already been exchanged."})
                    return
                diverted_kg = DIVERTED_KG_BY_CATEGORY[row[1]]
                connection.execute(
                    "UPDATE exchanges SET status = 'completed', diverted_kg = ?, updated_at = ? WHERE exchange_id = ?",
                    (diverted_kg, int(time.time()), exchange_id),
                )
                connection.execute(
                    "UPDATE listings SET status = 'completed' WHERE listing_id = (SELECT listing_id FROM exchanges WHERE exchange_id = ?)",
                    (exchange_id,),
                )
                connection.commit()
        self.send_json(200, {"status": "completed", "diverted_kg": DIVERTED_KG_BY_CATEGORY[row[1]]})

    def do_POST(self):
        if not self.request_is_secure():
            self.send_json(426, {"error": "HTTPS is required for account and exchange data."})
            return
        route = urlsplit(self.path).path
        if route == "/api/session":
            self.create_session()
            return
        if route == "/api/items":
            self.create_listing()
            return
        if route == "/api/survey":
            self.submit_survey()
            return
        if route == "/api/session/encryption-key":
            self.save_encryption_key()
            return
        if route == "/api/reports":
            self.create_dumping_report()
            return
        if route.startswith("/api/items/") and route.endswith("/requests"):
            self.request_item(route[len("/api/items/"):-len("/requests")])
            return
        if route.startswith("/api/exchanges/") and route.endswith("/messages"):
            self.create_message(route[len("/api/exchanges/"):-len("/messages")])
            return
        if not self.parse_truck_location():
            self.send_json(404, {"error": "Endpoint not found."})
            return
        self.publish_truck_location()

    def send_dumping_reports(self):
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                """
                SELECT report_id, category, latitude, longitude, created_at, status
                FROM dumping_reports
                ORDER BY created_at DESC
                LIMIT 500
                """
            ).fetchall()
        self.send_json(200, {"reports": [dict(row) for row in rows]})

    def send_verified_dropoffs(self):
        source_path = Path(os.environ.get(
            "BINGO_DROPOFFS_FILE",
            APP_DIRECTORY / "data" / "verified_dropoffs.json",
        ))
        if not source_path.is_file():
            self.send_json(200, {"status": "not_configured", "dropoffs": []})
            return
        try:
            with source_path.open("r", encoding="utf-8") as source_file:
                payload = json.load(source_file)
        except (OSError, json.JSONDecodeError) as error:
            sys.stderr.write("BinGo verified drop-off file could not be read: %s\n" % error)
            self.send_json(500, {"error": "The configured verified drop-off file could not be read."})
            return
        entries = payload.get("dropoffs") if isinstance(payload, dict) else None
        if not isinstance(entries, list):
            self.send_json(500, {"error": "The drop-off file must contain a dropoffs list."})
            return
        dropoffs = []
        for entry in entries:
            if not isinstance(entry, dict):
                self.send_json(500, {"error": "Each verified drop-off must be an object."})
                return
            latitude = entry.get("latitude")
            longitude = entry.get("longitude")
            if (
                not isinstance(entry.get("name"), str)
                or not entry["name"].strip()
                or not isinstance(entry.get("category"), str)
                or entry.get("category") not in DROP_OFF_CATEGORIES
                or isinstance(latitude, bool)
                or not isinstance(latitude, (int, float))
                or not math.isfinite(latitude)
                or not 10.8 <= latitude <= 11.25
                or isinstance(longitude, bool)
                or not isinstance(longitude, (int, float))
                or not math.isfinite(longitude)
                or not 76.75 <= longitude <= 77.25
                or not isinstance(entry.get("source_url"), str)
                or not entry["source_url"].startswith("https://")
                or not isinstance(entry.get("verified_at"), str)
                or not entry["verified_at"].strip()
            ):
                self.send_json(500, {"error": "A verified drop-off entry is incomplete or invalid."})
                return
            dropoffs.append({
                "name": entry["name"].strip(),
                "category": entry["category"],
                "latitude": float(latitude),
                "longitude": float(longitude),
                "source_url": entry["source_url"],
                "verified_at": entry["verified_at"].strip(),
            })
        self.send_json(200, {"status": "configured", "dropoffs": dropoffs})

    def create_dumping_report(self):
        user_id = self.require_user()
        if not user_id:
            return
        data = self.read_json()
        if data is None:
            return
        category = data.get("category")
        description = data.get("description")
        latitude = data.get("latitude")
        longitude = data.get("longitude")
        if not isinstance(category, str) or category not in REPORT_CATEGORIES:
            self.send_json(400, {"error": "Choose a supported dumping category."})
            return
        if not isinstance(description, str) or not description.strip() or len(description.strip()) > 300:
            self.send_json(400, {"error": "Description must contain 1 to 300 characters."})
            return
        if (
            isinstance(latitude, bool)
            or not isinstance(latitude, (int, float))
            or not math.isfinite(latitude)
            or not 10.8 <= latitude <= 11.25
            or isinstance(longitude, bool)
            or not isinstance(longitude, (int, float))
            or not math.isfinite(longitude)
            or not 76.75 <= longitude <= 77.25
        ):
            self.send_json(400, {"error": "Choose an incident location within Coimbatore."})
            return

        report_id = str(uuid.uuid4())
        created_at = int(time.time())
        # Keep map locations coarse; do not retain the precise point selected by the resident.
        coarse_latitude = round(float(latitude), 3)
        coarse_longitude = round(float(longitude), 3)
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            daily_count = connection.execute(
                """
                SELECT COUNT(*) FROM dumping_reports
                WHERE reporter_id = ? AND created_at >= ?
                """,
                (user_id, created_at - 24 * 60 * 60),
            ).fetchone()[0]
            if daily_count >= 5:
                self.send_json(429, {"error": "You have reached the daily report limit. Try again tomorrow."})
                return
            connection.execute(
                """
                INSERT INTO dumping_reports
                    (report_id, reporter_id, category, description, latitude, longitude, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    report_id,
                    user_id,
                    category,
                    description.strip(),
                    coarse_latitude,
                    coarse_longitude,
                    created_at,
                ),
            )
            connection.commit()
        self.send_json(201, {
            "status": "submitted",
            "report_id": report_id,
            "location_precision": "approximately 100 metres",
        })

    def send_collection_schedule(self):
        query = parse_qs(urlsplit(self.path).query)
        neighborhood = query.get("neighborhood", [""])[0]
        if neighborhood not in NEIGHBORHOODS:
            self.send_json(400, {"error": "Choose a supported neighbourhood area."})
            return

        schedule_path = Path(os.environ.get(
            "BINGO_COLLECTION_SCHEDULE_FILE",
            APP_DIRECTORY / "data" / "collection_schedule.json",
        ))
        if not schedule_path.is_file():
            self.send_json(200, {
                "status": "not_configured",
                "neighborhood": neighborhood,
                "schedules": [],
            })
            return
        try:
            with schedule_path.open("r", encoding="utf-8") as schedule_file:
                payload = json.load(schedule_file)
        except (OSError, json.JSONDecodeError) as error:
            sys.stderr.write("BinGo collection schedule could not be read: %s\n" % error)
            self.send_json(500, {"error": "The configured collection schedule file could not be read."})
            return

        entries = payload.get("schedules") if isinstance(payload, dict) else None
        if not isinstance(entries, list):
            self.send_json(500, {"error": "The collection schedule file must contain a schedules list."})
            return
        schedules = []
        for entry in entries:
            if not isinstance(entry, dict):
                self.send_json(500, {"error": "Each collection schedule entry must be an object."})
                return
            days = entry.get("weekdays")
            source_url = entry.get("source_url")
            if (
                not isinstance(entry.get("neighborhood"), str)
                or entry["neighborhood"] not in NEIGHBORHOODS
                or not isinstance(entry.get("waste_type"), str)
                or not entry["waste_type"].strip()
                or not isinstance(days, list)
                or not days
                or any(not isinstance(day, str) or day not in COLLECTION_DAYS for day in days)
                or not isinstance(entry.get("pickup_window"), str)
                or not entry["pickup_window"].strip()
                or not isinstance(source_url, str)
                or not source_url.startswith("https://")
                or not isinstance(entry.get("verified_at"), str)
                or not entry["verified_at"].strip()
            ):
                self.send_json(500, {"error": "A collection schedule entry is incomplete or invalid."})
                return
            if entry["neighborhood"] == neighborhood:
                schedules.append({
                    "waste_type": entry["waste_type"].strip(),
                    "weekdays": days,
                    "pickup_window": entry["pickup_window"].strip(),
                    "source_url": source_url,
                    "verified_at": entry["verified_at"].strip(),
                })
        self.send_json(200, {
            "status": "configured" if schedules else "not_configured",
            "neighborhood": neighborhood,
            "schedules": schedules,
        })

    def create_session(self):
        data = self.read_json()
        if data is None:
            return
        neighborhood = data.get("neighborhood", "RS Puram")
        if not isinstance(neighborhood, str) or neighborhood not in NEIGHBORHOODS:
            self.send_json(400, {"error": "Choose a supported neighbourhood area."})
            return
        user_id = str(uuid.uuid4())
        token = secrets.token_urlsafe(32)
        now = int(time.time())
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            connection.execute(
                "INSERT INTO sessions VALUES (?, ?, ?, ?, ?)",
                (user_id, hashlib.sha256(token.encode("utf-8")).hexdigest(), neighborhood, now, now),
            )
            connection.commit()
        self.send_json(201, {"user_id": user_id, "token": token, "neighborhood": neighborhood})

    def send_items(self):
        user_id = self.current_user()
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                """
                SELECT l.listing_id, l.title, l.category, l.photo_data, l.neighborhood,
                       l.status, l.created_at,
                       CASE WHEN l.owner_id = ? THEN 1 ELSE 0 END AS is_owner,
                       EXISTS(
                           SELECT 1 FROM exchanges e
                           WHERE e.listing_id = l.listing_id AND e.status != 'completed'
                       ) AS requested
                FROM listings l
                WHERE l.status = 'available'
                ORDER BY l.created_at DESC
                LIMIT 100
                """,
                (user_id,),
            ).fetchall()
        self.send_json(200, {"items": [dict(row) for row in rows]})

    def create_listing(self):
        user_id = self.require_user()
        if not user_id:
            return
        data = self.read_json()
        if data is None:
            return
        title = data.get("title")
        category = data.get("category")
        photo_data = data.get("photo_data")
        if not isinstance(title, str) or not title.strip() or len(title.strip()) > 60:
            self.send_json(400, {"error": "Item title must contain 1 to 60 characters."})
            return
        if not isinstance(category, str) or category not in ITEM_CATEGORIES:
            self.send_json(400, {"error": "Choose a valid item category."})
            return
        if not isinstance(photo_data, str) or not re.fullmatch(
            r"data:image/(?:jpeg|webp|png);base64,[A-Za-z0-9+/]+={0,2}",
            photo_data,
        ):
            self.send_json(400, {"error": "Choose a valid, compressed item photo."})
            return
        listing_id = str(uuid.uuid4())
        now = int(time.time())
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            row = connection.execute(
                "SELECT neighborhood FROM sessions WHERE user_id = ?",
                (user_id,),
            ).fetchone()
            connection.execute(
                """
                INSERT INTO listings (listing_id, owner_id, title, category, photo_data, neighborhood, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (listing_id, user_id, title.strip(), category, photo_data, row[0], now),
            )
            connection.commit()
        self.send_json(201, {"status": "ok", "listing_id": listing_id})

    def request_item(self, listing_id):
        user_id = self.require_user()
        if not user_id:
            return
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            listing = connection.execute(
                "SELECT owner_id, status FROM listings WHERE listing_id = ?",
                (listing_id,),
            ).fetchone()
            if not listing or listing[1] != "available":
                self.send_json(404, {"error": "This item is no longer available."})
                return
            if listing[0] == user_id:
                self.send_json(400, {"error": "You cannot request your own item."})
                return
            exchange_id = str(uuid.uuid4())
            now = int(time.time())
            try:
                connection.execute(
                    """
                    INSERT INTO exchanges (exchange_id, listing_id, requester_id, owner_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (exchange_id, listing_id, user_id, listing[0], now, now),
                )
                connection.commit()
            except sqlite3.IntegrityError:
                row = connection.execute(
                    "SELECT exchange_id FROM exchanges WHERE listing_id = ? AND requester_id = ?",
                    (listing_id, user_id),
                ).fetchone()
                exchange_id = row[0]
        self.send_json(201, {"status": "requested", "exchange_id": exchange_id})

    def send_exchanges(self):
        user_id = self.require_user()
        if not user_id:
            return
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                """
                SELECT e.exchange_id, e.status, e.diverted_kg, e.updated_at,
                       l.listing_id, l.title, l.category,
                       CASE WHEN e.owner_id = ? THEN 'Requester' ELSE 'Giver' END AS other_person
                FROM exchanges e JOIN listings l ON l.listing_id = e.listing_id
                WHERE e.requester_id = ? OR e.owner_id = ?
                ORDER BY e.updated_at DESC LIMIT 100
                """,
                (user_id, user_id, user_id),
            ).fetchall()
        self.send_json(200, {"exchanges": [dict(row) for row in rows]})

    def send_messages(self, exchange_id):
        user_id = self.require_user()
        if not user_id:
            return
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            connection.row_factory = sqlite3.Row
            participant = connection.execute(
                "SELECT 1 FROM exchanges WHERE exchange_id = ? AND (requester_id = ? OR owner_id = ?)",
                (exchange_id, user_id, user_id),
            ).fetchone()
            if not participant:
                self.send_json(404, {"error": "Conversation not found."})
                return
            rows = connection.execute(
                "SELECT sender_id, message, created_at FROM messages WHERE exchange_id = ? ORDER BY created_at, message_id LIMIT 500",
                (exchange_id,),
            ).fetchall()
        self.send_json(200, {"messages": [dict(row) for row in rows], "user_id": user_id})

    def create_message(self, exchange_id):
        user_id = self.require_user()
        if not user_id:
            return
        data = self.read_json()
        if data is None:
            return
        encrypted = data.get("encrypted")
        if (
            not isinstance(encrypted, dict)
            or encrypted.get("protocol") != "ECDH-P256-AES-256-GCM-v1"
            or not isinstance(encrypted.get("iv"), str)
            or not isinstance(encrypted.get("ciphertext"), str)
        ):
            self.send_json(400, {"error": "Messages must use the supported end-to-end encryption format."})
            return
        try:
            iv = base64.b64decode(encrypted["iv"], validate=True)
            ciphertext = base64.b64decode(encrypted["ciphertext"], validate=True)
        except (ValueError, base64.binascii.Error):
            self.send_json(400, {"error": "Encrypted message data is invalid."})
            return
        if len(iv) != 12 or not 16 <= len(ciphertext) <= 4096:
            self.send_json(400, {"error": "Encrypted message data is outside the supported size."})
            return
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            participant = connection.execute(
                """
                SELECT e.requester_id, e.owner_id,
                       requester_key.public_key, owner_key.public_key
                FROM exchanges e
                LEFT JOIN encryption_keys requester_key ON requester_key.user_id = e.requester_id
                LEFT JOIN encryption_keys owner_key ON owner_key.user_id = e.owner_id
                WHERE e.exchange_id = ? AND (e.requester_id = ? OR e.owner_id = ?)
                """,
                (exchange_id, user_id, user_id),
            ).fetchone()
            if not participant:
                self.send_json(404, {"error": "Conversation not found."})
                return
            if not participant[2] or not participant[3]:
                self.send_json(409, {"error": "Both participants must enable encrypted messaging before sending."})
                return
            connection.execute(
                "INSERT INTO messages VALUES (?, ?, ?, ?, ?)",
                (
                    str(uuid.uuid4()),
                    exchange_id,
                    user_id,
                    json.dumps(encrypted, separators=(",", ":")),
                    int(time.time()),
                ),
            )
            connection.execute(
                "UPDATE exchanges SET updated_at = ? WHERE exchange_id = ?",
                (int(time.time()), exchange_id),
            )
            connection.commit()
        self.send_json(201, {"status": "sent"})

    def save_encryption_key(self):
        user_id = self.require_user()
        if not user_id:
            return
        data = self.read_json()
        if data is None:
            return
        public_key = data.get("public_key")
        if not isinstance(public_key, str):
            self.send_json(400, {"error": "A P-256 public key is required."})
            return
        try:
            decoded_key = base64.b64decode(public_key, validate=True)
        except (ValueError, base64.binascii.Error):
            self.send_json(400, {"error": "The encryption public key is invalid."})
            return
        if (
            len(decoded_key) != 65
            or decoded_key[0] != 4
            or not self.is_valid_p256_point(decoded_key)
        ):
            self.send_json(400, {"error": "The encryption public key must use uncompressed P-256 format."})
            return
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            connection.execute(
                """
                INSERT INTO encryption_keys (user_id, public_key, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    public_key = excluded.public_key,
                    updated_at = excluded.updated_at
                """,
                (user_id, public_key, int(time.time())),
            )
            connection.commit()
        self.send_json(200, {"status": "saved"})

    @staticmethod
    def is_valid_p256_point(public_key):
        x = int.from_bytes(public_key[1:33], "big")
        y = int.from_bytes(public_key[33:], "big")
        return (
            x < P256_FIELD
            and y < P256_FIELD
            and (y * y - (pow(x, 3, P256_FIELD) - 3 * x + P256_CURVE_B)) % P256_FIELD == 0
        )

    def send_exchange_keys(self, exchange_id):
        user_id = self.require_user()
        if not user_id:
            return
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            row = connection.execute(
                """
                SELECT e.requester_id, e.owner_id,
                       requester_key.public_key, owner_key.public_key
                FROM exchanges e
                LEFT JOIN encryption_keys requester_key ON requester_key.user_id = e.requester_id
                LEFT JOIN encryption_keys owner_key ON owner_key.user_id = e.owner_id
                WHERE e.exchange_id = ? AND (e.requester_id = ? OR e.owner_id = ?)
                """,
                (exchange_id, user_id, user_id),
            ).fetchone()
        if not row:
            self.send_json(404, {"error": "Conversation not found."})
            return
        public_keys = {}
        if row[2]:
            public_keys[row[0]] = row[2]
        if row[3]:
            public_keys[row[1]] = row[3]
        self.send_json(200, {
            "user_id": user_id,
            "public_keys": public_keys,
            "ready": len(public_keys) == 2,
        })

    def send_impact(self):
        user_id = self.require_user()
        if not user_id:
            return
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            total = connection.execute(
                "SELECT COALESCE(SUM(diverted_kg), 0) FROM exchanges WHERE status = 'completed' AND (requester_id = ? OR owner_id = ?)",
                (user_id, user_id),
            ).fetchone()[0]
            completed = connection.execute(
                "SELECT COUNT(*) FROM exchanges WHERE status = 'completed' AND (requester_id = ? OR owner_id = ?)",
                (user_id, user_id),
            ).fetchone()[0]
            community_total = connection.execute(
                "SELECT COALESCE(SUM(diverted_kg), 0) FROM exchanges WHERE status = 'completed'"
            ).fetchone()[0]
        self.send_json(200, {
            "diverted_kg": round(total, 1),
            "completed_exchanges": completed,
            "community_diverted_kg": round(community_total, 1),
            "estimated": True,
            "method": "category-average-per-completed-item",
        })

    def send_metrics(self):
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            active_users = connection.execute(
                "SELECT COUNT(*) FROM sessions WHERE last_active >= ?",
                (int(time.time()) - 30 * 24 * 60 * 60,),
            ).fetchone()[0]
        monthly_cost = os.environ.get("BINGO_MONTHLY_PLATFORM_COST")
        try:
            monthly_cost = float(monthly_cost) if monthly_cost is not None else None
        except ValueError:
            self.send_json(500, {"error": "BINGO_MONTHLY_PLATFORM_COST must be a number."})
            return
        if monthly_cost is not None and (not math.isfinite(monthly_cost) or monthly_cost < 0):
            self.send_json(500, {"error": "BINGO_MONTHLY_PLATFORM_COST must be a finite, non-negative number."})
            return
        self.send_json(200, {
            "active_users_30d": active_users,
            "monthly_platform_cost": monthly_cost,
            "cost_per_active_user": round(monthly_cost / active_users, 4)
            if monthly_cost is not None and active_users else None,
            "currency": "INR",
        })

    def submit_survey(self):
        user_id = self.require_user()
        if not user_id:
            return
        data = self.read_json()
        if data is None:
            return
        keys = ("visual_clarity", "icon_readability", "layout_appeal")
        ratings = [data.get(key) for key in keys]
        if any(isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 5 for value in ratings):
            self.send_json(400, {"error": "Choose a whole-number rating from 1 to 5 for each question."})
            return
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            connection.execute(
                """
                INSERT INTO user_surveys
                    (user_id, visual_clarity, icon_readability, layout_appeal, submitted_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    visual_clarity = excluded.visual_clarity,
                    icon_readability = excluded.icon_readability,
                    layout_appeal = excluded.layout_appeal,
                    submitted_at = excluded.submitted_at
                """,
                (user_id, *ratings, int(time.time())),
            )
            connection.commit()
        self.send_json(201, {"status": "saved"})

    def send_survey_summary(self):
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            row = connection.execute(
                """
                SELECT COUNT(*), AVG(visual_clarity), AVG(icon_readability), AVG(layout_appeal)
                FROM user_surveys
                """
            ).fetchone()
        self.send_json(200, {
            "response_count": row[0],
            "target_responses": 10,
            "averages": [round(value, 2) if value is not None else None for value in row[1:]],
        })

    def send_trucks(self):
        now = int(time.time())
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                """
                SELECT truck_id, latitude, longitude, accuracy_m, neighborhood,
                       estimated_arrival_at, updated_at
                FROM truck_locations
                WHERE updated_at >= ?
                ORDER BY updated_at DESC
                """,
                (now - MAX_POSITION_AGE_SECONDS,),
            ).fetchall()

        trucks = []
        for row in rows:
            age_seconds = max(0, now - row["updated_at"])
            trucks.append({
                "id": row["truck_id"],
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "accuracy_m": row["accuracy_m"],
                "neighborhood": row["neighborhood"],
                "estimated_arrival_at": row["estimated_arrival_at"],
                "updated_at": row["updated_at"],
                "age_seconds": age_seconds,
                "status": "live" if age_seconds <= LIVE_SECONDS else "stale",
            })
        self.send_json(200, {"trucks": trucks, "live_seconds": LIVE_SECONDS})

    def publish_truck_location(self):
        if not self.parse_truck_location():
            self.send_json(404, {"error": "Truck location endpoint not found."})
            return
        if not self.has_driver_access():
            self.send_json(401, {"error": "A valid driver token is required."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_json(400, {"error": "A valid Content-Length header is required."})
            return

        if content_length < 1:
            self.send_json(400, {"error": "A JSON location update is required."})
            return
        if content_length > MAX_BODY_BYTES:
            self.send_json(413, {"error": "Location update is too large."})
            return
        if self.headers.get_content_type() != "application/json":
            self.send_json(415, {"error": "Location updates must use application/json."})
            return

        try:
            data = json.loads(self.rfile.read(content_length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self.send_json(400, {"error": "Location update must contain valid JSON."})
            return
        if not isinstance(data, dict):
            self.send_json(400, {"error": "Location update must be a JSON object."})
            return

        latitude = data.get("latitude")
        longitude = data.get("longitude")
        accuracy = data.get("accuracy_m")
        estimated_arrival_at = data.get("estimated_arrival_at")
        neighborhood = data.get("neighborhood")
        if (
            isinstance(latitude, bool)
            or not isinstance(latitude, (int, float))
            or not math.isfinite(latitude)
            or not -90 <= latitude <= 90
            or isinstance(longitude, bool)
            or not isinstance(longitude, (int, float))
            or not math.isfinite(longitude)
            or not -180 <= longitude <= 180
        ):
            self.send_json(400, {"error": "A valid latitude and longitude are required."})
            return
        if accuracy is not None and (
            isinstance(accuracy, bool)
            or not isinstance(accuracy, (int, float))
            or not math.isfinite(accuracy)
            or not 0 <= accuracy <= 10_000
        ):
            self.send_json(400, {"error": "GPS accuracy must be between 0 and 10,000 metres."})
            return
        if estimated_arrival_at is not None and (
            isinstance(estimated_arrival_at, bool)
            or not isinstance(estimated_arrival_at, int)
            or not int(time.time()) < estimated_arrival_at <= int(time.time()) + 24 * 60 * 60
        ):
            self.send_json(400, {"error": "Estimated arrival must be a future timestamp within 24 hours."})
            return
        if neighborhood is not None and (
            not isinstance(neighborhood, str)
            or neighborhood not in NEIGHBORHOODS
        ):
            self.send_json(400, {"error": "Choose a supported collection neighbourhood."})
            return
        if estimated_arrival_at is not None and not neighborhood:
            self.send_json(400, {"error": "Select the neighbourhood for the estimated arrival."})
            return

        truck_id = self.parse_truck_location()
        updated_at = int(time.time())
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            connection.execute(
                """
                INSERT INTO truck_locations
                    (truck_id, latitude, longitude, accuracy_m, neighborhood, estimated_arrival_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(truck_id) DO UPDATE SET
                    latitude = excluded.latitude,
                    longitude = excluded.longitude,
                    accuracy_m = excluded.accuracy_m,
                    neighborhood = excluded.neighborhood,
                    estimated_arrival_at = excluded.estimated_arrival_at,
                    updated_at = excluded.updated_at
                """,
                (
                    truck_id,
                    float(latitude),
                    float(longitude),
                    float(accuracy) if accuracy is not None else None,
                    neighborhood,
                    estimated_arrival_at,
                    updated_at,
                ),
            )
            connection.commit()
        self.send_json(200, {"status": "ok", "truck_id": truck_id, "updated_at": updated_at})

    def do_DELETE(self):
        if not self.request_is_secure():
            self.send_json(426, {"error": "HTTPS is required for account and exchange data."})
            return
        truck_id = self.parse_truck_location()
        if not truck_id:
            self.send_json(404, {"error": "Truck location endpoint not found."})
            return
        if not self.has_driver_access():
            self.send_json(401, {"error": "A valid driver token is required."})
            return

        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            connection.execute("DELETE FROM truck_locations WHERE truck_id = ?", (truck_id,))
            connection.commit()
        self.send_json(200, {"status": "ok", "truck_id": truck_id})


def create_server(host, port, driver_token, database_path=DATABASE_PATH):
    if not driver_token:
        raise ValueError("Set BINGO_DRIVER_TOKEN to a private, random token before starting the server.")

    initialise_database(database_path)
    handler = type("ConfiguredBingoRequestHandler", (BingoRequestHandler,), {
        "driver_token": driver_token,
        "database_path": Path(database_path),
    })
    return ThreadingHTTPServer((host, port), handler)


def main():
    token = os.environ.get("BINGO_DRIVER_TOKEN", "")
    if not token:
        print(
            "BinGo cannot start without a private BINGO_DRIVER_TOKEN. "
            "See the README for setup instructions.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    host = os.environ.get("BINGO_HOST", "127.0.0.1")
    try:
        port = int(os.environ.get("PORT", "8000"))
    except ValueError:
        print("PORT must be a number between 1 and 65535.", file=sys.stderr)
        raise SystemExit(1)
    if not 1 <= port <= 65535:
        print("PORT must be a number between 1 and 65535.", file=sys.stderr)
        raise SystemExit(1)

    certificate_file = os.environ.get("BINGO_TLS_CERTFILE")
    private_key_file = os.environ.get("BINGO_TLS_KEYFILE")
    if bool(certificate_file) != bool(private_key_file):
        print(
            "Set both BINGO_TLS_CERTFILE and BINGO_TLS_KEYFILE to enable HTTPS.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    server = create_server(host, port, token)
    scheme = "http"
    if certificate_file and private_key_file:
        tls_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        try:
            tls_context.load_cert_chain(certificate_file, private_key_file)
        except (OSError, ssl.SSLError) as error:
            server.server_close()
            print("BinGo could not load the configured TLS certificate: %s" % error, file=sys.stderr)
            raise SystemExit(1)
        server.socket = tls_context.wrap_socket(server.socket, server_side=True)
        scheme = "https"
    print("BinGo server listening on {}://{}:{}.".format(scheme, host, port), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping BinGo server.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
