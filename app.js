const views = document.querySelectorAll(".view");
const navItems = document.querySelectorAll("[data-view]");
const sidebar = document.querySelector(".sidebar");
const mobileMenu = document.querySelector(".mobile-menu");
const dialog = document.querySelector("#app-dialog");
const toast = document.querySelector(".toast");
const pointDisplays = document.querySelectorAll(".points-total");
const pointsKey = "bingo-eco-points";
const startingPoints = 1240;
const liveTruckMarker = document.getElementById("live-truck-marker");
const truckStatusCopy = document.querySelector(".truck-status-copy");
const shareGpsButton = document.getElementById("share-gps-button");
const truckBounds = { minLat: 10.92, maxLat: 11.14, minLng: 76.84, maxLng: 77.02 };
const truckId = "TN 37 AB 4812";

let points = Number(window.localStorage.getItem(pointsKey)) || startingPoints;
let toastTimeout;
let quizQuestion = 0;
let quizScore = 0;
let deferredInstallPrompt;

function toMapPosition(latitude, longitude) {
  const left = ((longitude - truckBounds.minLng) / (truckBounds.maxLng - truckBounds.minLng)) * 100;
  const top = ((truckBounds.maxLat - latitude) / (truckBounds.maxLat - truckBounds.minLat)) * 100;
  return { left: Math.min(90, Math.max(10, left)), top: Math.min(75, Math.max(18, top)) };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRadians = degrees => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function setTruckStatus(truck) {
  if (!truck || !liveTruckMarker || !truckStatusCopy) {
    return;
  }
  const store = { latitude: 11.018, longitude: 76.961 };
  const distanceKm = haversineKm(store.latitude, store.longitude, truck.latitude, truck.longitude);
  const position = toMapPosition(truck.latitude, truck.longitude);
  liveTruckMarker.style.left = `${position.left}%`;
  liveTruckMarker.style.top = `${position.top}%`;
  const label = Number.isFinite(distanceKm) ? `${distanceKm.toFixed(1)} km away` : "location updated";
  truckStatusCopy.innerHTML = `Truck <strong>${truck.id || truckId}</strong> · ${label}`;
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
    const fallback = { id: truckId, latitude: 11.018, longitude: 76.961 };
    setTruckStatus(fallback);
    truckStatusCopy.innerHTML = `Truck <strong>${truckId}</strong> · awaiting live GPS`;
  } catch (error) {
    if (truckStatusCopy) {
      truckStatusCopy.innerHTML = `Truck <strong>${truckId}</strong> · waiting for live GPS`;
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
  document.querySelector(".mini-profile small").textContent = `${points.toLocaleString("en-IN")} eco points`;
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

refreshTruckLocations();
window.setInterval(refreshTruckLocations, 12000);

if ("serviceWorker" in navigator && ["https:", "localhost"].some(host => window.location.hostname === host || window.location.hostname.endsWith(`.${host}`))) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.error("BinGo could not register its offline support:", error);
    });
  });
}
