const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      req.query.actif === 'true'
        ? 'SELECT * FROM leave_types WHERE actif = true ORDER BY nom'
        : 'SELECT * FROM leave_types ORDER BY nom'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/', async (req, res) => {
  const { nom, quota_jours, couleur } = req.body;
  if (!nom || quota_jours === undefined) {
    return res.status(400).json({ error: 'Nom et quota de jours requis.' });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO leave_types (nom, quota_jours, couleur) VALUES ($1,$2,$3) RETURNING *`,
      [nom, quota_jours, couleur || '#10b981']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur (nom peut-etre deja utilise).' });
  }
});

router.put('/:id', async (req, res) => {
  const { nom, quota_jours, couleur, actif } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE leave_types SET nom=$1, quota_jours=$2, couleur=$3, actif=$4 WHERE id=$5 RETURNING *`,
      [nom, quota_jours, couleur, actif !== undefined ? actif : true, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Type introuvable.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM leave_types WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Impossible de supprimer: des conges utilisent ce type.' });
  }
});

module.exports = router;
