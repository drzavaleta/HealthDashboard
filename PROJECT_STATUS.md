# Health Dashboard - Project Status

This document summarizes the current state, architecture, and infrastructure decisions for the Personal Health Record (Health Dashboard) web app. Load this in any future session to get up to speed instantly.

## 🚀 Project Overview
A secure, responsive Single Page Application (SPA) for tracking personal health data, designed for iOS Safari and hosted on GitHub Pages with a Supabase cloud backend.

**Live URL:** [https://stayconnected.at](https://stayconnected.at)
**Owner User ID:** `cac3a2da-0baa-491e-bf0d-01a2740b50eb`

---

## 🛠 Tech Stack & Infrastructure
- **Frontend:** Vanilla HTML5, CSS3 (Custom Theme), Modern JavaScript (ES6+).
- **Visualization:** [Chart.js](https://www.chartjs.org/) for real-time health trends.
- **Backend-as-a-Service:** [Supabase](https://supabase.com/)
  - **Auth:** Email/Password authentication.
  - **Database:** PostgreSQL with Row Level Security (RLS).
  - **Edge Functions:** Deno-based functions for secure third-party data ingestion (iPhone sync).
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
  - `charts.js`: Visualizes automated health metrics (RHR, HRV, Steps, Sleep).
  - `labs.js`: Handles laboratory result rendering and filtering.
  - `meds.js`: CRUD for Medications, Supplements, and Discontinued items.
  - `logs.js`: CRUD for manual device logs (Apple Watch, Whoop, etc.).
  - `providers.js`: CRUD for healthcare provider contact list.

---

## ✨ Key Features & Design Decisions

### 1. Health Automation Pipeline
- **iOS Integration:** Uses the **Health Auto Export** app on iPhone to "teleport" Apple Health data (Whoop, Eight Sleep, Apple Watch) directly to Supabase.
- **Translator Engine:** A Supabase Edge Function (`health-sync`) acts as a middleman, cleaning and routing incoming JSON data to the correct tables.
- **Source Normalization:** Automatically groups complex source names (e.g., "Jeffrey's Apple Watch") into clean categories ("Apple Watch", "Whoop", "Eight Sleep").
- **Deduplication:** Database-level `UNIQUE` constraints and `upsert` logic prevent duplicate entries when syncing the same timeframe multiple times.

### 2. Charts & Trends (New Home Screen)
- **Primary View:** The Charts page is now the first tab, providing an immediate overview of health trends.
- **Comparative Tracking:** Supports multi-source comparison (e.g., Whoop HRV vs. Eight Sleep HRV) on a single timeline.
- **Dynamic Timeframes:** Users can toggle between 7, 30, 90 days, or "All Time" views.
- **Mobile Optimized:** Charts are locked to a usable height (300px on mobile) to ensure readability on iPhone.

### 3. Responsive Navigation
- **Hamburger Menu:** Navigation links collapse into a hamburger icon on mobile.
- **Single-Line Header:** Brand title and icons are locked to a single row to maximize vertical space.
- **Interactive Icons:** Calendar picker added to date inputs for easier selection and one-click deletion.

### 4. Medications & Laboratory
- **Wide Sticky Columns:** Standardized 260px (180px mobile) sticky name columns for easy horizontal scrolling.
- **Smart Formatting:** Lab values use "capsule" styling (Red/High, Yellow/Low) for instant interpretation.
- **Interactive Tooltips:** Reference ranges are tucked away into "i" icons to reduce clutter.

---

## 🗄 Database Schema (Supabase)
All tables have `user_id` (uuid) and `RLS` enabled.

### Automated Metrics
- `health_metrics`: `metric_type`, `value`, `unit`, `source`, `recorded_at`. (Unique on `user_id, metric_type, recorded_at, source`).
- `sleep_logs`: `sleep_stage` (rem, deep, etc.), `start_time`, `end_time`, `source`. (Unique on `user_id, source, start_time`).
- `workouts`: `activity_type`, `duration_min`, `calories_burned`, `source`, `start_time`, `end_time`.

### Manual Entries
- `medications`: `name`, `dose`, `frequency`, `start_date`
- `supplements`: `name`, `dose`, `frequency`, `start_date`, `url`
- `discontinued_meds`: `name`, `dose`, `frequency`, `notes`
- `labs`: `panel`, `test`, `result`, `units`, `reference_range`, `flag`, `date`
- `providers`: `first_name`, `last_name`, `suffix`, `specialty`, `url`, `office`, `cell`, `email`, `notes`

---

## 📝 Roadmap / Pending Tasks
- [ ] **Edge Function Refinement:** Limit incoming payload size and filter for only necessary metrics.
- [ ] **Exercise Plan Section:** Build out routine definitions and recovery-based workout suggestions.
- [ ] **Documents Section:** Secure storage for PDF lab reports.
- [ ] **AI PDF Scraper:** Automated data entry from PDF lab reports.
- [ ] **Data Export:** Button to download the full Supabase database as a CSV archive.
- [ ] **Detailed Sleep Charts:** Stacked bar charts showing percentage of time spent in each sleep stage.
