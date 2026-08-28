(async function init() {
  await guardAuth();
  await renderSidebar('export.html');

  const [directions, exercices] = await Promise.all([
    api.get('/api/employees/meta/directions'),
    api.get('/api/fiscal-exercices'),
  ]);

  const dirSel = document.getElementById('directionSelect');
  dirSel.innerHTML = `<option value="">Toutes les directions</option>` +
    directions.map((d) => `<option value="${d}">${d}</option>`).join('');

  const exSel = document.getElementById('exerciceSelect');
  if (exercices.length === 0) {
    exSel.innerHTML = `<option value="">Aucun exercice</option>`;
  } else {
    exSel.innerHTML = exercices.map((ex) =>
      `<option value="${ex.id}" ${ex.is_active ? 'selected' : ''}>${ex.label}${ex.is_active ? ' (actif)' : ''}</option>`
    ).join('');
  }

  dirSel.addEventListener('change', loadPreview);
  exSel.addEventListener('change', loadPreview);
  document.getElementById('excelBtn').addEventListener('click', () => exportFile('excel'));
  document.getElementById('pdfBtn').addEventListener('click', () => exportFile('pdf'));

  await loadPreview();
})();

function currentParams() {
  const direction = document.getElementById('directionSelect').value;
  const fiscal_exercice_id = document.getElementById('exerciceSelect').value;
  const params = new URLSearchParams();
  if (direction) params.set('direction', direction);
  if (fiscal_exercice_id) params.set('fiscal_exercice_id', fiscal_exercice_id);
  return params;
}

async function loadPreview() {
  const params = currentParams();
  const rows = await api.get(`/api/leave-records?${params.toString()}`);
  document.getElementById('previewCount').textContent = `${rows.length} congé(s) correspondant(s).`;

  const map = { EN_COURS: ['badge-emerald', 'En congé'], A_VENIR: ['badge-indigo', 'À venir'], TERMINE: ['badge-slate', 'Terminé'] };
  const tbody = document.getElementById('previewBody');
  if (rows.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Aucun congé pour cette sélection.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((r) => {
    const [cls, label] = map[r.statut] || ['badge-slate', r.statut];
    return `
      <tr>
        <td><strong>${r.nom}</strong></td>
        <td>${r.prenom}</td>
        <td>${r.leave_type}</td>
        <td>${fmtDate(r.date_debut)} → ${fmtDate(r.date_fin)}</td>
        <td class="mono">${r.jours_ouvres} j.</td>
        <td><span class="badge ${cls}"><span class="dot"></span>${label}</span></td>
      </tr>
    `;
  }).join('');
}

function exportFile(type) {
  const params = currentParams();
  downloadFile(`/api/exports/${type}?${params.toString()}`);
}
