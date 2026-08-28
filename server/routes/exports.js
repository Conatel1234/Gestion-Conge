const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const db = require('../db');
const { countWorkingDays, statusOf, toISO } = require('../utils/workingDays');
const { specialLeaveQuota } = require('../utils/seniority');
const { drawDocumentHeader } = require('../utils/documentHeader');

const router = express.Router();

const STATUS_LABEL = { EN_COURS: 'En conge', A_VENIR: 'A venir', TERMINE: 'Termine' };

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function fetchLeaveList(fiscalExerciceId, direction, employeeStatus) {
  const params = [];
  let sql = `
    SELECT lr.*, e.nom AS emp_nom, e.prenom AS emp_prenom, e.direction, e.statut AS employee_status, e.date_embauche,
           lt.nom AS leave_type_nom, lt.quota_jours
    FROM leave_records lr
    JOIN employees e ON e.id = lr.employee_id
    JOIN leave_types lt ON lt.id = lr.leave_type_id
    WHERE 1=1
  `;
  if (fiscalExerciceId) { params.push(fiscalExerciceId); sql += ` AND lr.fiscal_exercice_id = $${params.length}`; }
  if (direction) { params.push(direction); sql += ` AND e.direction = $${params.length}`; }
  if (employeeStatus) { params.push(employeeStatus); sql += ` AND e.statut = $${params.length}`; }
  sql += ' ORDER BY e.nom, e.prenom, lr.date_debut';
  const { rows } = await db.query(sql, params);
  const today = toISO(new Date());

  const prisParEmployeType = {};
  rows.forEach((r) => {
    const key = `${r.employee_id}-${r.leave_type_id}`;
    prisParEmployeType[key] = (prisParEmployeType[key] || 0) + r.jours_ouvres;
  });

  return rows.map((r) => {
    const key = `${r.employee_id}-${r.leave_type_id}`;
    const quota = specialLeaveQuota({ date_embauche: r.date_embauche }, r.leave_type_nom, today);
    return {
      direction: r.direction,
      employee_status: r.employee_status,
      nom: r.emp_nom,
      prenom: r.emp_prenom,
      type: r.leave_type_nom,
      date_debut: r.date_debut.toISOString().slice(0, 10),
      date_fin: r.date_fin.toISOString().slice(0, 10),
      jours_ouvres: r.jours_ouvres,
      restant: (quota === null ? r.quota_jours : quota) - prisParEmployeType[key],
      date_reprise: r.date_reprise ? r.date_reprise.toISOString().slice(0, 10) : '',
      statut: STATUS_LABEL[statusOf(r.date_debut.toISOString().slice(0, 10), r.date_fin.toISOString().slice(0, 10), today)],
    };
  });
}

router.get('/employees-csv', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT nom, prenom, direction, date_embauche, statut, actif
       FROM employees
       ORDER BY nom, prenom`
    );
    const headers = ['Nom', 'Prenom', 'Direction', "Date d'embauche", 'Statut', 'Actif'];
    const lines = [headers, ...rows.map((employee) => [
      employee.nom,
      employee.prenom,
      employee.direction,
      employee.date_embauche ? employee.date_embauche.toISOString().slice(0, 10) : '',
      employee.statut,
      employee.actif ? 'Oui' : 'Non',
    ])].map((row) => row.map(csvCell).join(';'));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="employes.csv"');
    res.send(`\uFEFF${lines.join('\r\n')}\r\n`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/excel', async (req, res) => {
  try {
    const data = await fetchLeaveList(req.query.fiscal_exercice_id, req.query.direction, req.query.employee_status);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Gestion des Conges';
    const ws = wb.addWorksheet('Conges');

    ws.columns = [
      { header: 'Direction', key: 'direction', width: 22 },
      { header: 'Statut employé', key: 'employee_status', width: 16 },
      { header: 'Nom', key: 'nom', width: 18 },
      { header: 'Prenom', key: 'prenom', width: 18 },
      { header: 'Type de conge', key: 'type', width: 20 },
      { header: 'Date debut', key: 'date_debut', width: 14 },
      { header: 'Date fin', key: 'date_fin', width: 14 },
      { header: 'Jours demandes', key: 'jours_ouvres', width: 16 },
      { header: 'Jours restants', key: 'restant', width: 15 },
      { header: 'Date de reprise', key: 'date_reprise', width: 16 },
      { header: 'Statut', key: 'statut', width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    ws.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });

    data.forEach((d) => ws.addRow(d));
    ws.autoFilter = { from: 'A1', to: 'K1' };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="liste_conges${req.query.direction ? '_' + req.query.direction.replace(/\s+/g, '_') : ''}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/pdf', async (req, res) => {
  try {
    const data = await fetchLeaveList(req.query.fiscal_exercice_id, req.query.direction, req.query.employee_status);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="liste_conges${req.query.direction ? '_' + req.query.direction.replace(/\s+/g, '_') : ''}.pdf"`);

    const doc = new PDFDocument({ margin: 42, size: 'A4', layout: 'portrait' });
    doc.pipe(res);

    drawDocumentHeader(doc, 'LISTE DES CONGES');

    const headers = ['Direction', 'Nom', 'Prenom', 'Statut', 'Type', 'Debut', 'Fin', 'J. demandes', 'Restant', 'Reprise', 'Etat'];
    const colWidths = [58, 48, 48, 45, 58, 43, 43, 48, 43, 48, 43];
    let y = doc.y;
    const startX = doc.x;

    function drawRow(cells, opts = {}) {
      let x = startX;
      doc.fontSize(8).fillColor(opts.color || '#000');
      cells.forEach((cell, i) => {
        doc.text(String(cell), x, y, { width: colWidths[i], continued: false });
        x += colWidths[i];
      });
      y += 16;
      if (y > doc.page.height - 40) { doc.addPage({ layout: 'landscape' }); y = 40; }
    }

    doc.font('Helvetica-Bold');
    drawRow(headers, { color: '#0f172a' });
    doc.font('Helvetica');
    doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke();
    y += 4;

    data.forEach((d) => {
      drawRow([d.direction, d.nom, d.prenom, d.employee_status, d.type, d.date_debut, d.date_fin, d.jours_ouvres, d.restant, d.date_reprise, d.statut]);
    });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
