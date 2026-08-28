const express = require('express');
const db = require('../db');
const { toISO } = require('../utils/workingDays');

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const activeRes = await db.query('SELECT * FROM fiscal_exercices WHERE is_active = true');
    const exercice = activeRes.rows[0] || null;
    const today = toISO(new Date());

    let enConge = 0, aVenir7 = 0, totalConges = 0, directions = 0;

    if (exercice) {
      const r1 = await db.query(
        `SELECT COUNT(*)::int AS n FROM leave_records
         WHERE fiscal_exercice_id = $1 AND date_debut <= $2 AND date_fin >= $2`,
        [exercice.id, today]
      );
      enConge = r1.rows[0].n;

      const r2 = await db.query(
        `SELECT COUNT(*)::int AS n FROM leave_records
         WHERE fiscal_exercice_id = $1 AND date_reprise IS NOT NULL
         AND date_reprise >= $2 AND date_reprise <= ($2::date + INTERVAL '7 day')`,
        [exercice.id, today]
      );
      aVenir7 = r2.rows[0].n;

      const r3 = await db.query(
        `SELECT COUNT(*)::int AS n FROM leave_records WHERE fiscal_exercice_id = $1`,
        [exercice.id]
      );
      totalConges = r3.rows[0].n;
    }

    const r4 = await db.query('SELECT COUNT(DISTINCT direction)::int AS n FROM employees');
    directions = r4.rows[0].n;

    res.json({ exercice, enConge, aVenir7, totalConges, directions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
