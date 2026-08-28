const DOCUMENT_LOGO_PATH = '/images/logo_header.png';

function documentHeader(title, date = new Date()) {
  const formattedDate = new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return `
    <header class="official-header">
      <div class="official-top">
        <div class="official-ministry">MINISTERE<br>DES TRAVAUX PUBLICS<br>TRANSPORTS COMMUNICATIONS</div>
        <img class="official-logo" src="${DOCUMENT_LOGO_PATH}" alt="Logo officiel du CONATEL">
        <div class="official-republic">REPUBLIQUE D’HAITI</div>
      </div>
      <div class="official-institution">CONSEIL NATIONAL DES TELECOMMUNICATIONS</div>
      <div class="official-website">www.conatel.gouv.ht</div>
      <div class="official-rule"></div>
      <h1 class="official-title">${escapeDocumentHtml(title)}</h1>
      <div class="official-date">${formattedDate}</div>
    </header>
  `;
}

function documentPrintStyles() {
  return `
    @page { size: A4 portrait; margin: 16mm 15mm 15mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111; font: 10.5pt Arial, sans-serif; }
    .official-header { width: 100%; text-align: center; }
    .official-top { display: grid; grid-template-columns: 1fr 112px 1fr; align-items: center; min-height: 92px; }
    .official-ministry, .official-republic { font-size: 9.5pt; font-weight: 700; line-height: 1.35; }
    .official-ministry { text-align: left; }
    .official-republic { text-align: right; }
    .official-logo { width: 92px; height: 92px; object-fit: contain; justify-self: center; }
    .official-institution { margin-top: 5px; font-size: 16pt; font-weight: 700; }
    .official-website { margin-top: 3px; font-size: 9pt; }
    .official-rule { border-top: 1.5px solid #111; margin: 10px 0 16px; }
    .official-title { margin: 0; font-size: 15pt; font-weight: 700; text-align: center; text-transform: uppercase; }
    .official-date { margin-top: 5px; text-align: right; font-size: 9pt; }
    .print-content { margin-top: 18px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 6px 7px; border-bottom: 1px solid #cfd4dc; text-align: left; vertical-align: top; }
    th { background: #f0f1f3; font-size: 8.5pt; text-transform: uppercase; }
    h1, h2 { page-break-after: avoid; }
    .employee-sheet { page-break-after: always; }
    .employee-sheet:last-child { page-break-after: auto; }
    @media print { .official-header { break-inside: avoid; } }
  `;
}

function escapeDocumentHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}
