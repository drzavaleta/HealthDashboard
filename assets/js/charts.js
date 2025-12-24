/**
 * Charts Page Module
 * Visualizes health metrics and sleep logs from Supabase using Chart.js
 */

// Custom Crosshair Plugin for interactive vertical line
const crosshairPlugin = {
  id: 'crosshair',
  defaults: {
    color: 'rgba(0, 0, 0, 0.5)',
    lineWidth: 1,
    lineDash: [4, 4]
  },
  afterInit: (chart) => {
    chart.crosshair = { x: null, y: null };
  },
  afterEvent: (chart, args) => {
    // Only activate if crosshair plugin is explicitly enabled for this chart
    if (chart.options.plugins.crosshair !== true) return;
    
    const { event } = args;
    if (event.type === 'mousemove' || event.type === 'touchmove' || event.type === 'touchstart') {
      const canvasPosition = Chart.helpers.getRelativePosition(event, chart);
      chart.crosshair = { x: canvasPosition.x, y: canvasPosition.y };
      chart.draw();
    } else if (event.type === 'mouseout' || event.type === 'touchend') {
      chart.crosshair = { x: null, y: null };
      chart.draw();
    }
  },
  afterDatasetsDraw: (chart) => {
    // Only activate if crosshair plugin is explicitly enabled for this chart
    if (chart.options.plugins.crosshair !== true) return;
    
    const { ctx, chartArea, scales } = chart;
    const { x } = chart.crosshair;
    
    if (x === null || x < chartArea.left || x > chartArea.right) return;
    
    // Draw vertical line
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
    
    // Find nearest data point
    const xScale = scales.x;
    const xValue = xScale.getValueForPixel(x);
    const dataset = chart.data.datasets[0];
    if (!dataset || !dataset.data.length) return;
    
    // Find closest point
    let closest = null;
    let minDist = Infinity;
    dataset.data.forEach(point => {
      const dist = Math.abs(point.x - xValue);
      if (dist < minDist) {
        minDist = dist;
        closest = point;
      }
    });
    
    if (!closest) return;
    
    // Draw dot at intersection
    const pointX = xScale.getPixelForValue(closest.x);
    const pointY = scales.y.getPixelForValue(closest.y);
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(pointX, pointY, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#ff9500';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    
    // Format time from decimal hour
    const hours = Math.floor(closest.x);
    const minutes = Math.round((closest.x - hours) * 60);
    const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}`;
    const valueStr = `${Math.round(closest.y)} mg/dL`;
    const labelText = `${timeStr} — ${valueStr}`;
    
    // Draw label box
    ctx.save();
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
    const textWidth = ctx.measureText(labelText).width;
    const boxPadding = 8;
    const boxWidth = textWidth + boxPadding * 2;
    const boxHeight = 24;
    
    // Position box (flip if near right edge)
    let boxX = pointX + 10;
    if (boxX + boxWidth > chartArea.right) {
      boxX = pointX - boxWidth - 10;
    }
    let boxY = pointY - boxHeight / 2;
    if (boxY < chartArea.top) boxY = chartArea.top;
    if (boxY + boxHeight > chartArea.bottom) boxY = chartArea.bottom - boxHeight;
    
    // Draw rounded rectangle
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
    ctx.fill();
    
    // Draw text
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(labelText, boxX + boxPadding, boxY + boxHeight / 2);
    ctx.restore();
  }
};

// Register the plugin globally
Chart.register(crosshairPlugin);

const ChartsPage = (() => {
  let state = {
    metrics: [],
    glucoseSamples: [],
    timeframe: 7,
    charts: {},
    glucoseDate: null,  // Track currently displayed glucose date
  };

  // Initialize glucose date to yesterday
  const initGlucoseDate = () => {
    const now = new Date();
    state.glucoseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  };

  // Navigate glucose chart by days (-1 = previous, +1 = next)
  const navigateGlucose = (direction) => {
    if (!state.glucoseDate) initGlucoseDate();
    state.glucoseDate.setDate(state.glucoseDate.getDate() + direction);
    renderGlucoseChart();
  };

  // Expose navigation function globally for button clicks
  window.navigateGlucose = navigateGlucose;

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
      // Use more solid colors for bar charts (0.7 opacity instead of 0.1)
      const barBgColor = color.border.replace(')', ', 0.7)').replace('rgb', 'rgba');
      return {
        label: source,
        data: dates.map(d => {
          const val = dataMap[d][source];
          // If skipMinimum is set, treat values below threshold as missing data (null) so the line skips them
          // Default threshold is 1 (useful for sleep where <1 hour is likely noise)
          const minThreshold = yAxisOptions.skipMinimum;
          if (minThreshold !== undefined && (val === undefined || val < minThreshold)) return null;
          return val ?? null;
        }),
        borderColor: color.border,
        backgroundColor: type === 'bar' ? barBgColor : color.bg,
        tension: 0.3,
        fill: type === 'area',
        pointRadius: yAxisOptions.hidePoints ? 0 : 4,
        spanGaps: true
      };
    });

    // Build reference line annotations if provided
    const annotations = {};
    if (yAxisOptions.referenceLines) {
      yAxisOptions.referenceLines.forEach((lineValue, idx) => {
        annotations[`refLine${idx}`] = {
          type: 'line',
          yMin: lineValue,
          yMax: lineValue,
          borderColor: 'rgba(0, 0, 0, 0.4)',
          borderWidth: 2,
          borderDash: [6, 4],
          label: {
            display: false
          }
        };
      });
    }

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
          crosshair: false,  // Disable crosshair for non-glucose charts
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
              },
              label: (context) => {
                const value = context.parsed.y;
                // Round to integer if it's a whole number metric (steps, etc.)
                const displayValue = yAxisOptions.roundValues ? Math.round(value).toLocaleString() : value;
                return `${context.dataset.label}: ${displayValue}`;
              }
            }
          },
          annotation: {
            annotations: annotations
          }
        },
        scales: {
          y: { 
            beginAtZero: yAxisOptions.min === 0, 
            min: yAxisOptions.min,
            max: yAxisOptions.max,
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: yAxisOptions.roundValues ? {
              callback: (value) => Math.round(value).toLocaleString()
            } : {}
          },
          x: { grid: { display: false } }
        }
      }
    });
  };

  const renderGlucoseChart = () => {
    const ctx = document.getElementById('chart-glucose');
    if (!ctx) return;
    if (state.charts['chart-glucose']) state.charts['chart-glucose'].destroy();

    // Initialize glucose date if not set
    if (!state.glucoseDate) initGlucoseDate();

    // Get the selected date range (midnight to midnight)
    const selectedStart = new Date(state.glucoseDate.getFullYear(), state.glucoseDate.getMonth(), state.glucoseDate.getDate(), 0, 0, 0);
    const selectedEnd = new Date(selectedStart.getTime() + 24 * 60 * 60 * 1000);
    
    const daySamples = state.glucoseSamples.filter(s => {
      const sampleDate = new Date(s.recorded_at);
      return sampleDate >= selectedStart && sampleDate < selectedEnd;
    });
    
    // Format display date
    const displayDate = selectedStart.toLocaleDateString([], { 
      month: 'numeric', 
      day: 'numeric', 
      year: 'numeric' 
    });

    // Create or update navigation UI
    const chartContainer = ctx.closest('.chart-container');
    let navContainer = chartContainer.querySelector('.glucose-nav');
    if (!navContainer) {
      navContainer = document.createElement('div');
      navContainer.className = 'glucose-nav';
      navContainer.style.cssText = 'display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-bottom: 8px;';
      navContainer.innerHTML = `
        <button onclick="navigateGlucose(-1)" style="background: none; border: 1px solid #ccc; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 16px;">←</button>
        <span class="glucose-date" style="font-size: 14px; font-weight: 500; min-width: 100px; text-align: center;"></span>
        <button onclick="navigateGlucose(1)" style="background: none; border: 1px solid #ccc; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 16px;">→</button>
      `;
      chartContainer.insertBefore(navContainer, ctx);
    }
    navContainer.querySelector('.glucose-date').textContent = displayDate;

    // Convert samples to {x: decimalHour, y: value} format
    const dataPoints = daySamples.map(s => {
      const date = new Date(s.recorded_at);
      const decimalHour = date.getHours() + date.getMinutes() / 60;
      return { x: decimalHour, y: s.value };
    }).sort((a, b) => a.x - b.x);

    // Reference line annotations
    const annotations = {
      line70: {
        type: 'line',
        yMin: 70,
        yMax: 70,
        borderColor: 'rgba(0, 0, 0, 0.4)',
        borderWidth: 2,
        borderDash: [6, 4]
      },
      line120: {
        type: 'line',
        yMin: 120,
        yMax: 120,
        borderColor: 'rgba(0, 0, 0, 0.4)',
        borderWidth: 2,
        borderDash: [6, 4]
      }
    };

    state.charts['chart-glucose'] = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Lingo',
          data: dataPoints,
          borderColor: colors.lingo.border,
          backgroundColor: colors.lingo.bg,
          tension: 0.3,
          pointRadius: 0,
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          crosshair: true,  // Enable our custom crosshair plugin
          legend: { display: false },
          tooltip: {
            enabled: false  // Disable default tooltip, we use crosshair instead
          },
          annotation: { annotations }
        },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: 24,
            ticks: {
              stepSize: 1,
              callback: (value) => value.toString()
            },
            grid: { display: false },
            title: { display: false }
          },
          y: {
            min: 0,
            grid: { color: 'rgba(0,0,0,0.05)' }
          }
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
    createChart('chart-steps', 'Steps', groupDataByDateAndSource(filteredMetrics, 'step_count'), 'bar', { min: 0, referenceLines: [10000], roundValues: true });

    // 4. Sleep (Sum of asleep + deep + rem + core)
    const sleepFilter = (d) => d.metric_type.startsWith('sleep_') && !d.metric_type.includes('in_bed') && !d.metric_type.includes('awake');
    createChart('chart-sleep', 'Sleep Duration', groupDataByDateAndSource(filteredMetrics, sleepFilter), 'line', { min: 0, skipMinimum: 1 });

    // 5. Respiratory Rate
    createChart('chart-resp', 'Respiratory Rate', groupDataByDateAndSource(filteredMetrics, 'respiratory_rate'), 'line', { min: 0 });

    // 6. Blood Glucose (Intraday Detail) - Custom 24-hour chart
    renderGlucoseChart();
  };

  const init = () => {
    loadData();
  };

  return { init, updateTimeframe };
})();
