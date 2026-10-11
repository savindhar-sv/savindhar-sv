const views = document.querySelectorAll(".view");
const navItems = document.querySelectorAll("[data-view]");
const sidebar = document.querySelector(".sidebar");
const mobileMenu = document.querySelector(".mobile-menu");
const dialog = document.querySelector("#app-dialog");
const toast = document.querySelector(".toast");
const pointDisplays = document.querySelectorAll(".points-total");
const pointsKey = "bingo-eco-points";
const startingPoints = 1240;
const liveTruckMarkers = document.querySelectorAll(".live-truck-marker");
const truckStatusCopy = document.querySelector(".truck-status-copy");
const shareGpsButton = document.getElementById("share-gps-button");
const mapCenter = { latitude: 11.0140672, longitude: 76.9683931 };
const mapZoom = 14;
const truckId = "TN 37 AB 4812";

let points = Number(window.localStorage.getItem(pointsKey)) || startingPoints;
let toastTimeout;
let quizQuestion = 0;
let quizScore = 0;
let deferredInstallPrompt;
let currentTruckLocation = null;
let userCoordinates = null;

const nearbyPlaces = [
  {
    name: "Dharani Recyclers",
    kind: "E-waste",
    category: "ewaste",
    address: "No: 1A, Lala Mahal Road, PM Samy Colony, Gandhipuram, Coimbatore",
    details: "Used electronics, computers, UPS units, and batteries · +91 91714 50039",
    latitude: 11.0184,
    longitude: 76.9668
  },
  {
    name: "Techazar E-Cyclers Pvt. Ltd.",
    kind: "E-waste",
    category: "ewaste",
    address: "No. 15, Mother India Industrial Estate, Seerapalayam Link Road, Malumichampatti",
    details: "EPR-authorized e-waste management · R.S. Puram branch also listed",
    latitude: 10.902,
    longitude: 77.012
  },
  {
    name: "Green Era Recyclers",
    kind: "E-waste",
    category: "ewaste",
    address: "SF No. 91/1B, Sai Keerthi Industrial Estate, Bodipalayam, Seerapalayam",
    details: "E-waste collection and IT asset disposition",
    latitude: 10.944,
    longitude: 76.91
  },
  {
    name: "Cercle X",
    kind: "E-waste & recycling",
    category: "ewaste",
    address: "Eachanari, Coimbatore",
    details: "Waste management and recycling services · +91 96404 96454",
    latitude: 10.963,
    longitude: 77.014
  },
  {
    name: "Green India Recyclers",
    kind: "E-waste",
    category: "ewaste",
    address: "Kovilpalayam Road, Sulakkal Village, Kinathukadavu Taluk",
    details: "Pollution-control-compliant e-waste disposal",
    latitude: 10.83,
    longitude: 77.08
  },
  {
    name: "SS E-Waste Buyer / Pickmyscraps",
    kind: "E-waste",
    category: "ewaste",
    address: "Kurichi Round Road, Sundarapuram / Madukkarai, Coimbatore",
    details: "Doorstep pickup and exchange for cables, appliances, and scrap",
    latitude: 10.947,
    longitude: 76.966
  },
  {
    name: "SS Vermicompost Sales Center",
    kind: "Compost & organic supplies",
    category: "compost",
    address: "73, Duraisamy Nagar, Thottipalayam Pirivu, Goldwins",
    details: "Vermicompost, neem cake, and organic agricultural inputs",
    latitude: 11.053,
    longitude: 77.039
  },
  {
    name: "Future Organic System",
    kind: "Compost & organic supplies",
    category: "compost",
    address: "Siddhapudur, Coimbatore",
    details: "Organic gardening supplies and bulk vermicompost",
    latitude: 11.023,
    longitude: 76.969
  },
  {
    name: "Nothing is Waste",
    kind: "Composting service",
    category: "compost",
    address: "Kuniyamuthur, Coimbatore",
    details: "Community composting and at-source composting systems",
    latitude: 10.959,
    longitude: 76.953
  },
  {
    name: "Jeeva Eco Farm",
    kind: "Organic farm & compost",
    category: "compost",
    address: "Solai Thottam, Pappampatti Pirivu, Trichy Road",
    details: "Organic farm; contact the venue to confirm compost availability",
    latitude: 10.958,
    longitude: 77.08
  },
  {
    name: "CCMC Micro Composting Centres",
    kind: "Municipal composting",
    category: "compost",
    address: "Decentralized centres across Coimbatore; select the nearest centre on the map",
    details: "CCMC decentralized wet-waste composting under the Smart Cities Mission · confirm each centre and accepted waste",
    searchOnly: true
  },
  {
    name: "Community bins & recycling points",
    kind: "Community bins",
    category: "bins",
    address: "Coimbatore City Municipal Corporation area",
    details: "Search current public bin locations near your position",
    searchOnly: true
  },
  {
    name: "Coimbatore Cares",
    kind: "Community / NGO listing",
    category: "ngo",
    address: "Coimbatore; this name appears in the prototype and needs independent verification",
    details: "Check the current organization, address, and volunteering programme on the map before joining",
    searchOnly: true
  },
  {
    name: "Green Coimbatore",
    kind: "Environmental community group",
    category: "ngo",
    address: "Coimbatore; this name appears in the prototype and needs independent verification",
    details: "Search for current local waste and environmental volunteer opportunities",
    searchOnly: true
  },
  {
    name: "Waste-management NGOs & environmental groups",
    kind: "Volunteer opportunities",
    category: "ngo",
    address: "Coimbatore",
    details: "Find current local groups and confirm their volunteer programmes directly",
    searchOnly: true
  }
];

function mercatorY(latitude) {
  const limitedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const sine = Math.sin((limitedLatitude * Math.PI) / 180);
  return (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * 256 * 2 ** mapZoom;
}

function updateTruckMarkers(truck) {
  liveTruckMarkers.forEach(marker => {
    const map = marker.closest(".map");
    if (!truck || !map || !map.clientWidth || !map.clientHeight) {
      marker.hidden = true;
      return;
    }
    const worldSize = 256 * 2 ** mapZoom;
    let longitudeDelta = truck.longitude - mapCenter.longitude;
    if (longitudeDelta > 180) longitudeDelta -= 360;
    if (longitudeDelta < -180) longitudeDelta += 360;
    const horizontalOffset = (longitudeDelta / 360) * worldSize;
    const verticalOffset = mercatorY(truck.latitude) - mercatorY(mapCenter.latitude);
    const left = 50 + (horizontalOffset / map.clientWidth) * 100;
    const top = 50 + (verticalOffset / map.clientHeight) * 100;
    marker.hidden = left < 2 || left > 98 || top < 2 || top > 98;
    marker.style.left = `${left}%`;
    marker.style.top = `${top}%`;
  });
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRadians = degrees => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearbySearchUrl(place) {
  const location = userCoordinates
    ? `${userCoordinates.latitude},${userCoordinates.longitude}`
    : `${mapCenter.latitude},${mapCenter.longitude}`;
  const query = place.searchOnly
    ? `${place.name} ${place.kind} near ${location}`
    : `${place.name}, ${place.address}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function nearbyDirectionsUrl(place) {
  if (!userCoordinates || place.searchOnly) {
    return "";
  }
  const origin = `${userCoordinates.latitude},${userCoordinates.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(`${place.name}, ${place.address}`)}&travelmode=driving`;
}

function renderNearbyPlaces(category = "all") {
  const list = document.querySelector("#nearby-place-results");
  const count = document.querySelector("#nearby-place-count");
  if (!list || !count) {
    return;
  }
  const places = nearbyPlaces
    .filter(place => category === "all" || place.category === category)
    .map(place => ({
      ...place,
      distanceKm: userCoordinates && !place.searchOnly
        ? haversineKm(userCoordinates.latitude, userCoordinates.longitude, place.latitude, place.longitude)
        : null
    }))
    .sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return 0;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });

  count.textContent = userCoordinates
    ? `${places.filter(place => place.distanceKm !== null).length} places with approximate distances`
    : `${places.length} places and local searches`;
  list.replaceChildren();

  places.forEach(place => {
    const card = document.createElement("article");
    card.className = "nearby-place";
    const header = document.createElement("div");
    header.className = "nearby-place-header";
    const title = document.createElement("h3");
    title.textContent = place.name;
    const kind = document.createElement("span");
    kind.className = "nearby-kind";
    kind.textContent = place.kind;
    header.append(title, kind);

    const address = document.createElement("p");
    address.textContent = place.address;
    const details = document.createElement("p");
    details.className = "nearby-details";
    details.textContent = place.details;
    const distance = document.createElement("p");
    distance.className = "nearby-distance";
    distance.textContent = place.distanceKm === null
      ? (place.searchOnly ? "Exact centre/location varies; search nearby on the map." : "Use GPS to see an approximate distance.")
      : `About ${place.distanceKm.toFixed(1)} km away in a straight line · area-level estimate`;

    const actions = document.createElement("div");
    actions.className = "nearby-actions";
    const mapLink = document.createElement("a");
    mapLink.className = "secondary-button";
    mapLink.href = nearbySearchUrl(place);
    mapLink.target = "_blank";
    mapLink.rel = "noopener noreferrer";
    mapLink.textContent = "View on map ↗";
    actions.append(mapLink);

    const directionsUrl = nearbyDirectionsUrl(place);
    if (directionsUrl) {
      const directions = document.createElement("a");
      directions.className = "primary-button";
      directions.href = directionsUrl;
      directions.target = "_blank";
      directions.rel = "noopener noreferrer";
      directions.textContent = "Directions";
      actions.append(directions);
    }

    if (place.category === "ngo") {
      const joinLink = document.createElement("a");
      joinLink.className = "nearby-join-link";
      joinLink.href = `mailto:savindhar@manchesters.in?subject=${encodeURIComponent(`Volunteer with ${place.name}`)}&body=${encodeURIComponent("Hello, I would like information about joining a waste-management or environmental volunteer group in Coimbatore.")}`;
      joinLink.textContent = "Ask about joining ↗";
      actions.append(joinLink);
    }

    card.append(header, address, details, distance, actions);
    list.append(card);
  });
}

function initialiseNearbyDirectory() {
  const placeList = document.querySelector(".place-list");
  if (!placeList) {
    return;
  }
  placeList.innerHTML = `
    <div class="nearby-directory-heading">
      <div><strong>Nearby waste &amp; reuse</strong><small id="nearby-place-count"></small></div>
      <button class="primary-button" id="use-gps-button" type="button">Use my GPS</button>
    </div>
    <p class="nearby-privacy">GPS permission is requested only when tapped (GPS requires HTTPS or localhost). Coordinates are used in this browser; Google Maps receives them only if you open a map search or directions link.</p>
    <label class="nearby-filter-label" for="nearby-category-filter">Show</label>
    <select class="input nearby-filter" id="nearby-category-filter">
      <option value="all">All nearby options</option>
      <option value="compost">Compost hubs &amp; MCCs</option>
      <option value="ewaste">E-waste recycling</option>
      <option value="bins">Community bins</option>
      <option value="ngo">NGOs &amp; volunteering</option>
    </select>
    <div class="nearby-distance-note">Approximate straight-line distances use the supplied address/locality, not a verified entrance pin. Use map/directions to confirm.</div>
    <div class="nearby-place-results" id="nearby-place-results" aria-live="polite"></div>`;

  const filter = document.querySelector("#nearby-category-filter");
  filter.addEventListener("change", () => renderNearbyPlaces(filter.value));
  document.querySelector("#use-gps-button").addEventListener("click", () => {
    const status = document.querySelector("#nearby-place-count");
    if (!navigator.geolocation) {
      status.textContent = "This browser does not support GPS. Map searches are still available.";
      return;
    }
    status.textContent = "Requesting location permission…";
    navigator.geolocation.getCurrentPosition(
      position => {
        userCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        renderNearbyPlaces(filter.value);
        status.textContent = `${nearbyPlaces.filter(place => !place.searchOnly).length} approximate distances · GPS active`;
        notify("Your location was used to sort nearby options.");
      },
      error => {
        const messages = {
          1: "Location permission was denied. Allow it in your browser settings to sort by distance.",
          2: "Your location is unavailable right now. Try again or use the map links.",
          3: "Getting your location timed out. Try again."
        };
        status.textContent = messages[error.code] || "Could not get your location. Try again.";
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
  renderNearbyPlaces();
}

function setTruckStatus(truck) {
  if (!truck || !truckStatusCopy) {
    return;
  }
  currentTruckLocation = truck;
  updateTruckMarkers(truck);
  const distanceKm = haversineKm(mapCenter.latitude, mapCenter.longitude, truck.latitude, truck.longitude);
  const label = Number.isFinite(distanceKm) ? `${distanceKm.toFixed(1)} km from map centre` : "location updated";
  truckStatusCopy.textContent = `Truck ${truck.id || truckId} · ${label}`;
}

async function refreshTruckLocations() {
  try {
    const response = await fetch("/api/trucks", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Truck tracking service unavailable");
    }
    const payload = await response.json();
    const fleet = Array.isArray(payload?.trucks) ? payload.trucks : [];
    const matchingTruck = fleet.find(truck => truck.id === truckId) || fleet[0];
    if (matchingTruck) {
      setTruckStatus(matchingTruck);
      return;
    }
    currentTruckLocation = null;
    updateTruckMarkers(null);
    truckStatusCopy.textContent = `Truck ${truckId} · awaiting live GPS`;
  } catch (error) {
    currentTruckLocation = null;
    updateTruckMarkers(null);
    if (truckStatusCopy) {
      truckStatusCopy.textContent = `Truck ${truckId} · waiting for live GPS`;
    }
    console.warn("Unable to sync truck GPS:", error);
  }
}

async function shareTruckLocationFromPhone() {
  if (!navigator.geolocation) {
    notify("This browser cannot share live GPS coordinates.");
    return;
  }

  const truckForm = document.createElement("form");
  truckForm.innerHTML = `
    <div class="dialog-form">
      <label>Truck ID
        <input class="input" name="truckId" value="${truckId}" required>
      </label>
      <label>Driver token
        <input class="input" name="token" type="password" value="test-driver-token" placeholder="Paste your private driver token" required>
      </label>
      <button class="primary-button" type="submit">Share live position</button>
    </div>`;

  openDialog("Share live truck GPS", "Use the driver phone to send the route team’s current coordinates to the app.", truckForm.innerHTML, () => {
    const form = dialog.querySelector("form");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const formData = new FormData(form);
      const truckName = String(formData.get("truckId") || truckId).trim();
      const token = String(formData.get("token") || "").trim();
      if (!truckName || !token) {
        notify("Add a valid truck ID and driver token.");
        return;
      }

      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 10000
          });
        });
        const payload = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy || 0
        };
        const response = await fetch(`/api/trucks/${encodeURIComponent(truckName)}/location`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.error || "Unable to update GPS");
        }
        dialog.close();
        notify(`Live GPS updated for ${truckName}.`);
        await refreshTruckLocations();
      } catch (error) {
        notify(error.message || "GPS sharing failed.");
      }
    });
  });
}

dialog.addEventListener("click", event => {
  if (event.target === dialog) {
    dialog.close();
  }
});

function updatePoints(amount) {
  points += amount;
  window.localStorage.setItem(pointsKey, String(points));
  pointDisplays.forEach(display => {
    display.textContent = points.toLocaleString("en-IN");
  });
  document.querySelector(".profile-points").textContent = points.toLocaleString("en-IN");
  const levelPoints = 1500;
  const pointsRemaining = Math.max(0, levelPoints - points);
  document.querySelector(".level-progress > .progress span").style.width =
    `${Math.min(100, points / levelPoints * 100)}%`;
  document.querySelector(".level-progress > small").innerHTML =
    pointsRemaining ? `${pointsRemaining.toLocaleString("en-IN")} points to <b>Green Citizen</b>` : "<b>Green Citizen unlocked!</b>";
  document.querySelector(".big-points strong").textContent = points.toLocaleString("en-IN");
}

updatePoints(0);

function setMenuOpen(isOpen) {
  sidebar.classList.toggle("open", isOpen);
  mobileMenu.setAttribute("aria-expanded", String(isOpen));
  mobileMenu.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  document.body.classList.toggle("menu-open", isOpen);
}

function showView(name, { updateHistory = false, scroll = true } = {}) {
  const target = document.querySelector(`#view-${CSS.escape(name)}`);
  if (!target) {
    return;
  }

  views.forEach(view => view.classList.toggle("active-view", view === target));
  updateTruckMarkers(currentTruckLocation);
  navItems.forEach(item => {
    const isCurrent = item.dataset.view === name;
    item.classList.toggle("active", isCurrent);
    if (isCurrent) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  });
  setMenuOpen(false);

  if (updateHistory && window.location.hash !== `#${name}`) {
    window.history.pushState({ view: name }, "", `#${name}`);
  }
  if (scroll) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

navItems.forEach(item => {
  item.addEventListener("click", () => showView(item.dataset.view, { updateHistory: true }));
});

window.addEventListener("popstate", () => {
  showView(window.location.hash.slice(1) || "home", { scroll: false });
});

mobileMenu.addEventListener("click", () => {
  setMenuOpen(!sidebar.classList.contains("open"));
});

document.addEventListener("click", event => {
  if (sidebar.classList.contains("open") && !sidebar.contains(event.target) && !mobileMenu.contains(event.target)) {
    setMenuOpen(false);
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    setMenuOpen(false);
  }
});

if (window.location.hash) {
  showView(window.location.hash.slice(1), { scroll: false });
}

const dateElement = document.querySelector("#today-date");
dateElement.textContent = new Intl.DateTimeFormat("en", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
}).format(new Date()).toUpperCase();

document.querySelector(".notification-button").addEventListener("click", () => {
  notify("You’re all caught up ✨");
});

shareGpsButton?.addEventListener("click", shareTruckLocationFromPhone);
document.getElementById("broadcast-update-button")?.addEventListener("click", () => {
  notify("Route update sent to all nearby residents.");
});

function notify(message) {
  if (preferences?.notifications === false) {
    return;
  }
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function setActivePill(pill) {
  pill.parentElement.querySelectorAll(".pill").forEach(item => {
    const isActive = item === pill;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-pressed", String(isActive));
  });
}

document.querySelectorAll(".category-pills").forEach(group => {
  group.querySelectorAll(".pill").forEach(pill => {
    pill.setAttribute("aria-pressed", String(pill.classList.contains("active")));
    pill.addEventListener("click", () => {
      setActivePill(pill);
      if (!group.classList.contains("report-pills")) {
        filterDonations(pill.textContent.trim());
      }
    });
  });
});

function filterDonations(category) {
  document.querySelectorAll(".donation-card").forEach(card => {
    card.hidden = category !== "All items" && card.dataset.category !== category;
  });
}

function openDialog(title, description, content, onOpen) {
  dialog.innerHTML = `
    <div class="dialog-heading">
      <div><p class="eyebrow">BINGO COMMUNITY</p><h2 id="dialog-title">${title}</h2><p class="dialog-description">${description}</p></div>
      <button class="dialog-close" type="button" aria-label="Close dialog">×</button>
    </div>
    <div class="dialog-body">${content}</div>`;
  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.showModal();
  onOpen?.();
}

const profileKey = "bingo-profile";
const preferencesKey = "bingo-preferences";
const defaultProfile = { name: "Ananya Krishnan", email: "" };
const defaultPreferences = { appearance: "system", notifications: true, neighborhood: "RS Puram" };

function readStoredObject(key, fallback) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "null");
    return value && typeof value === "object" && !Array.isArray(value) ? { ...fallback, ...value } : fallback;
  } catch (error) {
    console.warn(`Unable to read ${key} from local storage:`, error);
    return fallback;
  }
}

let profile = readStoredObject(profileKey, defaultProfile);
let preferences = readStoredObject(preferencesKey, defaultPreferences);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function getInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "U";
}

function renderProfile() {
  const name = profile.name || defaultProfile.name;
  document.querySelectorAll(".profile-name").forEach(element => {
    element.textContent = name;
  });
  const greetingName = document.querySelector(".greeting-name");
  if (greetingName) {
    greetingName.textContent = name.split(/\s+/)[0];
  }
  document.querySelectorAll(".profile-initials").forEach(element => {
    element.textContent = getInitials(name);
  });
  document.querySelectorAll(".profile-button").forEach(button => {
    button.setAttribute("aria-label", `Open profile settings for ${name}`);
  });
}

function savePreferences() {
  window.localStorage.setItem(preferencesKey, JSON.stringify(preferences));
  const useDarkMode = preferences.appearance === "dark" ||
    (preferences.appearance === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.classList.toggle("dark-mode", useDarkMode);
  document.documentElement.dataset.appearance = preferences.appearance;
  const locationName = document.querySelector(".location-pill strong");
  if (locationName) {
    locationName.textContent = preferences.neighborhood || defaultPreferences.neighborhood;
  }
}

function openProfileSettings() {
  setMenuOpen(false);
  openDialog("Your profile", "Update the name and email saved on this device.", `
    <form class="dialog-form" id="profile-form">
      <label>Display name<input class="input" name="name" required maxlength="60" value="${escapeHtml(profile.name || defaultProfile.name)}"></label>
      <label>Email address<input class="input" name="email" type="email" maxlength="254" value="${escapeHtml(profile.email || "")}" placeholder="you@example.com"></label>
      <button class="primary-button" type="submit">Save profile</button>
    </form>`, () => {
    const form = dialog.querySelector("#profile-form");
    form.addEventListener("submit", event => {
      event.preventDefault();
      const formData = new FormData(form);
      profile = {
        name: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim()
      };
      if (!profile.name) {
        form.elements.name.reportValidity();
        return;
      }
      window.localStorage.setItem(profileKey, JSON.stringify(profile));
      renderProfile();
      dialog.close();
      notify("Profile saved on this device.");
    });
  });
}

function openSettings() {
  setMenuOpen(false);
  openDialog("Settings", "Manage your profile, appearance, activity, and app preferences on this device.", `
    <form class="dialog-form" id="settings-form">
      <p class="settings-section-title">Profile</p>
      <label>Display name<input class="input" name="name" required maxlength="60" value="${escapeHtml(profile.name || defaultProfile.name)}"></label>
      <label>Email address<input class="input" name="email" type="email" maxlength="254" value="${escapeHtml(profile.email || "")}" placeholder="you@example.com"></label>
      <p class="settings-section-title">App preferences</p>
      <label>Neighborhood
        <select class="input" name="neighborhood">
          <option>RS Puram</option>
          <option>Saibaba Colony</option>
          <option>Gandhipuram</option>
          <option>Race Course</option>
        </select>
      </label>
      <label>Appearance
        <select class="input" name="appearance">
          <option value="system">Use device setting</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <label class="setting-toggle"><span><strong>Notifications</strong><small>Show in-app updates and confirmations</small></span>
        <input name="notifications" type="checkbox">
      </label>
      <button class="primary-button" type="submit">Save settings</button>
      <div class="settings-actions">
        <button class="secondary-button" id="activity-settings-button" type="button">View your activity</button>
        <button class="secondary-button" id="reset-points-button" type="button">Reset local app data</button>
      </div>
      <a class="settings-help" href="mailto:savindhar@manchesters.in?subject=BinGo%20app%20help">Need help? Email savindhar@manchesters.in</a>
    </form>`, () => {
    const form = dialog.querySelector("#settings-form");
    form.elements.appearance.value = ["system", "light", "dark"].includes(preferences.appearance)
      ? preferences.appearance
      : "system";
    form.elements.neighborhood.value = preferences.neighborhood || defaultPreferences.neighborhood;
    form.elements.notifications.checked = preferences.notifications !== false;
    form.addEventListener("submit", event => {
      event.preventDefault();
      const formData = new FormData(form);
      const updatedName = String(formData.get("name") || "").trim();
      if (!updatedName) {
        form.elements.name.reportValidity();
        return;
      }
      profile = {
        name: updatedName,
        email: String(formData.get("email") || "").trim()
      };
      preferences = {
        appearance: form.elements.appearance.value,
        notifications: form.elements.notifications.checked,
        neighborhood: form.elements.neighborhood.value
      };
      window.localStorage.setItem(profileKey, JSON.stringify(profile));
      savePreferences();
      renderProfile();
      dialog.close();
      notify("Settings saved.");
    });
    dialog.querySelector("#activity-settings-button").addEventListener("click", () => {
      dialog.close();
      showView("activity", { updateHistory: true });
    });
    dialog.querySelector("#reset-points-button").addEventListener("click", () => {
      if (!window.confirm("Reset your saved profile, preferences, and eco points on this device?")) {
        return;
      }
      profile = { ...defaultProfile };
      preferences = { ...defaultPreferences };
      points = startingPoints;
      window.localStorage.removeItem(profileKey);
      window.localStorage.removeItem(preferencesKey);
      updatePoints(0);
      renderProfile();
      savePreferences();
      dialog.close();
      notify("Local profile, settings, and points were reset.");
    });
  });
}

function openActionMenu(menu) {
  const options = {
    profile: {
      title: "Profile actions",
      description: "Quick links for your BinGo account.",
      actions: [
        ["profile", "Edit profile"],
        ["activity", "View your activity"],
        ["settings", "Open settings"]
      ]
    },
    impact: {
      title: "Your impact",
      description: "Explore your progress and rewards.",
      actions: [
        ["activity", "View activity"],
        ["rewards", "Explore eco rewards"],
        ["settings", "Open settings"]
      ]
    },
    community: {
      title: "Community board",
      description: "Choose what you’d like to do next.",
      actions: [
        ["donate", "Browse or share items"],
        ["explore", "Explore nearby places"],
        ["help", "Contact support"]
      ]
    }
  }[menu];
  if (!options) {
    console.error("Unknown action menu:", menu);
    return;
  }

  openDialog(options.title, options.description, `
    <div class="action-menu-list">
      ${options.actions.map(([action, label]) =>
        `<button class="secondary-button" type="button" data-menu-action="${action}">${label}<span aria-hidden="true">→</span></button>`
      ).join("")}
    </div>`, () => {
    dialog.querySelectorAll("[data-menu-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.dataset.menuAction;
        dialog.close();
        if (action === "profile") {
          openProfileSettings();
        } else if (action === "settings") {
          openSettings();
        } else if (action === "help") {
          window.location.href = "mailto:savindhar@manchesters.in?subject=BinGo%20app%20help";
        } else {
          showView(action, { updateHistory: true });
        }
      });
    });
  });
}

document.querySelectorAll(".profile-button").forEach(button => {
  button.addEventListener("click", openProfileSettings);
});
document.querySelector("#settings-button").addEventListener("click", openSettings);
document.querySelector("#profile-menu-button").addEventListener("click", () => {
  openActionMenu("profile");
});
document.querySelectorAll(".more-button").forEach(button => {
  button.addEventListener("click", () => openActionMenu(button.dataset.menu));
});
renderProfile();
savePreferences();

function createDonationCard({ title, category, description, owner = "You", distance = "Nearby" }) {
  const card = document.createElement("article");
  card.className = "donation-card";
  card.dataset.category = category;

  const photo = document.createElement("div");
  photo.className = `item-photo ${category === "Books" ? "photo-books" : category === "Home goods" ? "photo-chair" : "photo-toys"}`;
  const photoLabel = document.createElement("span");
  photoLabel.textContent = category.toUpperCase();
  photo.append(photoLabel);

  const details = document.createElement("div");
  details.className = "item-details";
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = category;
  const heading = document.createElement("h3");
  heading.textContent = title;
  const copy = document.createElement("p");
  copy.textContent = description;
  const footer = document.createElement("div");
  footer.className = "item-footer";
  const ownerAvatar = document.createElement("span");
  ownerAvatar.className = "avatar tiny";
  ownerAvatar.textContent = owner === "You" ? "AK" : "RM";
  const ownerName = document.createElement("small");
  ownerName.textContent = `${owner} · ${distance}`;
  const request = document.createElement("button");
  request.type = "button";
  request.textContent = "Request";
  request.addEventListener("click", () => {
    request.textContent = "Requested";
    request.disabled = true;
    notify("Request sent. You’ll get a chat notification soon.");
  });
  footer.append(ownerAvatar, ownerName, request);
  details.append(tag, heading, copy, footer);
  card.append(photo, details);
  return card;
}

document.querySelectorAll(".donation-card").forEach(card => {
  card.dataset.category = card.querySelector(".tag").textContent.trim();
  const favorite = card.querySelector(".item-photo b");
  const favoriteButton = document.createElement("button");
  favoriteButton.type = "button";
  favoriteButton.className = "favorite-button";
  favoriteButton.setAttribute("aria-label", `Save ${card.querySelector("h3").textContent}`);
  favoriteButton.setAttribute("aria-pressed", "false");
  favoriteButton.textContent = "♡";
  favoriteButton.addEventListener("click", () => {
    const isSaved = favoriteButton.getAttribute("aria-pressed") === "true";
    favoriteButton.setAttribute("aria-pressed", String(!isSaved));
    favoriteButton.textContent = isSaved ? "♡" : "♥";
    notify(isSaved ? "Item removed from your saved list." : "Item saved for later.");
  });
  favorite.replaceWith(favoriteButton);
  card.querySelector(".item-footer button").addEventListener("click", event => {
    const button = event.currentTarget;
    button.textContent = "Requested";
    button.disabled = true;
    notify("Request sent. You’ll get a chat notification soon.");
  });
});

document.querySelector("#post-item").addEventListener("click", () => {
  openDialog("Give an item", "Share something useful with a neighbour.", `
    <form id="donation-form" class="dialog-form">
      <label>Item name<input name="title" class="input" required maxlength="60" placeholder="e.g. A set of storybooks"></label>
      <label>Category<select name="category" class="input" required><option>Books</option><option>Home goods</option><option>Electronics</option><option>Kids</option></select></label>
      <label>Condition and details<textarea name="description" required maxlength="180" placeholder="Describe the item and how it can be collected"></textarea></label>
      <button class="primary-button" type="submit">Share with the community</button>
    </form>`, () => {
    const form = dialog.querySelector("#donation-form");
    form.addEventListener("submit", event => {
      event.preventDefault();
      const listing = Object.fromEntries(new FormData(form));
      const card = createDonationCard(listing);
      document.querySelector(".donation-grid").prepend(card);
      const allItems = document.querySelector(".category-pills .pill");
      setActivePill(allItems);
      filterDonations("All items");
      dialog.close();
      updatePoints(10);
      notify("Your item is now on the community board. +10 eco points");
    });
  });
});

const reportUpload = document.querySelector(".upload-box");
const photoInput = document.createElement("input");
photoInput.type = "file";
photoInput.accept = "image/*";
photoInput.capture = "environment";
photoInput.hidden = true;
photoInput.setAttribute("aria-label", "Choose a photo of the reported dumping");
reportUpload.append(photoInput);
reportUpload.querySelector(".secondary-button").addEventListener("click", () => photoInput.click());
photoInput.addEventListener("change", () => {
  const file = photoInput.files?.[0];
  if (file) {
    reportUpload.querySelector("small").textContent = file.name;
    notify("Photo attached to your report.");
  }
});

document.querySelector(".submit-report").addEventListener("click", () => {
  const description = document.querySelector(".report-card textarea");
  if (!description.value.trim()) {
    description.setCustomValidity("Add a short description before submitting your report.");
    description.reportValidity();
    description.addEventListener("input", () => description.setCustomValidity(""), { once: true });
    return;
  }

  const activity = document.querySelector(".activity-list");
  const row = document.createElement("div");
  row.className = "activity-row";
  const activityIcon = document.createElement("span");
  activityIcon.className = "activity-icon peach";
  activityIcon.textContent = "⚑";
  const activityContent = document.createElement("div");
  const activityTitle = document.createElement("strong");
  activityTitle.textContent = "Dumping report submitted";
  const activityDescription = document.createElement("small");
  activityDescription.textContent = `${description.value.trim()} · Just now`;
  activityContent.append(activityTitle, activityDescription);
  const activityPoints = document.createElement("b");
  activityPoints.textContent = "+50";
  row.append(activityIcon, activityContent, activityPoints);
  activity.prepend(row);
  const activityCount = document.querySelector(".nav-count");
  activityCount.textContent = String(Number(activityCount.textContent) + 1);
  description.value = "";
  updatePoints(50);
  notify("Report submitted — thank you for keeping Coimbatore clean! +50 points");
  window.setTimeout(() => showView("activity", { updateHistory: true }), 1200);
});

const quizItems = [
  { prompt: "Where should vegetable peelings go?", answer: "Wet waste", options: ["Wet waste", "Dry waste", "E-waste"] },
  { prompt: "Where should a clean cardboard box go?", answer: "Dry waste", options: ["Wet waste", "Dry waste", "Special waste"] },
  { prompt: "Where should an old mobile phone go?", answer: "E-waste", options: ["Wet waste", "Dry waste", "E-waste"] },
  { prompt: "Where should used batteries go?", answer: "E-waste", options: ["Wet waste", "Dry waste", "E-waste"] },
  { prompt: "Where should garden leaves go?", answer: "Wet waste", options: ["Wet waste", "Dry waste", "Special waste"] }
];

document.querySelector("#start-quiz").addEventListener("click", startQuiz);

function startQuiz() {
  quizQuestion = 0;
  quizScore = 0;
  showQuizQuestion();
}

function showQuizQuestion() {
  if (quizQuestion >= quizItems.length) {
    showQuizResult();
    return;
  }

  const item = quizItems[quizQuestion];
  openDialog(`Sorting challenge · ${quizQuestion + 1}/${quizItems.length}`, item.prompt, `
    <div class="quiz-options">${item.options.map(option => `<button type="button" class="quiz-option">${option}</button>`).join("")}</div>
    <p class="quiz-feedback" aria-live="polite"></p>`);

  dialog.querySelectorAll(".quiz-option").forEach(option => {
    option.addEventListener("click", () => {
      const isCorrect = option.textContent === item.answer;
      quizScore += Number(isCorrect);
      const feedback = dialog.querySelector(".quiz-feedback");
      feedback.textContent = isCorrect ? "That’s right! ♻" : `Not quite — this belongs in ${item.answer.toLowerCase()}.`;
      dialog.querySelectorAll(".quiz-option").forEach(button => {
        button.disabled = true;
        if (button.textContent === item.answer) {
          button.classList.add("correct");
        }
      });
      const next = document.createElement("button");
      next.className = "primary-button quiz-next";
      next.type = "button";
      next.textContent = quizQuestion === quizItems.length - 1 ? "See my results" : "Next item →";
      next.addEventListener("click", () => {
        quizQuestion += 1;
        showQuizQuestion();
      });
      dialog.querySelector(".dialog-body").append(next);
      if (!isCorrect) {
        option.classList.add("incorrect");
      }
    }, { once: true });
  });
}

function showQuizResult() {
  const earned = Math.round(50 * quizScore / quizItems.length);
  openDialog("Sorting superstar!", `You got ${quizScore} out of ${quizItems.length} items right.`, `
    <div class="quiz-result"><span>♻</span><strong>+${earned} eco points</strong><p>Keep sorting smarter for a cleaner Coimbatore.</p></div>
    <button type="button" class="primary-button quiz-next">Done</button>`);
  dialog.querySelector(".quiz-next").addEventListener("click", () => dialog.close());
  updatePoints(earned);
}

document.querySelectorAll(".join-button").forEach(button => {
  button.addEventListener("click", () => {
    button.textContent = button.textContent === "Joined" ? "Join" : "Joined";
    button.setAttribute("aria-pressed", String(button.textContent === "Joined"));
    notify(button.textContent === "Joined" ? "You’re in! See you at the clean-up drive." : "You’ve left the clean-up drive.");
  });
});

const installButton = document.querySelector(".install-button");
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    return;
  }
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
  if (outcome === "accepted") {
    notify("BinGo is ready on your device!");
  }
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.hidden = true;
  notify("BinGo installed successfully!");
});

initialiseNearbyDirectory();
refreshTruckLocations();
window.setInterval(refreshTruckLocations, 12000);
window.addEventListener("resize", () => {
  updateTruckMarkers(currentTruckLocation);
});

if ("serviceWorker" in navigator && ["https:", "localhost"].some(host => window.location.hostname === host || window.location.hostname.endsWith(`.${host}`))) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.error("BinGo could not register its offline support:", error);
    });
  });
}
