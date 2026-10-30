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

### Free deployment and local preview

BinGo is a static web app and can be hosted free with GitHub Pages. It does not require a VPS, Python server, Node build, or paid hosting plan. The browser connects directly to Supabase using the project's publishable key; Supabase row-level security controls data access.

To preview locally, run `npm start` and open `http://localhost:3000` (or use `python3 -m http.server 8000` and open `http://localhost:8000`). For Hostinger Node.js hosting, use `server.js` as the entry file; there is no build command. For GitHub Pages or Hostinger PHP/HTML static hosting, upload the frontend files directly with `index.html` at the site root. To publish on GitHub Pages, push the repository, open **Settings → Pages**, choose **Deploy from a branch**, select the `main` branch and `/ (root)` folder, then save. The root `CNAME` already names `bingowaste.in`. Configure DNS as described below and enable **Enforce HTTPS** after GitHub Pages verifies the domain.

The GitHub Pages custom domain is `bingowaste.in` (configured by the repository-root `CNAME`). At the domain registrar, point the apex (`@`) to GitHub Pages with A records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, and `185.199.111.153`, and AAAA records `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, and `2606:50c0:8003::153`. Remove existing conflicting apex A/AAAA records, but keep any MX/TXT records used for email or domain verification. Optionally point `www` to `savindhar-sv.github.io` with a CNAME record. Enable **Enforce HTTPS** in the repository's Pages settings after DNS verification and certificate provisioning complete. DNS changes are made at the registrar; committing this configuration alone does not change registrar DNS.

### Supabase cloud database setup

Apply these migrations in order from **SQL Editor**: `20261029173000_bingo_cloud_data.sql`, `20261030120000_bingo_exchanges.sql`, then `20261030140000_bingo_static_features.sql`. Enable **Anonymous Sign-Ins** under Authentication settings. The schema covers neighborhood-only profiles, schedules, drop-off pins, truck-location reads, listings, requests, encrypted conversations, reports, and anonymous survey aggregates. Listing photos use a private `listing-photos` Storage bucket. Row-level security limits listing changes and conversations to their participants.

The browser settings are in `supabase-config.js`. Supabase publishable keys are intended for web apps; never put a `service_role` or secret key there. Listings, exchanges, encrypted messages, reports, surveys, schedules, drop-offs, truck-location reads, and impact totals use Supabase directly. Survey data is available only as an aggregate; report descriptions and reporter IDs are not exposed to map readers. Driver GPS publishing needs a trusted server or secured Edge Function and is disabled in this static version. Supabase JS loads from esm.sh, so cloud features need an internet connection. Do not upload household GPS points or street addresses; profiles and listings store only a neighborhood. Add only authoritative, verified CCMC schedules and map-pin coordinates.

On a supported browser, choose **Install app** to add BinGo to your device. On iPhone or iPad, open the site in Safari and choose **Add to Home Screen**. The responsive layout adapts to narrow phone viewports. The service worker caches the static app shell; maps and Supabase features need a connection.

The Explore, dashboard, report, and pickup-location maps use MapLibre with OpenStreetMap raster tiles centered near `11.0030, 76.9582` in Coimbatore. Maps display OpenStreetMap attribution and pickup pins use the verified drop-off records described above. Map views, truck locations, report pins, nearby places, and verified pickup points also offer links to open the corresponding location in Google Maps; this is a link-out integration and does not require the Google Maps JavaScript API. OSM tiles are loaded directly from `tile.openstreetmap.org`; normal browser caching and the page referrer are preserved. The public OSM tile service is best-effort, has no SLA, and can block excessive traffic. For a larger production audience, use an OSM-derived tile provider with an appropriate service plan or host tiles yourself. Truck locations refresh every 12 seconds while the app is open. **Enable truck alerts** asks for location permission after a tap, keeps the resident's exact coordinates on-device, and issues an in-app/browser notification when the truck is within 500 metres. Background delivery while the app is closed requires a separate push-notification service and is not included.

Collection schedules are read from Supabase's `collection_schedules` table. Add only schedule information confirmed by CCMC; BinGo does not invent pickup days when no verified row exists.

The configured schedule appears with its source link and verification date. The official [CCMC solid-waste page](https://ccmc.gov.in/index.php/administration/solid-waste-management) lists service providers rather than ward pickup days, and its [waste-truck monitoring page](https://ccmc.gov.in/index.php/createpage/waste-truck-monitoring) says it is under development. No official local timetable is preloaded. Explore shows color-coded community reports beside drop-off locations. Reports are unverified; pins are rounded to 3 decimal places (about 100 metres), and descriptions and reporter IDs are not exposed to map readers. Reports are not an official CCMC complaint channel. **Use my GPS** requests browser permission only after the user taps it (GPS requires HTTPS or localhost). Nearby distances are approximate and GPS is not sent to map-search links. Volunteering interest opens an email draft, not an online NGO registration.

Verified official drop-off pins are optional and are not pre-populated. Add locations to Supabase's `dropoff_locations` table only after checking each record against an authoritative source. Allowed categories are `mcc`, `dry_kiosk`, and `dustbin`; entries need Coimbatore-area coordinates, an HTTPS source URL, and a verification date.

Verified facilities can appear on the map and as meetup suggestions with directions. Do not publish unverified official pins.

The giveaway feed supports Clothes, Books, E-Waste, and Furniture, as well as legacy categories for existing records. Listings take their location from the account's supported neighborhood selection; client-supplied addresses or coordinates are ignored. Supabase returns the neighborhood, not a street address or resident coordinates. Users should avoid putting addresses or contact details in item titles, photos, or encrypted messages. Its `<1 km` and `<3 km` filters are **approximate distances between fixed neighborhood centers**, not item coordinates, walking routes, or GPS-derived distances. These prototype neighborhood centers are approximate UI reference points, not CCMC/OSM-verified boundaries. Listing locations remain neighborhood-only, and resident GPS is neither uploaded nor used by this filter. Diversion totals are illustrative category averages for completed exchanges (Books 2.0 kg, Clothes/Kids 1.0 kg, E-Waste/Electronics 1.5 kg, Furniture/Home goods 3.0 kg), not measured weights.

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

Anonymous users, profiles, reports, and listings are managed by Supabase. Item locations are neighbourhood labels. Report pins are rounded; reports are community-submitted and unverified. Exchange messages are encrypted in the browser with ECDH P-256 and AES-256-GCM; only ciphertext is stored in Supabase. Private keys are non-extractable and saved in browser storage, so users cannot recover them on a new device or after browser data is cleared. The prototype uses long-lived participant keys and does not provide forward secrecy. Compare the displayed peer-key fingerprint out of band to detect key substitution. This is not an independent cryptographic or network-traffic audit; it has not received a production security review and should not be used for highly sensitive conversations. TLS protects data in transit on the HTTPS site. Category weights are illustrative averages, not measured transaction weights. The browser survey collects ratings but cannot itself recruit 10 people. Validate the visual survey with 10 Coimbatore residents, the under-60-second task with five participants, and responsive layout on five physical Android/iOS devices before claiming those acceptance tests pass. The community board's example listings remain prototype data.
