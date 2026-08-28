let employees = [];
let leaveTypes = [];
let holidaySet = new Set();
let currentStatus = 'TOUS';
let currentQuery = '';
let currentDirection = '';
let currentEmployeeStatus = '';
let hintRequestId = 0;

(async function init() {
  await guardAuth();
  await renderSidebar('conges.html');
  await loadReference();
  await loadTable();
  bindEvents();
})();

async function loadReference() {
  [employees, leaveTypes] = await Promise.all([
    api.get('/api/employees'),
    api.get('/api/leave-types?actif=true'),
  ]);
  const holidays = await api.get('/api/holidays');
  holidaySet = new Set(holidays.map((h) => h.date_off.slice(0, 10)));

  document.getElementById('employeeSelect').innerHTML = employees
    .map((e) => `<option value="${e.id}">${e.prenom} ${e.nom} — ${e.direction}</option>`).join('');
  document.getElementById('typeSelect').innerHTML = leaveTypes
    .map((t) => `<option value="${t.id}">${t.nom} (${t.quota_jours} j./an)</option>`).join('');
  document.getElementById('directionFilter').innerHTML = '<option value="">Toutes les directions</option>'
    + [...new Set(employees.map((e) => e.direction))].sort().map((direction) => `<option value="${direction}">${direction}</option>`).join('');
}

async function loadTable() {
  const params = new URLSearchParams();
  if (currentStatus !== 'TOUS') params.set('status', currentStatus);
  if (currentQuery) params.set('q', currentQuery);
  if (currentDirection) params.set('direction', currentDirection);
  if (currentEmployeeStatus) params.set('employee_status', currentEmployeeStatus);
  const rows = await api.get(`/api/leave-records?${params.toString()}`);
  const tbody = document.getElementById('tableBody');

  if (rows.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="10">Aucun congé ne correspond à ce filtre.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td><strong>${r.prenom} ${r.nom}</strong></td>
      <td>${r.direction}</td>
      <td>${r.employee_status === 'contractuel' ? 'Contractuel' : 'Employé'}</td>
      <td>${r.leave_type}</td>
      <td>
        ${fmtDate(r.date_debut)} → ${fmtDate(r.date_fin)}
        ${periodBar(r.date_debut, r.date_fin)}
      </td>
      <td class="mono">${r.jours_ouvres} j.</td>
      <td class="mono ${r.restant < 0 ? 'text-danger' : ''}">${r.restant} j.</td>
      <td>${fmtDate(r.date_reprise)}</td>
      <td>${statusBadge(r.statut)}</td>
      <td>
        <button class="icon-btn" onclick='openEdit(${JSON.stringify(r)})'>✎</button>
        <button class="icon-btn danger" onclick="confirmDelete(${r.id})">🗑</button>
      </td>
    </tr>
  `).join('');
}

function periodBar(startISO, endISO) {
  const start = new Date(startISO), end = new Date(endISO);
  const days = [];
  let cur = new Date(start);
  while (cur <= end && days.length < 31) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return `<div class="period-bar">${days.map((d) => {
    const wknd = d.getDay() === 0 || d.getDay() === 6;
    const off = wknd || holidaySet.has(isoOf(d));
    return `<span class="${off ? '' : 'work'}"></span>`;
  }).join('')}</div>`;
}

function isoOf(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function statusBadge(status) {
  const map = {
    EN_COURS: ['badge-emerald', 'En congé'],
    A_VENIR: ['badge-indigo', 'À venir'],
    TERMINE: ['badge-slate', 'Terminé'],
  };
  const [cls, label] = map[status] || ['badge-slate', status];
  return `<span class="badge ${cls}"><span class="dot"></span>${label}</span>`;
}

function bindEvents() {
  document.querySelectorAll('#filterPills .pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#filterPills .pill').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatus = btn.dataset.status;
      loadTable();
    });
  });

  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { currentQuery = e.target.value; loadTable(); }, 250);
  });
  document.getElementById('directionFilter').addEventListener('change', (e) => { currentDirection = e.target.value; loadTable(); });
  document.getElementById('employeeStatusFilter').addEventListener('change', (e) => { currentEmployeeStatus = e.target.value; loadTable(); });

  document.getElementById('newLeaveBtn').addEventListener('click', () => openModal());
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', saveRecord);

  ['employeeSelect', 'typeSelect', 'dateDebut', 'dateFin'].forEach((id) => {
    document.getElementById(id).addEventListener('change', updateHint);
  });

  document.getElementById('exportExcelBtn').addEventListener('click', () => downloadFile('/api/exports/excel'));
  document.getElementById('exportPdfBtn').addEventListener('click', () => downloadFile('/api/exports/pdf'));
  document.getElementById('printActiveBtn').addEventListener('click', printActiveLeaves);
  document.getElementById('documentHeader').innerHTML = documentHeader('LISTE DES CONGES');
}

async function printActiveLeaves() {
  document.body.classList.add('active-leave-print');
  document.querySelectorAll('#filterPills .pill').forEach((button) => {
    button.classList.toggle('active', button.dataset.status === 'EN_COURS');
  });
  currentStatus = 'EN_COURS';
  await loadTable();
  window.print();
}

function openModal() {
  document.getElementById('modalTitle').textContent = 'Nouveau congé';
  document.getElementById('recordId').value = '';
  document.getElementById('dateDebut').value = '';
  document.getElementById('dateFin').value = '';
  document.getElementById('note').value = '';
  document.getElementById('hintBox').style.display = 'none';
  document.getElementById('modalOverlay').style.display = 'flex';
}

function openEdit(r) {
  document.getElementById('modalTitle').textContent = 'Modifier le congé';
  document.getElementById('recordId').value = r.id;
  document.getElementById('employeeSelect').value = r.employee_id;
  document.getElementById('typeSelect').value = r.leave_type_id;
  document.getElementById('dateDebut').value = r.date_debut;
  document.getElementById('dateFin').value = r.date_fin;
  document.getElementById('note').value = r.note || '';
  document.getElementById('modalOverlay').style.display = 'flex';
  updateHint();
}

function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; }

async function updateHint() {
  const employeeId = document.getElementById('employeeSelect').value;
  const typeId = document.getElementById('typeSelect').value;
  const dateDebut = document.getElementById('dateDebut').value;
  const dateFin = document.getElementById('dateFin').value;
  const box = document.getElementById('hintBox');

  if (!employeeId || !typeId || !dateDebut || !dateFin || dateFin < dateDebut) {
    box.style.display = 'none';
    return;
  }

  const jours = countWorkingDaysClient(dateDebut, dateFin);
  const requestId = ++hintRequestId;
  const type = leaveTypes.find((t) => String(t.id) === String(typeId));
  const reprise = nextWorkingDayClient(dateFin);
  box.style.display = 'block';
  box.innerHTML = `
    <div class="row"><span>Jours ouvrés demandés</span><strong>${jours} j.</strong></div>
    <div class="row"><span>Reprise de service prévue</span><strong>${fmtDate(reprise)}</strong></div>
    <div class="row"><span>Solde restant après ce congé</span><strong>Calcul en cours…</strong></div>
  `;

  try {
    const profile = await api.get(`/api/employees/${employeeId}/profile`);
    if (requestId !== hintRequestId) return;
    const bal = profile.balances.find((b) => String(b.leave_type_id) === String(typeId));
    const recordId = document.getElementById('recordId').value;
    const prisAilleurs = (profile.historique || [])
      .filter((h) => String(h.id) !== recordId)
      .filter((h) => h.leave_type === type?.nom)
      .reduce((s, h) => s + h.jours_ouvres, 0);
    const quota = bal ? bal.quota : 0;
    const restant = quota - prisAilleurs - jours;
    box.innerHTML = `
      <div class="row"><span>Jours ouvrés demandés</span><strong>${jours} j.</strong></div>
      <div class="row"><span>Reprise de service prévue</span><strong>${fmtDate(reprise)}</strong></div>
      <div class="row"><span>Solde restant après ce congé</span><strong style="color:${restant < 0 ? '#e11d48' : '#0f172a'}">${restant} j.</strong></div>
      ${restant < 0 ? `<div class="warn-text">⚠ Le solde annuel de ce type de congé est dépassé.</div>` : ''}
    `;
  } catch (err) {
    if (requestId === hintRequestId) {
      box.innerHTML += `<div class="warn-text">Le nombre de jours est calculé. Le solde est momentanément indisponible.</div>`;
    }
  }
}

function countWorkingDaysClient(startISO, endISO) {
  let cur = new Date(startISO);
  const end = new Date(endISO);
  let n = 0;
  while (cur <= end) {
    const wknd = cur.getDay() === 0 || cur.getDay() === 6;
    if (!wknd && !holidaySet.has(isoOf(cur))) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}

function nextWorkingDayClient(endISO) {
  const date = new Date(endISO);
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6 || holidaySet.has(isoOf(date))) {
    date.setDate(date.getDate() + 1);
  }
  return isoOf(date);
}

async function saveRecord() {
  const id = document.getElementById('recordId').value;
  const payload = {
    employee_id: document.getElementById('employeeSelect').value,
    leave_type_id: document.getElementById('typeSelect').value,
    date_debut: document.getElementById('dateDebut').value,
    date_fin: document.getElementById('dateFin').value,
    note: document.getElementById('note').value,
  };
  if (!payload.date_debut || !payload.date_fin) { alert('Veuillez indiquer une période complète.'); return; }
  try {
    if (id) await api.put(`/api/leave-records/${id}`, payload);
    else await api.post('/api/leave-records', payload);
    closeModal();
    await loadTable();
  } catch (err) {
    alert(err.message);
  }
}

async function confirmDelete(id) {
  if (!confirm('Supprimer ce congé ?')) return;
  await api.del(`/api/leave-records/${id}`);
  loadTable();
}
