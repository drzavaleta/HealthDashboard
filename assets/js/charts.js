/**
 * Charts Page Module
 * Visualizes health metrics and sleep logs from Supabase using Chart.js
 */
const ChartsPage = (() => {
  let state = {
    metrics: [],
    sleep: [],
    timeframe: 30,
    charts: {},
  };

  const colors = {
    whoop: { border: '#ff3b30', bg: 'rgba(255, 59, 48, 0.1)' },
    eightSleep: { border: '#007aff', bg: 'rgba(0, 122, 255, 0.1)' },
    appleWatch: { border: '#34c759', bg: 'rgba(52, 199, 89, 0.1)' },
    other: { border: '#8e8e93', bg: 'rgba(142, 142, 147, 0.1)' }
  };

  const normalizeSource = (source) => {
    const s = source.toLowerCase();
    if (s.includes('eight')) return 'Eight Sleep';
    if (s.includes('whoop')) return 'Whoop';
    if (s.includes('watch') || s.includes('iphone')) return 'Apple Watch';
    return 'Other';
  };

  const getSourceColor = (source) => {
    const label = normalizeSource(source);
    if (label === 'Whoop') return colors.whoop;
    if (label === 'Eight Sleep') return colors.eightSleep;
    if (label === 'Apple Watch') return colors.appleWatch;
    return colors.other;
  };

  const loadData = async () => {
    try {
      // Load both numeric metrics and sleep logs
      const [metricsRes, sleepRes] = await Promise.all([
        window.db.from('health_metrics').select('*').order('recorded_at', { ascending: true }),
        window.db.from('sleep_logs').select('*').order('start_time', { ascending: true })
      ]);

      if (metricsRes.error) throw metricsRes.error;
      if (sleepRes.error) throw sleepRes.error;

      state.metrics = metricsRes.data || [];
      state.sleep = sleepRes.data || [];
      
      renderAllCharts();
    } catch (err) {
      console.error("Error loading charts data:", err);
    }
  };

  const updateTimeframe = (days) => {
    state.timeframe = days === 'all' ? 9999 : parseInt(days);
    renderAllCharts();
  };

  const filterByTimeframe = (data, dateField) => {
    if (state.timeframe === 9999) return data;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - state.timeframe);
    return data.filter(d => new Date(d[dateField]) >= cutoff);
  };

  const groupDataByDateAndSource = (data, metricTypeKeywords) => {
    const filtered = data.filter(d => 
      metricTypeKeywords.some(key => d.metric_type.toLowerCase().includes(key.toLowerCase()))
    );
    const byDate = {}; 
    filtered.forEach(d => {
      const date = new Date(d.recorded_at).toISOString().split('T')[0];
      if (!byDate[date]) byDate[date] = {};
      const sourceLabel = normalizeSource(d.source);
      byDate[date][sourceLabel] = d.value;
    });
    return byDate;
  };

  const calculateSleepDuration = (sleepData) => {
    const byDate = {};
    sleepData.forEach(d => {
      const date = new Date(d.start_time).toISOString().split('T')[0];
      if (!byDate[date]) byDate[date] = {};
      const sourceLabel = normalizeSource(d.source);
      
      // Calculate duration in hours
      const duration = (new Date(d.end_time) - new Date(d.start_time)) / (1000 * 60 * 60);
      byDate[date][sourceLabel] = (byDate[date][sourceLabel] || 0) + duration;
    });
    return byDate;
  };

  const createChart = (id, title, dataMap, type = 'line') => {
    const ctx = document.getElementById(id);
    if (!ctx) return;
    if (state.charts[id]) state.charts[id].destroy();

    const dates = Object.keys(dataMap).sort();
    const sources = new Set();
    dates.forEach(d => Object.keys(dataMap[d]).forEach(s => sources.add(s)));

    const datasets = Array.from(sources).map(source => {
      const color = getSourceColor(source);
      return {
        label: source,
        data: dates.map(d => dataMap[d][source] ?? null),
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
    const filteredMetrics = filterByTimeframe(state.metrics, 'recorded_at');
    const filteredSleep = filterByTimeframe(state.sleep, 'start_time');

    // 1. RHR
    createChart('chart-rhr', 'Resting Heart Rate', groupDataByDateAndSource(filteredMetrics, ['resting_heart_rate', 'rhr']));

    // 2. HRV
    createChart('chart-hrv', 'HRV', groupDataByDateAndSource(filteredMetrics, ['heart_rate_variability', 'hrv']));

    // 3. Steps
    createChart('chart-steps', 'Steps', groupDataByDateAndSource(filteredMetrics, ['step_count', 'steps']), 'bar');

    // 4. Sleep (Calculated from sleep_logs)
    createChart('chart-sleep', 'Sleep Duration', calculateSleepDuration(filteredSleep));
  };

  const init = () => {
    loadData();
  };

  return { init, updateTimeframe };
})();
