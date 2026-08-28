let allEmployees = [];

(async function init() {
  await guardAuth();
  await renderSidebar('employes.html');
  await loadEmployees();
  bindEvents();
})();

async function loadEmployees() {
  allEmployees = await api.get('/api/employees');
  renderTable(allEmployees);
}

function renderTable(list) {
  const tbody = document.getElementById('tableBody');
  if (list.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">Aucun employé enregistré.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((e) => `
    <tr>
      <td class="selection-column"><input type="checkbox" class="employee-check" value="${e.id}" aria-label="Sélectionner ${e.prenom} ${e.nom}" /></td>
      <td><a href="employe.html?id=${e.id}"><strong>${e.nom}</strong></a></td>
      <td><a href="employe.html?id=${e.id}">${e.prenom}</a></td>
      <td>${e.direction}</td>
      <td>${e.statut === 'contractuel' ? 'Contractuel' : 'Employé'}</td>
      <td>${e.date_embauche ? fmtDate(e.date_embauche) : '—'}</td>
      <td>${e.anciennete ? e.anciennete.label : '—'}</td>
      <td><a class="btn btn-outline info-leave-btn" href="employe.html?id=${e.id}">Voir les congés</a></td>
    </tr>
  `).join('');
  tbody.querySelectorAll('.employee-check').forEach((checkbox) => checkbox.addEventListener('change', updateSelectionState));
  updateSelectionState();
}

function bindEvents() {
  document.getElementById('newEmpBtn').addEventListener('click', () => openModal());
  document.getElementById('printSelectedBtn').addEventListener('click', printSelectedEmployees);
  document.getElementById('selectAllEmployees').addEventListener('change', (event) => {
    document.querySelectorAll('.employee-check').forEach((checkbox) => { checkbox.checked = event.target.checked; });
    updateSelectionState();
  });
  document.getElementById('importCsvBtn').addEventListener('click', () => document.getElementById('importCsvInput').click());
  document.getElementById('importCsvInput').addEventListener('change', importEmployees);
  document.getElementById('exportCsvBtn').addEventListener('click', () => downloadFile('/api/exports/employees-csv'));
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', saveEmployee);
  document.getElementById('searchInput').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderTable(allEmployees.filter((emp) =>
      emp.nom.toLowerCase().includes(q) || emp.prenom.toLowerCase().includes(q) || emp.direction.toLowerCase().includes(q) || emp.statut.includes(q)));
  });
}

function selectedEmployeeIds() {
  return [...document.querySelectorAll('.employee-check:checked')].map((checkbox) => checkbox.value);
}

function updateSelectionState() {
  const selected = selectedEmployeeIds();
  const printButton = document.getElementById('printSelectedBtn');
  printButton.disabled = selected.length === 0;
  printButton.textContent = selected.length ? `Imprimer sélection (${selected.length})` : 'Imprimer sélection';
  const checks = [...document.querySelectorAll('.employee-check')];
  const selectAll = document.getElementById('selectAllEmployees');
  selectAll.checked = checks.length > 0 && selected.length === checks.length;
  selectAll.indeterminate = selected.length > 0 && selected.length < checks.length;
}

function escapePrintHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

async function printSelectedEmployees() {
  const ids = selectedEmployeeIds();
  if (!ids.length) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert('Autorisez les fenêtres pop-up pour imprimer la sélection.'); return; }
  printWindow.document.write('<p style="font-family:Arial;padding:24px;">Préparation de la fiche...</p>');
  try {
    const profiles = await Promise.all(ids.map((id) => api.get(`/api/employees/${id}/profile`)));
    const sections = profiles.map(({ employee, balances, historique }) => `
      <section class="employee-sheet">
        ${documentHeader("HISTORICITE DE CONGE DE L'EMPLOYE")}
        <h1>${escapePrintHtml(employee.prenom)} ${escapePrintHtml(employee.nom)}</h1>
        <p class="meta">${escapePrintHtml(employee.direction)}${employee.date_embauche ? ` · Embauché le ${fmtDate(employee.date_embauche)}` : ''}</p>
        <h2>Soldes de congés</h2>
        <table><thead><tr><th>Type</th><th>Pris</th><th>Quota</th><th>Restant</th></tr></thead><tbody>
          ${balances.map((balance) => `<tr><td>${escapePrintHtml(balance.nom)}</td><td>${balance.pris} j.</td><td>${balance.quota} j.</td><td>${balance.restant} j.</td></tr>`).join('') || '<tr><td colspan="4">Aucun type de congé.</td></tr>'}
        </tbody></table>
        <h2>Historique des congés</h2>
        <table><thead><tr><th>Exercice</th><th>Type</th><th>Période</th><th>Jours</th><th>Reprise</th><th>Statut</th></tr></thead><tbody>
          ${historique.map((leave) => `<tr><td>${escapePrintHtml(leave.exercice_label)}</td><td>${escapePrintHtml(leave.leave_type)}</td><td>${fmtDate(leave.date_debut)} → ${fmtDate(leave.date_fin)}</td><td>${leave.jours_ouvres} j.</td><td>${fmtDate(leave.date_reprise)}</td><td>${escapePrintHtml(leave.statut)}</td></tr>`).join('') || '<tr><td colspan="6">Aucun congé enregistré.</td></tr>'}
        </tbody></table>
      </section>
    `).join('');
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><title>Fiches congés employés</title><style>${documentPrintStyles()}body{font:13px Arial;color:#172033}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 8px}.meta{color:#5b6678;margin:0}.employee-sheet{page-break-after:always}.employee-sheet:last-child{page-break-after:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid #dce2ea}th{background:#f2f5f8;font-size:11px;text-transform:uppercase}</style></head><body>${sections}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  } catch (err) {
    printWindow.close();
    alert(err.message);
  }
}

async function importEmployees(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    alert('Le fichier CSV ne doit pas dépasser 2 Mo.');
    return;
  }
  try {
    const result = await api.post('/api/employees/import', { csv: await file.text() });
    const rejected = result.errors.length
      ? `\nLignes rejetées :\n${result.errors.map((error) => `- ${error}`).join('\n')}`
      : '';
    alert(`${result.imported} employé(s) importé(s).${rejected}`);
    await loadEmployees();
  } catch (err) { alert(err.message); }
}

function openModal() {
  document.getElementById('modalTitle').textContent = 'Nouvel employé';
  ['empId', 'empNom', 'empPrenom', 'empDirection', 'empEmbauche'].forEach((id) => document.getElementById(id).value = '');
  document.getElementById('empStatut').value = 'employe';
  document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; }

async function saveEmployee() {
  const id = document.getElementById('empId').value;
  const payload = {
    nom: document.getElementById('empNom').value.trim(),
    prenom: document.getElementById('empPrenom').value.trim(),
    direction: document.getElementById('empDirection').value.trim(),
    statut: document.getElementById('empStatut').value,
    date_embauche: document.getElementById('empEmbauche').value || null,
  };
  if (!payload.nom || !payload.prenom || !payload.direction) { alert('Nom, prénom et direction requis.'); return; }
  try {
    if (id) await api.put(`/api/employees/${id}`, payload);
    else await api.post('/api/employees', payload);
    closeModal();
    loadEmployees();
  } catch (err) { alert(err.message); }
}

