(async function init() {
  await guardAuth();
  await renderSidebar('index.html');
  await loadStats();
  await loadUpcoming();
  await loadExercices();

  document.getElementById('exDebut').addEventListener('change', (e) => {
    document.getElementById('exFin').min = e.target.value;
  });

  document.getElementById('exerciceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('exerciceError');
    errEl.textContent = '';
    const label = document.getElementById('exLabel').value.trim();
    const date_debut = document.getElementById('exDebut').value;
    const date_fin = document.getElementById('exFin').value;

    if (!label || !date_debut || !date_fin) {
      errEl.textContent = 'Veuillez remplir le libellé et les deux dates.';
      return;
    }
    if (date_fin <= date_debut) {
      errEl.textContent = 'La date de fin doit être postérieure à la date de début.';
      return;
    }
    try {
      await api.post('/api/fiscal-exercices', { label, date_debut, date_fin, activer: true });
      location.reload();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });
})();

async function loadStats() {
  const s = await api.get('/api/dashboard/stats');
  const grid = document.getElementById('statsGrid');
  grid.innerHTML = `
    ${statCard('#ecfdf5', '#059669', 'En congé aujourd\'hui', s.enConge)}
    ${statCard('#eef2ff', '#4f46e5', 'Reprises sous 7 jours', s.aVenir7)}
    ${statCard('#fffbeb', '#d97706', 'Congés cet exercice', s.totalConges)}
    ${statCard('#f1f5f9', '#334155', 'Directions', s.directions)}
  `;
}

function statCard(bg, color, label, value) {
  return `
    <div class="stat-card">
      <div class="icon" style="background:${bg}; color:${color};">●</div>
      <div class="value">${value}</div>
      <div class="label">${label}</div>
    </div>`;
}

async function loadUpcoming() {
  const list = await api.get('/api/leave-records/upcoming-return?days=7');
  const el = document.getElementById('repriseList');
  if (list.length === 0) {
    el.innerHTML = `<p style="color:#94a3b8; font-size:13px; margin:10px 0 0;">Aucune reprise de service prévue dans les 7 prochains jours.</p>`;
    return;
  }
  el.innerHTML = list.map((r) => `
    <div class="reprise-item">
      <div>
        <div class="who">${r.prenom} ${r.nom}</div>
        <div style="color:#94a3b8;">${r.direction} · ${r.leave_type} · fin le ${fmtDate(r.date_fin)}</div>
      </div>
      <div class="when">Reprise: ${fmtDate(r.date_reprise)}</div>
    </div>
  `).join('');
}

async function loadExercices() {
  const list = await api.get('/api/fiscal-exercices');
  const el = document.getElementById('exerciceList');
  if (list.length === 0) {
    el.innerHTML = `<p style="color:#94a3b8; font-size:13px;">Aucun exercice fiscal enregistré.</p>`;
    return;
  }
  el.innerHTML = list.map((ex) => `
    <div class="reprise-item" style="margin-bottom:6px;">
      <div>
        <div class="who">${ex.label}</div>
        <div style="color:#94a3b8;">${fmtDate(ex.date_debut)} → ${fmtDate(ex.date_fin)}</div>
      </div>
      ${ex.is_active
        ? `<span class="badge badge-emerald"><span class="dot"></span>Actif</span>`
        : `<div class="exercise-actions">
             <button class="btn btn-outline" data-id="${ex.id}" onclick="activerExercice(${ex.id})">Charger</button>
             <button class="icon-btn danger" title="Supprimer cet exercice" aria-label="Supprimer ${ex.label}" onclick="supprimerExercice(${ex.id}, '${escapeAttribute(ex.label)}')">🗑</button>
           </div>`}
    </div>
  `).join('');
}

async function activerExercice(id) {
  await api.put(`/api/fiscal-exercices/${id}/activer`);
  location.reload();
}

function escapeAttribute(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function supprimerExercice(id, label) {
  if (!confirm(`Supprimer l’exercice « ${label} » ? Cette action est irréversible.`)) return;
  try {
    await api.del(`/api/fiscal-exercices/${id}`);
    await loadExercices();
  } catch (err) {
    alert(err.message);
  }
}
