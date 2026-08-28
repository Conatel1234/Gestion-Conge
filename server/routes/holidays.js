const express = require('express');
const db = require('../db');
const { PDFParse } = require('pdf-parse');

const router = express.Router();

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error('Le CSV doit contenir des en-têtes et au moins une ligne.');
  const delimiter = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const normalize = (value) => value.replace(/^\uFEFF/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const headers = lines[0].split(delimiter).map(normalize);
  const dateIndex = headers.findIndex((header) => ['date', 'dateoff', 'dateferie', 'dateholiday'].includes(header));
  const labelIndex = headers.findIndex((header) => ['libelle', 'label', 'nom', 'name', 'motif'].includes(header));
  if (dateIndex < 0 || labelIndex < 0) throw new Error('En-têtes requis : Date et Libellé.');
  return lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((value) => value.trim().replace(/^"|"$/g, ''));
    return { date_off: values[dateIndex], libelle: values[labelIndex] };
  });
}

function parseDate(value) {
  const raw = String(value || '').trim();
  let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!match) return null;
  const parts = match[1].length === 4 ? [match[1], match[2], match[3]] : [match[3], match[2], match[1]];
  const date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date;
}

function parsePdfText(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    const match = line.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\s*(?:[-;,|]\s*)?(.*)$/);
    return match ? [{ date_off: parseDate(match[1]), libelle: match[2].trim() }] : [];
  });
}

router.post('/import', async (req, res) => {
  const { fileName, content, encoding } = req.body;
  if (typeof content !== 'string' || content.length > 7 * 1024 * 1024) {
    return res.status(400).json({ error: 'Fichier absent ou trop volumineux (maximum 5 Mo).' });
  }
  try {
    let records;
    if (String(fileName || '').toLowerCase().endsWith('.pdf')) {
      const buffer = Buffer.from(content, encoding === 'base64' ? 'base64' : 'utf8');
      const parser = new PDFParse({ data: buffer });
      try {
        const parsed = await parser.getText();
        records = parsePdfText(parsed.text);
      } finally { await parser.destroy(); }
    } else {
      const text = Buffer.from(content, encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
      records = parseCsv(text);
    }
    if (!records.length) return res.status(400).json({ error: 'Aucune ligne exploitable. Format attendu : Date, Libellé.' });

    const errors = [];
    const client = await db.pool.connect();
    let imported = 0;
    let skipped = 0;
    try {
      await client.query('BEGIN');
      for (const [index, record] of records.entries()) {
        const date = parseDate(record.date_off);
        const label = String(record.libelle || '').trim();
        if (!date || !label) { errors.push(`ligne ${index + 2}: date ou libellé invalide`); continue; }
        const result = await client.query(
          'INSERT INTO holidays (date_off, libelle) VALUES ($1,$2) ON CONFLICT (date_off) DO NOTHING RETURNING id',
          [date, label]
        );
        if (result.rowCount) imported += 1; else skipped += 1;
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally { client.release(); }
    res.json({ imported, skipped, errors });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Import impossible.' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM holidays ORDER BY date_off');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/', async (req, res) => {
  const { date_off, libelle } = req.body;
  if (!date_off || !libelle) return res.status(400).json({ error: 'Date et libelle requis.' });
  try {
    const { rows } = await db.query(
      'INSERT INTO holidays (date_off, libelle) VALUES ($1,$2) RETURNING *',
      [date_off, libelle]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur (date deja enregistree ?).' });
  }
});

router.put('/:id', async (req, res) => {
  const { date_off, libelle } = req.body;
  try {
    const { rows } = await db.query(
      'UPDATE holidays SET date_off=$1, libelle=$2 WHERE id=$3 RETURNING *',
      [date_off, libelle, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Introuvable.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM holidays WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
