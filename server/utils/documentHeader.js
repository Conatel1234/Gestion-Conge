const fs = require('fs');
const path = require('path');

const LOGO_PATH = process.env.LOGO_PATH || path.join(__dirname, '..', '..', 'images', 'logo_header.png');

function drawDocumentHeader(doc, title, date = new Date()) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const top = doc.y;
  const logoSize = 68;
  const logoX = left + (width - logoSize) / 2;

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111').text('MINISTERE\nDES TRAVAUX PUBLICS\nTRANSPORTS COMMUNICATIONS', left, top, { width: 145, lineGap: 2 });
  doc.font('Helvetica-Bold').fontSize(8.5).text('REPUBLIQUE D’HAITI', left + width - 145, top, { width: 145, align: 'right' });
  if (fs.existsSync(LOGO_PATH)) doc.image(LOGO_PATH, logoX, top, { fit: [logoSize, logoSize], align: 'center', valign: 'center' });
  doc.font('Helvetica-Bold').fontSize(13).text('CONSEIL NATIONAL DES TELECOMMUNICATIONS', left, top + 78, { width, align: 'center' });
  doc.font('Helvetica').fontSize(8).text('www.conatel.gouv.ht', left, top + 95, { width, align: 'center' });
  doc.moveTo(left, top + 112).lineTo(left + width, top + 112).lineWidth(1).stroke('#111');
  doc.font('Helvetica-Bold').fontSize(12).text(title, left, top + 128, { width, align: 'center' });
  doc.font('Helvetica').fontSize(8).text(new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }), left, top + 146, { width, align: 'right' });
  doc.y = top + 166;
}

module.exports = { LOGO_PATH, drawDocumentHeader };
