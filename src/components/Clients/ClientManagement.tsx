import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Phone, Mail, Eye, UserCircle } from 'lucide-react';
import { supabase, Client } from '../../lib/supabase';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { CardShell } from '../ui/CardShell';
import { IconPill } from '../ui/IconPill';
import { ClientFormModal } from './ClientFormModal';
import { ClientDetailModal } from './ClientDetailModal';

export const ClientManagement: React.FC = () => {
  const { clients, reservations, refreshClients } = useData();
  const { can } = useAuth();
  const canDelete = can('delete_clients');
  const canManage = can('manage_clients');

  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState('');

  const reservationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of reservations) {
      const key = r.client_name.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [reservations]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const handleOpenCreate = () => {
    setEditingClient(null);
    setShowForm(true);
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setShowForm(true);
  };

  const handleFormSaved = () => {
    setShowForm(false);
    setEditingClient(null);
    refreshClients();
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`Supprimer le client "${client.name}" ?`)) return;
    const { error } = await supabase.from('clients').delete().eq('id', client.id);
    if (!error) refreshClients();
  };

  return (
    <div className="space-y-4 xs:space-y-5 sm:space-y-6">
      <div className="flex flex-col xs:flex-row xs:items-center xs:justify-between gap-3 xs:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-white tracking-tight truncate">Clients</h1>
          <p className="text-xs xs:text-sm sm:text-base text-slate-400 mt-1">
            {clients.length} client{clients.length !== 1 ? 's' : ''} enregistre{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center justify-center gap-2 px-3 xs:px-4 sm:px-5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs xs:text-sm font-medium rounded-2xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-[1px] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
            <span className="hidden xs:inline">Nouveau Client</span>
            <span className="xs:hidden">Nouveau</span>
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 xs:left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 xs:w-4 xs:h-4 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher..."
          className="w-full pl-9 xs:pl-10 pr-3 xs:pr-4 min-h-[44px] bg-slate-800/50 backdrop-blur-sm border border-slate-700/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 text-sm transition-all duration-200"
        />
      </div>

      {filteredClients.length === 0 ? (
        <CardShell className="text-center">
          <div className="py-6">
            <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700/50 ring-1 ring-white/5">
              <UserCircle className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-white font-medium">
              {search ? 'Aucun client trouve' : 'Aucun client enregistre'}
            </p>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              {search ? 'Essayez un autre terme de recherche' : 'Ajoutez votre premier client'}
            </p>
            {!search && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 px-5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                <Plus className="w-4 h-4" />
                Creer un client
              </button>
            )}
          </div>
        </CardShell>
      ) : (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 xs:gap-4 sm:gap-5">
          {filteredClients.map((client) => {
            const resCount = reservationCounts[client.name.toLowerCase()] || 0;
            return (
              <CardShell key={client.id} hover>
                <div className="flex items-start justify-between mb-2.5 xs:mb-3 gap-2 min-w-0">
                  <div className="flex items-center gap-2 xs:gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 xs:w-10 xs:h-10 bg-emerald-500/10 rounded-lg xs:rounded-xl flex items-center justify-center shrink-0 border border-emerald-500/20 ring-1 ring-emerald-500/5">
                      <span className="text-xs xs:text-sm font-bold text-emerald-400">
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm xs:text-base font-semibold text-white truncate">{client.name}</h3>
                      {client.phone && (
                        <p className="text-[10px] xs:text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                          <Phone className="w-2.5 h-2.5 xs:w-3 xs:h-3 shrink-0" />
                          <span className="truncate">{client.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`px-1.5 xs:px-2 py-0.5 text-[9px] xs:text-[10px] font-medium rounded-full shrink-0 whitespace-nowrap ${
                    resCount > 0
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                  }`}>
                    {resCount} res.
                  </span>
                </div>

                {client.email && (
                  <p className="text-[10px] xs:text-xs text-slate-500 flex items-center gap-1.5 mb-2.5 xs:mb-3 truncate min-w-0">
                    <Mail className="w-2.5 h-2.5 xs:w-3 xs:h-3 shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </p>
                )}

                <div className="flex gap-1.5 xs:gap-2 mt-auto">
                  <button
                    onClick={() => setViewingClient(client)}
                    className="flex-1 flex items-center justify-center gap-1 xs:gap-1.5 bg-slate-700/40 hover:bg-slate-700/70 text-slate-300 hover:text-white px-2 xs:px-3 min-h-[40px] xs:min-h-[44px] rounded-lg xs:rounded-xl transition-all duration-200 text-[11px] xs:text-xs font-medium border border-slate-700/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <Eye className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
                    Voir
                  </button>
                  {canManage && <IconPill
                    size="sm"
                    variant="primary"
                    onClick={() => handleOpenEdit(client)}
                    title="Modifier"
                    aria-label="Modifier"
                  >
                    <Edit2 className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
                  </IconPill>}
                  {canDelete && (
                    <IconPill
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(client)}
                      title="Supprimer"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
                    </IconPill>
                  )}
                </div>
              </CardShell>
            );
          })}
        </div>
      )}

      {showForm && (
        <ClientFormModal
          client={editingClient}
          onClose={() => {
            setShowForm(false);
            setEditingClient(null);
          }}
          onSaved={handleFormSaved}
        />
      )}

      {viewingClient && (
        <ClientDetailModal
          client={viewingClient}
          onClose={() => setViewingClient(null)}
        />
      )}
    </div>
  );
};
