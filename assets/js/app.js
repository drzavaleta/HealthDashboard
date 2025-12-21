// Main App Controller
const App = (() => {
  const switchSection = () => {
    const hash = window.location.hash || "#labs";
    const sectionId = hash.substring(1);
    console.log("Switching to section:", hash);

    // Update Section Visibility
    document.querySelectorAll(".content-section").forEach((section) => {
      if (section.id === sectionId) {
        section.classList.remove("hidden");
      } else {
        section.classList.add("hidden");
      }
    });

      // Initialize the page module if it exists
      try {
        if (hash === "#meds" && typeof MedsPage !== "undefined") {
          MedsPage.init();
        } else if (hash === "#labs" && typeof LabsPage !== "undefined") {
          LabsPage.load();
        } else if (hash === "#logs" && typeof LogsPage !== "undefined") {
          LogsPage.load();
        } else if (hash === "#providers" && typeof ProvidersPage !== "undefined") {
          ProvidersPage.init();
        }
      } catch (err) {
      console.error("Error initializing page:", err);
    }

    // Update Nav Links
    document.querySelectorAll(".nav-link").forEach((link) => {
      const href = link.getAttribute("href");
      if (href) {
        // Active if exact match or if hash is default and link is for labs
        const isActive = href === hash || (hash === "#labs" && href === "#labs");
        link.classList.toggle("active", isActive);
      }
    });
  };

  const init = () => {
    // Standard hash change listener
    window.addEventListener("hashchange", switchSection);
    
    // Manual click override for browsers with stale hash state
    document.getElementById("main-nav")?.addEventListener("click", (e) => {
      const link = e.target.closest(".nav-link");
      if (link && link.getAttribute("href")) {
        // Small delay to let the browser update window.location.hash
        setTimeout(switchSection, 0);
      }
    });

    // Handle initial load
    switchSection();
  };

  const initSession = () => {
    // Re-run switchSection once user is authenticated to load their data
    switchSection();
  };

  return { init, initSession };
})();

// Initialize when scripts are ready
document.addEventListener("DOMContentLoaded", () => {
  Auth.init();
  App.init();
});
