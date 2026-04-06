import { useState, useEffect } from 'react';
import { X, Loader2, LogIn, LogOut, Ban, Sun, Moon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Reservation } from '../../types';

interface ReservationModalProps {
  reservation: Reservation | null;
  initialDate?: Date;
  initialTerrainId?: string;
  onClose: () => void;
}

type Creneau = 'jour' | 'nuit' | 'custom';

function formatDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildCreneauDates(baseDate: Date, creneau: Creneau, heureDebutJour: string, heureDebutNuit: string): { debut: string; fin: string } {
  const d = new Date(baseDate);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (creneau === 'jour') {
    const [hj, mj] = heureDebutJour.split(':').map(Number);
    const [hn, mn] = heureDebutNuit.split(':').map(Number);
    return {
      debut: `${dateStr}T${pad(hj)}:${pad(mj)}`,
      fin: `${dateStr}T${pad(hn)}:${pad(mn)}`,
    };
  }

  if (creneau === 'nuit') {
    const [hn, mn] = heureDebutNuit.split(':').map(Number);
    const debutNuit = new Date(d);
    debutNuit.setHours(hn, mn, 0, 0);
    const finNuit = new Date(debutNuit);
    finNuit.setDate(finNuit.getDate() + 1);
    const [hj, mj] = heureDebutJour.split(':').map(Number);
    finNuit.setHours(hj, mj, 0, 0);
    return {
      debut: formatDatetimeLocal(debutNuit),
      fin: formatDatetimeLocal(finNuit),
    };
  }

  return {
    debut: formatDatetimeLocal(baseDate),
    fin: formatDatetimeLocal(new Date(baseDate.getTime() + 3600000)),
  };
}

function detectCreneau(dateDebut: string, dateFin: string, heureDebutJour: string, heureDebutNuit: string): Creneau {
  const d = new Date(dateDebut);
  const f = new Date(dateFin);
  const [hj] = heureDebutJour.split(':').map(Number);
  const [hn] = heureDebutNuit.split(':').map(Number);

  if (d.getHours() === hj && f.getHours() === hn) return 'jour';
  if (d.getHours() === hn) return 'nuit';
  return 'custom';
}

export function ReservationModal({ reservation, initialDate, initialTerrainId, onClose }: ReservationModalProps) {
  const { terrains, refreshReservations } = useData();
  const { profile, hasPermission } = useAuth();
  const isEdit = !!reservation;

  const activeTerrain = terrains.filter(t => t.is_active);
  const defaultTerrain = activeTerrain.find(t => t.id === initialTerrainId) || activeTerrain[0];

  const defaultHeureJour = defaultTerrain?.heure_debut_jour || '08:00';
  const defaultHeureNuit = defaultTerrain?.heure_debut_nuit || '18:00';
  const baseDate = initialDate || new Date();
  const defaultCreneau: Creneau = 'jour';
  const defaultDates = buildCreneauDates(baseDate, defaultCreneau, defaultHeureJour, defaultHeureNuit);

  const [form, setForm] = useState({
    terrain_id: defaultTerrain?.id || '',
    client_name: '',
    client_phone: '',
    date_debut: defaultDates.debut,
    date_fin: defaultDates.fin,
    notes: '',
    statut: 'réservé' as Reservation['statut'],
  });
  const [creneau, setCreneau] = useState<Creneau>(defaultCreneau);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canDelete = hasPermission('cancel_reservations') || profile?.role === 'admin';

  const selectedTerrain = terrains.find(t => t.id === form.terrain_id);
  const heureJour = selectedTerrain?.heure_debut_jour || '08:00';
  const heureNuit = selectedTerrain?.heure_debut_nuit || '18:00';

  useEffect(() => {
    if (reservation) {
      const detectedCreneau = detectCreneau(
        reservation.date_debut,
        reservation.date_fin,
        reservation.terrain?.heure_debut_jour || '08:00',
        reservation.terrain?.heure_debut_nuit || '18:00'
      );
      setCreneau(detectedCreneau);
      setForm({
        terrain_id: reservation.terrain_id,
        client_name: reservation.client_name,
        client_phone: reservation.client_phone,
        date_debut: formatDatetimeLocal(new Date(reservation.date_debut)),
        date_fin: formatDatetimeLocal(new Date(reservation.date_fin)),
        notes: reservation.notes || '',
        statut: reservation.statut,
      });
    }
  }, [reservation]);

  const handleTerrainChange = (terrainId: string) => {
    const t = terrains.find(x => x.id === terrainId);
    const hj = t?.heure_debut_jour || '08:00';
    const hn = t?.heure_debut_nuit || '18:00';
    const base = new Date(form.date_debut);
    if (creneau !== 'custom') {
      const dates = buildCreneauDates(base, creneau, hj, hn);
      setForm(f => ({ ...f, terrain_id: terrainId, date_debut: dates.debut, date_fin: dates.fin }));
    } else {
      setForm(f => ({ ...f, terrain_id: terrainId }));
    }
  };

  const handleCreneauChange = (c: Creneau) => {
    setCreneau(c);
    if (c !== 'custom') {
      const base = new Date(form.date_debut);
      const dates = buildCreneauDates(base, c, heureJour, heureNuit);
      setForm(f => ({ ...f, date_debut: dates.debut, date_fin: dates.fin }));
    }
  };

  const calcTarif = () => {
    if (!selectedTerrain) return 0;
    if (creneau === 'jour' && selectedTerrain.tarif_jour > 0) return selectedTerrain.tarif_jour;
    if (creneau === 'nuit' && selectedTerrain.tarif_nuit > 0) return selectedTerrain.tarif_nuit;
    const debut = new Date(form.date_debut);
    const fin = new Date(form.date_fin);
    const hours = Math.max(0, (fin.getTime() - debut.getTime()) / 3600000);
    return hours * selectedTerrain.tarif_horaire;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const tarif = calcTarif();
    try {
      if (isEdit) {
        const { error } = await supabase.from('reservations').update({
          terrain_id: form.terrain_id,
          client_name: form.client_name,
          client_phone: form.client_phone,
          date_debut: new Date(form.date_debut).toISOString(),
          date_fin: new Date(form.date_fin).toISOString(),
          notes: form.notes,
          statut: form.statut,
          tarif_total: tarif,
          montant_ttc: tarif,
          amount_due: tarif,
        }).eq('id', reservation!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('reservations').insert({
          terrain_id: form.terrain_id,
          client_name: form.client_name,
          client_phone: form.client_phone,
          date_debut: new Date(form.date_debut).toISOString(),
          date_fin: new Date(form.date_fin).toISOString(),
          notes: form.notes,
          statut: 'réservé',
          tarif_total: tarif,
          montant_ttc: tarif,
          amount_due: tarif,
          created_by: profile?.id,
        });
        if (error) throw error;
      }
      await refreshReservations();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    }
    setLoading(false);
  };

  const handleStatusChange = async (newStatut: Reservation['statut']) => {
    if (!reservation) return;
    setLoading(true);
    const { error } = await supabase.from('reservations').update({ statut: newStatut }).eq('id', reservation.id);
    if (!error) {
      await refreshReservations();
      onClose();
    } else {
      setError(error.message);
    }
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!reservation || !window.confirm('Annuler cette réservation ?')) return;
    setLoading(true);
    const { error } = await supabase.from('reservations').update({ statut: 'annulé' }).eq('id', reservation.id);
    if (!error) {
      await refreshReservations();
      onClose();
    }
    setLoading(false);
  };

  const tarif = calcTarif();
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);

  const formatTimeRange = (debut: string, fin: string) => {
    if (!debut || !fin) return '';
    const d = new Date(debut);
    const f = new Date(fin);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}h${pad(d.getMinutes())} → ${pad(f.getHours())}h${pad(f.getMinutes())}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <h2 className="font-semibold text-white">
            {isEdit ? 'Modifier la réservation' : 'Nouvelle réservation'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isEdit && reservation && (
          <div className="px-5 py-3 border-b border-slate-800 flex gap-2 flex-wrap">
            {reservation.statut === 'réservé' && (
              <button
                onClick={() => handleStatusChange('check_in')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs transition-all"
              >
                <LogIn className="w-3.5 h-3.5" /> Check-in
              </button>
            )}
            {reservation.statut === 'check_in' && (
              <button
                onClick={() => handleStatusChange('terminé')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 rounded-lg text-xs transition-all"
              >
                <LogOut className="w-3.5 h-3.5" /> Check-out
              </button>
            )}
            {canDelete && !['annulé', 'terminé'].includes(reservation.statut) && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-all ml-auto"
              >
                <Ban className="w-3.5 h-3.5" /> Annuler
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Terrain</label>
            <select
              value={form.terrain_id}
              onChange={(e) => handleTerrainChange(e.target.value)}
              required
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {activeTerrain.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">Créneau</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleCreneauChange('jour')}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all ${
                  creneau === 'jour'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span className="text-xs font-medium">Journée</span>
                {selectedTerrain?.tarif_jour ? (
                  <span className="text-xs font-bold">{fmt(selectedTerrain.tarif_jour)} F</span>
                ) : null}
                <span className="text-[10px] text-slate-500">{heureJour} – {heureNuit}</span>
              </button>

              <button
                type="button"
                onClick={() => handleCreneauChange('nuit')}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all ${
                  creneau === 'nuit'
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span className="text-xs font-medium">Nuit</span>
                {selectedTerrain?.tarif_nuit ? (
                  <span className="text-xs font-bold">{fmt(selectedTerrain.tarif_nuit)} F</span>
                ) : null}
                <span className="text-[10px] text-slate-500">{heureNuit} – {heureJour}</span>
              </button>

              <button
                type="button"
                onClick={() => handleCreneauChange('custom')}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all ${
                  creneau === 'custom'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <span className="text-base leading-none">⏱</span>
                <span className="text-xs font-medium">Horaire</span>
                {selectedTerrain?.tarif_horaire ? (
                  <span className="text-xs font-bold">{fmt(selectedTerrain.tarif_horaire)} F/h</span>
                ) : null}
                <span className="text-[10px] text-slate-500">Personnalisé</span>
              </button>
            </div>

            {creneau !== 'custom' && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 text-center">
                <span className="text-xs text-slate-400">
                  {formatTimeRange(form.date_debut, form.date_fin)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Date</label>
            <input
              type="date"
              value={form.date_debut.split('T')[0]}
              onChange={(e) => {
                const dateStr = e.target.value;
                if (!dateStr) return;
                const base = new Date(dateStr + 'T12:00:00');
                if (creneau !== 'custom') {
                  const dates = buildCreneauDates(base, creneau, heureJour, heureNuit);
                  setForm(f => ({ ...f, date_debut: dates.debut, date_fin: dates.fin }));
                } else {
                  const prevDebut = new Date(form.date_debut);
                  const prevFin = new Date(form.date_fin);
                  const pad = (n: number) => String(n).padStart(2, '0');
                  setForm(f => ({
                    ...f,
                    date_debut: `${dateStr}T${pad(prevDebut.getHours())}:${pad(prevDebut.getMinutes())}`,
                    date_fin: `${dateStr}T${pad(prevFin.getHours())}:${pad(prevFin.getMinutes())}`,
                  }));
                }
              }}
              required
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {creneau === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Début</label>
                <input
                  type="datetime-local"
                  value={form.date_debut}
                  onChange={(e) => setForm(f => ({ ...f, date_debut: e.target.value }))}
                  required
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Fin</label>
                <input
                  type="datetime-local"
                  value={form.date_fin}
                  onChange={(e) => setForm(f => ({ ...f, date_fin: e.target.value }))}
                  required
                  className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Nom client</label>
              <input
                value={form.client_name}
                onChange={(e) => setForm(f => ({ ...f, client_name: e.target.value }))}
                required
                placeholder="Prénom Nom"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Téléphone</label>
              <input
                value={form.client_phone}
                onChange={(e) => setForm(f => ({ ...f, client_phone: e.target.value }))}
                required
                placeholder="+221..."
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Informations supplémentaires..."
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {tarif > 0 && (
            <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${
              creneau === 'jour' ? 'bg-amber-500/10 border border-amber-500/20' :
              creneau === 'nuit' ? 'bg-blue-500/10 border border-blue-500/20' :
              'bg-emerald-500/10 border border-emerald-500/20'
            }`}>
              <div>
                <span className="text-xs text-slate-400 block">
                  {creneau === 'jour' ? 'Tarif journée' : creneau === 'nuit' ? 'Tarif nuit' : 'Tarif estimé'}
                </span>
                <span className="text-[10px] text-slate-500">{formatTimeRange(form.date_debut, form.date_fin)}</span>
              </div>
              <span className={`font-bold text-lg ${
                creneau === 'jour' ? 'text-amber-400' :
                creneau === 'nuit' ? 'text-blue-400' :
                'text-emerald-400'
              }`}>
                {fmt(tarif)} FCFA
              </span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isEdit ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
