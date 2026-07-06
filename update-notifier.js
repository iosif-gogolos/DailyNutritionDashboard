// update-notifier.js — DailyNutritionDashboard
// Include this AFTER your existing script.js, or merge it in.
// Requires the markup from index-snippet.html and styles from update-notifier.css.

(function () {
  "use strict";

  const SCOPE = "/DailyNutritionDashboard/";
  const SW_URL = `${SCOPE}sw.js`;

  // GitHub repo this site is built from — used only for the "What's New" modal.
  const GITHUB_OWNER = "iosif-gogolos";
  const GITHUB_REPO = "DailyNutritionDashboard";
  const GITHUB_API_LATEST_COMMIT = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/commits?per_page=1`;

  const SNACKBAR_DURATION_MS = 15000; // keep in sync with CSS animation-duration

  let registrationRef = null;
  let snackbarTimeoutId = null;

  // ---------- Service worker registration + update detection ----------

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register(SW_URL, { scope: SCOPE })
      .then((registration) => {
        registrationRef = registration;

        // Case 1: an update is already waiting when we load (e.g. installed
        // in a previous tab/session but user never clicked "Update")
        if (registration.waiting) {
          showUpdateSnackbar(registration);
        }

        // Case 2: a new SW starts installing during this session
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && registration.waiting) {
              showUpdateSnackbar(registration);
            }
          });
        });

        // Proactively check for updates: on load, when tab regains focus,
        // and periodically. GitHub Pages doesn't push — we have to pull.
        registration.update();
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") registration.update();
        });
        setInterval(() => registration.update(), 5 * 60 * 1000); // every 5 min
      })
      .catch((err) => console.warn("SW registration failed:", err));

    // When the waiting worker takes control (after skipWaiting), reload once.
    let hasReloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hasReloaded) return;
      hasReloaded = true;
      window.location.reload();
    });
  }

  // ---------- Snackbar ----------

  function showUpdateSnackbar(registration) {
    const snackbar = document.getElementById("updateSnackbar");
    const timerBar = document.getElementById("snackbarTimerBar");
    if (!snackbar) return;

    snackbar.hidden = false;

    // Restart the CSS countdown animation
    timerBar.style.animation = "none";
    void timerBar.offsetWidth; // force reflow
    timerBar.style.animation = "";

    clearTimeout(snackbarTimeoutId);
    snackbarTimeoutId = setTimeout(() => {
      snackbar.hidden = true;
    }, SNACKBAR_DURATION_MS);

    const updateBtn = document.getElementById("snackbarUpdate");
    const learnMoreBtn = document.getElementById("snackbarLearnMore");

    updateBtn.onclick = () => {
      clearTimeout(snackbarTimeoutId);
      snackbar.hidden = true;
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    };

    learnMoreBtn.onclick = () => {
      clearTimeout(snackbarTimeoutId);
      snackbar.hidden = true;
      openWhatsNewModal();
    };
  }

  // ---------- Hamburger menu ----------

  function setupMenu() {
    const toggle = document.getElementById("menuToggle");
    const menu = document.getElementById("appMenu");
    const settingsBtn = document.getElementById("menuSettingsBtn");
    const whatsNewBtn = document.getElementById("menuWhatsNewBtn");
    if (!toggle || !menu) return;

    function closeMenu() {
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", () => {
      const isOpen = !menu.hidden;
      menu.hidden = isOpen;
      toggle.setAttribute("aria-expanded", String(!isOpen));
    });

    document.addEventListener("click", (event) => {
      if (!menu.hidden && !menu.contains(event.target) && event.target !== toggle) {
        closeMenu();
      }
    });

    settingsBtn?.addEventListener("click", () => {
      closeMenu();
      // Hook up to your existing settings UI here, e.g.:
      // document.getElementById('settingsModal').hidden = false;
      console.info("Open your existing Settings UI here.");
    });

    whatsNewBtn?.addEventListener("click", () => {
      closeMenu();
      openWhatsNewModal();
    });
  }

  // ---------- "What's New" / commit-info modal ----------

  function setupModal() {
    const modal = document.getElementById("whatsNewModal");
    const closeBtn = document.getElementById("whatsNewClose");
    if (!modal) return;

    closeBtn?.addEventListener("click", closeWhatsNewModal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeWhatsNewModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) closeWhatsNewModal();
    });
  }

  function closeWhatsNewModal() {
    const modal = document.getElementById("whatsNewModal");
    if (modal) modal.hidden = true;
  }

  function openWhatsNewModal() {
    const modal = document.getElementById("whatsNewModal");
    const loading = document.getElementById("whatsNewLoading");
    const content = document.getElementById("whatsNewContent");
    const errorEl = document.getElementById("whatsNewError");
    if (!modal) return;

    modal.hidden = false;
    loading.hidden = false;
    content.hidden = true;
    errorEl.hidden = true;

    fetchLatestCommit()
      .then((commit) => {
        loading.hidden = true;
        content.hidden = false;
        renderCommit(commit);
      })
      .catch((err) => {
        console.warn("Could not fetch latest commit:", err);
        loading.hidden = true;
        errorEl.hidden = false;
      });
  }

  function fetchLatestCommit() {
    return fetch(GITHUB_API_LATEST_COMMIT, {
      headers: { Accept: "application/vnd.github+json" },
    }).then((res) => {
      if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
      return res.json();
    }).then((data) => {
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("No commits returned");
      }
      return data[0];
    });
  }

  function renderCommit(commit) {
    const fullMessage = commit.commit?.message || "No commit message.";
    const firstLine = fullMessage.split("\n")[0];
    const author = commit.commit?.author?.name || "Unknown";
    const date = commit.commit?.author?.date
      ? new Date(commit.commit.author.date).toLocaleString()
      : "Unknown";
    const sha = commit.sha ? commit.sha.slice(0, 7) : "—";

    document.getElementById("commitMessage").textContent = firstLine;
    document.getElementById("commitAuthor").textContent = author;
    document.getElementById("commitDate").textContent = date;
    document.getElementById("commitSha").textContent = sha;

    const link = document.getElementById("commitLink");
    if (link) link.href = commit.html_url || "#";
  }

  // ---------- Init ----------

  document.addEventListener("DOMContentLoaded", () => {
    registerServiceWorker();
    setupMenu();
    setupModal();
  });
})();