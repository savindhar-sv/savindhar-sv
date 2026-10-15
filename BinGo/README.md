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

No build step or package installation is required. The interactive maps load MapLibre GL JS and map tiles from the internet. For app installation and offline caching of the app shell, serve the folder over `localhost` or HTTPS:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

On a supported browser, choose **Install app** to add BinGo to your device. On iPhone or iPad, open the site in Safari and choose **Add to Home Screen**. Once the app has loaded online, its screens and assets are available offline.

The app uses a service worker and browser storage for offline caching and eco points. Maps require an internet connection and are not available offline. Clear the site's storage in your browser settings to reset its locally saved points.

The Explore and dashboard panels use interactive MapLibre maps centered near `11.0140672, 76.9683931` in Coimbatore. The live truck marker appears when the GPS backend has a current truck location.

Explore includes the composting/organic suppliers and e-waste services supplied for Coimbatore, plus Google Maps searches for CCMC MCCs, community bins, and environmental volunteer groups. **Use my GPS** requests browser permission only after the user taps it (GPS requires HTTPS or localhost). Nearby distances are approximate straight-line estimates based on the available locality-level coordinates; Google Maps directions links can be opened for routing. Volunteering interest opens an email draft and is not an online NGO registration.

### Included prototype flows

- Collection dashboard with route status, eco points, impact chart, and community board
- Interactive navigation between home, map, donations, waste guide, reporting, activity, rewards, and the admin dashboard
- Responsive laptop and tablet sidebar; mobile navigation drawer and bottom navigation
- Map-style drop-off discovery view and donation marketplace
- Illegal dumping reports with photo attachment, required description, and activity updates
- Filterable donation listings, item requests, and a working item-sharing form
- Animated sorting lessons with quiz feedback and eco-point rewards

The prototype uses mock collection, map, community, and admin data intentionally. Its report photo, donations, and eco-point balance are local prototype interactions, not cloud-synchronised. For production deployment, connect cloud authentication and storage, notifications, map services, AI classification, and the admin application.
