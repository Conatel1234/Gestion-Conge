const express = require('express');
const db = require('../db');
const { countWorkingDays, nextWorkingDay, statusOf, toISO } = require('../utils/workingDays');
const { specialLeaveQuota } = require('../utils/seniority');

const router = express.Router();

async function getHolidaySet() {
  const { rows } = await db.query('SELECT date_off FROM holidays');
  return new Set(rows.map((h) => h.date_off.toISOString().slice(0, 10)));
}

async function getActiveExerciceId() {
  const { rows } = await db.query('SELECT id FROM fiscal_exercices WHERE is_active = true');
  return rows[0]?.id || null;
}

// GET /api/leave-records?status=EN_COURS|A_VENIR|TERMINE&q=&fiscal_exercice_id=&direction=&employee_status=
router.get('/', async (req, res) => {
  try {
    const { status, q, fiscal_exercice_id, direction, employee_status } = req.query;
    const exerciceId = fiscal_exercice_id || (await getActiveExerciceId());

    const params = [];
    let sql = `
      SELECT lr.*, e.nom AS emp_nom, e.prenom AS emp_prenom, e.direction, e.statut AS employee_status, e.date_embauche,
             lt.nom AS leave_type_nom, lt.couleur, lt.quota_jours
      FROM leave_records lr
      JOIN employees e ON e.id = lr.employee_id
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE 1=1
    `;
    if (exerciceId) { params.push(exerciceId); sql += ` AND lr.fiscal_exercice_id = $${params.length}`; }
    if (direction) { params.push(direction); sql += ` AND e.direction = $${params.length}`; }
    if (employee_status) { params.push(employee_status); sql += ` AND e.statut = $${params.length}`; }
    if (q) {
      params.push(`%${q.toLowerCase()}%`);
      sql += ` AND (LOWER(e.nom) LIKE $${params.length} OR LOWER(e.prenom) LIKE $${params.length} OR LOWER(e.direction) LIKE $${params.length})`;
    }
    sql += ' ORDER BY lr.date_debut DESC';

    const { rows } = await db.query(sql, params);
    const today = toISO(new Date());

    const holidaySet = await getHolidaySet();
    // solde restant = quota - somme des jours_ouvres de meme employe+type sur l'exercice
    const prisParEmployeType = {};
    rows.forEach((r) => {
      const key = `${r.employee_id}-${r.leave_type_id}`;
      prisParEmployeType[key] = (prisParEmployeType[key] || 0) + r.jours_ouvres;
    });

    let result = rows.map((r) => {
      const key = `${r.employee_id}-${r.leave_type_id}`;
      const quota = specialLeaveQuota({ date_embauche: r.date_embauche }, r.leave_type_nom, today);
      return {
        id: r.id,
        employee_id: r.employee_id,
        nom: r.emp_nom,
        prenom: r.emp_prenom,
        direction: r.direction,
        employee_status: r.employee_status,
        leave_type_id: r.leave_type_id,
        leave_type: r.leave_type_nom,
        couleur: r.couleur,
        date_debut: r.date_debut.toISOString().slice(0, 10),
        date_fin: r.date_fin.toISOString().slice(0, 10),
        jours_ouvres: r.jours_ouvres,
        date_reprise: r.date_reprise ? r.date_reprise.toISOString().slice(0, 10) : null,
        restant: (quota === null ? r.quota_jours : quota) - prisParEmployeType[key],
        statut: statusOf(r.date_debut.toISOString().slice(0, 10), r.date_fin.toISOString().slice(0, 10), today),
      };
    });

    if (status && status !== 'TOUS') {
      result = result.filter((r) => r.statut === status);
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// GET /api/leave-records/upcoming-return?days=7  -> reprises de service a venir
router.get('/upcoming-return', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const holidaySet = await getHolidaySet();
    const { rows } = await db.query(`
      SELECT lr.*, e.nom AS emp_nom, e.prenom AS emp_prenom, e.direction, lt.nom AS leave_type_nom
      FROM leave_records lr
      JOIN employees e ON e.id = lr.employee_id
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.date_reprise IS NOT NULL
      ORDER BY lr.date_reprise ASC
    `);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const limit = new Date(today); limit.setDate(limit.getDate() + days);

    const upcoming = rows
      .map((r) => ({
        id: r.id,
        nom: r.emp_nom,
        prenom: r.emp_prenom,
        direction: r.direction,
        leave_type: r.leave_type_nom,
        date_fin: r.date_fin.toISOString().slice(0, 10),
        date_reprise: r.date_reprise.toISOString().slice(0, 10),
      }))
      .filter((r) => {
        const d = new Date(r.date_reprise);
        return d >= today && d <= limit;
      });

    res.json(upcoming);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/', async (req, res) => {
  const { employee_id, leave_type_id, date_debut, date_fin, note } = req.body;
  if (!employee_id || !leave_type_id || !date_debut || !date_fin) {
    return res.status(400).json({ error: 'Employe, type de conge et periode sont requis.' });
  }
  if (date_fin < date_debut) {
    return res.status(400).json({ error: 'La date de fin doit etre apres la date de debut.' });
  }
  try {
    const exerciceId = await getActiveExerciceId();
    if (!exerciceId) return res.status(400).json({ error: "Aucun exercice fiscal actif. Chargez d'abord un exercice." });

    const holidaySet = await getHolidaySet();
    const jours = countWorkingDays(date_debut, date_fin, holidaySet);
    const reprise = nextWorkingDay(date_fin, holidaySet);

    const { rows } = await db.query(
      `INSERT INTO leave_records (employee_id, leave_type_id, fiscal_exercice_id, date_debut, date_fin, jours_ouvres, date_reprise, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [employee_id, leave_type_id, exerciceId, date_debut, date_fin, jours, reprise, note || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.put('/:id', async (req, res) => {
  const { employee_id, leave_type_id, date_debut, date_fin, note } = req.body;
  if (date_fin < date_debut) {
    return res.status(400).json({ error: 'La date de fin doit etre apres la date de debut.' });
  }
  try {
    const holidaySet = await getHolidaySet();
    const jours = countWorkingDays(date_debut, date_fin, holidaySet);
    const reprise = nextWorkingDay(date_fin, holidaySet);

    const { rows } = await db.query(
      `UPDATE leave_records SET employee_id=$1, leave_type_id=$2, date_debut=$3, date_fin=$4,
       jours_ouvres=$5, date_reprise=$6, note=$7 WHERE id=$8 RETURNING *`,
      [employee_id, leave_type_id, date_debut, date_fin, jours, reprise, note || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Conge introuvable.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM leave_records WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
