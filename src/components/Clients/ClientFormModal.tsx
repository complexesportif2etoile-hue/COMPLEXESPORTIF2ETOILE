import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { supabase, Client } from '../../lib/supabase';
import { IconPill } from '../ui/IconPill';

interface ClientFormModalProps {
  client: Client | null;
  onClose: () => void;
  onSaved: () => void;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({ client, onClose, onSaved }) => {
  const [name, setName] = useState(client?.name || '');
  const [phone, setPhone] = useState(client?.phone || '');
  const [email, setEmail] = useState(client?.email || '');
  const [address, setAddress] = useState(client?.address || '');
  const [notes, setNotes] = useState(client?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!client;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Le nom du client est requis');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        notes: notes.trim(),
        updated_at: new Date().toISOString(),
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', client.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('clients')
          .insert(payload);
        if (insertError) throw insertError;
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 min-h-[44px] bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200";
  const labelClass = "block text-sm font-medium text-slate-300 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/30 border border-slate-700/60 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-700/60 sticky top-0 bg-slate-800/95 backdrop-blur-sm rounded-t-2xl z-10">
          <h2 className="text-lg sm:text-xl font-semibold text-white">
            {isEditing ? 'Modifier Client' : 'Nouveau Client'}
          </h2>
          <IconPill size="sm" onClick={onClose} title="Fermer">
            <X className="w-4 h-4" />
          </IconPill>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className={labelClass}>Nom *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Nom complet du client"
              required
            />
          </div>

          <div>
            <label className={labelClass}>Telephone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="Numero de telephone"
            />
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="Adresse email"
            />
          </div>

          <div>
            <label className={labelClass}>Adresse</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass}
              placeholder="Adresse du client"
            />
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${inputClass} min-h-0 py-2.5`}
              placeholder="Notes additionnelles..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 min-h-[44px] text-sm font-medium text-slate-300 bg-slate-700/60 hover:bg-slate-600/70 rounded-xl transition-all duration-200 border border-slate-600/50 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 min-h-[44px] text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              {loading ? 'Enregistrement...' : isEditing ? 'Enregistrer' : 'Creer Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
