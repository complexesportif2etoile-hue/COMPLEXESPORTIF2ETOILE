import { useState, useEffect } from 'react';
import { X, Loader2, Trash2, CheckCircle, LogIn, LogOut, Ban } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Reservation } from '../../types';
import { format } from '../utils/dateUtils';

interface ReservationModalProps {
  reservation: Reservation | null;
  initialDate?: Date;
  initialTerrainId?: string;
  onClose: () => void;
}

export function ReservationModal({ reservation, initialDate, initialTerrainId, onClose }: ReservationModalProps) {
  const { terrains, refreshReservations } = useData();
  const { profile, hasPermission } = useAuth();
  const isEdit = !!reservation;

  const [form, setForm] = useState({
    terrain_id: initialTerrainId || terrains[0]?.id || '',
    client_name: '',
    client_phone: '',
    date_debut: initialDate ? formatDatetimeLocal(initialDate) : formatDatetimeLocal(new Date()),
    date_fin: initialDate ? formatDatetimeLocal(new Date(initialDate.getTime() + 3600000)) : formatDatetimeLocal(new Date(Date.now() + 3600000)),
    notes: '',
    statut: 'réservé' as Reservation['statut'],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const canDelete = hasPermission('cancel_reservations') || profile?.role === 'admin';

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

  function formatDatetimeLocal(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  const calcTarif = () => {
    const terrain = terrains.find((t) => t.id === form.terrain_id);
    if (!terrain) return 0;
    const debut = new Date(form.date_debut);
    const fin = new Date(form.date_fin);
    const hours = (fin.getTime() - debut.getTime()) / 3600000;
    return Math.max(0, hours * terrain.tarif_horaire);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="font-semibold text-white">
            {isEdit ? 'Modifier la réservation' : 'Nouvelle réservation'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isEdit && reservation && (
          <div className="px-6 py-3 border-b border-slate-800 flex gap-2 flex-wrap">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Terrain</label>
            <select
              value={form.terrain_id}
              onChange={(e) => setForm({ ...form, terrain_id: e.target.value })}
              required
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {terrains.filter((t) => t.is_active).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Nom client</label>
              <input
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                required
                placeholder="Prénom Nom"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Téléphone</label>
              <input
                value={form.client_phone}
                onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                required
                placeholder="+221..."
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Début</label>
              <input
                type="datetime-local"
                value={form.date_debut}
                onChange={(e) => setForm({ ...form, date_debut: e.target.value })}
                required
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Fin</label>
              <input
                type="datetime-local"
                value={form.date_fin}
                onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
                required
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Informations supplémentaires..."
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {tarif > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-emerald-300">Tarif estimé</span>
              <span className="font-bold text-emerald-400">{new Intl.NumberFormat('fr-FR').format(tarif)} FCFA</span>
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
