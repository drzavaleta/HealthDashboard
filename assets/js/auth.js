/**
 * Auth Module
 * Handles login, signup, and session management via Supabase.
 */
const Auth = (() => {
  const authSection = document.getElementById("auth-section");
  const dashboardContent = document.getElementById("dashboard-content");
  const mainHeader = document.getElementById("main-header");
  const authForm = document.getElementById("auth-form");
  const authError = document.getElementById("auth-error");
  
  const profileDropdown = document.getElementById("profile-dropdown");
  const profileBtn = document.getElementById("profile-btn");
  const dropdownMenu = document.getElementById("dropdown-menu");
  const userInitials = document.getElementById("user-initials");
  const userEmail = document.getElementById("user-email");

  const confirmGroup = document.getElementById("confirm-password-group");
  const submitBtn = document.getElementById("auth-submit-btn");
  const toggleLink = document.getElementById("btn-toggle-auth");
  const toggleText = document.getElementById("toggle-text");
  const authTitle = document.getElementById("auth-title");

  let mode = 'login'; // 'login' or 'signup'

  const toggleMode = (e) => {
    e.preventDefault();
    mode = mode === 'login' ? 'signup' : 'login';
    
    if (mode === 'signup') {
      authTitle.textContent = "Create Account";
      confirmGroup.classList.remove("hidden");
      submitBtn.textContent = "Sign Up";
      toggleText.innerHTML = `Already have an account? <a href="#" id="btn-toggle-auth">Login</a>`;
    } else {
      authTitle.textContent = "Health Dashboard";
      confirmGroup.classList.add("hidden");
      submitBtn.textContent = "Login";
      toggleText.innerHTML = `Don't have an account? <a href="#" id="btn-toggle-auth">Sign Up</a>`;
    }
    
    // Re-attach listener to the new link
    document.getElementById("btn-toggle-auth").addEventListener("click", toggleMode);
    authError.classList.add("hidden");
  };

  const showDashboard = (show, session = null) => {
    if (show) {
      authSection.classList.add("hidden");
      dashboardContent.classList.remove("hidden");
      mainHeader.classList.remove("hidden");
      profileDropdown.classList.remove("hidden");
      
      if (session && session.user) {
        const email = session.user.email;
        userEmail.textContent = email;
        userInitials.textContent = email.charAt(0).toUpperCase();
      }

      App.initSession();
    } else {
      authSection.classList.remove("hidden");
      dashboardContent.classList.add("hidden");
      mainHeader.classList.add("hidden");
      profileDropdown.classList.add("hidden");
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value.trim();
    authError.classList.add("hidden");

    if (!email || !password) {
      authError.textContent = "Please enter both email and password.";
      authError.classList.remove("hidden");
      return;
    }

    if (mode === 'signup') {
      const confirmPassword = document.getElementById("auth-confirm-password").value.trim();
      if (password !== confirmPassword) {
        authError.textContent = "Passwords do not match.";
        authError.classList.remove("hidden");
        return;
      }
      if (password.length < 6) {
        authError.textContent = "Password must be at least 6 characters.";
        authError.classList.remove("hidden");
        return;
      }
    }

    try {
      let result;
      if (mode === 'login') {
        result = await window.db.auth.signInWithPassword({ email, password });
      } else {
        result = await window.db.auth.signUp({ email, password });
        if (!result.error) {
          alert("Success! Check your email for a link, or try logging in if you disabled confirmation.");
        }
      }

      if (result.error) throw result.error;
    } catch (err) {
      authError.textContent = err.message;
      authError.classList.remove("hidden");
    }
  };

  const signOut = async () => {
    await window.db.auth.signOut();
    location.reload();
  };

  const init = () => {
    authForm?.addEventListener("submit", handleAuth);
    toggleLink?.addEventListener("click", toggleMode);

    // Profile Dropdown Toggle
    profileBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle("show");
    });

    // Close dropdown when clicking elsewhere
    window.addEventListener("click", () => {
      dropdownMenu.classList.remove("show");
    });

    window.db.auth.onAuthStateChange((event, session) => {
      if (session) {
        showDashboard(true, session);
      } else {
        showDashboard(false);
      }
    });
  };

  return { init, signOut };
})();
