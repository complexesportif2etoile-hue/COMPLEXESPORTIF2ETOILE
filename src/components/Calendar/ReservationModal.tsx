import { useState, useEffect, useMemo } from 'react';
import { X, Loader2, LogIn, LogOut, Ban, Sun, Moon, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Reservation } from '../../types';
import { calcTarifBySlots } from '../utils/tarifUtils';

interface ReservationModalProps {
  reservation: Reservation | null;
  initialDate?: Date;
  initialTerrainId?: string;
  onClose: () => void;
}

function formatDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ReservationModal({ reservation, initialDate, initialTerrainId, onClose }: ReservationModalProps) {
  const { terrains, refreshReservations } = useData();
  const { profile, hasPermission } = useAuth();
  const isEdit = !!reservation;

  const activeTerrain = terrains.filter(t => t.is_active);
  const defaultTerrain = activeTerrain.find(t => t.id === initialTerrainId) || activeTerrain[0];

  const baseDate = initialDate || new Date();
  const heureJourDefault = parseInt((defaultTerrain?.heure_debut_jour || '08:00').split(':')[0]);
  const heureNuitDefault = parseInt((defaultTerrain?.heure_debut_nuit || '18:00').split(':')[0]);

  const defaultDebut = new Date(baseDate);
  defaultDebut.setHours(heureJourDefault, 0, 0, 0);
  const defaultFin = new Date(defaultDebut);
  defaultFin.setHours(heureNuitDefault, 0, 0, 0);

  const [form, setForm] = useState({
    terrain_id: defaultTerrain?.id || '',
    client_name: '',
    client_phone: '',
    date_debut: formatDatetimeLocal(defaultDebut),
    date_fin: formatDatetimeLocal(defaultFin),
    notes: '',
    statut: 'réservé' as Reservation['statut'],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showBreakdown, setShowBreakdown] = useState(false);

  const canDelete = hasPermission('cancel_reservations') || profile?.role === 'admin';
  const selectedTerrain = terrains.find(t => t.id === form.terrain_id);

  useEffect(() => {
    if (reservation) {
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

  const tarifResult = useMemo(() => {
    if (!selectedTerrain || !form.date_debut || !form.date_fin) return null;
    const debut = new Date(form.date_debut);
    const fin = new Date(form.date_fin);
    if (fin <= debut) return null;
    return calcTarifBySlots(debut, fin, selectedTerrain);
  }, [form.date_debut, form.date_fin, form.terrain_id, selectedTerrain]);

  const handleTerrainChange = (terrainId: string) => {
    const t = terrains.find(x => x.id === terrainId);
    const hj = parseInt((t?.heure_debut_jour || '08:00').split(':')[0]);
    const hn = parseInt((t?.heure_debut_nuit || '18:00').split(':')[0]);
    const base = new Date(form.date_debut);
    const debut = new Date(base);
    debut.setHours(hj, 0, 0, 0);
    const fin = new Date(debut);
    fin.setHours(hn, 0, 0, 0);
    setForm(f => ({ ...f, terrain_id: terrainId, date_debut: formatDatetimeLocal(debut), date_fin: formatDatetimeLocal(fin) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const tarif = tarifResult?.total || 0;
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
    if (!error) { await refreshReservations(); onClose(); }
    else setError(error.message);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!reservation || !window.confirm('Annuler cette réservation ?')) return;
    setLoading(true);
    const { error } = await supabase.from('reservations').update({ statut: 'annulé' }).eq('id', reservation.id);
    if (!error) { await refreshReservations(); onClose(); }
    setLoading(false);
  };

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
  const pad = (n: number) => String(n).padStart(2, '0');

  const heureJour = selectedTerrain?.heure_debut_jour ? parseInt(selectedTerrain.heure_debut_jour.split(':')[0]) : 8;
  const heureNuit = selectedTerrain?.heure_debut_nuit ? parseInt(selectedTerrain.heure_debut_nuit.split(':')[0]) : 18;

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
              <button onClick={() => handleStatusChange('check_in')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs transition-all">
                <LogIn className="w-3.5 h-3.5" /> Check-in
              </button>
            )}
            {reservation.statut === 'check_in' && (
              <button onClick={() => handleStatusChange('terminé')} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 rounded-lg text-xs transition-all">
                <LogOut className="w-3.5 h-3.5" /> Check-out
              </button>
            )}
            {canDelete && !['annulé', 'terminé'].includes(reservation.statut) && (
              <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-all ml-auto">
                <Ban className="w-3.5 h-3.5" /> Annuler
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl">{error}</div>
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

          {selectedTerrain && (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2 flex items-center gap-2">
                <Sun className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500">{pad(heureJour)}h – {pad(heureNuit)}h (sem.)</p>
                  <p className="text-xs font-bold text-amber-400">{fmt(selectedTerrain.tarif_jour || selectedTerrain.tarif_horaire)} F</p>
                </div>
              </div>
              <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-3 py-2 flex items-center gap-2">
                <Moon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-500">{pad(heureNuit)}h – {pad(heureJour)}h / WE</p>
                  <p className="text-xs font-bold text-blue-400">{fmt(selectedTerrain.tarif_nuit || selectedTerrain.tarif_horaire)} F</p>
                </div>
              </div>
            </div>
          )}

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

          {tarifResult && tarifResult.total > 0 && (
            <div className="rounded-xl overflow-hidden border border-slate-700">
              <button
                type="button"
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="w-full px-4 py-3 flex items-center justify-between bg-slate-800/60 hover:bg-slate-800 transition-all"
              >
                <div>
                  <span className="text-xs text-slate-400 block text-left">Tarif total</span>
                  <span className="font-bold text-lg text-white">{fmt(tarifResult.total)} FCFA</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{tarifResult.slots.length}h</span>
                  {showBreakdown ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {showBreakdown && (
                <div className="bg-slate-800/30 border-t border-slate-700/50 max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-px bg-slate-700/30 text-[10px] font-medium text-slate-500 px-4 py-1.5">
                    <span>Créneau</span>
                    <span className="text-right">Tarif</span>
                  </div>
                  {tarifResult.slots.map((slot, i) => (
                    <div key={i} className={`flex items-center justify-between px-4 py-1.5 text-xs border-b border-slate-700/30 last:border-0 ${slot.isNight ? 'bg-blue-500/3' : 'bg-amber-500/3'}`}>
                      <div className="flex items-center gap-1.5">
                        {slot.isNight
                          ? <Moon className="w-3 h-3 text-blue-400 flex-shrink-0" />
                          : <Sun className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        }
                        <span className="text-slate-300">{slot.label}</span>
                        {slot.isWeekend && <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1 rounded">WE</span>}
                      </div>
                      <span className={`font-medium ${slot.isNight ? 'text-blue-400' : 'text-amber-400'}`}>
                        {fmt(slot.tarif)} F
                      </span>
                    </div>
                  ))}
                  <div className="px-4 py-2 flex justify-between text-xs bg-slate-800/50">
                    <span className="text-slate-400">
                      {tarifResult.breakdown.slotJour > 0 && (
                        <span className="mr-3">
                          <Sun className="w-3 h-3 text-amber-400 inline mr-1" />
                          {tarifResult.breakdown.slotJour}h × {fmt(tarifResult.breakdown.jour)} F
                        </span>
                      )}
                      {tarifResult.breakdown.slotNuit > 0 && (
                        <span>
                          <Moon className="w-3 h-3 text-blue-400 inline mr-1" />
                          {tarifResult.breakdown.slotNuit}h × {fmt(tarifResult.breakdown.nuit)} F
                        </span>
                      )}
                    </span>
                    <span className="font-bold text-white">{fmt(tarifResult.total)} F</span>
                  </div>
                </div>
              )}
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
