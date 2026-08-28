function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function shiftDays(date, amount) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + amount);
  return shifted;
}

function holidaysForYear(year) {
  const easter = easterSunday(year);
  return [
    [`${year}-01-01`, 'Jour de l’Indépendance / Nouvel An'],
    [`${year}-01-02`, 'Jour des Aïeux'],
    [toISO(shiftDays(easter, -48)), 'Lundi gras'],
    [toISO(shiftDays(easter, -47)), 'Mardi gras'],
    [toISO(shiftDays(easter, -2)), 'Vendredi saint'],
    [toISO(shiftDays(easter, 1)), 'Lundi de Pâques'],
    [`${year}-05-01`, 'Fête de l’Agriculture et du Travail'],
    [`${year}-05-18`, 'Fête du Drapeau et de l’Université'],
    [toISO(shiftDays(easter, 60)), 'Fête-Dieu'],
    [`${year}-08-15`, 'Assomption'],
    [`${year}-10-17`, 'Commémoration de la mort de Jean-Jacques Dessalines'],
    [`${year}-11-01`, 'Toussaint'],
    [`${year}-11-02`, 'Jour des Morts'],
    [`${year}-12-25`, 'Noël'],
  ];
}

function holidaysForPeriod(dateDebut, dateFin) {
  const startYear = new Date(dateDebut).getUTCFullYear();
  const endYear = new Date(dateFin).getUTCFullYear();
  const result = [];
  for (let year = startYear; year <= endYear; year += 1) {
    result.push(...holidaysForYear(year).filter(([date]) => date >= dateDebut && date <= dateFin));
  }
  return result;
}

async function ensureHolidaysForExercice(client, exercice) {
  const holidays = holidaysForPeriod(exercice.date_debut.toISOString().slice(0, 10), exercice.date_fin.toISOString().slice(0, 10));
  for (const [date, label] of holidays) {
    await client.query(
      'INSERT INTO holidays (date_off, libelle) VALUES ($1,$2) ON CONFLICT (date_off) DO NOTHING',
      [date, label]
    );
  }
  return holidays.length;
}

module.exports = { easterSunday, holidaysForPeriod, ensureHolidaysForExercice };
