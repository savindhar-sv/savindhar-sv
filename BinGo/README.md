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

Then visit `http://localhost:8000`. The driver token is for trusted vehicle devices only; never put it in browser code or share it with users. The default database is `data/bingo.sqlite3`; set `BINGO_DATABASE` to select another path. The default server binding is loopback-only.

For a public deployment, put the app behind a TLS-terminating HTTPS reverse proxy, bind the Python server only to a private interface, and set `BINGO_TRUST_PROXY=1` only when that proxy overwrites `X-Forwarded-Proto`. The app redirects public HTTP page requests to HTTPS and rejects public HTTP API writes. Set `BINGO_MONTHLY_PLATFORM_COST` to the monthly hosting/database/bandwidth bill in INR to calculate cost per active user. User access is free; no billing flow is included.

On a supported browser, choose **Install app** to add BinGo to your device. On iPhone or iPad, open the site in Safari and choose **Add to Home Screen**. The static app shell is about 153 KiB (157 KB) before browser/runtime overhead, well below the 35 MB target. The responsive layout adapts to narrow phone viewports. The service worker caches only the static shell; maps and community APIs need a connection, while API responses are deliberately never cached.

The Explore and dashboard panels use MapLibre maps centered near `11.0140672, 76.9683931` in Coimbatore. MapLibre and map tiles are CDN-loaded. Truck locations refresh every 12 seconds while the app is open. **Enable truck alerts** asks for location permission after a tap, keeps the resident's exact coordinates on-device, and issues an in-app/browser notification when the truck is within 500 metres. Background delivery while the app is closed requires a separate push-notification service and is not included.

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
