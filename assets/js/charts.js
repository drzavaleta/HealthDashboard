/**
 * Charts Page Module
 * Visualizes health metrics from Supabase using Chart.js
 */
const ChartsPage = (() => {
  let state = {
    metrics: [],
    timeframe: 30, // Default to 30 days
    charts: {},    // Store chart instances
  };

  const colors = {
    whoop: { border: '#ff3b30', bg: 'rgba(255, 59, 48, 0.1)' },
    eightSleep: { border: '#007aff', bg: 'rgba(0, 122, 255, 0.1)' },
    appleWatch: { border: '#34c759', bg: 'rgba(52, 199, 89, 0.1)' },
  };

  const getSourceColor = (source) => {
    const s = source.toLowerCase();
    if (s.includes('whoop')) return colors.whoop;
    if (s.includes('eight')) return colors.eightSleep;
    if (s.includes('apple')) return colors.appleWatch;
    return { border: '#8e8e93', bg: 'rgba(142, 142, 147, 0.1)' };
  };

  const loadData = async () => {
    try {
      const { data, error } = await window.db
        .from('health_metrics')
        .select('*')
        .order('recorded_at', { ascending: true });

      if (error) throw error;
      state.metrics = data || [];
      renderAllCharts();
    } catch (err) {
      console.error("Error loading charts data:", err);
    }
  };

  const updateTimeframe = (days) => {
    state.timeframe = days === 'all' ? 9999 : parseInt(days);
    renderAllCharts();
  };

  const filterByTimeframe = (data) => {
    if (state.timeframe === 9999) return data;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - state.timeframe);
    return data.filter(d => new Date(d.recorded_at) >= cutoff);
  };

  const groupDataByDateAndSource = (data, metricTypes) => {
    const filtered = data.filter(d => metricTypes.includes(d.metric_type));
    const byDate = {}; // { 'YYYY-MM-DD': { 'Source': value } }

    filtered.forEach(d => {
      const date = new Date(d.recorded_at).toISOString().split('T')[0];
      if (!byDate[date]) byDate[date] = {};
      
      // Simplify source name
      let source = 'Other';
      if (d.source.toLowerCase().includes('whoop')) source = 'Whoop';
      else if (d.source.toLowerCase().includes('eight')) source = 'Eight Sleep';
      else if (d.source.toLowerCase().includes('watch')) source = 'Apple Watch';

      byDate[date][source] = d.value;
    });

    return byDate;
  };

  const createChart = (id, title, dataMap, type = 'line') => {
    const ctx = document.getElementById(id);
    if (!ctx) return;

    // Destroy existing chart to prevent ghosting
    if (state.charts[id]) state.charts[id].destroy();

    const dates = Object.keys(dataMap).sort();
    const sources = new Set();
    dates.forEach(d => Object.keys(dataMap[d]).forEach(s => sources.add(s)));

    const datasets = Array.from(sources).map(source => {
      const color = getSourceColor(source);
      return {
        label: source,
        data: dates.map(d => dataMap[d][source] || null),
        borderColor: color.border,
        backgroundColor: color.bg,
        tension: 0.3,
        fill: type === 'area',
        pointRadius: 4,
        spanGaps: true
      };
    });

    state.charts[id] = new Chart(ctx, {
      type: type === 'area' ? 'line' : type,
      data: { labels: dates, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, padding: 20 } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.05)' } },
          x: { grid: { display: false } }
        }
      }
    });
  };

  const renderAllCharts = () => {
    const filtered = filterByTimeframe(state.metrics);

    // 1. Resting Heart Rate
    const rhrData = groupDataByDateAndSource(filtered, ['resting_heart_rate', 'rhr']);
    createChart('chart-rhr', 'Resting Heart Rate', rhrData);

    // 2. HRV
    const hrvData = groupDataByDateAndSource(filtered, ['heart_rate_variability', 'hrv']);
    createChart('chart-hrv', 'HRV', hrvData);

    // 3. Steps
    const stepData = groupDataByDateAndSource(filtered, ['step_count', 'steps']);
    createChart('chart-steps', 'Steps', stepData, 'bar');

    // 4. Sleep (Simplified duration)
    const sleepData = groupDataByDateAndSource(filtered, ['sleep_analysis', 'total_sleep']);
    createChart('chart-sleep', 'Sleep', sleepData);
  };

  const init = () => {
    loadData();
  };

  return { init, updateTimeframe };
})();

