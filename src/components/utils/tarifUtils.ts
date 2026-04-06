export const TARIF_JOUR = 20000;
export const TARIF_NUIT = 25000;

export interface SlotHour {
  startDate: Date;
  endDate: Date;
  hour: number;
  label: string;
  tarif: number;
  isNight: boolean;
  isWeekend: boolean;
}

export function isNightSlot(date: Date, hour: number): boolean {
  const day = date.getDay();
  const weekend = day === 0 || day === 6;
  const night = hour >= 19 || hour < 8;
  return weekend || night;
}

export function getTarifForSlot(date: Date, hour: number): number {
  return isNightSlot(date, hour) ? TARIF_NUIT : TARIF_JOUR;
}

export function buildDaySlots(baseDate: Date): SlotHour[] {
  const slots: SlotHour[] = [];
  for (let h = 0; h < 24; h++) {
    const start = new Date(baseDate);
    start.setHours(h, 0, 0, 0);
    const end = new Date(start);
    end.setHours(h + 1, 0, 0, 0);

    const night = isNightSlot(start, h);
    const weekend = start.getDay() === 0 || start.getDay() === 6;
    const pad = (n: number) => String(n).padStart(2, '0');

    slots.push({
      startDate: start,
      endDate: end,
      hour: h,
      label: `${pad(h)}h – ${pad(h + 1 === 24 ? 0 : h + 1)}h`,
      tarif: night ? TARIF_NUIT : TARIF_JOUR,
      isNight: night,
      isWeekend: weekend,
    });
  }
  return slots;
}

export function buildRangeSlots(debut: Date, fin: Date): SlotHour[] {
  const slots: SlotHour[] = [];
  const current = new Date(debut);
  current.setMinutes(0, 0, 0);

  while (current.getTime() < fin.getTime()) {
    const start = new Date(current);
    const end = new Date(current);
    end.setHours(end.getHours() + 1);

    const h = start.getHours();
    const night = isNightSlot(start, h);
    const weekend = start.getDay() === 0 || start.getDay() === 6;
    const pad = (n: number) => String(n).padStart(2, '0');
    const nextH = h + 1 >= 24 ? 0 : h + 1;

    slots.push({
      startDate: start,
      endDate: end,
      hour: h,
      label: `${pad(h)}h – ${pad(nextH)}h`,
      tarif: night ? TARIF_NUIT : TARIF_JOUR,
      isNight: night,
      isWeekend: weekend,
    });

    current.setHours(current.getHours() + 1);
  }
  return slots;
}

export function calcTotalFromSlots(slots: SlotHour[]): number {
  return slots.reduce((sum, s) => sum + s.tarif, 0);
}

export function slotsToRange(slots: SlotHour[]): { debut: Date; fin: Date } | null {
  if (!slots.length) return null;
  const sorted = [...slots].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  return {
    debut: sorted[0].startDate,
    fin: sorted[sorted.length - 1].endDate,
  };
}

export function areConsecutive(slots: SlotHour[]): boolean {
  if (slots.length <= 1) return true;
  const sorted = [...slots].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startDate.getTime() !== sorted[i - 1].endDate.getTime()) return false;
  }
  return true;
}

export function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}
