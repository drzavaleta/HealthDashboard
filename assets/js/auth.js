/**
 * Auth Module
 * Handles login, signup, session management, and user profile via Supabase.
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

  // Profile form elements
  const profileNameInput = document.getElementById("profile-name");
  const profileGenderSelect = document.getElementById("profile-gender");
  const profileDobInput = document.getElementById("profile-dob");
  const profileZone0Input = document.getElementById("profile-zone0");
  const profileZone1Input = document.getElementById("profile-zone1");
  const profileZone2Input = document.getElementById("profile-zone2");
  const profileZone3Input = document.getElementById("profile-zone3");
  const profileZone4Input = document.getElementById("profile-zone4");
  const saveProfileBtn = document.getElementById("save-profile-btn");
  const suggestZonesBtn = document.getElementById("suggest-zones-btn");
  const profileSaveStatus = document.getElementById("profile-save-status");

  // Default HR zone thresholds (based on max HR of 180)
  const DEFAULT_ZONES = {
    zone0_max: 90,   // 50% of 180
    zone1_max: 108,  // 60% of 180
    zone2_max: 126,  // 70% of 180
    zone3_max: 144,  // 80% of 180
    zone4_max: 162   // 90% of 180
  };

  let mode = 'login'; // 'login' or 'signup'
  let currentProfile = null; // Store the current user's profile

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

  // Extract initials from full name
  const getInitials = (fullName) => {
    if (!fullName || typeof fullName !== 'string') return null;
    
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0) return null;
    
    const first = parts[0].charAt(0).toUpperCase();
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : '';
    
    return first + last;
  };

  // Update the initials display
  const updateInitialsDisplay = (profile, email) => {
    if (profile && profile.full_name) {
      const initials = getInitials(profile.full_name);
      if (initials) {
        userInitials.textContent = initials;
        return;
      }
    }
    // Fallback to email first character
    userInitials.textContent = email ? email.charAt(0).toUpperCase() : 'U';
  };

  // Calculate age from a date string
  const calculateAge = (dobString) => {
    if (!dobString) return null;
    
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    
    return age;
  };

  // Calculate max heart rate based on gender and age
  // Men: 214 - (0.8 * age)
  // Women: 209 - (0.9 * age)
  // Default (if missing data): 220
  const calculateMaxHR = (gender, age) => {
    if (!gender || !age) {
      return 220;
    }
    
    if (gender === 'male') {
      return Math.round(214 - (0.8 * age));
    } else if (gender === 'female') {
      return Math.round(209 - (0.9 * age));
    }
    
    return 220;
  };

  // Calculate suggested zone thresholds based on max HR
  const calculateSuggestedZones = (maxHR) => {
    return {
      zone0_max: Math.round(0.5 * maxHR),
      zone1_max: Math.round(0.6 * maxHR),
      zone2_max: Math.round(0.7 * maxHR),
      zone3_max: Math.round(0.8 * maxHR),
      zone4_max: Math.round(0.9 * maxHR)
    };
  };

  // Handle "Calculate Suggested Values" button click
  const handleSuggestZones = () => {
    const gender = profileGenderSelect?.value || null;
    const dobString = profileDobInput?.value || null;
    const age = calculateAge(dobString);
    
    const maxHR = calculateMaxHR(gender, age);
    const zones = calculateSuggestedZones(maxHR);
    
    // Populate the zone inputs
    if (profileZone0Input) profileZone0Input.value = zones.zone0_max;
    if (profileZone1Input) profileZone1Input.value = zones.zone1_max;
    if (profileZone2Input) profileZone2Input.value = zones.zone2_max;
    if (profileZone3Input) profileZone3Input.value = zones.zone3_max;
    if (profileZone4Input) profileZone4Input.value = zones.zone4_max;
    
    // Show feedback
    if (profileSaveStatus) {
      const ageText = age ? ` (age ${age})` : '';
      profileSaveStatus.textContent = `Max HR: ${maxHR}${ageText}`;
      profileSaveStatus.className = 'profile-status';
      
      setTimeout(() => {
        profileSaveStatus.textContent = '';
      }, 3000);
    }
  };

  // Fetch user profile from database
  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await window.db
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (profile doesn't exist yet)
        console.error('Error fetching profile:', error);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  };

  // Save user profile to database
  const saveProfile = async () => {
    const session = await window.db.auth.getSession();
    if (!session.data.session) return;

    const userId = session.data.session.user.id;
    const fullName = profileNameInput?.value.trim();
    const gender = profileGenderSelect?.value || null;
    const dob = profileDobInput?.value || null;
    
    // Get zone values with validation
    const zone0 = parseInt(profileZone0Input?.value) || DEFAULT_ZONES.zone0_max;
    const zone1 = parseInt(profileZone1Input?.value) || DEFAULT_ZONES.zone1_max;
    const zone2 = parseInt(profileZone2Input?.value) || DEFAULT_ZONES.zone2_max;
    const zone3 = parseInt(profileZone3Input?.value) || DEFAULT_ZONES.zone3_max;
    const zone4 = parseInt(profileZone4Input?.value) || DEFAULT_ZONES.zone4_max;

    profileSaveStatus.textContent = 'Saving...';
    profileSaveStatus.className = 'profile-status saving';

    try {
      const { error } = await window.db
        .from('profiles')
        .upsert({
          id: userId,
          full_name: fullName || null,
          gender: gender,
          date_of_birth: dob,
          zone0_max: zone0,
          zone1_max: zone1,
          zone2_max: zone2,
          zone3_max: zone3,
          zone4_max: zone4
        });

      if (error) throw error;

      // Update local state
      currentProfile = {
        ...currentProfile,
        full_name: fullName,
        gender: gender,
        date_of_birth: dob,
        zone0_max: zone0,
        zone1_max: zone1,
        zone2_max: zone2,
        zone3_max: zone3,
        zone4_max: zone4
      };

      // Update initials display
      updateInitialsDisplay(currentProfile, session.data.session.user.email);

      profileSaveStatus.textContent = 'Saved!';
      profileSaveStatus.className = 'profile-status success';
      
      // Dispatch event so other modules can react to profile changes
      window.dispatchEvent(new CustomEvent('profileUpdated', { 
        detail: { zones: true } 
      }));
      
      setTimeout(() => {
        profileSaveStatus.textContent = '';
        profileSaveStatus.className = 'profile-status';
      }, 2000);

    } catch (err) {
      console.error('Error saving profile:', err);
      profileSaveStatus.textContent = 'Error saving';
      profileSaveStatus.className = 'profile-status error';
    }
  };

  // Populate profile form with existing data
  const populateProfileForm = (profile) => {
    if (profileNameInput) {
      profileNameInput.value = profile?.full_name || '';
    }
    if (profileGenderSelect) {
      profileGenderSelect.value = profile?.gender || '';
    }
    if (profileDobInput) {
      profileDobInput.value = profile?.date_of_birth || '';
    }
    if (profileZone0Input) {
      profileZone0Input.value = profile?.zone0_max ?? DEFAULT_ZONES.zone0_max;
    }
    if (profileZone1Input) {
      profileZone1Input.value = profile?.zone1_max ?? DEFAULT_ZONES.zone1_max;
    }
    if (profileZone2Input) {
      profileZone2Input.value = profile?.zone2_max ?? DEFAULT_ZONES.zone2_max;
    }
    if (profileZone3Input) {
      profileZone3Input.value = profile?.zone3_max ?? DEFAULT_ZONES.zone3_max;
    }
    if (profileZone4Input) {
      profileZone4Input.value = profile?.zone4_max ?? DEFAULT_ZONES.zone4_max;
    }
  };

  const showDashboard = async (show, session = null) => {
    if (show) {
      authSection.classList.add("hidden");
      dashboardContent.classList.remove("hidden");
      mainHeader.classList.remove("hidden");
      profileDropdown.classList.remove("hidden");
      
      if (session && session.user) {
        const email = session.user.email;
        userEmail.textContent = email;
        
        // Fetch and display profile
        currentProfile = await fetchProfile(session.user.id);
        populateProfileForm(currentProfile);
        updateInitialsDisplay(currentProfile, email);
      }

      App.initSession();
    } else {
      authSection.classList.remove("hidden");
      dashboardContent.classList.add("hidden");
      mainHeader.classList.add("hidden");
      profileDropdown.classList.add("hidden");
      currentProfile = null;
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

  // Get current profile (for use by other modules like Exercise)
  const getProfile = () => {
    return currentProfile;
  };

  // Calculate age from date of birth (public method)
  const getAge = () => {
    if (!currentProfile || !currentProfile.date_of_birth) return null;
    return calculateAge(currentProfile.date_of_birth);
  };

  // Get HR zone thresholds for Exercise page
  // Returns array of zone objects with min/max values
  // Zone 0 is included but typically not displayed in charts
  const getHRZones = () => {
    const z0 = currentProfile?.zone0_max ?? DEFAULT_ZONES.zone0_max;
    const z1 = currentProfile?.zone1_max ?? DEFAULT_ZONES.zone1_max;
    const z2 = currentProfile?.zone2_max ?? DEFAULT_ZONES.zone2_max;
    const z3 = currentProfile?.zone3_max ?? DEFAULT_ZONES.zone3_max;
    const z4 = currentProfile?.zone4_max ?? DEFAULT_ZONES.zone4_max;

    return [
      { name: 'Zone 0', min: 0, max: z0, display: false },
      { name: 'Zone 1', min: z0 + 1, max: z1, display: true },
      { name: 'Zone 2', min: z1 + 1, max: z2, display: true },
      { name: 'Zone 3', min: z2 + 1, max: z3, display: true },
      { name: 'Zone 4', min: z3 + 1, max: z4, display: true },
      { name: 'Zone 5', min: z4 + 1, max: 999, display: true }
    ];
  };

  const init = () => {
    authForm?.addEventListener("submit", handleAuth);
    toggleLink?.addEventListener("click", toggleMode);

    // Profile save button
    saveProfileBtn?.addEventListener("click", saveProfile);
    
    // Suggest zones button
    suggestZonesBtn?.addEventListener("click", handleSuggestZones);

    // Profile Dropdown Toggle
    profileBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle("show");
    });

    // Close dropdown when clicking elsewhere (but not inside dropdown)
    window.addEventListener("click", (e) => {
      if (!dropdownMenu.contains(e.target)) {
        dropdownMenu.classList.remove("show");
      }
    });

    // Prevent dropdown from closing when clicking inside the form
    dropdownMenu?.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    window.db.auth.onAuthStateChange((event, session) => {
      if (session) {
        showDashboard(true, session);
      } else {
        showDashboard(false);
      }
    });
  };

  return { init, signOut, getProfile, getAge, getHRZones };
})();
