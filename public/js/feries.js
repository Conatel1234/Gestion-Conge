(async function init() {
  await guardAuth();
  await renderSidebar('feries.html');
  await loadHolidays();
  bindEvents();
})();

async function loadHolidays() {
  const list = await api.get('/api/holidays');
  const tbody = document.getElementById('tableBody');
  if (list.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="3">Aucun jour off enregistré.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((h) => `
    <tr>
      <td><strong>${fmtDate(h.date_off)}</strong></td>
      <td>${h.libelle}</td>
      <td>
        <button class="icon-btn" onclick='openEdit(${JSON.stringify(h)})'>✎</button>
        <button class="icon-btn danger" onclick="confirmDelete(${h.id})">🗑</button>
      </td>
    </tr>
  `).join('');
}

function bindEvents() {
  document.getElementById('newHolidayBtn').addEventListener('click', openModal);
  document.getElementById('importHolidaysBtn').addEventListener('click', () => document.getElementById('importHolidaysInput').click());
  document.getElementById('importHolidaysInput').addEventListener('change', importHolidays);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', saveHoliday);
}

async function importHolidays(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { alert('Le fichier ne doit pas dépasser 5 Mo.'); return; }
  try {
    let content;
    let encoding = 'utf8';
    if (file.name.toLowerCase().endsWith('.pdf')) {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      content = btoa(binary);
      encoding = 'base64';
    } else content = await file.text();
    const result = await api.post('/api/holidays/import', { fileName: file.name, content, encoding });
    const rejected = result.errors.length ? `\nLignes rejetées :\n${result.errors.map((error) => `- ${error}`).join('\n')}` : '';
    alert(`${result.imported} jour(s) importé(s), ${result.skipped} doublon(s) ignoré(s).${rejected}`);
    await loadHolidays();
  } catch (err) { alert(err.message); }
}

function openModal() {
  document.getElementById('modalTitle').textContent = 'Nouveau jour off';
  document.getElementById('holidayId').value = '';
  document.getElementById('holidayDate').value = '';
  document.getElementById('holidayLabel').value = '';
  document.getElementById('modalOverlay').style.display = 'flex';
}

function openEdit(h) {
  document.getElementById('modalTitle').textContent = 'Modifier le jour off';
  document.getElementById('holidayId').value = h.id;
  document.getElementById('holidayDate').value = h.date_off.slice(0, 10);
  document.getElementById('holidayLabel').value = h.libelle;
  document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; }

async function saveHoliday() {
  const id = document.getElementById('holidayId').value;
  const payload = {
    date_off: document.getElementById('holidayDate').value,
    libelle: document.getElementById('holidayLabel').value.trim(),
  };
  if (!payload.date_off || !payload.libelle) { alert('Date et libellé requis.'); return; }
  try {
    if (id) await api.put(`/api/holidays/${id}`, payload);
    else await api.post('/api/holidays', payload);
    closeModal();
    loadHolidays();
  } catch (err) { alert(err.message); }
}

async function confirmDelete(id) {
  if (!confirm('Supprimer ce jour off ?')) return;
  await api.del(`/api/holidays/${id}`);
  loadHolidays();
}
