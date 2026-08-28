(async function init() {
  await guardAuth();
  await renderSidebar('types.html');
  await loadTypes();
  bindEvents();
})();

async function loadTypes() {
  const list = await api.get('/api/leave-types');
  const tbody = document.getElementById('tableBody');
  if (list.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Aucun type de congé.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((t) => `
    <tr>
      <td><strong>${t.nom}</strong></td>
      <td class="mono">${t.quota_jours} j.</td>
      <td><span style="display:inline-block; width:16px; height:16px; border-radius:4px; background:${t.couleur}; vertical-align:middle;"></span></td>
      <td>${t.actif ? '<span class="badge badge-emerald"><span class="dot"></span>Actif</span>' : '<span class="badge badge-slate"><span class="dot"></span>Inactif</span>'}</td>
      <td>
        <button class="icon-btn" onclick='openEdit(${JSON.stringify(t)})'>✎</button>
        <button class="status-switch ${t.actif ? 'is-on' : 'is-off'}" role="switch" aria-checked="${t.actif}" aria-label="${t.actif ? 'Désactiver' : 'Activer'} ${t.nom}" onclick="toggleType(${t.id}, ${t.actif})">
          <span class="status-switch-track"><span class="status-switch-thumb"></span></span>
          <span class="status-switch-label">${t.actif ? 'ON' : 'OFF'}</span>
        </button>
        <button class="icon-btn danger" onclick="confirmDelete(${t.id})">🗑</button>
      </td>
    </tr>
  `).join('');
}

function bindEvents() {
  document.getElementById('newTypeBtn').addEventListener('click', openModal);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', saveType);
}

function openModal() {
  document.getElementById('modalTitle').textContent = 'Nouveau type';
  document.getElementById('typeId').value = '';
  document.getElementById('typeNom').value = '';
  document.getElementById('typeQuota').value = 15;
  document.getElementById('typeCouleur').value = '#10b981';
  document.getElementById('modalOverlay').style.display = 'flex';
}

function openEdit(t) {
  document.getElementById('modalTitle').textContent = 'Modifier le type';
  document.getElementById('typeId').value = t.id;
  document.getElementById('typeNom').value = t.nom;
  document.getElementById('typeQuota').value = t.quota_jours;
  document.getElementById('typeCouleur').value = t.couleur;
  document.getElementById('typeActif').value = String(t.actif);
  document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; }

async function saveType() {
  const id = document.getElementById('typeId').value;
  const payload = {
    nom: document.getElementById('typeNom').value.trim(),
    quota_jours: Number(document.getElementById('typeQuota').value),
    couleur: document.getElementById('typeCouleur').value,
    actif: id ? document.getElementById('typeActif').value === 'true' : true,
  };
  if (!payload.nom) { alert('Le nom est requis.'); return; }
  try {
    if (id) await api.put(`/api/leave-types/${id}`, payload);
    else await api.post('/api/leave-types', payload);
    closeModal();
    loadTypes();
  } catch (err) { alert(err.message); }
}

async function toggleType(id, actif) {
  const type = (await api.get('/api/leave-types')).find((item) => item.id === id);
  if (!type) return;
  const action = actif ? 'désactiver' : 'activer';
  if (!confirm(`Voulez-vous ${action} le type « ${type.nom} » ?`)) return;
  try {
    await api.put(`/api/leave-types/${id}`, { ...type, actif: !actif });
    loadTypes();
  } catch (err) { alert(err.message); }
}

async function confirmDelete(id) {
  if (!confirm('Supprimer ce type de congé ?')) return;
  try { await api.del(`/api/leave-types/${id}`); loadTypes(); }
  catch (err) { alert(err.message); }
}
