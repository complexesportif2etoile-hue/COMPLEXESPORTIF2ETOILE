import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CardShell } from '../ui/CardShell';
import { IconPill } from '../ui/IconPill';
import { RolePermissionsEditor } from './RolePermissionsEditor';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Shield,
  UserCheck,
  UserX,
  Search,
  X,
  ShieldCheck,
} from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'user' | 'receptionist';
  active: boolean;
  created_at: string;
}

type Tab = 'users' | 'permissions';

export const UserManagement: React.FC = () => {
  const { user, profile: authProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('users');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user' as Profile['role'],
    active: true,
  });

  useEffect(() => {
    if (user) {
      loadProfiles();
    }
  }, [user]);

  const loadProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && !error) {
      setProfiles(data);
    }
    setLoading(false);
  };

  const isAdmin = authProfile?.role === 'admin';

  const filteredProfiles = profiles.filter((profile) =>
    profile.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateUser = async () => {
    if (!formData.email || !formData.password) {
      alert('Email et mot de passe sont requis');
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.full_name,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        await new Promise(resolve => setTimeout(resolve, 500));

        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            role: formData.role,
            active: formData.active,
          })
          .eq('id', authData.user.id);

        if (updateError) {
          throw new Error(`Impossible de mettre à jour le profil: ${updateError.message}`);
        }
      }

      setShowModal(false);
      resetForm();
      await loadProfiles();
      alert('Utilisateur créé avec succès');
    } catch (error: unknown) {
      alert(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue lors de la création'}`);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          role: formData.role,
          active: formData.active,
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      setShowModal(false);
      setEditingUser(null);
      resetForm();
      loadProfiles();
      alert('Utilisateur mis à jour avec succès');
    } catch (error: unknown) {
      alert(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur?')) return;

    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) throw authError;

      loadProfiles();
      alert('Utilisateur supprimé avec succès');
    } catch (error: unknown) {
      alert(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  const handleToggleActive = async (profile: Profile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ active: !profile.active })
        .eq('id', profile.id);

      if (error) throw error;

      loadProfiles();
    } catch (error: unknown) {
      alert(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  const openEditModal = (profile: Profile) => {
    setEditingUser(profile);
    setFormData({
      email: profile.email,
      password: '',
      full_name: profile.full_name,
      role: profile.role,
      active: profile.active,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      full_name: '',
      role: 'user',
      active: true,
    });
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'manager': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'receptionist': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrateur';
      case 'manager': return 'Manager';
      case 'receptionist': return 'Réceptionniste';
      default: return 'Utilisateur';
    }
  };

  if (!authProfile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Gestion des Utilisateurs</h1>
        <CardShell className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
        </CardShell>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Gestion des Utilisateurs</h1>
        <CardShell className="text-center py-8">
          <Shield className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
        </CardShell>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Gestion des Utilisateurs</h1>
          <p className="text-sm sm:text-base text-slate-400 mt-1">
            {profiles.length} utilisateur{profiles.length > 1 ? 's' : ''} enregistré{profiles.length > 1 ? 's' : ''}
          </p>
        </div>
        {activeTab === 'users' && (
          <button
            onClick={() => {
              resetForm();
              setEditingUser(null);
              setShowModal(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-2xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-[1px] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <Plus className="w-4 h-4" />
            Nouvel Utilisateur
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-slate-800/40 border border-slate-700/40 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'users'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          Utilisateurs
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'permissions'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Rôles & Permissions
        </button>
      </div>

      {activeTab === 'users' && (
        <>
          <CardShell padding="md">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Rechercher un utilisateur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 min-h-[44px] bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200"
              />
            </div>
          </CardShell>

          {loading ? (
            <CardShell className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
            </CardShell>
          ) : (
            <CardShell padding="none">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700/60">
                      <th className="text-left text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider p-4 sm:p-5">Utilisateur</th>
                      <th className="text-left text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider p-4 sm:p-5 hidden md:table-cell">Rôle</th>
                      <th className="text-left text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider p-4 sm:p-5 hidden lg:table-cell">Statut</th>
                      <th className="text-left text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider p-4 sm:p-5 hidden sm:table-cell">Date création</th>
                      <th className="text-right text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider p-4 sm:p-5">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {filteredProfiles.map((profile) => {
                      const isCurrentUser = profile.id === user?.id;
                      return (
                        <tr key={profile.id} className="hover:bg-slate-700/20 transition-colors duration-200">
                          <td className="p-4 sm:p-5">
                            <div>
                              <p className="text-sm font-medium text-white flex items-center gap-2">
                                {profile.full_name || 'Sans nom'}
                                {isCurrentUser && (
                                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-semibold">Vous</span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500">{profile.email}</p>
                            </div>
                          </td>
                          <td className="p-4 sm:p-5 hidden md:table-cell">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(profile.role)}`}>
                              {getRoleLabel(profile.role)}
                            </span>
                          </td>
                          <td className="p-4 sm:p-5 hidden lg:table-cell">
                            {profile.active ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-teal-400 font-medium">
                                <UserCheck className="w-3.5 h-3.5" />Actif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs text-red-400 font-medium">
                                <UserX className="w-3.5 h-3.5" />Inactif
                              </span>
                            )}
                          </td>
                          <td className="p-4 sm:p-5 text-xs text-slate-400 hidden sm:table-cell">
                            {new Date(profile.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="p-4 sm:p-5">
                            <div className="flex items-center justify-end gap-1.5">
                              <IconPill size="sm" variant={profile.active ? 'warn' : 'success'} onClick={() => handleToggleActive(profile)} disabled={isCurrentUser} title={profile.active ? 'Désactiver' : 'Activer'}>
                                {profile.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </IconPill>
                              <IconPill size="sm" variant="primary" onClick={() => openEditModal(profile)} title="Modifier">
                                <Edit2 className="w-4 h-4" />
                              </IconPill>
                              <IconPill size="sm" variant="danger" onClick={() => handleDeleteUser(profile.id)} disabled={isCurrentUser} title="Supprimer">
                                <Trash2 className="w-4 h-4" />
                              </IconPill>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredProfiles.length === 0 && (
                <div className="p-12 text-center">
                  <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <p className="text-white font-medium">Aucun utilisateur trouvé</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {searchTerm ? 'Essayez de modifier votre recherche' : 'Commencez par créer un utilisateur'}
                  </p>
                </div>
              )}
            </CardShell>
          )}
        </>
      )}

      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-400/80 leading-relaxed">
              Configurez les permissions pour chaque rôle opérationnel. Les administrateurs ont toujours accès à tout. Les modifications prennent effet à la prochaine connexion de l'utilisateur.
            </p>
          </div>

          <RolePermissionsEditor
            role="manager"
            roleLabel="Manager"
            roleColor="bg-blue-500/10 border-blue-500/20 text-blue-400"
          />
          <RolePermissionsEditor
            role="receptionist"
            roleLabel="Réceptionniste"
            roleColor="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          />
          <RolePermissionsEditor
            role="user"
            roleLabel="Utilisateur"
            roleColor="bg-slate-500/10 border-slate-500/20 text-slate-400"
          />
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/95 backdrop-blur-sm rounded-2xl border border-slate-700/60 shadow-2xl shadow-black/30 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700/60 p-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg sm:text-xl font-bold text-white">
                {editingUser ? 'Modifier Utilisateur' : 'Nouvel Utilisateur'}
              </h2>
              <IconPill size="sm" onClick={() => { setShowModal(false); setEditingUser(null); resetForm(); }} title="Fermer">
                <X className="w-4 h-4" />
              </IconPill>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingUser}
                  className="w-full px-4 min-h-[44px] bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  placeholder="utilisateur@example.com"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Mot de passe</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 min-h-[44px] bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Nom complet</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 min-h-[44px] bg-slate-900/60 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200"
                  placeholder="Jean Dupont"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Rôle</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Profile['role'] })}
                  className="w-full px-4 min-h-[44px] bg-slate-900/60 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200"
                >
                  <option value="user">Utilisateur</option>
                  <option value="receptionist">Réceptionniste</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-600 focus:ring-emerald-500/50"
                />
                <label htmlFor="active" className="text-sm text-slate-300">Compte actif</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowModal(false); setEditingUser(null); resetForm(); }}
                  className="flex-1 px-4 min-h-[44px] bg-slate-700/60 hover:bg-slate-600/70 text-white rounded-xl transition-all duration-200 border border-slate-600/50 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/40"
                >
                  Annuler
                </button>
                <button
                  onClick={editingUser ? handleUpdateUser : handleCreateUser}
                  className="flex-1 px-4 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all duration-200 font-medium text-sm hover:shadow-lg hover:shadow-emerald-500/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  {editingUser ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
