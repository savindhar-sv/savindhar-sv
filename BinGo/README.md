## Hi there 👋

<!--
**savindhar-sv/savindhar-sv** is a ✨ _special_ ✨ repository because its `README.md` (this file) appears on your GitHub profile.

Here are some ideas to get you started:

- 🔭 I’m currently working on ...
- 🌱 I’m currently learning ...
- 👯 I’m looking to collaborate on ...
- 🤔 I’m looking for help with ...
- 💬 Ask me about ...
- 📫 How to reach me: ...
- 😄 Pronouns: ...
- ⚡ Fun fact: ...
-->

## BinGo

BinGo is an installable, offline-capable app for a smart waste management and community reuse platform in Coimbatore. The responsive interface works on mobile phones, tablets, and laptops.

### Run locally

No build step or package installation is required. For the API-backed item exchange, truck locations, and impact metrics, run the included Python standard-library server:

```bash
BINGO_DRIVER_TOKEN=replace-with-a-private-random-token PORT=8000 /usr/bin/python3 server.py
```

Alternatively, with Node.js and npm installed, set a private driver token and use the package scripts:

```bash
export BINGO_DRIVER_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
npm start
npm test
```

The package scripts do not install Node dependencies; the server and tests use Python's standard library. The driver token is required to start the server and is for trusted vehicle devices only.

Then visit `http://localhost:8000`. To serve HTTPS directly, set both `BINGO_TLS_CERTFILE` and `BINGO_TLS_KEYFILE` to paths for a certificate and matching private key; the server will then accept HTTPS on that port. For local testing, use a self-signed certificate with `localhost` and `127.0.0.1` subject alternative names (browsers will show a trust warning until you explicitly trust the certificate). For a public site, use a certificate issued for the public hostname by a trusted CA. The driver token is for trusted vehicle devices only; never put it in browser code or share it with users. The default database is `data/bingo.sqlite3`; set `BINGO_DATABASE` to select another path. The default server binding is loopback-only.

For a public deployment, put the app behind a TLS-terminating HTTPS reverse proxy, bind the Python server only to a private interface, and set `BINGO_TRUST_PROXY=1` only when that proxy overwrites `X-Forwarded-Proto`. The app redirects public HTTP page requests to HTTPS and rejects public HTTP API writes. Set `BINGO_MONTHLY_PLATFORM_COST` to the monthly hosting/database/bandwidth bill in INR to calculate cost per active user. User access is free; no billing flow is included.

The GitHub Pages custom domain is `bingowaste.in` (configured by the repository-root `CNAME`). At the domain registrar, point the apex (`@`) to GitHub Pages with A records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, and `185.199.111.153`, and AAAA records `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, and `2606:50c0:8003::153`. Remove existing conflicting apex A/AAAA records. Optionally point `www` to `savindhar-sv.github.io` with a CNAME record. Enable **Enforce HTTPS** in the repository's Pages settings after DNS verification and certificate provisioning complete. DNS changes are made at the registrar; committing this configuration alone does not change registrar DNS.

### Supabase cloud database setup

Apply the migrations in order from **SQL Editor**: first `supabase/migrations/20261029173000_bingo_cloud_data.sql`, then `supabase/migrations/20261030120000_bingo_exchanges.sql`. Enable **Anonymous Sign-Ins** under Authentication settings. The schema covers neighborhood-only profiles, collection schedules, municipal drop-off pins, truck locations, item listings, requests, and encrypted exchange conversations. Listing photos use a private `listing-photos` Storage bucket. Row-level security limits listing changes and conversations to their participants; the neighborhood comes from each user's profile.

For local development, copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. The ignored `.env` in this checkout is configured for the current project. Restart the Python server after changing `.env`; it exposes only these public client settings through `/api/config`. The frontend uses Supabase's JavaScript client with the publishable key and relies on RLS; never use a `service_role` or secret key in browser code. The community listings, requests, messages, encryption keys, and diversion totals use Supabase. Reports, surveys, truck operations, and platform metrics continue to use the Python/SQLite API. Supabase client code loads from esm.sh, so the community features need an internet connection. Do not upload household GPS points or street addresses: profiles and item listings store only a neighborhood. Add only authoritative, verified CCMC schedules and map-pin coordinates.

On a supported browser, choose **Install app** to add BinGo to your device. On iPhone or iPad, open the site in Safari and choose **Add to Home Screen**. The static app shell is about 153 KiB (157 KB) before browser/runtime overhead, well below the 35 MB target. The responsive layout adapts to narrow phone viewports. The service worker caches only the static shell; maps and community APIs need a connection, while API responses are deliberately never cached.

The Explore, dashboard, report, and pickup-location maps use MapLibre with OpenStreetMap raster tiles centered near `11.0030, 76.9582` in Coimbatore. Maps display OpenStreetMap attribution and pickup pins use the verified drop-off records described above. Map views, truck locations, report pins, nearby places, and verified pickup points also offer links to open the corresponding location in Google Maps; this is a link-out integration and does not require the Google Maps JavaScript API. OSM tiles are loaded directly from `tile.openstreetmap.org`; normal browser caching and the page referrer are preserved. The public OSM tile service is best-effort, has no SLA, and can block excessive traffic. For a larger production audience, use an OSM-derived tile provider with an appropriate service plan or host tiles yourself. Truck locations refresh every 12 seconds while the app is open. **Enable truck alerts** asks for location permission after a tap, keeps the resident's exact coordinates on-device, and issues an in-app/browser notification when the truck is within 500 metres. Background delivery while the app is closed requires a separate push-notification service and is not included.

Collection schedules are loaded from `data/collection_schedule.json` (or the file named by `BINGO_COLLECTION_SCHEDULE_FILE`). Add only schedule information confirmed by CCMC; BinGo does not invent pickup days when the file is absent. Example format:

```json
{
  "schedules": [
    {
      "neighborhood": "RS Puram",
      "waste_type": "Household waste",
      "weekdays": ["Monday", "Thursday"],
      "pickup_window": "06:00-09:00",
      "source_url": "https://www.ccmc.gov.in/",
      "verified_at": "2026-10-27"
    }
  ]
}
```

The configured schedule is shown on the dashboard with its source link and verification date; operators are responsible for confirming the source and keeping it current. The official [CCMC solid-waste page](https://ccmc.gov.in/index.php/administration/solid-waste-management) currently lists service providers rather than ward pickup days, and its [waste-truck monitoring page](https://ccmc.gov.in/index.php/createpage/waste-truck-monitoring) says it is still under development. No official local timetable could therefore be populated without guessing. Explore shows color-coded, crowdsourced dumping reports alongside nearby drop-off locations. Report pins are explicitly marked unverified; the server rounds reported coordinates to 3 decimal places (about 100 metres) and does not expose report descriptions or reporter identities on the map. Reports are not an official CCMC complaint channel. Explore also includes neighbourhood-level map searches for CCMC MCCs, community bins, and environmental volunteer groups. **Use my GPS** requests browser permission only after the user taps it (GPS requires HTTPS or localhost). Nearby distances are approximate straight-line estimates and GPS is not sent to map-search links. Volunteering interest opens an email draft and is not an online NGO registration.

Verified official drop-off pins are optional and are not pre-populated. To configure them, create `data/verified_dropoffs.json` (or set `BINGO_DROPOFFS_FILE`) with this structure:

```json
{
  "dropoffs": [
    {
      "name": "Example municipal centre",
      "category": "mcc",
      "latitude": 11.014,
      "longitude": 76.968,
      "phone": "+914221234567",
      "source_url": "https://www.ccmc.gov.in/",
      "verified_at": "2026-10-27"
    }
  ]
}
```

Allowed categories are `mcc`, `dry_kiosk`, and `dustbin`. Entries must be in the Coimbatore bounding area, include an HTTPS source URL and verification date, and must be checked by the operator against an authoritative source before publication. The optional `phone` must be an internationally formatted `+` number and must also be verified by the operator. Configured facilities appear in the existing end-to-end encrypted user exchange chat as meetup suggestions with map directions; a **Call facility** link appears only when a verified facility phone is present. The chat is between the exchange participants, not a direct chat with facility staff. When no verified file is present, the API reports `not_configured`; the map must not be presented as containing official pins.

The giveaway feed supports Clothes, Books, E-Waste, and Furniture, as well as legacy categories for existing records. Listings take their location from the account's supported neighborhood selection; client-supplied addresses or coordinates are ignored. The API returns the neighborhood, not a street address or resident coordinates. Users should still avoid putting addresses or contact details in item titles, photos, or encrypted messages. Its `<1 km` and `<3 km` filters are **approximate distances between fixed neighborhood centers**, not item coordinates, walking routes, or GPS-derived distances. These prototype neighborhood centers are approximate UI reference points, not CCMC/OSM-verified boundaries. Listing locations remain neighborhood-only, and resident GPS is neither uploaded nor used by this filter. Diversion totals are illustrative category averages for completed exchanges (Books 2.0 kg, Clothes/Kids 1.0 kg, E-Waste/Electronics 1.5 kg, Furniture/Home goods 3.0 kg), not measured weights.

Exchange conversations offer suggested meetups at a busy public park, public community center, CCMC ward office, or another busy public place in the selected neighborhood. These are message prompts, not verified venue listings. Participants should agree on a specific public location, check that it is open and well-lit, and never share a home address.

An authorized driver can publish a neighborhood-specific estimated arrival with the truck location using `estimated_arrival_at` (a future Unix timestamp in seconds, up to 24 hours ahead) and `neighborhood`. The dashboard displays that estimate only when it matches the resident's selected neighborhood. Residents must enable alerts and grant browser permission; the page polls while open and can issue a foreground notification as the ETA enters the 15-minute window. This is not background push and cannot guarantee an alert if the app/browser is closed, suspended, or offline.

### Included prototype flows

- Collection dashboard with route status, eco points, impact chart, and community board
- Interactive navigation between home, map, donations, waste guide, reporting, activity, rewards, and the admin dashboard
- Responsive laptop and tablet sidebar; mobile navigation drawer and bottom navigation
- Map-style drop-off discovery view and donation marketplace
- Crowdsourced illegal-dumping reports with category-colored, privacy-rounded map pins and activity updates
- Three-field item listings (photo, title, category), with photos resized before upload
- Anonymous, neighbourhood-only listings and participant-restricted exchange messages encrypted in the browser with ECDH P-256 and AES-256-GCM
- Category-average landfill-diversion estimates after an exchange is marked complete (books 2.0 kg, home goods 3.0 kg, electronics 1.5 kg, kids 1.0 kg)
- Opt-in 1–5 visual clarity, icon readability, and layout appeal survey, with an anonymous aggregate response count targeting 10 testers
- Animated sorting lessons with quiz feedback and eco-point rewards

The server stores random anonymous session tokens as hashes and does not store residents' GPS coordinates. Item locations are neighbourhood labels. Report pins are rounded and descriptions are not publicly exposed, but reports are community-submitted and unverified. New exchange messages are encrypted in the browser with ECDH P-256 and AES-256-GCM; only ciphertext is stored by the server. Private keys are non-extractable and saved in browser storage, so users cannot recover them on a new device or after browser data is cleared. The prototype uses long-lived participant keys and does not provide forward secrecy. Compare the displayed peer-key fingerprint out of band to detect key substitution. This is not an independent cryptographic or network-traffic audit; it has not received a production security review and should not be used for highly sensitive conversations. TLS still protects other data in transit when deployed behind HTTPS. The category weights are illustrative averages, not measured transaction weights. The browser survey collects ratings but cannot itself recruit 10 people. Validate the visual survey with 10 Coimbatore residents, the under-60-second task with five participants, and responsive layout on five physical Android/iOS devices before claiming those acceptance tests pass. The local API tests cover encrypted-message delivery and exchange accounting, not production-scale availability or live field GPS. The community board's example listings remain prototype data.
