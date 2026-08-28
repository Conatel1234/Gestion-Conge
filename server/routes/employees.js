const express = require('express');
const db = require('../db');
const { countWorkingDays, nextWorkingDay, statusOf } = require('../utils/workingDays');
const { specialLeaveQuota } = require('../utils/seniority');

const router = express.Router();
const EMPLOYEE_STATUSES = ['employe', 'contractuel'];

function calculateSeniority(dateEmbauche) {
  if (!dateEmbauche) return null;
  const start = new Date(`${dateEmbauche.toISOString().slice(0, 10)}T00:00:00`);
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (start > current) return null;

  let years = current.getFullYear() - start.getFullYear();
  let months = current.getMonth() - start.getMonth();
  let days = current.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(current.getFullYear(), current.getMonth(), 0).getDate();
  }
  if (months < 0) { years -= 1; months += 12; }
  return { years, months, days, label: `${years} an(s), ${months} mois` };
}

function presentEmployee(employee) {
  return { ...employee, anciennete: calculateSeniority(employee.date_embauche) };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const delimiter = (text.split(/\r?\n/, 1)[0].match(/;/g) || []).length >
    (text.split(/\r?\n/, 1)[0].match(/,/g) || []).length ? ';' : ',';

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim()); cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim()); cell = '';
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
    } else cell += character;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

function normalizeHeader(value) {
  return value.replace(/^\uFEFF/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

router.post('/import', async (req, res) => {
  const csv = typeof req.body.csv === 'string' ? req.body.csv : '';
  if (!csv.trim()) return res.status(400).json({ error: 'Le fichier CSV est vide.' });

  const rows = parseCsv(csv);
  if (rows.length < 2) return res.status(400).json({ error: 'Le CSV doit contenir une ligne d’en-têtes et au moins un employé.' });

  const headers = rows[0].map(normalizeHeader);
  const columns = {
    nom: headers.findIndex((header) => ['nom', 'lastname', 'surname'].includes(header)),
    prenom: headers.findIndex((header) => ['prenom', 'firstname', 'givenname'].includes(header)),
    direction: headers.findIndex((header) => ['direction', 'departement', 'department', 'service'].includes(header)),
    date_embauche: headers.findIndex((header) => ['dateembauche', 'datehire', 'hiredate'].includes(header)),
    statut: headers.findIndex((header) => ['statut', 'status', 'typecontrat', 'contracttype'].includes(header)),
  };
  if (columns.nom < 0 || columns.prenom < 0 || columns.direction < 0) {
    return res.status(400).json({ error: 'En-têtes requis : Nom, Prenom et Direction.' });
  }

  const validRows = [];
  const errors = [];
  rows.slice(1).forEach((values, index) => {
    const line = index + 2;
    const employee = {
      nom: values[columns.nom] || '',
      prenom: values[columns.prenom] || '',
      direction: values[columns.direction] || '',
      date_embauche: columns.date_embauche >= 0 ? values[columns.date_embauche] || null : null,
      statut: columns.statut >= 0 ? (values[columns.statut] || 'employe').toLowerCase() : 'employe',
    };
    if (!employee.nom || !employee.prenom || !employee.direction) {
      errors.push(`ligne ${line}: Nom, Prenom et Direction sont requis`);
    } else if (!EMPLOYEE_STATUSES.includes(employee.statut)) {
      errors.push(`ligne ${line}: le statut doit être employe ou contractuel`);
    } else if (employee.date_embauche && !/^\d{4}-\d{2}-\d{2}$/.test(employee.date_embauche)) {
      errors.push(`ligne ${line}: la date doit être au format AAAA-MM-JJ`);
    } else validRows.push(employee);
  });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const employee of validRows) {
      await client.query(
        'INSERT INTO employees (nom, prenom, direction, date_embauche, statut) VALUES ($1,$2,$3,$4,$5)',
        [employee.nom, employee.prenom, employee.direction, employee.date_embauche, employee.statut]
      );
    }
    await client.query('COMMIT');
    res.json({ imported: validRows.length, errors });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Import impossible. Aucune ligne n’a été ajoutée.' });
  } finally {
    client.release();
  }
});

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM employees ORDER BY nom, prenom`
    );
    res.json(rows.map(presentEmployee));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/', async (req, res) => {
  const { nom, prenom, direction, date_embauche, statut = 'employe' } = req.body;
  if (!nom || !prenom || !direction) {
    return res.status(400).json({ error: 'Nom, prenom et direction sont requis.' });
  }
  if (!EMPLOYEE_STATUSES.includes(statut)) return res.status(400).json({ error: 'Le statut doit être employe ou contractuel.' });
  try {
    const { rows } = await db.query(
      `INSERT INTO employees (nom, prenom, direction, date_embauche, statut) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nom, prenom, direction, date_embauche || null, statut]
    );
    res.status(201).json(presentEmployee(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.put('/:id', async (req, res) => {
  const { nom, prenom, direction, date_embauche, statut = 'employe', actif } = req.body;
  if (!EMPLOYEE_STATUSES.includes(statut)) return res.status(400).json({ error: 'Le statut doit être employe ou contractuel.' });
  try {
    const { rows } = await db.query(
      `UPDATE employees SET nom=$1, prenom=$2, direction=$3, date_embauche=$4, statut=$5, actif=$6 WHERE id=$7 RETURNING *`,
      [nom, prenom, direction, date_embauche || null, statut, actif !== undefined ? actif : true, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Employe introuvable.' });
    res.json(presentEmployee(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM employees WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Liste des directions distinctes (pour filtres / export)
router.get('/meta/directions', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT DISTINCT direction FROM employees ORDER BY direction');
    res.json(rows.map((r) => r.direction));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Profil complet: infos + solde par type de conge pour l'exercice choisi (ou actif par defaut)
// + historique COMPLET multi-exercices de l'employe
router.get('/:id/profile', async (req, res) => {
  try {
    const empRes = await db.query('SELECT * FROM employees WHERE id=$1', [req.params.id]);
    const employee = empRes.rows[0];
    if (!employee) return res.status(404).json({ error: 'Employe introuvable.' });

    const exercicesRes = await db.query('SELECT * FROM fiscal_exercices ORDER BY date_debut DESC');
    const exercices = exercicesRes.rows;

    let exerciceId = req.query.fiscal_exercice_id ? Number(req.query.fiscal_exercice_id) : null;
    if (!exerciceId) {
      exerciceId = (exercices.find((e) => e.is_active) || {}).id || null;
    }

    const typesRes = await db.query('SELECT * FROM leave_types WHERE actif = true ORDER BY nom');

    // Historique COMPLET (tous les exercices), pour affichage multi-exercices
    const allRecordsRes = await db.query(
      `SELECT lr.*, lt.nom AS leave_type_nom, lt.couleur, fe.label AS exercice_label, fe.id AS exercice_id
       FROM leave_records lr
       JOIN leave_types lt ON lt.id = lr.leave_type_id
       JOIN fiscal_exercices fe ON fe.id = lr.fiscal_exercice_id
       WHERE lr.employee_id = $1
       ORDER BY lr.date_debut DESC`,
      [req.params.id]
    );
    const allRecords = allRecordsRes.rows;

    // Soldes calcules uniquement a partir des conges de l'exercice selectionne
    const recordsForBalance = allRecords.filter((r) => String(r.exercice_id) === String(exerciceId));
    const balances = typesRes.rows.map((t) => {
      const pris = recordsForBalance
        .filter((r) => r.leave_type_id === t.id)
        .reduce((sum, r) => sum + r.jours_ouvres, 0);
      const quota = specialLeaveQuota(employee, t.nom, new Date());
      const effectiveQuota = quota === null ? t.quota_jours : quota;
      return {
        leave_type_id: t.id,
        nom: t.nom,
        couleur: t.couleur,
        quota: effectiveQuota,
        pris,
        restant: effectiveQuota - pris,
        pourcentage: effectiveQuota > 0 ? Math.min(100, Math.round((pris / effectiveQuota) * 100)) : 0,
      };
    });

    const historique = allRecords.map((r) => ({
      id: r.id,
      exercice_id: r.exercice_id,
      exercice_label: r.exercice_label,
      leave_type: r.leave_type_nom,
      couleur: r.couleur,
      date_debut: r.date_debut,
      date_fin: r.date_fin,
      jours_ouvres: r.jours_ouvres,
      date_reprise: r.date_reprise,
      statut: statusOf(
        r.date_debut.toISOString().slice(0, 10),
        r.date_fin.toISOString().slice(0, 10)
      ),
    }));

    res.json({ employee: presentEmployee(employee), exercices, fiscal_exercice_id: exerciceId, balances, historique });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
