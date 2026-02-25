const TARIF_JOUR = 20000;
const TARIF_SOIR_WEEKEND = 25000;

export function getTarifForSlot(dateStr: string, hour: number): number {
  const date = new Date(dateStr + 'T12:00:00');
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isSoir = hour >= 19 || hour < 7;
  return isWeekend || isSoir ? TARIF_SOIR_WEEKEND : TARIF_JOUR;
}

export function getSlotPriceLabel(dateStr: string, hour: number): string {
  const tarif = getTarifForSlot(dateStr, hour);
  return tarif === TARIF_JOUR ? 'Journée' : 'Soir / Nuit / Weekend';
}

export function calculateTarifForRange(
  startDateStr: string,
  startHour: number,
  durationHours: number,
): number {
  let total = 0;
  for (let i = 0; i < durationHours; i++) {
    const absoluteHour = startHour + i;
    const daysOffset = Math.floor(absoluteHour / 24);
    const hour = absoluteHour % 24;
    let dateStr = startDateStr;
    if (daysOffset > 0) {
      const d = new Date(startDateStr + 'T12:00:00');
      d.setDate(d.getDate() + daysOffset);
      dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    total += getTarifForSlot(dateStr, hour);
  }
  return total;
}

export function calculateTarifForPublicSlot(
  dateStr: string,
  timeStart: string,
  timeEnd: string,
): number {
  if (!dateStr || !timeStart || !timeEnd) return 0;
  const start = new Date(`${dateStr}T${timeStart}:00`);
  const isMidnightEnd = timeEnd === '00:00' && timeStart !== '00:00';
  let endDateStr = dateStr;
  if (isMidnightEnd) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    endDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const end = new Date(`${endDateStr}T${timeEnd}:00`);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  const hours = diffMs / (1000 * 60 * 60);
  const startHour = start.getHours();
  let total = 0;
  for (let i = 0; i < hours; i++) {
    const absoluteHour = startHour + i;
    const daysOffset = Math.floor(absoluteHour / 24);
    const hour = absoluteHour % 24;
    let ds = dateStr;
    if (daysOffset > 0) {
      const d = new Date(dateStr + 'T12:00:00');
      d.setDate(d.getDate() + daysOffset);
      ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    total += getTarifForSlot(ds, hour);
  }
  return total;
}

export { TARIF_JOUR, TARIF_SOIR_WEEKEND };
