const express = require('express');
const db = require('../db');

const router = express.Router();
const TABLES = ['hr_users', 'fiscal_exercices', 'leave_types', 'employees', 'holidays', 'leave_records'];
const MAX_BACKUP_BYTES = 8 * 1024 * 1024;

function validateBackup(backup) {
  if (!backup || backup.format !== 'gestion-conge-backup' || backup.version !== 1 || typeof backup.data !== 'object') {
    throw new Error('Fichier de sauvegarde invalide ou incompatible.');
  }
  for (const table of TABLES) {
    if (!Array.isArray(backup.data[table])) throw new Error(`Donnees manquantes pour ${table}.`);
  }
}

async function readBackup() {
  const data = {};
  for (const table of TABLES) {
    const { rows } = await db.query(`SELECT * FROM ${table}`);
    data[table] = rows;
  }
  return data;
}

router.get('/export', async (req, res) => {
  try {
    const backup = {
      format: 'gestion-conge-backup',
      version: 1,
      created_at: new Date().toISOString(),
      data: await readBackup(),
    };
    const filename = `gestion-conge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sauvegarde impossible.' });
  }
});

router.post('/import', async (req, res) => {
  if (Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8') > MAX_BACKUP_BYTES) {
    return res.status(400).json({ error: 'La sauvegarde depasse la taille maximale de 8 Mo.' });
  }
  try {
    validateBackup(req.body);
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const table of [...TABLES].reverse()) await client.query(`DELETE FROM ${table}`);
      for (const table of TABLES) {
        const rows = req.body.data[table];
        for (const row of rows) {
          const columns = Object.keys(row);
          if (!columns.length) continue;
          const values = columns.map((column) => row[column]);
          const placeholders = values.map((_, index) => `$${index + 1}`).join(',');
          await client.query(`INSERT INTO ${table} (${columns.map((column) => `"${column}"`).join(',')}) VALUES (${placeholders})`, values);
        }
      }
      for (const table of TABLES) {
        await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally { client.release(); }
    res.json({ restored: TABLES.reduce((sum, table) => sum + req.body.data[table].length, 0) });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Restauration impossible.' });
  }
});

module.exports = router;
