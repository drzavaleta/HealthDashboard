# Health Dashboard - Project Status

This document summarizes the current state, architecture, and infrastructure decisions for the Personal Health Record (Health Dashboard) web app. Load this in any future session to get up to speed instantly.

## 🚀 Project Overview
A secure, responsive Single Page Application (SPA) for tracking personal health data, designed for iOS Safari and hosted on GitHub Pages with a Supabase cloud backend.

**Live URL:** [https://stayconnected.at](https://stayconnected.at)
**Owner User ID:** `cac3a2da-0baa-491e-bf0d-01a2740b50eb`

---

## 🛠 Tech Stack & Infrastructure
- **Frontend:** Vanilla HTML5, CSS3 (Custom Theme), Modern JavaScript (ES6+).
- **Visualization:** [Chart.js](https://www.chartjs.org/) + [chartjs-plugin-annotation](https://www.chartjs.org/chartjs-plugin-annotation/) for reference lines.
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
  - `charts.js`: Visualizes automated health metrics with custom crosshair plugin.
  - `labs.js`: Handles laboratory result rendering and filtering.
  - `meds.js`: CRUD for Medications, Supplements, and Discontinued items.
  - `logs.js`: CRUD for manual device logs (Apple Watch, Whoop, etc.).
  - `providers.js`: CRUD for healthcare provider contact list.
- `supabase/functions/`:
  - `health-sync/index.ts`: Main edge function for processing Health Auto Export data.
  - `capture-payload/index.ts`: Debug function to capture raw payloads for analysis.

---

## ✨ Key Features & Design Decisions

### 1. Health Automation Pipeline
- **iOS Integration:** Uses the **Health Auto Export** app on iPhone to send Apple Health data (Whoop, Eight Sleep, Apple Watch, Lingo) directly to Supabase.
- **3-Tier Storage Engine:**
  - **Tier 1 (Audit):** `raw_health_exports` table stores the full incoming JSON for 48 hours (auto-purged).
  - **Tier 2 (Source of Truth):** `health_samples` table stores high-resolution individual data points with deduplication.
  - **Tier 3 (Performance):** `health_metrics` VIEW calculates daily sums/averages on-the-fly for charts.
- **Source Normalization:** Automatically groups complex source names into clean categories (see Edge Function section below).
- **Deduplication:** Database-level `UNIQUE` constraints prevent duplicate entries when syncing overlapping timeframes.

### 2. Charts & Trends (Home Screen)
Charts are displayed in this order:
1. **Blood Glucose** (mg/dL) - Lingo CGM data
2. **Resting Heart Rate** (bpm) - Apple Watch, Whoop, Eight Sleep
3. **Heart Rate Variability** (ms) - Apple Watch only (see Device Notes)
4. **Daily Steps** - Apple Watch only
5. **Sleep Duration** (hrs) - Apple Watch, Whoop, Eight Sleep
6. **Respiratory Rate** (br/min) - Whoop, Eight Sleep

**Chart Features:**
- **Dynamic Timeframes:** Toggle between 7, 30, 90 days, or "All Time" views.
- **Multi-Source Comparison:** Different devices shown as separate colored lines.
- **Mobile Optimized:** Charts scale responsively for iPhone.

### 3. Blood Glucose Chart (Special Features)
The glucose chart has unique functionality for CGM data analysis:
- **24-Hour X-Axis:** Fixed scale from 0-23 hours with clean hour labels.
- **Day Navigation:** Left/right arrows to browse previous days. Defaults to yesterday on load.
- **No Point Markers:** Clean line without circles (too many data points).
- **Reference Lines:** Horizontal dashed lines at 70 mg/dL and 120 mg/dL for target range.
- **Interactive Crosshair:** Draggable vertical line shows exact time and glucose value at intersection.
  - Only enabled on the glucose chart (other charts use standard tooltips).
  - Touch-friendly for iOS Safari.
  - Orange dot highlights nearest data point.
  - Tooltip shows time and value (e.g., "14:30 — 105 mg/dL").

### 4. Chart Customization Options (charts.js)
The `createChart()` function supports these `yAxisOptions`:
- `min` / `max`: Y-axis bounds
- `skipMinimum: <number>`: Treat values below threshold as null (line skips them). Used for sleep to ignore values < 1 hour.
- `referenceLines: [70, 120]`: Array of y-values to draw horizontal dashed lines.
- `hidePoints: true`: Remove circle markers from data points.
- `isTimeBased: true`: Format x-axis labels as times instead of dates.

### 5. Responsive Navigation
- **Hamburger Menu:** Navigation links collapse into a hamburger icon on mobile.
- **Single-Line Header:** Brand title and icons are locked to a single row to maximize vertical space.
- **Interactive Icons:** Calendar picker added to date inputs for easier selection and one-click deletion.

### 6. Medications & Laboratory
- **Wide Sticky Columns:** Standardized 260px (180px mobile) sticky name columns for easy horizontal scrolling.
- **Smart Formatting:** Lab values use "capsule" styling (Red/High, Yellow/Low) for instant interpretation.
- **Interactive Tooltips:** Reference ranges are tucked away into "i" icons to reduce clutter.

---

## 🔄 Edge Function: health-sync

Located at `supabase/functions/health-sync/index.ts`

### Source Normalization Rules
The edge function normalizes device source names to clean categories:
| Raw Source Pattern | Normalized To |
|-------------------|---------------|
| Contains "watch" or "health" | `Apple Watch` |
| Contains "whoop" | `Whoop` |
| Contains "eight" | `Eight Sleep` |
| Contains "iphone" | `iPhone` |
| Contains "lingo" | `Lingo` |

### Special Processing Rules
1. **Pipe-Delimited Sources:** When source contains `|` (e.g., "Apple Watch|iPhone"), take only the first value.
2. **iPhone Steps Ignored:** Step count from iPhone is skipped (unreliable since phone isn't always carried).
3. **Eight Sleep Heart Rate → RHR:** Eight Sleep's `heart_rate` metric is converted to `resting_heart_rate`.
4. **Sleep Analysis Parsing:** `sleep_analysis` metric is split into `sleep_asleep`, `sleep_deep`, `sleep_rem`, etc. based on the `value` field.

### Date/Value Extraction
The function handles multiple date field formats from Auto Exporter:
- `sample.date` (primary)
- `sample.startDate` (fallback for sleep data)
- `sample.recorded_at`

Value is extracted from:
- `sample.qty` (primary)
- `sample.Avg` (for aggregated metrics)
- `sample.value` (fallback)

---

## 📊 Device Data Availability

Not all devices export all metrics to Apple Health. Current observed availability:

| Metric | Apple Watch | Whoop | Eight Sleep | Lingo | iPhone |
|--------|-------------|-------|-------------|-------|--------|
| Resting Heart Rate | ✅ | ✅ | ✅ (as heart_rate) | ❌ | ❌ |
| Heart Rate Variability | ✅ | ❌ | ❌ | ❌ | ❌ |
| Respiratory Rate | ❌ | ✅ | ✅ | ❌ | ❌ |
| Sleep Analysis | ❌ | ✅ | ✅ | ❌ | ❌ |
| Step Count | ✅ | ❌ | ❌ | ❌ | ✅ (ignored) |
| Blood Glucose | ❌ | ❌ | ❌ | ✅ | ❌ |

**Note:** Eight Sleep HRV is not exported to Apple Health, even though the Eight Sleep app displays it. To get Eight Sleep HRV, would need direct API integration.

---

## 🗄 Database Schema (Supabase)
All tables have `user_id` (uuid) and `RLS` enabled.

### Core Tables

#### `health_samples` (Source of Truth)
```sql
id UUID PRIMARY KEY,
user_id UUID NOT NULL,
metric_type TEXT NOT NULL,
value FLOAT8 NOT NULL,
unit TEXT,
source TEXT NOT NULL,
recorded_at TIMESTAMPTZ NOT NULL,
created_at TIMESTAMPTZ DEFAULT now(),
CONSTRAINT unique_sample UNIQUE (user_id, metric_type, source, recorded_at)
```

#### `health_metrics` (VIEW - Aggregated Daily Data)
```sql
CREATE VIEW health_metrics AS
SELECT
  user_id,
  metric_type,
  CASE 
    WHEN metric_type ILIKE ANY (ARRAY['%step%', '%energy%', '%distance%', '%calories%', '%sleep%', '%active%', '%flights%', '%exercise%']) THEN SUM(value)
    ELSE AVG(value)
  END as value,
  MAX(unit) as unit,
  source,
  date_trunc('day', recorded_at) as recorded_at
FROM health_samples
GROUP BY user_id, metric_type, source, date_trunc('day', recorded_at);
```

#### `raw_health_exports` (Audit/Debug)
Stores raw JSON payloads for 48 hours. Useful for debugging new metrics.

### Other Tables
- `workouts`: `activity_type`, `duration_min`, `calories_burned`, `source`, `start_time`, `end_time`.
- `medications`: `name`, `dose`, `frequency`, `start_date`
- `supplements`: `name`, `dose`, `frequency`, `start_date`, `url`
- `discontinued_meds`: `name`, `dose`, `frequency`, `notes`
- `labs`: `panel`, `test`, `result`, `units`, `reference_range`, `flag`, `date`
- `providers`: `first_name`, `last_name`, `suffix`, `specialty`, `url`, `office`, `cell`, `email`, `notes`

---

## 🧪 Testing New Metrics from Auto Exporter

When adding a new metric to Health Auto Export:

1. **Enable the metric** in Auto Exporter on iPhone.
2. **Trigger a sync** to your Supabase endpoint.
3. **Query the raw payload** to see the structure:
```sql
SELECT 
  m->>'name' as metric_name,
  m->>'units' as units,
  jsonb_array_length(m->'data') as sample_count
FROM raw_health_exports,
     jsonb_array_elements(payload->'data'->'metrics') as m
WHERE created_at = (SELECT MAX(created_at) FROM raw_health_exports)
ORDER BY metric_name;
```
4. **Inspect sample data**:
```sql
SELECT 
  sample->>'date' as date,
  sample->>'qty' as value,
  sample->>'source' as source
FROM raw_health_exports,
     jsonb_array_elements(payload->'data'->'metrics') as m,
     jsonb_array_elements(m->'data') as sample
WHERE created_at = (SELECT MAX(created_at) FROM raw_health_exports)
  AND m->>'name' = 'YOUR_METRIC_NAME'
LIMIT 10;
```
5. **Update edge function** if special handling is needed.
6. **Update health_metrics VIEW** if aggregation logic differs (SUM vs AVG).

### Important Distinction: Exercise Time vs Workouts
- **Apple Exercise Time** (`apple_exercise_time`): Green ring minutes — any activity with elevated heart rate. Comes as many small increments throughout the day.
- **Workouts** (`workouts`): Specific workout sessions manually started on Apple Watch. Includes activity type, duration, heart rate stats, calories. This is what you want for "I did a 45-minute walk" data.

---

## 📝 Roadmap / Pending Tasks
- [ ] **Workout Data Integration:** Enable "Workouts" in Auto Exporter (not Apple Exercise Time) to capture structured workout sessions with activity type, duration, and heart rate stats.
- [ ] **Edge Function Refinement:** Limit incoming payload size and filter for only necessary metrics.
- [ ] **Documents Section:** Secure storage for PDF lab reports.
- [ ] **AI PDF Scraper:** Automated data entry from PDF lab reports.
- [ ] **Data Export:** Button to download the full Supabase database as a CSV archive.
- [ ] **Detailed Sleep Charts:** Stacked bar charts showing percentage of time spent in each sleep stage.
- [ ] **Eight Sleep HRV:** Investigate direct Eight Sleep API integration since HRV isn't exported to Apple Health.

---

## 🛠 Recent Changes (Dec 22, 2025)

### Charts Improvements
- Blood Glucose chart moved to first position
- Added day navigation arrows (← →) to glucose chart
- Added interactive crosshair with time/value display (glucose only)
- Added reference lines at 70 and 120 mg/dL
- Removed point markers from glucose chart for cleaner line
- Changed glucose x-axis to clean 24-hour format (0-23)
- Added `skipMinimum` option to ignore low values (used for sleep < 1 hour)
- Fixed crosshair to only activate on glucose chart (`crosshair: false` on others)

### Database Cleanup
Ran migration to clean historical data:
- Deleted iPhone step count data (unreliable)
- Normalized pipe-delimited sources (took first value)
- Standardized all source names to clean categories
- Cleaned non-breaking space characters from source names

### Edge Function Verified
- Pipe-delimiter handling: ✅ (line 62)
- iPhone steps ignored: ✅ (lines 104-106)
- Source normalization: ✅ (lines 81-92)
- Eight Sleep HR → RHR conversion: ✅ (lines 98-101)
