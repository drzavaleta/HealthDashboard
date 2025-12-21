/**
 * Laboratory Page Module
 * Handles lab results via Supabase.
 */
const LabsPage = (() => {
  const labsContent = () => document.getElementById("labs-content");
  const state = {
    rows: [],
    panel: "all",
    flag: "all",
  };

  const flagClass = (flag) => {
    if (!flag) return "normal";
    const f = flag.toUpperCase();
    if (f === "H") return "high";
    if (f === "L") return "low";
    return "normal";
  };

  const groupByPanelAndTest = (rows) => {
    const grouped = {};
    rows.forEach((row) => {
      const { panel, test } = row;
      if (!grouped[panel]) grouped[panel] = {};
      if (!grouped[panel][test]) grouped[panel][test] = [];
      grouped[panel][test].push(row);
    });
    // Sort tests by date (most recent first)
    Object.values(grouped).forEach(panel => {
      Object.values(panel).forEach(testRows => {
        testRows.sort((a, b) => new Date(b.date) - new Date(a.date));
      });
    });
    return grouped;
  };

  const renderTables = (panelMap) => {
    const container = labsContent();
    container.innerHTML = "";

    const panels = Object.keys(panelMap);
    if (!panels.length) {
      container.innerHTML = `<div class="error">No results match your filters.</div>`;
      return;
    }

    const dateSet = new Set();
    state.rows.forEach(r => r.date && dateSet.add(r.date));
    const dateColumns = Array.from(dateSet).sort((a, b) => new Date(b) - new Date(a));

    panels.forEach((panel) => {
      const block = document.createElement("section");
      block.className = "panel-block";

      const wrap = document.createElement("div");
      wrap.className = "table-wrapper";
      const table = document.createElement("table");
      table.className = "responsive lab-table";
      table.innerHTML = `
        <colgroup>
          <col class="col-test" />
          ${dateColumns.map(() => `<col class="col-date" />`).join("")}
        </colgroup>
        <thead>
          <tr class="panel-header-row">
            <th class="th-panel"><div class="panel-header-content"><span class="device-title">${panel}</span></div></th>
            ${dateColumns.map((d) => `
              <th class="th-date">
                <div class="date-header-content">
                  <div class="date-spacer"></div>
                  <span class="date-text">${d}</span>
                  <div class="date-spacer"></div>
                </div>
              </th>
            `).join("")}
          </tr>
        </thead>
        <tbody></tbody>
      `;

      const tbody = table.querySelector("tbody");
      Object.keys(panelMap[panel]).forEach((test) => {
        const entries = panelMap[panel][test];
        const byDate = entries.reduce((acc, e) => { acc[e.date] = e; return acc; }, {});
        const latest = entries[0];

        const unitsLabel = latest.units ? ` (${latest.units})` : "";
        const refInfo = latest.reference_range
          ? `<span class="info" tabindex="0" aria-label="Reference range ${latest.reference_range}">i<span class="tooltip">Reference: ${latest.reference_range}</span></span>`
          : "";
        const testCell = `<div class="test-cell-content"><span class="test-name">${test}${unitsLabel}</span>${refInfo}</div>`;

        const valueCells = dateColumns.map((d) => {
          const entry = byDate[d];
          if (!entry) return `<td data-label="${d}">—</td>`;
          const cls = flagClass(entry.flag);
          const content = cls === "normal" ? `${entry.result}` : `<span class="flag ${cls}">${entry.result}</span>`;
          return `<td data-label="${d}">${content}</td>`;
        }).join("");

        const tr = document.createElement("tr");
        tr.innerHTML = `<td data-label="Test">${testCell}</td>${valueCells}`;
        tbody.appendChild(tr);
      });

      wrap.appendChild(table);
      block.appendChild(wrap);
      container.appendChild(block);
    });
  };

  const applyFilters = () => {
    const filtered = state.rows.filter((row) => {
      if (state.panel !== "all" && row.panel !== state.panel) return false;
      return true;
    });

    const grouped = groupByPanelAndTest(filtered);

    Object.keys(grouped).forEach((panel) => {
      Object.keys(grouped[panel]).forEach((test) => {
        const latest = grouped[panel][test][0];
        const flag = (latest.flag || "").toUpperCase();
        const match =
          state.flag === "all" ||
          (state.flag === "high" && flag === "H") ||
          (state.flag === "low" && flag === "L") ||
          (state.flag === "normal" && flag !== "H" && flag !== "L");
        if (!match) delete grouped[panel][test];
      });
      if (Object.keys(grouped[panel]).length === 0) delete grouped[panel];
    });

    renderTables(grouped);
  };

  const initFilters = (rows) => {
    const panelSelect = document.getElementById("panel-filter");
    const flagSelect = document.getElementById("flag-filter");
    if (!panelSelect || !flagSelect || panelSelect.options.length > 1) return;

    const panels = Array.from(new Set(rows.map((r) => r.panel))).sort();
    panels.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p; opt.textContent = p;
      panelSelect.appendChild(opt);
    });

    panelSelect.addEventListener("change", (e) => { state.panel = e.target.value; applyFilters(); });
    flagSelect.addEventListener("change", (e) => { state.flag = e.target.value; applyFilters(); });
  };

  const load = async () => {
    try {
      const { data, error } = await window.db.from('labs').select('*');
      if (error) throw error;
      state.rows = data || [];
      initFilters(state.rows);
      applyFilters();
    } catch (err) {
      labsContent().innerHTML = `<div class="error">Could not load labs: ${err.message}</div>`;
    }
  };

  return { load };
})();
