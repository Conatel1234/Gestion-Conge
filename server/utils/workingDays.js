// Toutes les dates circulent en chaines 'YYYY-MM-DD' pour eviter les
// problemes de fuseau horaire lors des calculs.

function pad(n) { return String(n).padStart(2, '0'); }

function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isWeekend(d) {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function eachDay(startISO, endISO) {
  const start = parseISO(startISO);
  const end = parseISO(endISO);
  const days = [];
  let cur = start;
  while (cur <= end) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return days;
}

// holidaySet: Set of 'YYYY-MM-DD' strings
function countWorkingDays(startISO, endISO, holidaySet) {
  return eachDay(startISO, endISO)
    .filter((d) => !isWeekend(d) && !holidaySet.has(toISO(d)))
    .length;
}

function nextWorkingDay(endISO, holidaySet) {
  let d = addDays(parseISO(endISO), 1);
  while (isWeekend(d) || holidaySet.has(toISO(d))) {
    d = addDays(d, 1);
  }
  return toISO(d);
}

function statusOf(dateDebutISO, dateFinISO, todayISO) {
  const today = todayISO || toISO(new Date());
  if (today < dateDebutISO) return 'A_VENIR';
  if (today > dateFinISO) return 'TERMINE';
  return 'EN_COURS';
}

module.exports = {
  toISO, parseISO, addDays, isWeekend, eachDay,
  countWorkingDays, nextWorkingDay, statusOf,
};
