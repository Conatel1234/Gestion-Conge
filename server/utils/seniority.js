function completedYearsSince(dateISO, onDateISO) {
  if (!dateISO || !onDateISO) return 0;
  const startValue = dateISO instanceof Date ? dateISO.toISOString().slice(0, 10) : dateISO;
  const endValue = onDateISO instanceof Date ? onDateISO.toISOString().slice(0, 10) : onDateISO;
  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  let years = end.getFullYear() - start.getFullYear();
  const anniversaryPassed = end.getMonth() > start.getMonth() ||
    (end.getMonth() === start.getMonth() && end.getDate() >= start.getDate());
  if (!anniversaryPassed) years -= 1;
  return Math.max(0, years);
}

function specialLeaveQuota(employee, leaveTypeName, leaveStartISO) {
  const normalizedType = String(leaveTypeName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!normalizedType.includes('special')) return null;
  const years = completedYearsSince(employee.date_embauche, leaveStartISO);
  if (years >= 11) return 25;
  if (years >= 6) return 20;
  return 15;
}

module.exports = { completedYearsSince, specialLeaveQuota };