const views = document.querySelectorAll(".view");
const navItems = document.querySelectorAll("[data-view]");
const sidebar = document.querySelector(".sidebar");
const mobileMenu = document.querySelector(".mobile-menu");
const dialog = document.querySelector("#app-dialog");
const toast = document.querySelector(".toast");
const pointDisplays = document.querySelectorAll(".points-total");
const pointsKey = "bingo-eco-points";
const startingPoints = 1240;
const truckStatusCopy = document.querySelector(".truck-status-copy");
const shareGpsButton = document.getElementById("share-gps-button");
const mapCenter = { latitude: 11.0140672, longitude: 76.9683931 };
const neighborhoodCenters = {
  "RS Puram": { latitude: 11.010, longitude: 76.950 },
  Gandhipuram: { latitude: 11.0183, longitude: 76.9678 },
  "Saibaba Colony": { latitude: 11.0243, longitude: 76.9448 },
  "Race Course": { latitude: 11.0011, longitude: 76.978 },
  Coimbatore: mapCenter
};
const mapZoom = 14;
const truckId = "TN 37 AB 4812";
const liveTruckMarkers = [];
const hotspotMaps = [];
const dropoffMaps = [];
const sessionStorageKey = "bingo-session";

let communitySession = null;
let verifiedDropoffs = [];
let currentDonationCategory = "all";
let currentDonationRadius = "all";
let collectionScheduleDisplay = null;
let language = window.localStorage.getItem("bingo-language") === "ta" ? "ta" : "en";

const tamilTranslations = {
  "Good morning,": "காலை வணக்கம்,",
  "Small actions make a cleaner Coimbatore.": "சிறிய செயல்கள் கோயம்புத்தூரை தூய்மையாக்கும்.",
  "YOUR ECO POINTS": "உங்கள் பசுமைப் புள்ளிகள்",
  "TODAY’S COLLECTION": "இன்றைய சேகரிப்பு",
  "Waste pickup": "குப்பை சேகரிப்பு",
  "Schedule needed": "அட்டவணை தேவை",
  "Next collection": "அடுத்த சேகரிப்பு",
  "Not set": "அமைக்கப்படவில்லை",
  "A confirmed ward schedule is not connected yet.": "உறுதிப்படுத்தப்பட்ட வார்டு அட்டவணை இன்னும் இணைக்கப்படவில்லை.",
  "No verified collection days are configured for": "சரிபார்க்கப்பட்ட சேகரிப்பு நாட்கள் இல்லை:",
  "Weekly collection": "வாராந்திர சேகரிப்பு",
  "Schedule data loaded": "அட்டவணை ஏற்றப்பட்டது",
  "Schedule unavailable": "அட்டவணை கிடைக்கவில்லை",
  "Live route": "நேரடி வழித்தடம்",
  "Waiting for truck GPS": "குப்பை வண்டியின் GPS-க்காக காத்திருக்கிறது",
  "Enable alerts · 15 min ETA / 500 m": "எச்சரிக்கைகளை இயக்கு · 15 நிமிட வருகை / 500 மீ",
  "Track collection truck": "குப்பை வண்டியைப் பின்தொடர்",
  "Estimated community waste kept from Vellalore": "வெல்லலூர் குப்பைக் கிடங்குக்குச் செல்லாமல் தடுக்கப்பட்ட மதிப்பிடப்பட்ட சமூகக் கழிவு",
  "How can we help today?": "இன்று நாங்கள் எவ்வாறு உதவலாம்?",
  "Find a drop-off": "கழிவு ஒப்படைப்பு இடம்",
  "Bins, centres & NGOs": "தொட்டிகள், மையங்கள் மற்றும் தன்னார்வ அமைப்புகள்",
  "Report dumping": "குப்பை கொட்டுதலைப் புகாரளி",
  "Help keep our streets clean": "நமது தெருக்களைத் தூய்மையாக வைத்திருக்க உதவுங்கள்",
  "Give an item": "ஒரு பொருளை வழங்கு",
  "Someone nearby needs it": "அருகில் உள்ள ஒருவருக்கு இது தேவை",
  "Sort smarter": "சரியாகப் பிரிப்போம்",
  "Learn in under 3 minutes": "3 நிமிடங்களுக்குள் கற்றுக்கொள்ளுங்கள்",
  "YOUR IMPACT": "உங்கள் தாக்கம்",
  "This month": "இந்த மாதம்",
  "Estimated landfill diversion": "குப்பைக் கிடங்குக்குச் செல்லாமல் தடுக்கப்பட்ட மதிப்பிடப்பட்ட எடை",
  "Completed item exchanges": "முடிக்கப்பட்ட பொருள் பரிமாற்றங்கள்",
  "Weight is an estimate based on category averages for completed exchanges.": "முடிக்கப்பட்ட பரிமாற்றங்களின் வகை சராசரியைப் பயன்படுத்திய மதிப்பீடு இது.",
  "DISCOVER NEARBY": "அருகிலுள்ளவற்றைக் கண்டறியுங்கள்",
  "Explore your map": "வரைபடத்தை ஆராயுங்கள்",
  "Interactive map · Coimbatore": "ஊடாடும் வரைபடம் · கோயம்புத்தூர்",
  "Nearby waste & reuse": "அருகிலுள்ள கழிவு மற்றும் மறுபயன்பாட்டு இடங்கள்",
  "Use my GPS": "எனது GPS-ஐப் பயன்படுத்து",
  "Your GPS stays on this device. Map searches and directions use neighbourhood-level locations only.": "உங்கள் GPS இந்தச் சாதனத்திலேயே இருக்கும். வரைபடத் தேடல்கள் மற்றும் வழிகள் பகுதி அளவிலான இடத்தையே பயன்படுத்தும்.",
  "Show": "காட்டு",
  "All nearby options": "அருகிலுள்ள அனைத்தும்",
  "Compost hubs & MCCs": "உரம் மையங்கள் மற்றும் MCC-கள்",
  "E-waste recycling": "மின்னணுக் கழிவு மறுசுழற்சி",
  "Community bins": "சமூகக் குப்பைத் தொட்டிகள்",
  "CCMC micro-composting centres": "CCMC நுண் உரமிடும் மையங்கள்",
  "Dry-waste collection kiosks": "உலர் கழிவு சேகரிப்பு மையங்கள்",
  "Legal community dustbins": "அங்கீகரிக்கப்பட்ட சமூகக் குப்பைத் தொட்டிகள்",
  "NGOs & volunteering": "தன்னார்வ அமைப்புகள் மற்றும் தன்னார்வப் பணி",
  "CCMC-verified MCC, dry kiosk, and community dustbin locations are not connected": "CCMC சரிபார்த்த MCC, உலர் கழிவு மையம் மற்றும் சமூகத் தொட்டி இடங்கள் இணைக்கப்படவில்லை",
  "CIRCULAR COMMUNITY": "சுற்றுச்சூழல் சமூகப் பகிர்வு",
  "Give things a second life": "பொருட்களுக்கு இரண்டாவது வாழ்க்கை கொடுங்கள்",
  "Pass on what you no longer need to someone nearby.": "தேவையில்லாத பொருளை அருகிலுள்ள ஒருவருடன் பகிருங்கள்.",
  "Messages": "செய்திகள்",
  "Connecting to the community service…": "சமூக சேவையுடன் இணைகிறது…",
  "All items": "அனைத்துப் பொருட்கள்",
  "Clothes": "ஆடைகள்",
  "Books": "புத்தகங்கள்",
  "E-Waste": "மின்னணுக் கழிவு",
  "Furniture": "மரச்சாமான்கள்",
  "Approximate distance": "தோராயமான தூரம்",
  "All neighbourhoods": "அனைத்துப் பகுதிகள்",
  "Under 1 km": "1 கி.மீ.க்குள்",
  "Under 3 km": "3 கி.மீ.க்குள்",
  "Distance is estimated between neighborhood centers; exact addresses and GPS are not shared.": "பகுதி மையங்களுக்கு இடையிலான தூரம் தோராயமானது; சரியான முகவரியும் GPS-மும் பகிரப்படாது.",
  "Item name": "பொருளின் பெயர்",
  "Category": "வகை",
  "Photo": "புகைப்படம்",
  "Share item": "பொருளைப் பகிர்",
  "Report illegal dumping": "சட்டவிரோதக் குப்பை கொட்டுதலைப் புகாரளி",
  "Your report helps our city respond faster.": "நகரம் விரைவாகச் செயல்பட உங்கள் புகார் உதவும்.",
  "Choose the incident location on the map": "சம்பவ இடத்தை வரைபடத்தில் தேர்ந்தெடுக்கவும்",
  "Tap the map to place a pin. The saved position is rounded for privacy.": "குறியிட வரைபடத்தைத் தட்டவும். தனியுரிமைக்காக சேமிக்கும் இடம் தோராயமாக்கப்படும்.",
  "Mixed waste": "கலப்பு கழிவு",
  "Plastic": "பிளாஸ்டிக்",
  "Construction": "கட்டுமானக் கழிவு",
  "Description": "விளக்கம்",
  "Add any details that can help our team...": "எங்கள் குழுவுக்கு உதவும் விவரங்களைச் சேர்க்கவும்…",
  "Submit report · earn 50 points": "புகாரைச் சமர்ப்பி · 50 புள்ளிகள்",
  "Item messages": "பொருள் செய்திகள்",
  "Send message": "செய்தி அனுப்பு",
  "Suggest a public meeting place:": "பொது சந்திப்பு இடத்தைப் பரிந்துரைக்கவும்:",
  "Public park": "பொது பூங்கா",
  "Community center": "சமூக மையம்",
  "CCMC ward office": "CCMC வார்டு அலுவலகம்",
  "Other public place": "வேறு பொது இடம்",
  "Messages are encrypted on this device. Meet in a public place and avoid sharing home addresses or personal contact details.": "செய்திகள் இந்தச் சாதனத்தில் குறியாக்கம் செய்யப்படுகின்றன. பொது இடத்தில் சந்திக்கவும்; வீட்டு முகவரி அல்லது தனிப்பட்ட தொடர்பு விவரங்களைப் பகிர வேண்டாம்.",
  "Mark exchange complete": "பரிமாற்றம் முடிந்தது எனக் குறி"
};
const englishTranslations = Object.fromEntries(
  Object.entries(tamilTranslations).map(([english, tamil]) => [tamil, english])
);

function translateInterface() {
  const languageMap = language === "ta" ? tamilTranslations : englishTranslations;
  document.documentElement.lang = language === "ta" ? "ta" : "en";
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const original = node.nodeValue;
    const text = original.trim();
    if (languageMap[text]) {
      const startWhitespace = original.match(/^\s*/)[0];
      const endWhitespace = original.match(/\s*$/)[0];
      node.nodeValue = `${startWhitespace}${languageMap[text]}${endWhitespace}`;
    }
  }
  document.querySelectorAll("body *").forEach(element => {
    for (const attribute of ["placeholder", "aria-label"]) {
      const value = element.getAttribute(attribute);
      if (value && languageMap[value]) element.setAttribute(attribute, languageMap[value]);
    }
  });
  const toggle = document.querySelector("#language-toggle");
  if (toggle) {
    toggle.textContent = language === "ta" ? "English" : "தமிழ்";
    toggle.setAttribute("aria-label", language === "ta" ? "Switch to English" : "Switch to Tamil");
  }
}

document.querySelector("#language-toggle").addEventListener("click", () => {
  language = language === "ta" ? "en" : "ta";
  window.localStorage.setItem("bingo-language", language);
  translateInterface();
});
translateInterface();
let translationQueued = false;
new MutationObserver(() => {
  if (translationQueued) return;
  translationQueued = true;
  queueMicrotask(() => {
    translationQueued = false;
    translateInterface();
  });
}).observe(document.body, { childList: true, subtree: true, characterData: true });
let localEncryptionKey = null;
let selectedReportLocation = null;
let truckAlertWatch = null;
let truckAlerted = false;
let reportLocationMarker = null;
let reportCategory = "Mixed waste";

let points = Number(window.localStorage.getItem(pointsKey)) || startingPoints;
let toastTimeout;
let quizQuestion = 0;
let quizScore = 0;
let deferredInstallPrompt;
let currentTruckLocation = null;
let userCoordinates = null;

window.localStorage.removeItem("bingo-google-maps-key");

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

function updateTruckMarkers(truck) {
  const hasValidLocation = truck
    && Number.isFinite(truck.longitude)
    && Number.isFinite(truck.latitude)
    && Math.abs(truck.longitude) <= 180
    && Math.abs(truck.latitude) <= 90;

  liveTruckMarkers.forEach(({ marker, added }, index) => {
    if (!hasValidLocation) {
      if (added) {
        marker.remove();
        liveTruckMarkers[index].added = false;
      }
      return;
    }

    marker.setLngLat([truck.longitude, truck.latitude]);
    if (!added) {
      marker.addTo(liveTruckMarkers[index].map);
      liveTruckMarkers[index].added = true;
    }
  });
}

function reportCategoryClass(category) {
  return {
    "Mixed waste": "mixed",
    Plastic: "plastic",
    Construction: "construction"
  }[category] || "mixed";
}

async function refreshDumpingReportMarkers() {
  if (!hotspotMaps.length) {
    return;
  }
  try {
    const response = await fetch("/api/reports", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Hotspot reports are unavailable.");
    }
    const payload = await response.json();
    const reports = Array.isArray(payload?.reports) ? payload.reports : [];
    hotspotMaps.forEach(({ map, maplibregl, markers }) => {
      markers.forEach(marker => marker.remove());
      markers.length = 0;
      reports.forEach(report => {
        if (!Number.isFinite(report.latitude) || !Number.isFinite(report.longitude)) {
          return;
        }
        const element = document.createElement("button");
        element.type = "button";
        element.className = `dumping-hotspot-marker ${reportCategoryClass(report.category)}`;
        element.textContent = "!";
        element.title = `${report.category} · community reported, unverified`;
        element.setAttribute("aria-label", element.title);
        element.addEventListener("click", event => {
          event.stopPropagation();
          const details = document.createElement("div");
          const heading = document.createElement("strong");
          heading.textContent = `${report.category} hotspot`;
          const description = document.createElement("p");
          description.textContent = "Community reported · unverified · location rounded to protect privacy";
          details.append(heading, description);
          new maplibregl.Popup({ offset: 22 })
            .setLngLat([report.longitude, report.latitude])
            .setDOMContent(details)
            .addTo(map);
        });
        const marker = new maplibregl.Marker({ element, anchor: "bottom" })
          .setLngLat([report.longitude, report.latitude])
          .addTo(map);
        markers.push(marker);
      });
    });
  } catch (error) {
    console.warn("Unable to load community dumping hotspots:", error);
  }
}

function dropoffCategoryLabel(category) {
  return {
    mcc: "CCMC micro-composting centre",
    dry_kiosk: "Dry-waste collection kiosk",
    dustbin: "Legal community dustbin"
  }[category] || "Verified drop-off";
}

async function loadVerifiedDropoffs() {
  try {
    const response = await fetch("/api/dropoffs", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Verified drop-off locations are unavailable.");
    }
    verifiedDropoffs = Array.isArray(payload.dropoffs) ? payload.dropoffs : [];
    dropoffMaps.forEach(({ map, maplibregl, markers }) => {
      markers.forEach(marker => marker.remove());
      markers.length = 0;
      verifiedDropoffs.forEach(dropoff => {
        const element = document.createElement("button");
        element.type = "button";
        element.className = `verified-dropoff-marker ${dropoff.category}`;
        element.textContent = dropoff.category === "mcc" ? "♻" : dropoff.category === "dry_kiosk" ? "▤" : "♧";
        element.setAttribute("aria-label", `${dropoff.name}, ${dropoffCategoryLabel(dropoff.category)}`);
        const details = document.createElement("div");
        const heading = document.createElement("strong");
        heading.textContent = dropoff.name;
        const description = document.createElement("p");
        description.textContent = `${dropoffCategoryLabel(dropoff.category)} · Source verified ${dropoff.verified_at}`;
        const source = document.createElement("a");
        source.href = dropoff.source_url;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
        source.textContent = "Verification source";
        details.append(heading, description, source);
        element.addEventListener("click", event => {
          event.stopPropagation();
          new maplibregl.Popup({ offset: 22 })
            .setLngLat([dropoff.longitude, dropoff.latitude])
            .setDOMContent(details)
            .addTo(map);
        });
        markers.push(
          new maplibregl.Marker({ element, anchor: "bottom" })
            .setLngLat([dropoff.longitude, dropoff.latitude])
            .addTo(map)
        );
      });
    });
    renderNearbyPlaces(document.querySelector("#nearby-category-filter")?.value || "all");
  } catch (error) {
    console.error("Unable to load verified drop-off locations:", error);
    const count = document.querySelector("#nearby-place-count");
    if (count) count.textContent = "Official drop-off locations unavailable.";
  }
}

async function initialiseMaps() {
  const containers = document.querySelectorAll(".maplibre-map");
  if (!containers.length) {
    return;
  }

  try {
    const maplibregl = await import("https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.mjs");
    containers.forEach(container => {
      const map = new maplibregl.Map({
        container,
        style: "https://demotiles.maplibre.org/style.json",
        center: [mapCenter.longitude, mapCenter.latitude],
        zoom: mapZoom
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      map.on("load", () => map.resize());

      const isExploreMap = container.classList.contains("large-map-frame");
      const isReportMap = container.classList.contains("report-map-frame");
      if (isExploreMap || isReportMap) {
        hotspotMaps.push({ map, maplibregl, markers: [] });
      }
      if (isExploreMap) {
        dropoffMaps.push({ map, maplibregl, markers: [] });
      }

      if (isReportMap) {
        map.on("click", event => {
          selectedReportLocation = {
            latitude: event.lngLat.lat,
            longitude: event.lngLat.lng
          };
          if (!reportLocationMarker) {
            const element = document.createElement("div");
            element.className = "report-location-marker";
            element.setAttribute("aria-label", "Selected report location");
            reportLocationMarker = new maplibregl.Marker({ element, anchor: "center" });
          }
          reportLocationMarker.setLngLat([event.lngLat.lng, event.lngLat.lat]).addTo(map);
          document.querySelector("#report-location-status").textContent =
            "Location selected. The saved map pin is rounded to approximately 100 metres.";
        });
      }

      if (isExploreMap) {
        nearbyPlaces.filter(place => {
          return Number.isFinite(place.latitude)
            && Number.isFinite(place.longitude)
            && haversineKm(mapCenter.latitude, mapCenter.longitude, place.latitude, place.longitude) <= 3;
        }).forEach(place => {
          const element = document.createElement("button");
          element.type = "button";
          element.className = `map-place-marker ${place.category}`;
          element.textContent = place.category === "ewaste" ? "⌁" : "♻";
          element.setAttribute("aria-label", `${place.name}, ${place.kind}`);
          element.title = place.name;
          element.addEventListener("click", event => {
            event.stopPropagation();
            const details = document.createElement("div");
            const heading = document.createElement("strong");
            heading.textContent = place.name;
            const description = document.createElement("p");
            description.textContent = place.address;
            details.append(heading, description);
            new maplibregl.Popup({ offset: 22 })
              .setLngLat([place.longitude, place.latitude])
              .setDOMContent(details)
              .addTo(map);
          });
          new maplibregl.Marker({ element, anchor: "bottom" })
            .setLngLat([place.longitude, place.latitude])
            .addTo(map);
        });
      }

      const element = document.createElement("div");
      element.className = "truck-marker live-truck-marker";
      element.setAttribute("aria-label", "Live truck position");
      element.textContent = "▰";
      liveTruckMarkers.push({
        map,
        marker: new maplibregl.Marker({ element, anchor: "center" }),
        added: false
      });
      if (isExploreMap) {
        const legend = document.createElement("div");
        legend.className = "hotspot-legend";
        legend.setAttribute("aria-label", "Map pin legend");
        [
          ["mixed", "Mixed waste"],
          ["plastic", "Plastic"],
          ["construction", "Construction"],
          ["mcc", "Verified CCMC MCC"],
          ["dry_kiosk", "Verified dry-waste kiosk"],
          ["dustbin", "Verified community dustbin"]
        ].forEach(([category, label]) => {
          const item = document.createElement("span");
          const swatch = document.createElement("i");
          swatch.className = `hotspot-swatch ${category}`;
          const text = document.createElement("span");
          text.textContent = label;
          item.append(swatch, text);
          legend.append(item);
        });
        const verificationNote = document.createElement("small");
        verificationNote.textContent = "Community reports are unverified";
        legend.append(verificationNote);
        container.parentElement.append(legend);
      }
      map.on("error", event => {
        console.warn("BinGo map could not load a map resource:", event.error);
        container.dataset.mapStatus = "offline";
      });
    });
    refreshDumpingReportMarkers();
    loadVerifiedDropoffs();
    updateTruckMarkers(currentTruckLocation);
  } catch (error) {
    console.error("BinGo could not load MapLibre. Other app features remain available:", error);
    containers.forEach(container => {
      container.dataset.mapStatus = "offline";
      container.setAttribute("aria-label", "Map unavailable. Check your internet connection.");
    });
  }
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
  const query = place.searchOnly
    ? `${place.name} ${place.kind} near Coimbatore, Tamil Nadu`
    : `${place.name}, ${place.address}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function nearbyDirectionsUrl(place) {
  if (place.searchOnly) {
    return "";
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.name}, ${place.address}`)}&travelmode=driving`;
}

function renderNearbyPlaces(category = "all") {
  const list = document.querySelector("#nearby-place-results");
  const count = document.querySelector("#nearby-place-count");
  if (!list || !count) {
    return;
  }
  const places = [...nearbyPlaces, ...verifiedDropoffs.map(dropoff => ({
    ...dropoff,
    kind: dropoffCategoryLabel(dropoff.category),
    category: dropoff.category,
    address: "Officially verified point location",
    details: `Source verified ${dropoff.verified_at}`,
    searchOnly: false,
    official: true
  }))]
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

  count.textContent = verifiedDropoffs.length
    ? `${verifiedDropoffs.length} verified CCMC/authorized drop-off locations · other local services listed separately`
    : "CCMC-verified MCC, dry kiosk, and community dustbin locations are not connected";
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
    kind.textContent = place.official ? `${place.kind} · verified` : place.kind;
    header.append(title, kind);

    const address = document.createElement("p");
    address.textContent = place.address;
    const details = document.createElement("p");
    details.className = "nearby-details";
    details.textContent = place.details;
    const distance = document.createElement("p");
    distance.className = "nearby-distance";
    distance.textContent = place.official
      ? `Source verification date: ${place.verified_at}. Confirm access before visiting.`
      : place.distanceKm === null
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
    <p class="nearby-privacy">Your GPS stays on this device. Map searches and directions use neighbourhood-level locations only.</p>
    <label class="nearby-filter-label" for="nearby-category-filter">Show</label>
    <select class="input nearby-filter" id="nearby-category-filter">
      <option value="all">All nearby options</option>
      <option value="compost">Compost hubs &amp; MCCs</option>
      <option value="ewaste">E-waste recycling</option>
      <option value="bins">Community bins</option>
      <option value="mcc">CCMC micro-composting centres</option>
      <option value="dry_kiosk">Dry-waste collection kiosks</option>
      <option value="dustbin">Legal community dustbins</option>
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
  const arrivalAt = Number.isInteger(truck.estimated_arrival_at)
    ? truck.estimated_arrival_at * 1000
    : null;
  const arrivalMinutes = arrivalAt === null ? null : Math.ceil((arrivalAt - Date.now()) / 60000);
  const hasLocalArrival = truck.neighborhood === (preferences.neighborhood || "RS Puram");
  renderCollectionBanner(truck);
  truckStatusCopy.textContent = arrivalMinutes !== null && arrivalMinutes > 0 && hasLocalArrival
    ? `Truck ${truck.id || truckId} · approx. ${arrivalMinutes} min to ${truck.neighborhood}`
    : `Truck ${truck.id || truckId} · ${label}`;
  if (
    arrivalMinutes !== null
    && arrivalMinutes > 0
    && arrivalMinutes <= 15
    && hasLocalArrival
    && window.localStorage.getItem("bingo-arrival-alerts") === "enabled"
  ) {
    const alertKey = `bingo-arrival-alert-${truck.id || truckId}-${truck.estimated_arrival_at}`;
    if (window.localStorage.getItem(alertKey) !== "sent") {
      window.localStorage.setItem(alertKey, "sent");
      const message = `Collection is expected in ${truck.neighborhood} in about 15 minutes.`;
      notify(message);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("BinGo collection reminder", { body: message });
      }
    }
  }
  if (userCoordinates && haversineKm(userCoordinates.latitude, userCoordinates.longitude, truck.latitude, truck.longitude) <= 0.5) {
    if (!truckAlerted) {
      truckAlerted = true;
      notify("Your collection truck is within 500 metres.");
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("BinGo collection alert", { body: "Your collection truck is within 500 metres." });
      }
    }
  } else {
    truckAlerted = false;
  }
}

async function refreshTruckLocations() {
  try {
    const response = await fetch("/api/trucks", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Truck tracking service unavailable");
    }
    const payload = await response.json();
    const fleet = Array.isArray(payload?.trucks) ? payload.trucks : [];
    const matchingTruck = fleet.find(truck => truck.id === truckId && truck.status === "live")
      || fleet.find(truck => truck.status === "live");
    if (matchingTruck) {
      setTruckStatus(matchingTruck);
      return;
    }
    currentTruckLocation = null;
    renderCollectionBanner(null);
    updateTruckMarkers(null);
    truckStatusCopy.textContent = `Truck ${truckId} · awaiting live GPS`;
  } catch (error) {
    currentTruckLocation = null;
    renderCollectionBanner(null);
    updateTruckMarkers(null);
    if (truckStatusCopy) {
      truckStatusCopy.textContent = `Truck ${truckId} · waiting for live GPS`;
    }
    console.warn("Unable to sync truck GPS:", error);
  }
}

async function loadCollectionSchedule() {
  const neighborhood = preferences.neighborhood || "RS Puram";
  try {
    const response = await fetch(`/api/schedule?neighborhood=${encodeURIComponent(neighborhood)}`, {
      cache: "no-store"
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Collection schedule unavailable.");
    }
    if (!Array.isArray(payload.schedules) || payload.schedules.length === 0) {
      collectionScheduleDisplay = {
        status: "Schedule needed",
        title: "Not set",
        label: "Next collection",
        detail: `No verified collection days are configured for ${neighborhood}.`
      };
      renderCollectionBanner();
      return;
    }

    const schedule = payload.schedules[0];
    const dayNames = schedule.weekdays.map(day => day.slice(0, 3)).join(", ");
    collectionScheduleDisplay = {
      status: "Schedule data loaded",
      title: dayNames,
      label: "Weekly collection",
      detail: `${schedule.waste_type} · ${dayNames} · ${schedule.pickup_window}`,
      source: schedule.source_url,
      verifiedAt: schedule.verified_at,
      additionalCount: payload.schedules.length - 1
    };
    renderCollectionBanner();
  } catch (error) {
    collectionScheduleDisplay = {
      status: "Schedule unavailable",
      title: "Unavailable",
      label: "Next collection",
      detail: "Could not load collection schedule data. Try again when connected."
    };
    renderCollectionBanner();
    console.error("Unable to load collection schedule:", error);
  }
}

function renderCollectionBanner(truck = currentTruckLocation) {
  if (!collectionScheduleDisplay) return;
  const status = document.querySelector(".collection-card .status-badge");
  const arrival = document.querySelector(".collection-card .arrival");
  const heading = arrival.querySelector("strong");
  const label = arrival.querySelector("p");
  const detail = arrival.querySelectorAll("p")[1];
  const etaAt = Number.isInteger(truck?.estimated_arrival_at)
    ? truck.estimated_arrival_at * 1000
    : null;
  const etaMinutes = etaAt === null ? null : Math.ceil((etaAt - Date.now()) / 60000);
  const matchesNeighborhood = truck?.neighborhood === (preferences.neighborhood || "RS Puram");

  if (etaMinutes !== null && etaMinutes > 0 && matchesNeighborhood) {
    status.textContent = "Live arrival estimate";
    label.textContent = "Truck expected in";
    heading.textContent = `~${etaMinutes} min`;
    detail.textContent = `Operator estimate for ${truck.neighborhood}; updated ${new Date(truck.updated_at * 1000).toLocaleTimeString()}.`;
    return;
  }

  status.textContent = collectionScheduleDisplay.status;
  label.textContent = collectionScheduleDisplay.label;
  heading.textContent = collectionScheduleDisplay.title;
  detail.replaceChildren(document.createTextNode(collectionScheduleDisplay.detail));
  if (collectionScheduleDisplay.source) {
    detail.append(document.createTextNode(" · "));
    const source = document.createElement("a");
    source.href = collectionScheduleDisplay.source;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.textContent = `Source updated ${collectionScheduleDisplay.verifiedAt}`;
    detail.append(source);
  }
  if (collectionScheduleDisplay.additionalCount > 0) {
    detail.append(document.createTextNode(` · +${collectionScheduleDisplay.additionalCount} other schedule(s)`));
  }
}

async function shareTruckLocationFromPhone() {
  if (!navigator.geolocation) {
    notify("This browser cannot share live GPS coordinates.");
    return;
  }

  const truckForm = `
    <form class="dialog-form" id="truck-location-form">
      <label>Truck ID
        <input class="input" name="truckId" value="${truckId}" required>
      </label>
      <label>Arrival neighbourhood
        <select class="input" name="neighborhood" required>
          ${["RS Puram", "Gandhipuram", "Saibaba Colony", "Race Course", "Coimbatore"]
            .map(neighborhood => `<option>${neighborhood}</option>`).join("")}
        </select>
      </label>
      <label>Estimated arrival time
        <input class="input" name="arrival" type="datetime-local">
      </label>
      <label>Driver token
        <input class="input" name="token" type="password" autocomplete="off" placeholder="Paste your private driver token" required>
      </label>
      <small>Arrival estimates are optional and must be kept current by the route operator.</small>
      <button class="primary-button" type="submit">Share live position</button>
    </form>`;

  openDialog("Share live truck GPS", "Use the driver phone to send the route team’s current coordinates to the app.", truckForm, () => {
    const form = dialog.querySelector("#truck-location-form");
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
          accuracy_m: position.coords.accuracy || 0,
          neighborhood: String(formData.get("neighborhood") || "")
        };
        const arrivalValue = String(formData.get("arrival") || "");
        if (arrivalValue) {
          const arrivalAt = Date.parse(arrivalValue);
          if (!Number.isFinite(arrivalAt) || arrivalAt <= Date.now()) {
            throw new Error("Choose a future estimated arrival time.");
          }
          payload.estimated_arrival_at = Math.floor(arrivalAt / 1000);
        } else {
          payload.neighborhood = null;
        }
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
  if (name === "admin") {
    loadPlatformMetrics();
  }
  liveTruckMarkers.forEach(({ map }) => {
    if (map.getContainer().closest(".view") === target) {
      map.resize();
    }
  });
  hotspotMaps.forEach(({ map }) => {
    if (map.getContainer().closest(".view") === target) {
      map.resize();
    }
  });
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
      if (group.classList.contains("report-pills")) {
        reportCategory = pill.dataset.category || pill.textContent.trim();
      } else {
        currentDonationCategory = pill.dataset.category || "all";
        filterDonations();
      }
    });
  });
});

function normalizedDonationCategory(category) {
  return {
    "Home goods": "Furniture",
    Electronics: "E-Waste"
  }[category] || category;
}

function donationDistanceKm(neighborhood) {
  const origin = neighborhoodCenters[preferences.neighborhood || "RS Puram"];
  const destination = neighborhoodCenters[neighborhood];
  if (!origin || !destination) return null;
  return haversineKm(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
}

function filterDonations() {
  const radius = currentDonationRadius === "all" ? null : Number(currentDonationRadius);
  document.querySelectorAll(".donation-card").forEach(card => {
    const categoryMatches = currentDonationCategory === "all"
      || normalizedDonationCategory(card.dataset.category) === currentDonationCategory;
    const distance = card.dataset.distanceKm === "" ? null : Number(card.dataset.distanceKm);
    const distanceMatches = radius === null || (distance !== null && distance <= radius);
    card.hidden = !categoryMatches || !distanceMatches;
  });
}

document.querySelector("#donation-radius-filter").addEventListener("change", event => {
  currentDonationRadius = event.currentTarget.value;
  filterDonations();
});

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
  if (document.querySelector("#donation-radius-filter")) {
    filterDonations();
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
    </form>
    <form class="dialog-form survey-form" id="survey-form">
      <h3>Quick design survey · rate 1–5</h3>
      <label>Visual clarity<select class="input" name="visual_clarity" required><option value="">Choose</option><option value="1">1 · Needs work</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 · Clear</option></select></label>
      <label>Icon readability<select class="input" name="icon_readability" required><option value="">Choose</option><option value="1">1 · Needs work</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 · Clear</option></select></label>
      <label>Layout appeal<select class="input" name="layout_appeal" required><option value="">Choose</option><option value="1">1 · Needs work</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5 · Appealing</option></select></label>
      <p class="nearby-privacy" id="survey-summary">Survey summary is loading…</p>
      <button class="secondary-button" type="submit">Submit anonymous ratings</button>
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
      loadCollectionSchedule();
      renderProfile();
      dialog.close();
      notify("Settings saved.");
      if (communitySession) {
        communityRequest("/api/session", {
          method: "PATCH",
          body: { neighborhood: preferences.neighborhood }
        }).catch(error => notify(`Settings saved here, but the community area did not sync: ${error.message}`));
      }
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
      loadCollectionSchedule();
      dialog.close();
      notify("Local profile, settings, and points were reset.");
    });
    const surveyForm = dialog.querySelector("#survey-form");
    const surveySummary = dialog.querySelector("#survey-summary");
    loadSurveySummary(surveySummary);
    surveyForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (!communitySession) {
        notify("Survey submissions need the BinGo community service.");
        return;
      }
      const ratings = Object.fromEntries(new FormData(surveyForm));
      try {
        await communityRequest("/api/survey", {
          method: "POST",
          body: Object.fromEntries(Object.entries(ratings).map(([key, value]) => [key, Number(value)]))
        });
        await loadSurveySummary(surveySummary);
        notify("Thanks for helping us improve BinGo.");
      } catch (error) {
        notify(error.message);
      }
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

async function communityRequest(path, { method = "GET", body, authenticated = true } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (authenticated && communitySession?.token) {
    headers.Authorization = `Bearer ${communitySession.token}`;
  }
  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store"
    });
  } catch (error) {
    throw new Error("Community service is unreachable. Check your connection and BinGo server.");
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Community service is not configured. Start the BinGo server to use listings and messages.");
  }
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || "Community request failed.");
    error.status = response.status;
    throw error;
  }
  return result;
}

async function ensureCommunitySession() {
  const storedSession = window.localStorage.getItem(sessionStorageKey);
  if (storedSession) {
    try {
      communitySession = JSON.parse(storedSession);
      await communityRequest("/api/exchanges");
      await communityRequest("/api/session", {
        method: "PATCH",
        body: { neighborhood: preferences.neighborhood || "RS Puram" }
      });
      return;
    } catch (error) {
      if (error.status !== 401) {
        communitySession = null;
        throw error;
      }
      window.localStorage.removeItem(sessionStorageKey);
    }
  }
  const session = await communityRequest("/api/session", {
    method: "POST",
    body: { neighborhood: preferences.neighborhood || "RS Puram" },
    authenticated: false
  });
  communitySession = { token: session.token, userId: session.user_id };
  window.localStorage.setItem(sessionStorageKey, JSON.stringify(communitySession));
}

function bytesToBase64(value) {
  let binary = "";
  new Uint8Array(value).forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

function openEncryptionDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("bingo-encryption-keys", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("keys");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open private-key storage."));
  });
}

async function getStoredEncryptionKey(userId) {
  const database = await openEncryptionDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("keys", "readonly");
    const request = transaction.objectStore("keys").get(userId);
    request.onsuccess = () => {
      database.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      database.close();
      reject(request.error || new Error("Could not read the private encryption key."));
    };
  });
}

async function storeEncryptionKey(userId, keyRecord) {
  const database = await openEncryptionDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("keys", "readwrite");
    transaction.objectStore("keys").put(keyRecord, userId);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error("Could not save the private encryption key."));
    };
  });
}

async function ensureEncryptionKey() {
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) {
    throw new Error("This browser cannot safely store end-to-end encryption keys.");
  }
  if (!communitySession) {
    await ensureCommunitySession();
  }
  if (localEncryptionKey?.userId === communitySession.userId) {
    return localEncryptionKey;
  }

  let keyRecord = await getStoredEncryptionKey(communitySession.userId);
  if (!keyRecord) {
    const pair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveKey"]
    );
    keyRecord = {
      privateKey: pair.privateKey,
      publicKey: bytesToBase64(await crypto.subtle.exportKey("raw", pair.publicKey))
    };
    await storeEncryptionKey(communitySession.userId, keyRecord);
  }
  await communityRequest("/api/session/encryption-key", {
    method: "POST",
    body: { public_key: keyRecord.publicKey }
  });
  localEncryptionKey = { ...keyRecord, userId: communitySession.userId };
  return localEncryptionKey;
}

async function deriveConversationKey(privateKey, publicKey) {
  const importedKey = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(publicKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: importedKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptionFingerprint(publicKey) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", base64ToBytes(publicKey)));
  const fingerprint = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
  return fingerprint.match(/.{1,4}/g).join(" ");
}

async function encryptExchangeMessage(message, key, exchangeId, senderId) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(`${exchangeId}:${senderId}`);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    key,
    new TextEncoder().encode(message)
  );
  return {
    protocol: "ECDH-P256-AES-256-GCM-v1",
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext)
  };
}

async function decryptExchangeMessage(encrypted, key, exchangeId, senderId) {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(encrypted.iv),
      additionalData: new TextEncoder().encode(`${exchangeId}:${senderId}`)
    },
    key,
    base64ToBytes(encrypted.ciphertext)
  );
  return new TextDecoder().decode(plaintext);
}

async function compressItemPhoto(file) {
  if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
    throw new Error("Choose an image smaller than 12 MB.");
  }
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.72));
    if (!blob) {
      throw new Error("Could not compress that image. Choose a different photo.");
    }
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", () => reject(new Error("Could not read that photo.")));
      reader.readAsDataURL(blob);
    });
  } finally {
    URL.revokeObjectURL(source);
  }
}

function createDonationCard({ listingId, title, category, description = "Shared by a neighbour", photoUrl, neighborhood = "Coimbatore", isOwner = false, requested = false }) {
  const card = document.createElement("article");
  card.className = "donation-card";
  card.dataset.category = category;
  card.dataset.listingId = listingId;
  const approximateDistance = donationDistanceKm(neighborhood);
  card.dataset.distanceKm = approximateDistance === null ? "" : String(approximateDistance);

  const photo = document.createElement("div");
  const categoryClass = ["Furniture", "Home goods"].includes(category)
    ? "photo-chair"
    : category === "Books" ? "photo-books" : "photo-toys";
  photo.className = `item-photo ${categoryClass}`;
  if (photoUrl) {
    const image = document.createElement("img");
    image.src = photoUrl;
    image.alt = title;
    image.loading = "lazy";
    photo.append(image);
  }
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
  ownerAvatar.textContent = isOwner ? "You" : "NB";
  const ownerName = document.createElement("small");
  ownerName.textContent = approximateDistance === null
    ? neighborhood
    : `${neighborhood} · ~${approximateDistance.toFixed(1)} km`;
  const request = document.createElement("button");
  request.type = "button";
  request.textContent = isOwner ? "Your listing" : requested ? "Requested" : "Message giver";
  request.disabled = isOwner || requested;
  request.addEventListener("click", () => {
    startItemRequest(listingId, title, request);
  });
  footer.append(ownerAvatar, ownerName, request);
  details.append(tag, heading, copy, footer);
  card.append(photo, details);
  return card;
}

async function startItemRequest(listingId, title, button) {
  if (!communitySession || !listingId) {
    notify("Item requests are unavailable until the community service is connected.");
    return;
  }
  button.disabled = true;
  try {
    const result = await communityRequest(`/api/items/${encodeURIComponent(listingId)}/requests`, {
      method: "POST"
    });
    button.textContent = "Requested";
    await openConversation(result.exchange_id, title);
  } catch (error) {
    button.disabled = false;
    notify(error.message);
  }
}

async function loadCommunityListings() {
  const status = document.querySelector("#community-service-status");
  const grid = document.querySelector(".donation-grid");
  try {
    await ensureCommunitySession();
    const { items } = await communityRequest("/api/items");
    grid.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "nearby-privacy";
      empty.textContent = "No items yet. Be the first to share something useful.";
      grid.append(empty);
    }
    items.forEach(item => {
      grid.append(createDonationCard({
        listingId: item.listing_id,
        title: item.title,
        category: item.category,
        photoUrl: item.photo_data,
        neighborhood: item.neighborhood,
        isOwner: item.is_owner,
        requested: item.requested
      }));
    });
    status.textContent = "Community listings are live. Only neighbourhood-level locations are shown.";
    filterDonations();
    await loadImpact();
  } catch (error) {
    status.textContent = `${error.message} Sample listings are for display only.`;
    console.warn("BinGo community features are unavailable:", error);
  }
}

async function renderMessages(exchangeId, messagesElement, conversationKey) {
  const result = await communityRequest(`/api/exchanges/${encodeURIComponent(exchangeId)}/messages`);
  messagesElement.replaceChildren();
  for (const message of result.messages) {
    const item = document.createElement("p");
    item.className = message.sender_id === result.user_id ? "exchange-message own-message" : "exchange-message";
    try {
      const encrypted = JSON.parse(message.message);
      if (!conversationKey || encrypted.protocol !== "ECDH-P256-AES-256-GCM-v1") {
        item.textContent = "Encrypted message is unavailable until both participants enable secure messaging.";
      } else {
        item.textContent = await decryptExchangeMessage(
          encrypted,
          conversationKey,
          exchangeId,
          message.sender_id
        );
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        item.textContent = "Legacy message omitted because it was not end-to-end encrypted.";
      } else {
        item.textContent = "Unable to decrypt this message on this device.";
        console.error("BinGo could not decrypt an exchange message:", error);
      }
    }
    messagesElement.append(item);
  }
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

async function openConversation(exchangeId, itemTitle) {
  const safeTitle = String(itemTitle).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
  openDialog("Item messages", safeTitle, `
    <div id="exchange-messages" class="exchange-messages" aria-live="polite"></div>
    <form id="exchange-message-form" class="dialog-form">
      <label>Message<textarea name="message" maxlength="500" required placeholder="Arrange a safe public pickup"></textarea></label>
      <button class="primary-button" type="submit">Send message</button>
    </form>
    <div class="safe-pickup-suggestions" aria-label="Safe public pickup suggestions">
      <span>Suggest a public meeting place:</span>
      <button type="button" data-meeting-suggestion="park">Public park</button>
      <button type="button" data-meeting-suggestion="community-center">Community center</button>
      <button type="button" data-meeting-suggestion="ward-office">CCMC ward office</button>
      <button type="button" data-meeting-suggestion="other-public-place">Other public place</button>
    </div>
    <p class="nearby-privacy" id="encryption-status" role="status">Preparing end-to-end encryption…</p>
    <p class="nearby-privacy">Messages are encrypted on this device. Listings show only a neighborhood, not a street address. Meet in a busy, well-lit public place during open hours; never share a home address.</p>
    <button class="secondary-button" id="complete-exchange-button" type="button">Mark exchange complete</button>`, () => {
    const messages = dialog.querySelector("#exchange-messages");
    const form = dialog.querySelector("#exchange-message-form");
    dialog.querySelectorAll("[data-meeting-suggestion]").forEach(button => {
      button.addEventListener("click", () => {
        const neighborhood = preferences.neighborhood || defaultPreferences.neighborhood;
        const suggestion = {
          park: `a busy public park in ${neighborhood} during daylight`,
          "community-center": `a public community center in ${neighborhood} during opening hours`,
          "ward-office": `the CCMC ward office serving ${neighborhood} during opening hours`,
          "other-public-place": `another busy, well-lit public place in ${neighborhood} during opening hours`
        }[button.dataset.meetingSuggestion];
        if (!suggestion) return;
        form.elements.message.value =
          `Would you be comfortable meeting at ${suggestion}? Let's agree on the exact public spot here; I won't share home addresses.`;
        form.elements.message.focus();
      });
    });
    const submit = form.querySelector("button[type=submit]");
    const encryptionStatus = dialog.querySelector("#encryption-status");
    let conversationKey = null;
    let preparingEncryption = false;
    submit.disabled = true;
    let refreshing = false;
    const prepareEncryption = async () => {
      if (preparingEncryption || conversationKey || !dialog.open) return;
      preparingEncryption = true;
      try {
        const keyRecord = await ensureEncryptionKey();
        const exchangeKeys = await communityRequest(
          `/api/exchanges/${encodeURIComponent(exchangeId)}/keys`
        );
        if (!exchangeKeys.ready) {
          encryptionStatus.textContent =
            "Ask the other participant to open messages on their device to enable encryption.";
          return;
        }
        const peerId = Object.keys(exchangeKeys.public_keys)
          .find(userId => userId !== communitySession.userId);
        if (!peerId) {
          throw new Error("Could not find the other participant’s encryption key.");
        }
        conversationKey = await deriveConversationKey(
          keyRecord.privateKey,
          exchangeKeys.public_keys[peerId]
        );
        encryptionStatus.textContent =
          `Encrypted on this device · verify peer fingerprint out of band: ${await encryptionFingerprint(exchangeKeys.public_keys[peerId])}`;
        submit.disabled = false;
      } catch (error) {
        encryptionStatus.textContent = error.message;
      } finally {
        preparingEncryption = false;
      }
    };
    const refresh = async () => {
      if (refreshing || !dialog.open) return;
      refreshing = true;
      try {
        await prepareEncryption();
        await renderMessages(exchangeId, messages, conversationKey);
      } catch (error) {
        messages.textContent = error.message;
      } finally {
        refreshing = false;
      }
    };
    const refreshTimer = window.setInterval(refresh, 5000);
    dialog.addEventListener("close", () => window.clearInterval(refreshTimer), { once: true });
    refresh();
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!conversationKey) {
        notify("Encrypted messaging is not ready yet.");
        return;
      }
      submit.disabled = true;
      try {
        const encrypted = await encryptExchangeMessage(
          form.elements.message.value.trim(),
          conversationKey,
          exchangeId,
          communitySession.userId
        );
        await communityRequest(`/api/exchanges/${encodeURIComponent(exchangeId)}/messages`, {
          method: "POST",
          body: { encrypted }
        });
        form.reset();
        await refresh();
      } catch (error) {
        notify(error.message);
      } finally {
        submit.disabled = !conversationKey;
      }
    });
    dialog.querySelector("#complete-exchange-button").addEventListener("click", async event => {
      event.currentTarget.disabled = true;
      try {
        const result = await communityRequest(`/api/exchanges/${encodeURIComponent(exchangeId)}`, { method: "PATCH" });
        dialog.close();
        notify(`Exchange complete · about ${result.diverted_kg.toFixed(1)} kg diverted.`);
        await loadImpact();
      } catch (error) {
        event.currentTarget.disabled = false;
        notify(error.message);
      }
    });
  });
}

async function openExchanges() {
  try {
    await ensureCommunitySession();
    await ensureEncryptionKey();
    const { exchanges } = await communityRequest("/api/exchanges");
    const content = document.createElement("div");
    if (!exchanges.length) {
      content.textContent = "No item conversations yet.";
    } else {
      exchanges.forEach(exchange => {
        const row = document.createElement("article");
        row.className = "exchange-listing";
        const title = document.createElement("strong");
        title.textContent = exchange.title;
        const status = document.createElement("small");
        status.textContent = `${exchange.other_person} · ${exchange.status}`;
        const open = document.createElement("button");
        open.className = "secondary-button";
        open.type = "button";
        open.textContent = "Open messages";
        open.addEventListener("click", () => openConversation(exchange.exchange_id, exchange.title));
        row.append(title, status, open);
        content.append(row);
      });
    }
    openDialog("Your messages", "Coordinate an item exchange in the app.", content.outerHTML);
    dialog.querySelector(".dialog-body").replaceChildren(content);
  } catch (error) {
    notify(error.message);
  }
}

async function loadImpact() {
  if (!communitySession) return;
  const impact = await communityRequest("/api/impact");
  document.querySelector("#diverted-weight").textContent = impact.diverted_kg.toFixed(1);
  document.querySelector("#completed-exchanges").textContent = String(impact.completed_exchanges || 0);
  const communityCounter = document.querySelector("#community-diverted-weight");
  if (communityCounter) {
    communityCounter.textContent = Number(impact.community_diverted_kg || 0).toFixed(1);
  }
}

async function loadPlatformMetrics() {
  const activeUsers = document.querySelector("#active-user-metric");
  const costPerUser = document.querySelector("#cost-per-user-metric");
  try {
    const metrics = await communityRequest("/api/metrics", { authenticated: false });
    activeUsers.textContent = String(metrics.active_users_30d);
    costPerUser.textContent = metrics.cost_per_active_user === null
      ? "Configure monthly bill"
      : `₹${metrics.cost_per_active_user.toFixed(2)}`;
  } catch (error) {
    activeUsers.textContent = "Unavailable";
    costPerUser.textContent = "Unavailable";
    console.warn("BinGo platform metrics are unavailable:", error);
  }
}

async function loadSurveySummary(element) {
  try {
    const survey = await communityRequest("/api/survey", { authenticated: false });
    element.textContent = `${survey.response_count} of ${survey.target_responses} target responses collected. Average ratings (clarity, icons, layout): ${survey.averages.map(value => value ?? "—").join(" / ")}.`;
  } catch (error) {
    element.textContent = "Survey collection requires the BinGo server.";
  }
}

async function enableTruckAlerts() {
  const button = document.querySelector("#truck-alert-button");
  if (!("Notification" in window)) {
    notify("This browser does not support collection notifications.");
    return;
  }
  button.disabled = true;
  try {
    const permission = await Notification.requestPermission();
    window.localStorage.setItem("bingo-arrival-alerts", "enabled");
    button.textContent = "Alerts enabled · 15 min ETA / 500 m";
    notify(permission === "granted"
      ? "Collection alerts enabled. 15-minute ETA reminders need a live operator estimate."
      : "In-app collection alerts enabled. Allow browser notifications for system alerts.");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(position => {
        userCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        truckAlerted = false;
        if (currentTruckLocation) setTruckStatus(currentTruckLocation);
        if (truckAlertWatch === null) {
          truckAlertWatch = navigator.geolocation.watchPosition(nextPosition => {
            userCoordinates = {
              latitude: nextPosition.coords.latitude,
              longitude: nextPosition.coords.longitude
            };
            if (currentTruckLocation) setTruckStatus(currentTruckLocation);
          }, error => {
            console.warn("BinGo could not refresh the local alert location:", error);
            notify("Location updates stopped. ETA alerts still work while the app is open.");
            truckAlertWatch = null;
          }, { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 });
        }
      }, error => {
        console.warn("BinGo could not read alert location:", error);
        notify("Location unavailable; ETA reminders still work when live arrival data is provided.");
      }, { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 });
    }
  } catch (error) {
    button.disabled = false;
    notify(`Could not enable notifications: ${error.message}`);
    return;
  } finally {
    button.disabled = false;
  }
}

document.querySelector("#truck-alert-button").addEventListener("click", enableTruckAlerts);

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
    event.currentTarget.disabled = true;
    notify("This is a sample listing. Live requests are available for community listings.");
    event.currentTarget.disabled = false;
  });
});

document.querySelector("#open-exchanges-button").addEventListener("click", openExchanges);
loadCommunityListings();

document.querySelector("#post-item").addEventListener("click", () => {
  openDialog("Give an item", "Share something useful with a neighbour.", `
    <form id="donation-form" class="dialog-form">
      <label>Photo<input name="photo" class="input" type="file" accept="image/*" capture="environment" required></label>
      <label>Item name<input name="title" class="input" required maxlength="60" placeholder="e.g. A set of storybooks"></label>
      <label>Category<select name="category" class="input" required><option>Clothes</option><option>Books</option><option>E-Waste</option><option>Furniture</option></select></label>
      <p class="nearby-privacy">Your listing shows only your selected neighborhood (for example, RS Puram). We do not request your street address or attach your GPS location. Photo is resized before upload.</p>
      <button class="primary-button" type="submit">Share item</button>
    </form>`, () => {
    const form = dialog.querySelector("#donation-form");
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const photoFile = form.elements.photo.files[0];
      if (!photoFile) {
        form.elements.photo.setCustomValidity("Choose a photo to list your item.");
        form.elements.photo.reportValidity();
        return;
      }

      if (!communitySession) {
        notify("Item listings need the BinGo community service. Please try again when connected.");
        return;
      }
      const submit = form.querySelector("button[type=submit]");
      submit.disabled = true;
      try {
        const photoData = await compressItemPhoto(photoFile);
        await communityRequest("/api/items", {
          method: "POST",
          body: {
            title: form.elements.title.value,
            category: form.elements.category.value,
            photo_data: photoData
          }
        });
        dialog.close();
        updatePoints(10);
        notify("Your item is now on the community board. +10 eco points");
        await loadCommunityListings();
      } catch (error) {
        notify(error.message);
      } finally {
        submit.disabled = false;
      }
    });
  });
});

document.querySelector("#view-report .upload-box").remove();
const reportLocationLabel = document.querySelector("#view-report .form-fields > label");
reportLocationLabel.replaceChildren();
const reportLocationTitle = document.createElement("span");
reportLocationTitle.textContent = "Choose the incident location on the map";
const reportMap = document.createElement("div");
reportMap.className = "map report-map-frame maplibre-map";
reportMap.setAttribute("role", "region");
reportMap.setAttribute("aria-label", "Select an approximate illegal dumping report location");
const reportLocationStatus = document.createElement("small");
reportLocationStatus.id = "report-location-status";
reportLocationStatus.textContent = "Tap the map to place a pin. The saved position is rounded for privacy.";
reportLocationLabel.classList.add("report-location-field");
reportLocationLabel.append(reportLocationTitle, reportMap, reportLocationStatus);

document.querySelector(".submit-report").addEventListener("click", () => {
  if (!selectedReportLocation) {
    notify("Tap the map to choose where the dumping was seen.");
    return;
  }
  const description = document.querySelector(".report-card textarea");
  if (!description.value.trim()) {
    description.setCustomValidity("Add a short description before submitting your report.");
    description.reportValidity();
    description.addEventListener("input", () => description.setCustomValidity(""), { once: true });
    return;
  }

  const submitButton = document.querySelector(".submit-report");
  submitButton.disabled = true;
  (async () => {
    try {
      await ensureCommunitySession();
      await communityRequest("/api/reports", {
        method: "POST",
        body: {
          category: reportCategory,
          description: description.value.trim(),
          latitude: selectedReportLocation.latitude,
          longitude: selectedReportLocation.longitude
        }
      });
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
      activityDescription.textContent = `${reportCategory} · Just now`;
      activityContent.append(activityTitle, activityDescription);
      const activityPoints = document.createElement("b");
      activityPoints.textContent = "+50";
      row.append(activityIcon, activityContent, activityPoints);
      activity.prepend(row);
      const activityCount = document.querySelector(".nav-count");
      activityCount.textContent = String(Number(activityCount.textContent) + 1);
      description.value = "";
      selectedReportLocation = null;
      reportLocationMarker?.remove();
      document.querySelector("#report-location-status").textContent =
        "Tap the map to place another pin. The saved position is rounded for privacy.";
      updatePoints(50);
      notify("Report submitted as an unverified community hotspot. +50 points");
      await refreshDumpingReportMarkers();
      window.setTimeout(() => showView("activity", { updateHistory: true }), 1200);
    } catch (error) {
      notify(error.message);
    } finally {
      submitButton.disabled = false;
    }
  })();
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
loadCollectionSchedule();
initialiseMaps();
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
