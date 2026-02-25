import { useState, useEffect } from 'react';
import { Plus, Shield, Edit2, X, Loader2, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Profile } from '../../types';

const ROLES = ['admin', 'manager', 'receptionist', 'user'] as const;
const ROLE_LABELS: Record<string, string> = { admin: 'Admin', manager: 'Manager', receptionist: 'Réceptionniste', user: 'Utilisateur' };
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/10 text-red-400 border-red-500/20',
  manager: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  receptionist: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  user: 'bg-slate-700/50 text-slate-400 border-slate-600/20',
};

export function UserManagement() {
  const { profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState<typeof ROLES[number]>('user');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<typeof ROLES[number]>('user');

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at');
    if (data) setUsers(data);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: inviteEmail,
        password: invitePassword,
        options: { data: { full_name: inviteName } },
      });
      if (error) throw error;
      if (data.user && inviteRole !== 'user') {
        await supabase.from('profiles').update({ role: inviteRole }).eq('id', data.user.id);
      }
      await fetchUsers();
      setShowInvite(false);
      setInviteEmail('');
      setInviteName('');
      setInvitePassword('');
      setInviteRole('user');
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : 'Erreur');
    }
    setInviteLoading(false);
  };

  const handleUpdateRole = async () => {
    if (!editingUser) return;
    await supabase.from('profiles').update({ role: editRole }).eq('id', editingUser.id);
    await fetchUsers();
    setEditingUser(null);
  };

  const handleToggleActive = async (user: Profile) => {
    await supabase.from('profiles').update({ active: !user.active }).eq('id', user.id);
    await fetchUsers();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Utilisateurs</h1>
          <p className="text-slate-400 text-sm mt-0.5">{users.length} utilisateur{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {users.map((u) => (
              <div key={u.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-800/30 transition-colors">
                <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-slate-300">
                    {u.full_name?.charAt(0)?.toUpperCase() || u.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{u.full_name || u.email}</p>
                  <p className="text-xs text-slate-500 truncate">{u.email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLORS[u.role]}`}>
                  {ROLE_LABELS[u.role]}
                </span>
                <span className={`text-xs ${u.active ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {u.active ? 'Actif' : 'Inactif'}
                </span>
                {currentProfile?.id !== u.id && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingUser(u); setEditRole(u.role as typeof ROLES[number]); }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(u)}
                      className={`p-1.5 rounded-lg transition-all ${u.active ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'}`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="font-semibold text-white">Ajouter un utilisateur</h2>
              <button onClick={() => setShowInvite(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              {inviteError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl">{inviteError}</div>}
              {[
                { key: 'name', label: 'Nom complet', placeholder: 'Prénom Nom', value: inviteName, onChange: setInviteName },
                { key: 'email', label: 'Email', placeholder: 'utilisateur@exemple.com', value: inviteEmail, onChange: setInviteEmail },
                { key: 'password', label: 'Mot de passe', placeholder: '••••••••', value: invitePassword, onChange: setInvitePassword, type: 'password' },
              ].map(({ key, label, placeholder, value, onChange, type }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400">{label}</label>
                  <input type={type || 'text'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Rôle</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as typeof ROLES[number])} className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInvite(false)} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">Annuler</button>
                <button type="submit" disabled={inviteLoading} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                  {inviteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="font-semibold text-white">Modifier le rôle</h2>
              <button onClick={() => setEditingUser(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-300">{editingUser.full_name || editingUser.email}</p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Rôle</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value as typeof ROLES[number])} className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-all">Annuler</button>
                <button onClick={handleUpdateRole} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-xl text-sm transition-all">Sauvegarder</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
