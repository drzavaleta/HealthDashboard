// Main App Controller
const App = (() => {
  const switchSection = () => {
    const hash = window.location.hash || "#charts";
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
        if (hash === "#charts" && typeof ChartsPage !== "undefined") {
          ChartsPage.init();
        } else if (hash === "#meds" && typeof MedsPage !== "undefined") {
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
        // Active if exact match or if hash is default and link is for charts
        const isActive = href === hash || (hash === "#charts" && href === "#charts");
        link.classList.toggle("active", isActive);
      }
    });
  };

  const init = () => {
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const navLinks = document.getElementById("nav-links");

    // Standard hash change listener
    window.addEventListener("hashchange", () => {
      switchSection();
      // Close mobile menu on navigation
      navLinks?.classList.remove("show");
    });
    
    // Manual click override for browsers with stale hash state
    document.getElementById("main-nav")?.addEventListener("click", (e) => {
      const link = e.target.closest(".nav-link");
      if (link && link.getAttribute("href")) {
        // Small delay to let the browser update window.location.hash
        setTimeout(switchSection, 0);
        // Close mobile menu on navigation
        navLinks?.classList.remove("show");
      }
    });

    // Hamburger Toggle
    hamburgerBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      navLinks?.classList.toggle("show");
    });

    // Close menu when clicking elsewhere
    window.addEventListener("click", (e) => {
      if (!e.target.closest("#main-nav")) {
        navLinks?.classList.remove("show");
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
