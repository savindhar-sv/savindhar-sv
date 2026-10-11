#!/usr/bin/env python3
"""BinGo's small, authenticated, SQLite-backed truck-location server."""

import hmac
import json
import math
import os
import re
import sqlite3
import sys
import time
from contextlib import closing
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


APP_DIRECTORY = Path(__file__).resolve().parent
DATABASE_PATH = Path(os.environ.get("BINGO_DATABASE", APP_DIRECTORY / "data" / "bingo.sqlite3"))
MAX_BODY_BYTES = 16 * 1024
LIVE_SECONDS = 90
MAX_POSITION_AGE_SECONDS = 24 * 60 * 60
TRUCK_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 -]{0,31}$")


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
                updated_at INTEGER NOT NULL
            )
            """
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
        super().end_headers()

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

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
        if route == "/api/health":
            self.send_json(200, {"status": "ok"})
            return
        if route == "/api/trucks":
            self.send_trucks()
            return
        super().do_GET()

    def send_trucks(self):
        now = int(time.time())
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                """
                SELECT truck_id, latitude, longitude, accuracy_m, updated_at
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
                "updated_at": row["updated_at"],
                "age_seconds": age_seconds,
                "status": "live" if age_seconds <= LIVE_SECONDS else "stale",
            })
        self.send_json(200, {"trucks": trucks, "live_seconds": LIVE_SECONDS})

    def do_POST(self):
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

        truck_id = self.parse_truck_location()
        updated_at = int(time.time())
        with closing(sqlite3.connect(str(self.database_path), timeout=5)) as connection:
            connection.execute(
                """
                INSERT INTO truck_locations (truck_id, latitude, longitude, accuracy_m, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(truck_id) DO UPDATE SET
                    latitude = excluded.latitude,
                    longitude = excluded.longitude,
                    accuracy_m = excluded.accuracy_m,
                    updated_at = excluded.updated_at
                """,
                (truck_id, float(latitude), float(longitude), float(accuracy) if accuracy is not None else None, updated_at),
            )
            connection.commit()
        self.send_json(200, {"status": "ok", "truck_id": truck_id, "updated_at": updated_at})

    def do_DELETE(self):
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

    server = create_server(host, port, token)
    print("BinGo server listening on {}:{}.".format(host, port), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping BinGo server.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
