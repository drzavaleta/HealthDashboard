/**
 * Exercise Page - Workout Charts
 * Weekly Activity Duration and Heart Rate Zones
 */

const ExercisePage = (() => {
  let activityChart = null;
  let zonesChart = null;
  let weekStart = null; // Always a Sunday
  
  // Zone colors (static, thresholds come from Auth.getHRZones())
  // Index 0 = Zone 0 (not displayed), Index 1-5 = Zones 1-5
  const zoneColors = [
    { color: 'rgba(158, 158, 158, 0.7)', border: 'rgb(158, 158, 158)' }, // Zone 0 - Gray (not displayed)
    { color: 'rgba(76, 175, 80, 0.7)', border: 'rgb(76, 175, 80)' },     // Zone 1 - Green
    { color: 'rgba(139, 195, 74, 0.7)', border: 'rgb(139, 195, 74)' },   // Zone 2 - Light Green
    { color: 'rgba(255, 193, 7, 0.7)', border: 'rgb(255, 193, 7)' },     // Zone 3 - Yellow
    { color: 'rgba(255, 152, 0, 0.7)', border: 'rgb(255, 152, 0)' },     // Zone 4 - Orange
    { color: 'rgba(244, 67, 54, 0.7)', border: 'rgb(244, 67, 54)' }      // Zone 5 - Red
  ];

  // Get HR zones from profile (with colors added)
  function getHRZonesWithColors() {
    const zones = Auth.getHRZones();
    return zones.map((zone, i) => ({
      ...zone,
      color: zoneColors[i].color,
      border: zoneColors[i].border
    }));
  }

  function initWeek() {
    // Initialize to the current week's Sunday
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const day = now.getDay(); // 0 = Sunday
    weekStart = new Date(now);
    weekStart.setDate(now.getDate() - day);
  }

  // Color palette for different activities
  const activityColors = {
    'Walking': { bg: 'rgba(76, 175, 80, 0.7)', border: 'rgb(76, 175, 80)' },
    'Running': { bg: 'rgba(244, 67, 54, 0.7)', border: 'rgb(244, 67, 54)' },
    'Cycling': { bg: 'rgba(33, 150, 243, 0.7)', border: 'rgb(33, 150, 243)' },
    'Swimming': { bg: 'rgba(0, 188, 212, 0.7)', border: 'rgb(0, 188, 212)' },
    'Golf': { bg: 'rgba(139, 195, 74, 0.7)', border: 'rgb(139, 195, 74)' },
    'Yoga': { bg: 'rgba(156, 39, 176, 0.7)', border: 'rgb(156, 39, 176)' },
    'Strength Training': { bg: 'rgba(255, 87, 34, 0.7)', border: 'rgb(255, 87, 34)' },
    'HIIT': { bg: 'rgba(255, 152, 0, 0.7)', border: 'rgb(255, 152, 0)' },
    'Elliptical': { bg: 'rgba(121, 85, 72, 0.7)', border: 'rgb(121, 85, 72)' },
    'Rowing': { bg: 'rgba(63, 81, 181, 0.7)', border: 'rgb(63, 81, 181)' },
    'Stair Climbing': { bg: 'rgba(96, 125, 139, 0.7)', border: 'rgb(96, 125, 139)' },
    'Sauna': { bg: 'rgba(255, 111, 0, 0.7)', border: 'rgb(255, 111, 0)' },
    'default': { bg: 'rgba(158, 158, 158, 0.7)', border: 'rgb(158, 158, 158)' }
  };

  function getActivityColor(activity) {
    return activityColors[activity] || activityColors['default'];
  }

  function formatDateISO(date) {
    return date.toISOString().split('T')[0];
  }

  function formatDayLabel(date) {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'numeric', 
      day: 'numeric'
    });
  }

  // Get ISO week number
  function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  // Get array of 7 dates for the week (Sun-Sat)
  function getWeekDates() {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      dates.push(d);
    }
    return dates;
  }

  function formatDateRange(startDate, endDate) {
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} – ${endDay}`;
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
  }

  function updatePageHeader() {
    const dates = getWeekDates();
    const thursday = new Date(weekStart);
    thursday.setDate(weekStart.getDate() + 4);
    const weekNum = getWeekNumber(thursday);

    const weekLabel = document.getElementById('exercise-week-label');
    const dateRange = document.getElementById('exercise-date-range');
    
    if (weekLabel) {
      weekLabel.textContent = `Week ${weekNum}`;
    }
    if (dateRange) {
      dateRange.textContent = formatDateRange(dates[0], dates[6]);
    }
  }

  async function fetchWeekData() {
    const dates = getWeekDates();
    const startStr = formatDateISO(dates[0]);
    const endStr = formatDateISO(dates[6]);
    
    const { data, error } = await window.db
      .from('workouts')
      .select('activity_type, duration_min, workout_date')
      .gte('workout_date', startStr)
      .lte('workout_date', endStr)
      .order('workout_date')
      .order('activity_type');

    if (error) {
      console.error('Error fetching workout data:', error);
      return { workouts: [], dates };
    }

    return { workouts: data || [], dates };
  }

  async function fetchHeartRateData() {
    const dates = getWeekDates();
    const startDate = dates[0];
    const endDate = new Date(dates[6]);
    endDate.setDate(endDate.getDate() + 1); // Include full Saturday
    
    // Query workout_heart_rate for the week
    // Need to join with workouts to get workout_date filter
    const { data, error } = await window.db
      .from('workout_heart_rate')
      .select(`
        avg_hr,
        workout_id,
        workouts!inner (
          workout_date
        )
      `)
      .gte('workouts.workout_date', formatDateISO(startDate))
      .lte('workouts.workout_date', formatDateISO(dates[6]));

    if (error) {
      console.error('Error fetching heart rate data:', error);
      return [];
    }

    return data || [];
  }

  function categorizeHR(avgHR, zones) {
    for (let i = 0; i < zones.length; i++) {
      if (avgHR >= zones[i].min && avgHR <= zones[i].max) {
        return i;
      }
    }
    return 4; // Default to Zone 5 if above all thresholds
  }

  async function renderActivityChart() {
    const { workouts, dates } = await fetchWeekData();
    const ctx = document.getElementById('chart-activity');
    
    if (!ctx) return;

    // Calculate total minutes (excluding Sauna)
    const totalMinutes = workouts
      .filter(w => w.activity_type !== 'Sauna')
      .reduce((sum, w) => sum + (w.duration_min || 0), 0);

    // Update total label
    const totalLabel = document.getElementById('activity-total-label');
    if (totalLabel) {
      totalLabel.textContent = `${totalMinutes} min`;
    }

    // Destroy existing chart
    if (activityChart) {
      activityChart.destroy();
    }

    // Create x-axis labels (Sun 12/22, Mon 12/23, etc.)
    const labels = dates.map(d => formatDayLabel(d));

    // Group workouts by date and activity
    const byDateActivity = {};
    const allActivities = new Set();
    
    for (const workout of workouts) {
      const dateKey = workout.workout_date;
      if (!byDateActivity[dateKey]) {
        byDateActivity[dateKey] = {};
      }
      if (!byDateActivity[dateKey][workout.activity_type]) {
        byDateActivity[dateKey][workout.activity_type] = 0;
      }
      byDateActivity[dateKey][workout.activity_type] += workout.duration_min;
      allActivities.add(workout.activity_type);
    }

    // Sort activities for consistent ordering
    const activityList = Array.from(allActivities).sort();

    // Create datasets - one per activity type
    const datasets = activityList.map(activity => {
      const color = getActivityColor(activity);
      return {
        label: activity,
        data: dates.map(d => {
          const dateKey = formatDateISO(d);
          return byDateActivity[dateKey]?.[activity] || 0;
        }),
        backgroundColor: color.bg,
        borderColor: color.border,
        borderWidth: 2,
        borderRadius: 4
      };
    });

    // Handle empty state
    if (datasets.length === 0) {
      datasets.push({
        label: 'No workouts',
        data: [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(200, 200, 200, 0.3)',
        borderColor: 'rgba(200, 200, 200, 0.5)',
        borderWidth: 1
      });
    }

    activityChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 16,
              font: { size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.parsed.y;
                if (value === 0) return null;
                return `${context.dataset.label}: ${value} min`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            title: { 
              display: true, 
              text: 'Minutes',
              font: { size: 12 }
            },
            ticks: {
              stepSize: 15
            }
          }
        }
      }
    });
  }

  async function renderZonesChart() {
    const hrData = await fetchHeartRateData();
    const ctx = document.getElementById('chart-zones');
    
    if (!ctx) return;

    // Get HR zones from user profile (includes Zone 0)
    const hrZones = getHRZonesWithColors();

    // Categorize each HR record into zones
    // Each record represents approximately 1 minute of workout
    // 6 zones: Zone 0-5 (Zone 0 is not displayed)
    const zoneCounts = [0, 0, 0, 0, 0, 0];
    
    for (const record of hrData) {
      if (record.avg_hr) {
        const zoneIndex = categorizeHR(record.avg_hr, hrZones);
        if (zoneIndex >= 0 && zoneIndex < zoneCounts.length) {
          zoneCounts[zoneIndex]++;
        }
      }
    }

    // Filter to only displayable zones (Zone 1-5, skip Zone 0)
    const displayZones = hrZones.filter(z => z.display !== false);
    const displayCounts = zoneCounts.slice(1); // Skip Zone 0 count

    // Total only includes displayed zones (Zone 1-5)
    const totalZoneMinutes = displayCounts.reduce((a, b) => a + b, 0);

    // Update total label
    const totalLabel = document.getElementById('zones-total-label');
    if (totalLabel) {
      totalLabel.textContent = `${totalZoneMinutes} min`;
    }

    // Destroy existing chart
    if (zonesChart) {
      zonesChart.destroy();
    }

    // Create chart (using displayZones which excludes Zone 0)
    zonesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: displayZones.map(z => z.name),
        datasets: [{
          label: 'Minutes',
          data: displayCounts,
          backgroundColor: displayZones.map(z => z.color),
          borderColor: displayZones.map(z => z.border),
          borderWidth: 2,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                const zone = displayZones[idx];
                if (idx === displayZones.length - 1) return `${zone.name}: ${zone.min}+ bpm`;
                return `${zone.name}: ${zone.min}-${zone.max} bpm`;
              },
              label: (context) => {
                return `${context.parsed.y} minutes`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 13, weight: '600' }
            }
          },
          y: {
            beginAtZero: true,
            title: { 
              display: true, 
              text: 'Minutes',
              font: { size: 12 }
            },
            ticks: {
              stepSize: 10
            }
          }
        }
      }
    });
  }

  async function renderAllCharts() {
    updatePageHeader();
    await Promise.all([
      renderActivityChart(),
      renderZonesChart()
    ]);
  }

  function navigate(direction) {
    if (!weekStart) {
      initWeek();
    }
    
    // Navigate by week (7 days)
    weekStart.setDate(weekStart.getDate() + (direction * 7));
    renderAllCharts();
  }

  async function init() {
    // Initialize week if not set
    if (!weekStart) {
      initWeek();
    }
    
    await renderAllCharts();
  }

  return {
    init,
    navigate,
    renderActivityChart,
    renderZonesChart
  };
})();

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Will be called by app.js when exercise section is shown
  
  // Listen for profile updates to refresh zones chart
  window.addEventListener('profileUpdated', (e) => {
    if (e.detail?.zones) {
      // Only refresh if the exercise section is visible
      const exerciseSection = document.getElementById('exercise');
      if (exerciseSection && !exerciseSection.classList.contains('hidden')) {
        ExercisePage.renderZonesChart();
      }
    }
  });
});
