const views = document.querySelectorAll(".view");
const navItems = document.querySelectorAll("[data-view]");
const toast = document.querySelector(".toast");

function showView(name) {
  views.forEach(view => view.classList.toggle("active-view", view.id === `view-${name}`));
  navItems.forEach(item => item.classList.toggle("active", item.dataset.view === name));
  document.querySelector(".sidebar")?.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

navItems.forEach(item => item.addEventListener("click", () => showView(item.dataset.view)));
document.querySelector(".mobile-menu")?.addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));
document.querySelector(".notification-button")?.addEventListener("click", () => notify("You’re all caught up ✨"));
document.querySelector(".submit-report")?.addEventListener("click", () => {
  notify("Report submitted — thank you for keeping Coimbatore clean!");
  setTimeout(() => showView("activity"), 1300);
});
document.querySelector("#start-quiz")?.addEventListener("click", () => notify("Sorting quiz coming up next! +50 points waiting."));
document.querySelector("#post-item")?.addEventListener("click", () => notify("Opening the quick item listing flow…"));
document.querySelectorAll(".donation-card .item-footer button").forEach(button => button.addEventListener("click", () => {
  button.textContent = "Requested";
  button.disabled = true;
  notify("Request sent. You’ll get a chat notification soon.");
}));
document.querySelectorAll(".pill").forEach(pill => pill.addEventListener("click", () => {
  pill.parentElement.querySelectorAll(".pill").forEach(item => item.classList.remove("active"));
  pill.classList.add("active");
}));
function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(notify.timeout);
  notify.timeout = window.setTimeout(() => toast.classList.remove("show"), 2800);
}
