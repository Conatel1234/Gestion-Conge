const express = require('express');
const db = require('../db');
const { ensureHolidaysForExercice } = require('../utils/haitianHolidays');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM fiscal_exercices ORDER BY date_debut DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/active', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM fiscal_exercices WHERE is_active = true');
    if (rows[0]) await ensureHolidaysForExercice(db, rows[0]);
    res.json(rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Cree un nouvel exercice fiscal (ex: date_debut=2025-10-01, date_fin=2026-09-30)
router.post('/', async (req, res) => {
  const { label, date_debut, date_fin, activer } = req.body;
  if (!label || !date_debut || !date_fin) {
    return res.status(400).json({ error: 'Le libellé, la date de début et la date de fin sont requis.' });
  }
  if (date_fin <= date_debut) {
    return res.status(400).json({ error: 'La date de fin doit être postérieure à la date de début.' });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    if (activer) {
      await client.query('UPDATE fiscal_exercices SET is_active = false WHERE is_active = true');
    }
    const { rows } = await client.query(
      `INSERT INTO fiscal_exercices (label, date_debut, date_fin, is_active) VALUES ($1,$2,$3,$4) RETURNING *`,
      [label, date_debut, date_fin, !!activer]
    );
    if (activer) await ensureHolidaysForExercice(client, rows[0]);
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Un exercice fiscal existe déjà avec exactement ces dates de début et de fin.' });
    }
    if (err.code === '23514') {
      return res.status(400).json({ error: 'Période invalide : la date de fin doit être postérieure à la date de début.' });
    }
    res.status(500).json({ error: 'Erreur serveur lors de la création de l\'exercice fiscal.' });
  } finally {
    client.release();
  }
});

// Charger/activer un exercice fiscal existant (bascule l'ensemble de l'app dessus)
router.put('/:id/activer', async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE fiscal_exercices SET is_active = false WHERE is_active = true');
    const { rows } = await client.query(
      'UPDATE fiscal_exercices SET is_active = true WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (rows[0]) await ensureHolidaysForExercice(client, rows[0]);
    await client.query('COMMIT');
    if (!rows[0]) return res.status(404).json({ error: 'Exercice introuvable.' });
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const exerciceRes = await db.query(
      'SELECT id, label, is_active FROM fiscal_exercices WHERE id = $1',
      [req.params.id]
    );
    const exercice = exerciceRes.rows[0];
    if (!exercice) return res.status(404).json({ error: 'Exercice introuvable.' });
    if (exercice.is_active) {
      return res.status(400).json({ error: 'Impossible de supprimer l’exercice fiscal actif.' });
    }

    const recordsRes = await db.query(
      'SELECT COUNT(*)::int AS count FROM leave_records WHERE fiscal_exercice_id = $1',
      [req.params.id]
    );
    if (recordsRes.rows[0].count > 0) {
      return res.status(409).json({
        error: 'Impossible de supprimer cet exercice : des congés y sont déjà enregistrés.',
      });
    }

    await db.query('DELETE FROM fiscal_exercices WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression de l’exercice fiscal.' });
  }
});

module.exports = router;
