/**
 * Providers Page Module
 * Handles Healthcare Providers via Supabase.
 */
const ProvidersPage = (() => {
  const state = {
    providers: [],
    initialized: false,
    editingIndex: null,
  };

  const loadData = async () => {
    try {
      const { data, error } = await window.db.from('providers').select('*');
      if (error) throw error;
      state.providers = data || [];
    } catch (err) {
      console.error("Error loading providers:", err);
    }
  };

  const renderTable = () => {
    const tbody = document.querySelector("#providers-table tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    state.providers.sort((a, b) => (a.last_name || "").localeCompare(b.last_name || ""));

    state.providers.forEach((item, index) => {
      const tr = document.createElement("tr");
      
      if (state.editingIndex === index) {
        tr.className = "editing-row";
        tr.innerHTML = `
          <td>
            <input type="text" value="${item.first_name || ""}" id="edit-prov-first" placeholder="First">
            <input type="text" value="${item.last_name || ""}" id="edit-prov-last" placeholder="Last">
            <input type="text" value="${item.suffix || ""}" id="edit-prov-suffix" placeholder="Suffix">
            <input type="url" value="${item.url || ""}" id="edit-prov-url" placeholder="URL" class="url-input">
          </td>
          <td><input type="text" value="${item.specialty || ""}" id="edit-prov-specialty" placeholder="Specialty"></td>
          <td><input type="text" value="${item.office || ""}" id="edit-prov-office" placeholder="Office"></td>
          <td><input type="text" value="${item.cell || ""}" id="edit-prov-cell" placeholder="Cell"></td>
          <td><input type="email" value="${item.email || ""}" id="edit-prov-email" placeholder="Email"></td>
          <td><input type="text" value="${item.notes || ""}" id="edit-prov-notes" placeholder="Notes"></td>
          <td class="actions">
            <button class="btn-icon save" onclick="ProvidersPage.saveEdit(${index})">💾</button>
            <button class="btn-icon cancel" onclick="ProvidersPage.cancelEdit()">❌</button>
          </td>
        `;
      } else {
        const fullName = [item.first_name, item.last_name, item.suffix].filter(Boolean).join(" ");
        const displayName = item.url
          ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer" class="reorder-link">${fullName || "-"}</a>`
          : (fullName || "-");

        tr.innerHTML = `
          <td>${displayName}</td>
          <td>${item.specialty || "-"}</td>
          <td>${item.office || "-"}</td>
          <td>${item.cell || "-"}</td>
          <td>${item.email || "-"}</td>
          <td class="notes-cell">${item.notes || "-"}</td>
          <td class="actions">
            <button class="btn-icon edit" onclick="ProvidersPage.editItem(${index})">✏️</button>
            <button class="btn-icon delete" onclick="ProvidersPage.deleteItem(${index})">🗑️</button>
          </td>
        `;
      }
      tbody.appendChild(tr);
    });
  };

  const addItem = async () => {
    const fields = {
      first_name: document.getElementById("new-prov-first").value,
      last_name: document.getElementById("new-prov-last").value,
      suffix: document.getElementById("new-prov-suffix").value,
      specialty: document.getElementById("new-prov-specialty").value,
      url: document.getElementById("new-prov-url").value,
      office: document.getElementById("new-prov-office").value,
      cell: document.getElementById("new-prov-cell").value,
      email: document.getElementById("new-prov-email").value,
      notes: document.getElementById("new-prov-notes").value
    };

    if (!fields.last_name) { alert("Last Name is required"); return; }

    try {
      const { data, error } = await window.db.from('providers').insert([fields]).select();
      if (error) throw error;
      state.providers.push(data[0]);
      renderTable();
      document.querySelectorAll('#providers-table tfoot input').forEach(i => i.value = "");
    } catch (err) { alert(err.message); }
  };

  const deleteItem = async (index) => {
    if (confirm("Delete this provider?")) {
      try {
        const { error } = await window.db.from('providers').delete().eq('id', state.providers[index].id);
        if (error) throw error;
        state.providers.splice(index, 1);
        renderTable();
      } catch (err) { alert(err.message); }
    }
  };

  const editItem = (index) => { state.editingIndex = index; renderTable(); };
  const cancelEdit = () => { state.editingIndex = null; renderTable(); };

  const saveEdit = async (index) => {
    const id = state.providers[index].id;
    const updates = {
      first_name: document.getElementById("edit-prov-first").value,
      last_name: document.getElementById("edit-prov-last").value,
      suffix: document.getElementById("edit-prov-suffix").value,
      specialty: document.getElementById("edit-prov-specialty").value,
      url: document.getElementById("edit-prov-url").value,
      office: document.getElementById("edit-prov-office").value,
      cell: document.getElementById("edit-prov-cell").value,
      email: document.getElementById("edit-prov-email").value,
      notes: document.getElementById("edit-prov-notes").value
    };

    try {
      const { data, error } = await window.db.from('providers').update(updates).eq('id', id).select();
      if (error) throw error;
      state.providers[index] = data[0];
      state.editingIndex = null;
      renderTable();
    } catch (err) { alert(err.message); }
  };

  const init = async () => {
    if (state.initialized) return;
    await loadData();
    state.initialized = true;
    renderTable();
  };

  return { init, addItem, deleteItem, editItem, saveEdit, cancelEdit };
})();
