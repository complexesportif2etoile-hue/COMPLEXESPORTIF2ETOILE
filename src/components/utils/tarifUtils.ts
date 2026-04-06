import { Terrain } from '../../types';

export interface SlotHour {
  date: Date;
  hour: number;
  label: string;
  tarif: number;
  isNight: boolean;
  isWeekend: boolean;
}

export interface TarifResult {
  slots: SlotHour[];
  total: number;
  breakdown: { jour: number; nuit: number; slotJour: number; slotNuit: number };
}

function isNightHour(hour: number, heureDebutNuit: number, heureDebutJour: number): boolean {
  if (heureDebutNuit > heureDebutJour) {
    return hour >= heureDebutNuit || hour < heureDebutJour;
  }
  return hour >= heureDebutNuit && hour < heureDebutJour;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getTarifForSlot(date: Date, hour: number, terrain: Terrain): { tarif: number; isNight: boolean; isWeekend: boolean } {
  const heureDebutJour = parseInt((terrain.heure_debut_jour || '08:00').split(':')[0]);
  const heureDebutNuit = parseInt((terrain.heure_debut_nuit || '18:00').split(':')[0]);

  const slotDate = new Date(date);
  slotDate.setHours(hour, 0, 0, 0);

  const weekend = isWeekend(slotDate);
  const night = isNightHour(hour, heureDebutNuit, heureDebutJour);

  let tarif: number;
  if (night || weekend) {
    tarif = terrain.tarif_nuit > 0 ? terrain.tarif_nuit : terrain.tarif_horaire;
  } else {
    tarif = terrain.tarif_jour > 0 ? terrain.tarif_jour : terrain.tarif_horaire;
  }

  return { tarif, isNight: night || weekend, isWeekend: weekend };
}

export function calcTarifBySlots(debut: Date, fin: Date, terrain: Terrain): TarifResult {
  const slots: SlotHour[] = [];
  let total = 0;
  let slotJour = 0;
  let slotNuit = 0;

  const current = new Date(debut);
  current.setMinutes(0, 0, 0);

  const endMs = fin.getTime();

  while (current.getTime() < endMs) {
    const slotStart = new Date(current);
    const slotEnd = new Date(current);
    slotEnd.setHours(slotEnd.getHours() + 1);

    const actualEnd = slotEnd.getTime() > endMs ? fin : slotEnd;
    const fraction = (actualEnd.getTime() - slotStart.getTime()) / 3600000;

    const hour = slotStart.getHours();
    const { tarif, isNight, isWeekend: weekend } = getTarifForSlot(slotStart, hour, terrain);
    const cost = tarif * fraction;

    const pad = (n: number) => String(n).padStart(2, '0');
    const dateLabel = `${pad(slotStart.getDate())}/${pad(slotStart.getMonth() + 1)}`;
    const timeLabel = `${pad(hour)}h – ${pad(hour + 1)}h`;

    slots.push({
      date: slotStart,
      hour,
      label: `${dateLabel} ${timeLabel}`,
      tarif,
      isNight,
      isWeekend: weekend,
    });

    total += cost;
    if (isNight) slotNuit++;
    else slotJour++;

    current.setHours(current.getHours() + 1);
  }

  const heureDebutNuit = parseInt((terrain.heure_debut_nuit || '18:00').split(':')[0]);
  const heureDebutJour = parseInt((terrain.heure_debut_jour || '08:00').split(':')[0]);

  return {
    slots,
    total: Math.round(total),
    breakdown: {
      jour: terrain.tarif_jour > 0 ? terrain.tarif_jour : terrain.tarif_horaire,
      nuit: terrain.tarif_nuit > 0 ? terrain.tarif_nuit : terrain.tarif_horaire,
      slotJour,
      slotNuit,
    },
  };
}

export function formatCreneauLabel(debut: Date, fin: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(debut.getHours())}h${pad(debut.getMinutes())} → ${pad(fin.getHours())}h${pad(fin.getMinutes())}`;
}

export function buildHourSlots(baseDate: Date, terrain: Terrain, count = 24): SlotHour[] {
  const slots: SlotHour[] = [];
  const heureDebutJour = parseInt((terrain.heure_debut_jour || '08:00').split(':')[0]);
  const heureDebutNuit = parseInt((terrain.heure_debut_nuit || '18:00').split(':')[0]);

  for (let i = 0; i < count; i++) {
    const slotDate = new Date(baseDate);
    slotDate.setHours(heureDebutJour + i, 0, 0, 0);
    if (slotDate.getHours() < heureDebutJour && i > 0) break;

    const hour = slotDate.getHours();
    const { tarif, isNight, isWeekend: weekend } = getTarifForSlot(slotDate, hour, terrain);

    const pad = (n: number) => String(n).padStart(2, '0');
    slots.push({
      date: slotDate,
      hour,
      label: `${pad(hour)}h00`,
      tarif,
      isNight,
      isWeekend: weekend,
    });
  }
  return slots;
}
