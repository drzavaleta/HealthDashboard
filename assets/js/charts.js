/**
 * Charts Page Module
 * Visualizes health metrics and sleep logs from Supabase using Chart.js
 */
const ChartsPage = (() => {
  let state = {
    metrics: [],
    glucoseSamples: [],
    timeframe: 7,
    charts: {},
  };

  const colors = {
    whoop: { border: '#ff3b30', bg: 'rgba(255, 59, 48, 0.1)' },
    eightSleep: { border: '#007aff', bg: 'rgba(0, 122, 255, 0.1)' },
    appleWatch: { border: '#34c759', bg: 'rgba(52, 199, 89, 0.1)' },
    iphone: { border: '#af52de', bg: 'rgba(175, 82, 222, 0.1)' },
    lingo: { border: '#ff9500', bg: 'rgba(255, 149, 0, 0.1)' },
    other: { border: '#8e8e93', bg: 'rgba(142, 142, 147, 0.1)' }
  };

  const normalizeSource = (source) => {
    if (!source || source === 'Unknown') return 'Other Source';
    
    // Clean common characters that might cause mismatch
    const s = source.replace(/\u00A0/g, ' ').toLowerCase();
    
    if (s.includes('eight')) return 'Eight Sleep';
    if (s.includes('whoop')) return 'Whoop';
    if (s.includes('watch') || s.includes('health')) return 'Apple Watch';
    if (s.includes('iphone')) return 'iPhone';
    if (s.includes('lingo')) return 'Lingo';
    
    console.log('[Source Debug] Unrecognized source:', source);
    return source; // Return raw name so we can identify it
  };

  const getSourceColor = (source) => {
    const label = normalizeSource(source);
    if (label === 'Whoop') return colors.whoop;
    if (label === 'Eight Sleep') return colors.eightSleep;
    if (label === 'Apple Watch') return colors.appleWatch;
    if (label === 'iPhone') return colors.iphone;
    if (label === 'Lingo') return colors.lingo;
    return colors.other;
  };

  const loadData = async () => {
    try {
      // 1. Load daily summaries from health_metrics
      const { data: metricsData, error: metricsError } = await window.db
        .from('health_metrics')
        .select('*')
        .order('recorded_at', { ascending: true });

      if (metricsError) throw metricsError;
      state.metrics = metricsData || [];

      // 2. Load raw glucose samples (last 48 hours for detail view)
      const { data: glucoseData, error: glucoseError } = await window.db
        .from('health_samples')
        .select('*')
        .eq('metric_type', 'blood_glucose')
        .gte('recorded_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .order('recorded_at', { ascending: true });

      if (glucoseError) throw glucoseError;
      state.glucoseSamples = glucoseData || [];

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
    const isSleep = typeof metricFilter === 'function' && metricFilter.toString().includes('sleep_');
    const filtered = typeof metricFilter === 'function' 
      ? data.filter(metricFilter)
      : data.filter(d => d.metric_type === metricFilter);

    const byDate = {}; 
    const counts = {}; // To calculate averages if multiple sources map to the same label

    filtered.forEach(d => {
      const date = new Date(d.recorded_at).toISOString().split('T')[0];
      if (!byDate[date]) {
        byDate[date] = {};
        counts[date] = {};
      }
      
      const sourceLabel = normalizeSource(d.source);
      
      // Determine if we should sum or average
      // We sum for sleep stages and "count" metrics like steps
      const metricName = d.metric_type.toLowerCase();
      const shouldSum = isSleep || metricName.includes('step') || metricName.includes('energy') || 
                        metricName.includes('distance') || metricName.includes('calories') || 
                        metricName.includes('active') || metricName.includes('flights');

      if (shouldSum) {
        byDate[date][sourceLabel] = (byDate[date][sourceLabel] || 0) + d.value;
      } else {
        // Average the values if multiple raw sources map to the same label (e.g. "WHOOP" and "Whoop")
        byDate[date][sourceLabel] = (byDate[date][sourceLabel] || 0) + d.value;
        counts[date][sourceLabel] = (counts[date][sourceLabel] || 0) + 1;
      }
    });

    // Finalize averages
    for (const date in counts) {
      for (const source in counts[date]) {
        if (counts[date][source] > 1) {
          byDate[date][source] /= counts[date][source];
        }
      }
    }

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
        labels: dates.map(d => {
          if (yAxisOptions.isTimeBased) {
            return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
          return window.formatDateForDisplay(d);
        }), 
        datasets 
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { usePointStyle: true, padding: 20 } },
          tooltip: { 
            mode: 'index', 
            intersect: false,
            callbacks: {
              title: (items) => {
                const d = dates[items[0].dataIndex];
                if (yAxisOptions.isTimeBased) {
                  return new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                }
                return window.formatDateForDisplay(d);
              }
            }
          }
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

    // 6. Blood Glucose (Intraday Detail)
    const glucoseMap = {};
    // Use raw samples for glucose to show fluctuations
    state.glucoseSamples.forEach(s => {
      const timeKey = s.recorded_at;
      if (!glucoseMap[timeKey]) glucoseMap[timeKey] = {};
      glucoseMap[timeKey]['Lingo'] = s.value;
    });

    createChart('chart-glucose', 'Blood Glucose', glucoseMap, 'line', { 
      min: 0, 
      isTimeBased: true 
    });
  };

  const init = () => {
    loadData();
  };

  return { init, updateTimeframe };
})();
