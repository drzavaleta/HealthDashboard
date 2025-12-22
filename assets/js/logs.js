/**
 * Daily Logs Page Module
 * Handles health device logs via Supabase.
 */
const LogsPage = (() => {
  const state = {
    rows: [],
    initialized: false,
    addingToDevice: null,
    editingColumn: null, // { device: string, date: string }
  };

  const logsContent = () => document.getElementById("logs-content");

  const groupByDeviceAndTest = (rows) => {
    const devices = {};
    rows.forEach((row) => {
      const device = row.device;
      const test = row.test;
      if (!devices[device]) devices[device] = {};
      if (!devices[device][test]) devices[device][test] = [];
      devices[device][test].push(row);
    });
    return devices;
  };

  const startAddColumn = (device) => {
    state.addingToDevice = device;
    render();
  };

  const cancelAddColumn = () => {
    state.addingToDevice = null;
    render();
  };

  const startEditColumn = (device, date) => {
    state.editingColumn = { device, date };
    render();
  };

  const cancelEditColumn = () => {
    state.editingColumn = null;
    render();
  };

  const saveEditColumn = async (device, date) => {
    const deviceMap = groupByDeviceAndTest(state.rows);
    const tests = Object.keys(deviceMap[device] || {});
    
    const updates = [];
    tests.forEach(test => {
      const input = document.getElementById(`edit-val-${device}-${test}-${date}`);
      if (input) {
        const existing = deviceMap[device][test].find(r => r.date === date);
        const val = input.value.trim();
        
        if (existing) {
          // Update existing
          updates.push(window.db.from('daily_logs').update({ result: val }).eq('id', existing.id));
        } else if (val !== "") {
          // Create new
          updates.push(window.db.from('daily_logs').insert([{ device, test, result: val, date }]));
        }
      }
    });

    try {
      await Promise.all(updates);
      await load(true); // Force reload from DB
      state.editingColumn = null;
      render();
    } catch (err) {
      alert("Error saving: " + err.message);
    }
  };

  const saveAddColumn = async (device) => {
    const dateInput = document.getElementById(`new-col-date-${device}`);
    const date = dateInput.value;
    if (!date) {
      alert("Please select a date.");
      return;
    }

    const deviceMap = groupByDeviceAndTest(state.rows);
    const tests = Object.keys(deviceMap[device] || {});
    const newRows = [];
    
    tests.forEach(test => {
      const input = document.getElementById(`new-val-${device}-${test}`);
      if (input && input.value.trim() !== "") {
        newRows.push({ device, test, result: input.value.trim(), date });
      }
    });

    try {
      if (newRows.length > 0) {
        const { error } = await window.db.from('daily_logs').insert(newRows);
        if (error) throw error;
      }
      await load(true);
      state.addingToDevice = null;
      render();
    } catch (err) {
      alert("Error adding column: " + err.message);
    }
  };

  const render = () => {
    const deviceMap = groupByDeviceAndTest(state.rows);
    renderTables(deviceMap);
  };

  const renderTables = (deviceMap) => {
    const container = logsContent();
    container.innerHTML = "";

    const dateSet = new Set();
    state.rows.forEach(r => r.date && dateSet.add(r.date));
    // Sort descending and take only the past 7 days
    const dateColumns = Array.from(dateSet)
      .sort((a, b) => new Date(b) - new Date(a))
      .slice(0, 7);

    const devices = Object.keys(deviceMap);
    devices.forEach((device) => {
      const isAdding = state.addingToDevice === device;
      const block = document.createElement("section");
      block.className = "panel-block";

      const wrap = document.createElement("div");
      wrap.className = "table-wrapper";
      const table = document.createElement("table");
      table.className = "responsive lab-table log-table";
      
      const colCount = dateColumns.length + (isAdding ? 1 : 0);
      
      const dateInputHtml = (id, value) => `
        <div class="date-input-wrapper">
          <input type="text" value="${value || ""}" id="${id}" placeholder="YYYY-MM-DD" class="date-picker-header">
          <button type="button" class="date-picker-trigger" onclick="this.nextElementSibling.showPicker()">📅</button>
          <input type="date" class="hidden-date-picker" onchange="this.previousElementSibling.previousElementSibling.value = this.value">
        </div>
      `;

      table.innerHTML = `
        <colgroup>
          <col class="col-test" />
          ${Array(colCount).fill('<col class="col-date" />').join("")}
        </colgroup>
        <thead>
          <tr class="panel-header-row">
            <th class="th-panel">
              <div class="panel-header-content">
                <span class="device-title">${device}</span>
                <div class="panel-actions">
                  ${isAdding 
                    ? `<button class="btn-icon save" onclick="LogsPage.saveAddColumn('${device}')">💾</button>
                       <button class="btn-icon cancel" onclick="LogsPage.cancelAddColumn()">❌</button>`
                    : `<button class="btn-icon add" onclick="LogsPage.startAddColumn('${device}')">➕</button>`
                  }
                </div>
              </div>
            </th>
            ${isAdding ? `<th class="th-date">${dateInputHtml(`new-col-date-${device}`, "")}</th>` : ""}
            ${dateColumns.map((d) => {
              const isEditing = state.editingColumn?.device === device && state.editingColumn?.date === d;
              return `
                <th class="th-date">
                  <div class="date-header-content">
                    <div class="date-spacer"></div>
                    <span class="date-text">${d}</span>
                    <div class="date-actions ${isEditing ? 'is-editing' : ''}">
                      ${isEditing 
                        ? `<button class="btn-icon save-small" onclick="LogsPage.saveEditColumn('${device}', '${d}')">💾</button>
                           <button class="btn-icon cancel-small" onclick="LogsPage.cancelEditColumn()">❌</button>`
                        : `<button class="btn-icon edit-small" onclick="LogsPage.startEditColumn('${device}', '${d}')">✏️</button>`
                      }
                    </div>
                  </div>
                </th>
              `;
            }).join("")}
          </tr>
        </thead>
        <tbody></tbody>
      `;

      const tbody = table.querySelector("tbody");
      Object.keys(deviceMap[device]).forEach((test) => {
        const entries = deviceMap[device][test];
        const byDate = entries.reduce((acc, e) => {
          acc[e.date] = e;
          return acc;
        }, {});

        const testCell = `<div class="test-cell-content"><span class="test-name">${test}</span></div>`;
        const inputCell = isAdding ? `<td><input type="text" id="new-val-${device}-${test}" class="log-input" placeholder="..."></td>` : "";
        
        const existingCells = dateColumns.map((d) => {
          const isEditing = state.editingColumn?.device === device && state.editingColumn?.date === d;
          const val = byDate[d]?.result || "—";
          return isEditing 
            ? `<td><input type="text" id="edit-val-${device}-${test}-${d}" class="log-input" value="${val === "—" ? "" : val}"></td>`
            : `<td data-label="${d}">${val}</td>`;
        }).join("");

        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${testCell}</td>${inputCell}${existingCells}`;
        tbody.appendChild(tr);
      });

      wrap.appendChild(table);
      block.appendChild(wrap);
      container.appendChild(block);
    });
  };

  const load = async (force = false) => {
    if (state.initialized && !force) return;
    try {
      const { data, error } = await window.db.from('daily_logs').select('*');
      if (error) throw error;
      state.rows = data || [];
      state.initialized = true;
      render();
    } catch (err) {
      logsContent().innerHTML = `<div class="error">Could not load logs: ${err.message}</div>`;
    }
  };

  return { load, startAddColumn, cancelAddColumn, saveAddColumn, startEditColumn, cancelEditColumn, saveEditColumn };
})();
