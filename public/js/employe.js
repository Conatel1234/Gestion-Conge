let employeeId = null;
let currentHistory = [];

(async function init() {
  await guardAuth();
  await renderSidebar('employes.html');

  employeeId = new URLSearchParams(location.search).get('id');
  if (!employeeId) { location.href = 'employes.html'; return; }

  await loadProfile();

  document.getElementById('exerciceSelect').addEventListener('change', (e) => loadProfile(e.target.value));
  document.getElementById('printProfileBtn').addEventListener('click', () => {
    document.getElementById('documentHeader').innerHTML = documentHeader("HISTORICITE DE CONGE DE L'EMPLOYE");
    const filter = document.getElementById('printLeaveFilter').value;
    const records = currentHistory.filter((leave) => filter === 'PRISES_AVENIR'
      || (filter === 'PRISES' && ['TERMINE', 'EN_COURS'].includes(leave.statut))
      || (filter === 'AVENIR' && leave.statut === 'A_VENIR'));
    renderHistory(records);
    window.print();
    renderHistory(currentHistory);
  });
})();

async function loadProfile(fiscalExerciceId) {
  const qs = fiscalExerciceId ? `?fiscal_exercice_id=${fiscalExerciceId}` : '';
  const profile = await api.get(`/api/employees/${employeeId}/profile${qs}`);
  const e = profile.employee;

  document.getElementById('empName').textContent = `${e.prenom} ${e.nom}`;
  document.getElementById('empMeta').textContent = `${e.direction}${e.date_embauche ? ' · embauché le ' + fmtDate(e.date_embauche) : ''}`;
  document.getElementById('documentHeader').innerHTML = documentHeader("HISTORICITE DE CONGE DE L'EMPLOYE");

  renderExerciceSelect(profile.exercices, profile.fiscal_exercice_id);
  renderBalances(profile.balances, profile.exercices, profile.fiscal_exercice_id);
  currentHistory = profile.historique || [];
  renderHistory(profile.historique);
}

function renderExerciceSelect(exercices, currentId) {
  const sel = document.getElementById('exerciceSelect');
  if (!exercices || exercices.length === 0) {
    sel.innerHTML = `<option>Aucun exercice fiscal</option>`;
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  sel.innerHTML = exercices.map((ex) =>
    `<option value="${ex.id}" ${String(ex.id) === String(currentId) ? 'selected' : ''}>${ex.label}${ex.is_active ? ' (actif)' : ''}</option>`
  ).join('');
}

function renderBalances(balances, exercices, currentId) {
  const wrap = document.getElementById('balancesWrap');
  if (!exercices || exercices.length === 0) {
    wrap.innerHTML = `<p style="color:#94a3b8; font-size:13px;">Aucun exercice fiscal n'a été créé. Rendez-vous sur le tableau de bord pour en charger un.</p>`;
    return;
  }
  if (!balances || balances.length === 0) {
    wrap.innerHTML = `<p style="color:#94a3b8; font-size:13px;">Aucun type de congé actif.</p>`;
    return;
  }
  wrap.innerHTML = balances.map((b) => {
    const overflow = b.pris > b.quota;
    const pct = b.quota > 0 ? Math.min(100, Math.round((b.pris / b.quota) * 100)) : (b.pris > 0 ? 100 : 0);
    return `
      <div class="balance-card">
        <div class="top-row">
          <span class="type-name">${b.nom}</span>
          <span class="figures mono">${b.pris} / ${b.quota} j. pris · <strong style="color:${overflow ? '#e11d48' : '#059669'}">${b.restant} j. restants</strong></span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${overflow ? 'progress-overflow' : ''}" style="width:${pct}%; background:${overflow ? '' : b.couleur};"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderHistory(historique) {
  const tbody = document.getElementById('historyBody');
  if (!historique || historique.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Aucun congé correspondant à ce filtre.</td></tr>`;
    return;
  }
  const map = { EN_COURS: ['badge-emerald', 'En congé'], A_VENIR: ['badge-indigo', 'À venir'], TERMINE: ['badge-slate', 'Terminé'] };
  tbody.innerHTML = historique.map((h) => {
    const [cls, label] = map[h.statut] || ['badge-slate', h.statut];
    return `
      <tr>
        <td><span class="badge badge-slate"><span class="dot"></span>${h.exercice_label}</span></td>
        <td>${h.leave_type}</td>
        <td>${fmtDate(h.date_debut)} → ${fmtDate(h.date_fin)}</td>
        <td class="mono">${h.jours_ouvres} j.</td>
        <td>${fmtDate(h.date_reprise)}</td>
        <td><span class="badge ${cls}"><span class="dot"></span>${label}</span></td>
      </tr>
    `;
  }).join('');
}
