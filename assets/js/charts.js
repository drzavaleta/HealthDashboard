/**
 * Charts Page Module
 * Visualizes health metrics and sleep logs from Supabase using Chart.js
 */
const ChartsPage = (() => {
  let state = {
    metrics: [],
    sleep: [],
    timeframe: 7,
    charts: {},
  };

  const colors = {
    whoop: { border: '#ff3b30', bg: 'rgba(255, 59, 48, 0.1)' },
    eightSleep: { border: '#007aff', bg: 'rgba(0, 122, 255, 0.1)' },
    appleWatch: { border: '#34c759', bg: 'rgba(52, 199, 89, 0.1)' },
    iphone: { border: '#af52de', bg: 'rgba(175, 82, 222, 0.1)' },
    other: { border: '#8e8e93', bg: 'rgba(142, 142, 147, 0.1)' }
  };

  const normalizeSource = (source) => {
    const s = source.toLowerCase();
    if (s.includes('eight')) return 'Eight Sleep';
    if (s.includes('whoop')) return 'Whoop';
    if (s.includes('watch')) return 'Apple Watch';
    if (s.includes('iphone')) return 'iPhone';
    return 'Other';
  };

  const getSourceColor = (source) => {
    const label = normalizeSource(source);
    if (label === 'Whoop') return colors.whoop;
    if (label === 'Eight Sleep') return colors.eightSleep;
    if (label === 'Apple Watch') return colors.appleWatch;
    if (label === 'iPhone') return colors.iphone;
    return colors.other;
  };

  const loadData = async () => {
    try {
      // Load all daily summaries from health_metrics
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

  const filterByTimeframe = (data, dateField) => {
    if (state.timeframe === 9999) return data;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - state.timeframe);
    return data.filter(d => new Date(d[dateField]) >= cutoff);
  };

  /**
   * Groups data for Chart.js.
   * Supports specific metric name or a filter function.
   */
  const groupDataByDateAndSource = (data, metricFilter) => {
    const filtered = typeof metricFilter === 'function' 
      ? data.filter(metricFilter)
      : data.filter(d => d.metric_type === metricFilter);

    const byDate = {}; 
    filtered.forEach(d => {
      const date = new Date(d.recorded_at).toISOString().split('T')[0];
      if (!byDate[date]) byDate[date] = {};
      const sourceLabel = normalizeSource(d.source);
      // For sleep, we might be summing multiple stages if we use a filter function
      byDate[date][sourceLabel] = (byDate[date][sourceLabel] || 0) + d.value;
    });
    return byDate;
  };

  const createChart = (id, title, dataMap, type = 'line', yAxisOptions = {}) => {
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
      data: { 
        labels: dates.map(d => window.formatDateForDisplay(d)), 
        datasets 
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, padding: 20 } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          y: { 
            beginAtZero: yAxisOptions.min === 0, 
            min: yAxisOptions.min,
            max: yAxisOptions.max,
            grid: { color: 'rgba(0,0,0,0.05)' } 
          },
          x: { grid: { display: false } }
        }
      }
    });
  };

  const renderAllCharts = () => {
    const filteredMetrics = filterByTimeframe(state.metrics, 'recorded_at');

    // 1. Resting Heart Rate
    createChart('chart-rhr', 'RHR', groupDataByDateAndSource(filteredMetrics, 'resting_heart_rate'), 'line', { min: 0, max: 100 });

    // 2. HRV
    createChart('chart-hrv', 'HRV', groupDataByDateAndSource(filteredMetrics, 'heart_rate_variability'), 'line', { min: 0, max: 100 });

    // 3. Steps
    createChart('chart-steps', 'Steps', groupDataByDateAndSource(filteredMetrics, 'step_count'), 'bar', { min: 0 });

    // 4. Sleep (Sum of asleep + deep + rem + core)
    const sleepFilter = (d) => d.metric_type.startsWith('sleep_') && !d.metric_type.includes('in_bed') && !d.metric_type.includes('awake');
    createChart('chart-sleep', 'Sleep Duration', groupDataByDateAndSource(filteredMetrics, sleepFilter), 'line', { min: 0 });

    // 5. Respiratory Rate
    createChart('chart-resp', 'Respiratory Rate', groupDataByDateAndSource(filteredMetrics, 'respiratory_rate'), 'line', { min: 0 });
  };

  const init = () => {
    loadData();
  };

  return { init, updateTimeframe };
})();
