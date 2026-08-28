require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./db');

async function seed() {
  console.log('Seeding de la base de donnees...');

  // 1. Compte RH par defaut
  const username = process.env.SEED_HR_USERNAME || 'admin';
  const password = process.env.SEED_HR_PASSWORD || 'admin123';
  const existing = await db.query('SELECT id FROM hr_users WHERE username=$1', [username]);
  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO hr_users (username, password_hash) VALUES ($1,$2)', [username, hash]);
    console.log(`Compte RH cree -> identifiant: ${username} / mot de passe: ${password}`);
  } else {
    console.log('Compte RH deja existant, ignore.');
  }

  // 2. Types de conge standards (modifiables ensuite dans l'app)
  const defaultTypes = [
    { nom: 'Congé Annuel', quota_jours: 15, couleur: '#10b981' },
    { nom: 'Congé Maladie', quota_jours: 10, couleur: '#f59e0b' },
    { nom: 'Congé Maternité', quota_jours: 90, couleur: '#8b5cf6' },
    { nom: 'Congé Paternité', quota_jours: 3, couleur: '#6366f1' },
    { nom: 'Congé Sans Solde', quota_jours: 0, couleur: '#64748b' },
    { nom: 'Congé pour Deuil', quota_jours: 3, couleur: '#334155' },
    { nom: 'Congé Spécial', quota_jours: 15, couleur: '#163cb6' },
  ];
  for (const t of defaultTypes) {
    await db.query(
      'INSERT INTO leave_types (nom, quota_jours, couleur) VALUES ($1,$2,$3) ON CONFLICT (nom) DO NOTHING',
      [t.nom, t.quota_jours, t.couleur]
    );
  }
  console.log('Types de conge par defaut inseres.');

  // 3. Exercice fiscal 01 Octobre 2025 -> 30 Septembre 2026, active par defaut
  const exo = await db.query('SELECT id FROM fiscal_exercices WHERE date_debut=$1 AND date_fin=$2', ['2025-10-01', '2026-09-30']);
  if (exo.rows.length === 0) {
    await db.query(
      `INSERT INTO fiscal_exercices (label, date_debut, date_fin, is_active) VALUES ($1,$2,$3,true)`,
      ['2025-2026', '2025-10-01', '2026-09-30']
    );
    console.log('Exercice fiscal 2025-2026 (01 Oct 2025 - 30 Sept 2026) cree et active.');
  } else {
    console.log('Exercice fiscal 2025-2026 deja existant, ignore.');
  }

  console.log('Seed termine.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Erreur pendant le seed:', err);
  process.exit(1);
});
