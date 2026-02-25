import type { Reservation, Terrain } from '../../lib/supabase';

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  en_attente: { label: 'En attente', color: '#f59e0b', bg: '#fef3c7', dot: '#f59e0b' },
  réservé:    { label: 'Réservé',    color: '#3b82f6', bg: '#dbeafe', dot: '#3b82f6' },
  check_in:   { label: 'Check-in',  color: '#f97316', bg: '#ffedd5', dot: '#f97316' },
  check_out:  { label: 'Check-out', color: '#8b5cf6', bg: '#ede9fe', dot: '#8b5cf6' },
  terminé:    { label: 'Terminé',   color: '#10b981', bg: '#d1fae5', dot: '#10b981' },
  annulé:     { label: 'Annulé',    color: '#ef4444', bg: '#fee2e2', dot: '#ef4444' },
  bloqué:     { label: 'Bloqué',    color: '#6b7280', bg: '#f3f4f6', dot: '#6b7280' },
  libre:      { label: 'Libre',     color: '#6b7280', bg: '#f3f4f6', dot: '#6b7280' },
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  ON_SITE: 'Sur place',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Non payé',
  PARTIAL: 'Partiel',
  PAID: 'Payé',
};

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(amount));
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString('fr-FR', opts ?? { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function formatDuration(debut: string, fin: string) {
  const ms = new Date(fin).getTime() - new Date(debut).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export interface ReportStats {
  total: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  blocked: number;
  active: number;
  pending: number;
  totalRevenueBrut: number;
  totalTVA: number;
  totalRevenueTTC: number;
  averageRevenueTTC: number;
  completionRate: number;
  cancellationRate: number;
  occupancyRevenue: number;
  onlineTotal: number;
  onlineRevenueTTC: number;
  onlineRevenueShare: number;
  onlineCountShare: number;
  terrainStats: TerrainStat[];
  statusBreakdown: StatusBreakdown[];
  monthlyRevenue: MonthlyData[];
  topClients: TopClient[];
  paymentMethodStats: PaymentMethodStat[];
  hourlyDistribution: HourlyData[];
}

export interface TerrainStat {
  id: string;
  name: string;
  count: number;
  revenue: number;
  completed: number;
  cancelled: number;
  avgRevenue: number;
  share: number;
}

export interface StatusBreakdown {
  status: string;
  label: string;
  count: number;
  percentage: number;
  revenue: number;
}

export interface MonthlyData {
  month: string;
  monthKey: string;
  count: number;
  revenue: number;
  completed: number;
  cancelled: number;
}

export interface TopClient {
  name: string;
  phone: string;
  count: number;
  revenue: number;
  lastVisit: string;
}

export interface PaymentMethodStat {
  method: string;
  label: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface HourlyData {
  hour: number;
  label: string;
  count: number;
}

export function computeStats(reservations: Reservation[], terrains: Terrain[]): ReportStats {
  const total = reservations.length;
  const confirmed = reservations.filter(r => r.statut === 'réservé').length;
  const completed = reservations.filter(r => r.statut === 'terminé').length;
  const cancelled = reservations.filter(r => r.statut === 'annulé').length;
  const blocked = reservations.filter(r => r.statut === 'bloqué').length;
  const active = reservations.filter(r => r.statut === 'check_in').length;
  const pending = reservations.filter(r => r.statut === 'en_attente').length;

  const nonCancelled = reservations.filter(r => r.statut !== 'annulé' && r.statut !== 'bloqué');
  const totalRevenueBrut = nonCancelled.reduce((s, r) => s + Number(r.tarif_total ?? 0), 0);
  const totalTVA = nonCancelled.reduce((s, r) => s + Number(r.montant_tva ?? 0), 0);
  const totalRevenueTTC = nonCancelled.reduce((s, r) => s + Number(r.montant_ttc ?? 0), 0);
  const averageRevenueTTC = nonCancelled.length > 0 ? totalRevenueTTC / nonCancelled.length : 0;
  const completionRate = total > 0 ? (completed / total) * 100 : 0;
  const cancellationRate = total > 0 ? (cancelled / total) * 100 : 0;

  const terrainStats: TerrainStat[] = terrains.map(t => {
    const tr = reservations.filter(r => r.terrain_id === t.id);
    const rev = tr.filter(r => r.statut !== 'annulé' && r.statut !== 'bloqué').reduce((s, r) => s + Number(r.montant_ttc ?? 0), 0);
    return {
      id: t.id,
      name: t.name,
      count: tr.length,
      revenue: rev,
      completed: tr.filter(r => r.statut === 'terminé').length,
      cancelled: tr.filter(r => r.statut === 'annulé').length,
      avgRevenue: tr.length > 0 ? rev / tr.length : 0,
      share: total > 0 ? (tr.length / total) * 100 : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const allStatuses = ['terminé', 'réservé', 'check_in', 'check_out', 'en_attente', 'annulé', 'bloqué'];
  const statusBreakdown: StatusBreakdown[] = allStatuses.map(s => {
    const sr = reservations.filter(r => r.statut === s);
    return {
      status: s,
      label: STATUS_CONFIG[s]?.label ?? s,
      count: sr.length,
      percentage: total > 0 ? (sr.length / total) * 100 : 0,
      revenue: sr.filter(r => r.statut !== 'annulé' && r.statut !== 'bloqué').reduce((acc, r) => acc + Number(r.montant_ttc ?? 0), 0),
    };
  }).filter(s => s.count > 0);

  const monthMap = new Map<string, MonthlyData>();
  for (const r of reservations) {
    const d = new Date(r.date_debut);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    if (!monthMap.has(key)) {
      monthMap.set(key, { month: label, monthKey: key, count: 0, revenue: 0, completed: 0, cancelled: 0 });
    }
    const m = monthMap.get(key)!;
    m.count++;
    if (r.statut !== 'annulé' && r.statut !== 'bloqué') m.revenue += Number(r.montant_ttc ?? 0);
    if (r.statut === 'terminé') m.completed++;
    if (r.statut === 'annulé') m.cancelled++;
  }
  const monthlyRevenue = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v)
    .slice(-12);

  const clientMap = new Map<string, TopClient>();
  for (const r of reservations) {
    if (!r.client_name) continue;
    const key = r.client_name.trim().toLowerCase();
    if (!clientMap.has(key)) {
      clientMap.set(key, { name: r.client_name, phone: r.client_phone ?? '', count: 0, revenue: 0, lastVisit: r.date_debut });
    }
    const c = clientMap.get(key)!;
    c.count++;
    if (r.statut !== 'annulé' && r.statut !== 'bloqué') c.revenue += Number(r.montant_ttc ?? 0);
    if (r.date_debut > c.lastVisit) c.lastVisit = r.date_debut;
  }
  const topClients = Array.from(clientMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  const methodMap = new Map<string, { count: number; revenue: number }>();
  for (const r of reservations) {
    if (r.statut === 'annulé' || r.statut === 'bloqué') continue;
    const method = (r as Record<string, unknown>)['payment_method'] as string | undefined ?? 'ON_SITE';
    if (!methodMap.has(method)) methodMap.set(method, { count: 0, revenue: 0 });
    const m = methodMap.get(method)!;
    m.count++;
    m.revenue += Number(r.montant_ttc ?? 0);
  }
  const totalMethodCount = Array.from(methodMap.values()).reduce((s, v) => s + v.count, 0);
  const paymentMethodStats: PaymentMethodStat[] = Array.from(methodMap.entries()).map(([method, v]) => ({
    method,
    label: PAYMENT_METHOD_LABEL[method] ?? method,
    count: v.count,
    revenue: v.revenue,
    percentage: totalMethodCount > 0 ? (v.count / totalMethodCount) * 100 : 0,
  })).sort((a, b) => b.count - a.count);

  const hourMap = new Map<number, number>();
  for (const r of reservations) {
    const h = new Date(r.date_debut).getHours();
    hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
  }
  const hourlyDistribution: HourlyData[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${String(i).padStart(2, '0')}h`,
    count: hourMap.get(i) ?? 0,
  })).filter(h => h.count > 0);

  const onlineReservations = reservations.filter(r => r.code_court != null && r.code_court !== '');
  const onlineNonCancelled = onlineReservations.filter(r => r.statut !== 'annulé' && r.statut !== 'bloqué');
  const onlineTotal = onlineReservations.length;
  const onlineRevenueTTC = onlineNonCancelled.reduce((s, r) => s + Number(r.montant_ttc ?? 0), 0);
  const onlineRevenueShare = totalRevenueTTC > 0 ? (onlineRevenueTTC / totalRevenueTTC) * 100 : 0;
  const onlineCountShare = total > 0 ? (onlineTotal / total) * 100 : 0;

  return {
    total, confirmed, completed, cancelled, blocked, active, pending,
    totalRevenueBrut, totalTVA, totalRevenueTTC, averageRevenueTTC,
    completionRate, cancellationRate, occupancyRevenue: totalRevenueTTC,
    onlineTotal, onlineRevenueTTC, onlineRevenueShare, onlineCountShare,
    terrainStats, statusBreakdown, monthlyRevenue, topClients,
    paymentMethodStats, hourlyDistribution,
  };
}
