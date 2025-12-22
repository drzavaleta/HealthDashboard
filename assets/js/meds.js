/**
 * Medications Page Module
 * Handles fetching, rendering, and CRUD operations via Supabase.
 */
const MedsPage = (() => {
  let state = {
    medications: [],
    supplements: [],
    discontinued: [],
    editing: {
      medications: null,
      supplements: null,
      discontinued: null,
    },
    initialized: false,
  };

  const loadData = async (table, stateKey) => {
    try {
      const { data, error } = await window.db
        .from(table)
        .select('*');
      
      if (error) throw error;
      state[stateKey] = data || [];
    } catch (err) {
      console.error(`Error loading ${table}:`, err);
    }
  };

  const renderTable = (key) => {
    const tbody = document.querySelector(`#${key}-table tbody`);
    if (!tbody) return;
    tbody.innerHTML = "";

    // Sort items alphabetically by name
    state[key].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const editingIndex = state.editing[key];
    const dateInputHtml = (id, value) => `
      <div class="date-input-wrapper">
        <input type="text" value="${window.formatDateForDisplay(value)}" id="${id}" placeholder="MM-DD-YYYY" class="date-text-input">
        <button type="button" class="date-picker-trigger" onclick="this.nextElementSibling.showPicker()">📅</button>
        <input type="date" class="hidden-date-picker" onchange="this.previousElementSibling.previousElementSibling.value = window.formatDateForDisplay(this.value)">
      </div>
    `;

    state[key].forEach((item, index) => {
      const tr = document.createElement("tr");
      
      if (editingIndex === index) {
        tr.className = "editing-row";
        const urlInput = key === "supplements" 
          ? `<input type="url" value="${item.url || ""}" id="edit-${key}-url" placeholder="Paste reorder URL here..." class="url-input">`
          : "";
        
        const fourthColInput = key === "discontinued"
          ? `<input type="text" value="${item.notes || ""}" id="edit-${key}-notes" placeholder="Notes">`
          : dateInputHtml(`edit-${key}-date`, item.start_date);

        tr.innerHTML = `
          <td>
            <input type="text" value="${item.name}" id="edit-${key}-name" placeholder="Item name">
            ${urlInput}
          </td>
          <td><input type="text" value="${item.dose || ""}" id="edit-${key}-dose"></td>
          <td><input type="text" value="${item.frequency || ""}" id="edit-${key}-freq"></td>
          <td>${fourthColInput}</td>
          <td class="actions">
            <button class="btn-icon save" onclick="MedsPage.saveEdit('${key}', ${index})">💾</button>
            <button class="btn-icon cancel" onclick="MedsPage.cancelEdit('${key}')">❌</button>
          </td>
        `;
      } else {
        let displayName = item.name || "-";
        
        if (item.name) {
          const searchUrl = `https://grokipedia.com/search?q=${encodeURIComponent(item.name)}`;
          displayName = `<a href="${searchUrl}" target="_blank" rel="noopener noreferrer" class="reorder-link">${item.name}</a>`;
          
          if (key === "supplements" && item.url) {
            displayName += ` <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="shop-icon" title="Reorder link">🛒</a>`;
          }
        }

        const fourthColValue = key === "discontinued" ? (item.notes || "-") : (window.formatDateForDisplay(item.start_date));

        tr.innerHTML = `
          <td>${displayName}</td>
          <td>${item.dose || "-"}</td>
          <td>${item.frequency || "-"}</td>
          <td class="notes-cell">${fourthColValue}</td>
          <td class="actions">
            <button class="btn-icon edit" onclick="MedsPage.editItem('${key}', ${index})">✏️</button>
            <button class="btn-icon delete" onclick="MedsPage.deleteItem('${key}', ${index})">🗑️</button>
          </td>
        `;
      }
      tbody.appendChild(tr);
    });
  };

  const addItem = async (key) => {
    let prefix;
    let table;
    if (key === "medications") { prefix = "new-med"; table = "medications"; }
    else if (key === "supplements") { prefix = "new-supp"; table = "supplements"; }
    else if (key === "discontinued") { prefix = "new-disco"; table = "discontinued_meds"; }

    const name = document.getElementById(`${prefix}-name`).value;
    const dose = document.getElementById(`${prefix}-dose`).value;
    const freq = document.getElementById(`${prefix}-freq`).value;
    
    const newItem = { name, dose, frequency: freq };
    
    if (key === "discontinued") {
      newItem.notes = document.getElementById(`${prefix}-notes`).value;
    } else {
      newItem.start_date = window.formatDateForDb(document.getElementById(`${prefix}-date`).value) || null;
    }
    
    if (key === "supplements") {
      newItem.url = document.getElementById(`${prefix}-url`).value;
    }

    if (!name) {
      alert("Name is required");
      return;
    }

    try {
      const { data, error } = await window.db.from(table).insert([newItem]).select();
      if (error) throw error;
      
      state[key].push(data[0]);
      renderTable(key);

      // Clear inputs
      document.getElementById(`${prefix}-name`).value = "";
      document.getElementById(`${prefix}-dose`).value = "";
      document.getElementById(`${prefix}-freq`).value = "";
      if (key === "discontinued") {
        document.getElementById(`${prefix}-notes`).value = "";
      } else {
        document.getElementById(`${prefix}-date`).value = "";
      }
      if (key === "supplements") {
        document.getElementById(`${prefix}-url`).value = "";
      }
    } catch (err) {
      alert("Error adding item: " + err.message);
    }
  };

  const deleteItem = async (key, index) => {
    if (confirm("Are you sure you want to delete this item?")) {
      const item = state[key][index];
      const table = key === "discontinued" ? "discontinued_meds" : key;
      
      try {
        const { error } = await window.db.from(table).delete().eq('id', item.id);
        if (error) throw error;
        
        state[key].splice(index, 1);
        renderTable(key);
      } catch (err) {
        alert("Error deleting item: " + err.message);
      }
    }
  };

  const editItem = (key, index) => {
    state.editing[key] = index;
    renderTable(key);
  };

  const saveEdit = async (key, index) => {
    const item = state[key][index];
    const table = key === "discontinued" ? "discontinued_meds" : key;
    
    const name = document.getElementById(`edit-${key}-name`).value;
    const dose = document.getElementById(`edit-${key}-dose`).value;
    const freq = document.getElementById(`edit-${key}-freq`).value;
    
    const updates = { name, dose, frequency: freq };
    
    if (key === "discontinued") {
      updates.notes = document.getElementById(`edit-${key}-notes`).value;
    } else {
      updates.start_date = window.formatDateForDb(document.getElementById(`edit-${key}-date`).value) || null;
    }
    
    if (key === "supplements") {
      updates.url = document.getElementById(`edit-${key}-url`).value;
    }

    if (!name) {
      alert("Name is required");
      return;
    }

    try {
      const { data, error } = await window.db.from(table).update(updates).eq('id', item.id).select();
      if (error) throw error;
      
      state[key][index] = data[0];
      state.editing[key] = null;
      renderTable(key);
    } catch (err) {
      alert("Error saving edit: " + err.message);
    }
  };

  const cancelEdit = (key) => {
    state.editing[key] = null;
    renderTable(key);
  };

  const init = async () => {
    if (!state.initialized) {
      await Promise.all([
        loadData("medications", "medications"),
        loadData("supplements", "supplements"),
        loadData("discontinued_meds", "discontinued"),
      ]);
      state.initialized = true;
    }
    renderTable("medications");
    renderTable("supplements");
    renderTable("discontinued");
  };

  return { init, addItem, deleteItem, editItem, saveEdit, cancelEdit };
})();
