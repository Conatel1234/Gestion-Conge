const api = {
  async request(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      if (!location.pathname.endsWith('login.html')) location.href = 'login.html';
      throw new Error('Non authentifie');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body (blob downloads) */ }
    if (!res.ok) throw new Error((data && data.error) || 'Erreur serveur');
    return data;
  },
  get: (url) => api.request('GET', url),
  post: (url, body) => api.request('POST', url, body),
  put: (url, body) => api.request('PUT', url, body),
  del: (url) => api.request('DELETE', url),
};

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
let inactivityTimer;

function resetInactivityTimer() {
  if (location.pathname.endsWith('login.html')) return;
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(async () => {
    try { await api.post('/api/auth/logout'); } catch (e) { /* session may already be expired */ }
    location.href = 'login.html?reason=timeout';
  }, INACTIVITY_LIMIT_MS);
}

if (!location.pathname.endsWith('login.html')) {
  ['click', 'keydown', 'mousemove', 'mousedown', 'scroll', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, resetInactivityTimer, { passive: true });
  });
  resetInactivityTimer();
}

function downloadFile(url) {
  window.open(url, '_blank');
}

const NAV_LINKS = [
  { href: 'index.html', label: 'Tableau de bord' },
  { href: 'conges.html', label: 'Conges' },
  { href: 'employes.html', label: 'Employes' },
  { href: 'export.html', label: 'Export par direction' },
  { href: 'types.html', label: 'Types de conge' },
  { href: 'feries.html', label: 'Jours off' },
  { href: 'backups.html', label: 'Sauvegarde / restauration' },
];

async function renderSidebar(activeHref) {
  const el = document.getElementById('sidebar');
  if (!el) return;
  let exercice = null;
  try { exercice = await api.get('/api/fiscal-exercices/active'); } catch (e) { /* ignore */ }

  el.innerHTML = `
    <header class="sidebar-header">
      <label class="company-logo" for="companyLogoInput" title="Ajouter le logo de l'entreprise">
        <img id="companyLogo" alt="Logo de l'entreprise" />
        <span id="companyLogoPlaceholder">Logo<br />entreprise</span>
      </label>
      <input type="file" id="companyLogoInput" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden />
      <div class="brand">Gestion Congé</div>
      <div class="brand-sub">Espace RH</div>
    </header>
    <nav>
      ${NAV_LINKS.map((l) => `<a href="${l.href}" class="${l.href === activeHref ? 'active' : ''}">${l.label}</a>`).join('')}
    </nav>
    <div class="exercice-badge">
      <strong>${exercice ? exercice.label : 'Aucun exercice actif'}</strong>
      ${exercice ? `${fmtDate(exercice.date_debut)} — ${fmtDate(exercice.date_fin)}` : 'Chargez un exercice fiscal'}
    </div>
    <button class="logout-btn" id="logoutBtn">Se déconnecter</button>
  `;
  const logo = document.getElementById('companyLogo');
  const placeholder = document.getElementById('companyLogoPlaceholder');
  const savedLogo = localStorage.getItem('companyLogo');
  logo.src = savedLogo && /^data:image\//.test(savedLogo)
    ? savedLogo
    : '/images/logo%20Conate.png';
  logo.classList.add('visible');
  placeholder.style.display = 'none';
  document.getElementById('companyLogoInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      localStorage.setItem('companyLogo', reader.result);
      logo.src = reader.result;
      logo.classList.add('visible');
      placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api.post('/api/auth/logout');
    location.href = 'login.html';
  });
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.slice ? iso.slice(0, 10) : iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function guardAuth() {
  try { await api.get('/api/auth/me'); } catch (e) { location.href = 'login.html'; }
}
