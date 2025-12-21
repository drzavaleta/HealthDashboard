# Health Dashboard - Project Status

This document summarizes the current state, architecture, and infrastructure decisions for the Personal Health Record (Health Dashboard) web app. Load this in any future session to get up to speed instantly.

## 🚀 Project Overview
A secure, responsive Single Page Application (SPA) for tracking personal health data, designed for iOS Safari and hosted on GitHub Pages with a Supabase cloud backend.

**Live URL:** [https://stayconnected.at](https://stayconnected.at)
**Owner User ID:** `cac3a2da-0baa-491e-bf0d-01a2740b50eb`

---

## 🛠 Tech Stack & Infrastructure
- **Frontend:** Vanilla HTML5, CSS3 (Custom Theme), Modern JavaScript (ES6+).
- **Backend-as-a-Service:** [Supabase](https://supabase.com/)
  - **Auth:** Email/Password authentication.
  - **Database:** PostgreSQL with Row Level Security (RLS).
  - **Security:** RLS policies ensure users can only see/edit their own records.
- **Hosting:** GitHub Pages.
- **Custom Domain:** `stayconnected.at` (A records pointed to GitHub IPs, CNAME for `www`).

---

## 📂 Architecture & File Structure
- `index.html`: The main SPA container.
- `assets/css/theme.css`: Healthcare-focused theme, responsive layouts, and table styling.
- `assets/js/`:
  - `supabase-config.js`: Initializes the Supabase client.
  - `auth.js`: Manages login/signup toggles and session states.
  - `app.js`: Main router (hash-based navigation).
  - `labs.js`: Handles laboratory result rendering and filtering.
  - `meds.js`: CRUD for Medications, Supplements, and Discontinued items.
  - `logs.js`: CRUD for device logs (Apple Watch, Whoop, etc.).
  - `providers.js`: CRUD for healthcare provider contact list.
- `data/`: Original CSV sources (now migrated to DB).

---

## ✨ Key Features & Design Decisions

### 1. Security First
- The site is locked behind a **Login/Signup** screen.
- The Dashboard header and content are hidden from the DOM until a valid Supabase session is detected.

### 2. Laboratory Page
- **Horizontal Date Columns:** Trends are viewed left-to-right (newest first).
- **Auto-Alignment:** Dates are perfectly aligned across different panels.
- **Smart Formatting:** Values are "capsuled" (Red for High, Yellow for Low).
- **Tooltips:** Hovering over the "i" next to a test name reveals the reference range.
- **Filters:** Ability to filter by Panel name or Flag status (High/Low/Normal).

### 3. Medications & Supplements
- **Grokipedia Integration:** All item names are hyperlinks to `grokipedia.com` searches.
- **Shopping Shortcuts:** Supplements include a 🛒 icon if a reorder URL is provided.
- **Inline Editing:** Full CRUD (Create, Read, Update, Delete) directly in the table.
- **Discontinued Table:** Replaced "Start Date" with a "Notes" string for historical context.

### 4. Daily Logs
- **Device Grouping:** Tables for Apple Watch, Whoop, and Eight Sleep.
- **7-Day View:** Only shows the most recent week of data to keep the UI clean.
- **Column Addition:** Users can add a new date column via a calendar picker.

### 5. Providers
- Separate fields for First Name, Last Name, Suffix, and Specialty.
- **Smart Sorting:** Automatically sorted alphabetically by **Last Name**.

---

## 🗄 Database Schema (Supabase)
All tables have `user_id` (uuid) and `RLS` enabled.
- `medications`: `name`, `dose`, `frequency`, `start_date`
- `supplements`: `name`, `dose`, `frequency`, `start_date`, `url`
- `discontinued_meds`: `name`, `dose`, `frequency`, `notes`
- `labs`: `panel`, `test`, `result`, `units`, `reference_range`, `flag`, `date`
- `daily_logs`: `device`, `test`, `result`, `date`
- `providers`: `first_name`, `last_name`, `suffix`, `specialty`, `url`, `office`, `cell`, `email`, `notes`

---

## 📝 Roadmap / Pending Tasks
- [ ] **Exercise Plan Section:** Currently disabled in nav.
- [ ] **Documents Section:** Currently disabled in nav.
- [ ] **AI PDF Scraper:** Future feature to upload PDF lab reports and auto-populate the `labs` table using LLM extraction.
- [ ] **Data Export:** Ability to download current DB state as CSV.
- [ ] **History View:** Toggle to see more than the past 7 days of logs.

