(async function init() {
  await guardAuth();
  await renderSidebar('backups.html');
  document.getElementById('downloadBackupBtn').addEventListener('click', downloadBackup);
  document.getElementById('restoreBackupBtn').addEventListener('click', () => document.getElementById('restoreBackupInput').click());
  document.getElementById('restoreBackupInput').addEventListener('change', restoreBackup);
})();

function showBackupMessage(message, isError = true) {
  const element = document.getElementById('backupMessage');
  element.textContent = message;
  element.style.color = isError ? 'var(--rose)' : 'var(--emerald)';
}

async function downloadBackup() {
  try {
    const response = await fetch('/api/backups/export', { credentials: 'include' });
    if (!response.ok) throw new Error('Sauvegarde impossible.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gestion-conge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showBackupMessage('Sauvegarde téléchargée.', false);
  } catch (err) { showBackupMessage(err.message); }
}

async function restoreBackup(event) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  if (!confirm('Attention : cette restauration remplacera toutes les données actuelles. Continuer ?')) return;
  try {
    const content = await file.text();
    const backup = JSON.parse(content);
    const result = await api.post('/api/backups/import', backup);
    showBackupMessage(`${result.restored} enregistrements restaurés.`, false);
  } catch (err) { showBackupMessage(err.message); }
}
