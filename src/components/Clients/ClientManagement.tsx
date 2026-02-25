import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Users, Search, Phone, Mail, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Client } from '../../types';

interface ClientForm {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const EMPTY: ClientForm = { name: '', phone: '', email: '', address: '', notes: '' };

export function ClientManagement() {
  const { clients, reservations, refreshClients } = useData();
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canManage = hasPermission('manage_clients');
  const canDelete = hasPermission('delete_clients');

  const filtered = useMemo(() =>
    clients.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase())
    ), [clients, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setError('');
    setShowModal(true);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, email: c.email || '', address: c.address || '', notes: c.notes || '' });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (editing) {
        const { error } = await supabase.from('clients').update(form).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert(form);
        if (error) throw error;
      }
      await refreshClients();
      setShowModal(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
    setLoading(false);
  };

  const handleDelete = async (c: Client) => {
    if (!window.confirm(`Supprimer le client "${c.name}" ?`)) return;
    await supabase.from('clients').delete().eq('id', c.id);
    await refreshClients();
  };

  const getClientStats = (clientName: string) => {
    const res = reservations.filter((r) => r.client_name.toLowerCase() === clientName.toLowerCase());
    return res.length;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clients</h1>
          <p className="text-slate-400 text-sm mt-0.5">{clients.length} client{clients.length !== 1 ? 's' : ''} enregistré{clients.length !== 1 ? 's' : ''}</p>
        </div>
        {canManage && (
          <button onClick={openCreate} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">
            <Plus className="w-4 h-4" />
            Nouveau client
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, téléphone, email..."
          className="w-full bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Client</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Téléphone</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 hidden md:table-cell">Email</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Réservations</th>
                {(canManage || canDelete) && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-slate-300">{c.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{c.name}</p>
                        {c.address && <p className="text-xs text-slate-500 truncate max-w-32">{c.address}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell">
                    <div className="flex items-center gap-1.5 text-sm text-slate-400">
                      <Phone className="w-3.5 h-3.5 text-slate-600" />
                      {c.phone || '-'}
                    </div>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <span className="text-sm text-slate-400">{c.email || '-'}</span>
                  </td>
                  <td className="px-5 py-3 text-center hidden sm:table-cell">
                    <span className="text-sm font-medium text-slate-300">{getClientStats(c.name)}</span>
                  </td>
                  {(canManage || canDelete) && (
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {canManage && (
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500 text-sm">
                    {search ? 'Aucun client trouvé' : 'Aucun client enregistré'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="font-semibold text-white">{editing ? 'Modifier le client' : 'Nouveau client'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl">{error}</div>}
              {[
                { key: 'name', label: 'Nom complet', placeholder: 'Prénom Nom', required: true },
                { key: 'phone', label: 'Téléphone', placeholder: '+221...', required: true },
                { key: 'email', label: 'Email', placeholder: 'client@exemple.com' },
                { key: 'address', label: 'Adresse', placeholder: 'Dakar, Sénégal' },
              ].map(({ key, label, placeholder, required }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">{label}</label>
                  <input
                    value={form[key as keyof ClientForm]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    required={required}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">Annuler</button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing ? 'Modifier' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
