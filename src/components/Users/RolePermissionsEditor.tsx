import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { PERMISSION_DEFINITIONS, OperationalRole, Permission } from '../../lib/permissions';
import { Shield, Loader2, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface RolePermissionsEditorProps {
  role: OperationalRole;
  roleLabel: string;
  roleColor: string;
}

type PermMap = Record<Permission, boolean>;

export const RolePermissionsEditor: React.FC<RolePermissionsEditorProps> = ({ role, roleLabel, roleColor }) => {
  const [permissions, setPermissions] = useState<PermMap>({} as PermMap);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, [role]);

  const loadPermissions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('role_permissions')
      .select('permission, enabled')
      .eq('role', role);

    const map = {} as PermMap;
    PERMISSION_DEFINITIONS.forEach(p => { map[p.key] = false; });
    if (data) {
      data.forEach(row => { map[row.permission as Permission] = row.enabled; });
    }
    setPermissions(map);
    setLoading(false);
  };

  const togglePermission = (key: Permission) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const upsertData = PERMISSION_DEFINITIONS.map(p => ({
        role,
        permission: p.key,
        enabled: permissions[p.key] ?? false,
      }));

      const { error: upsertError } = await supabase
        .from('role_permissions')
        .upsert(upsertData, { onConflict: 'role,permission' });

      if (upsertError) throw upsertError;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  const groups = PERMISSION_DEFINITIONS.reduce<Record<string, typeof PERMISSION_DEFINITIONS>>((acc, def) => {
    if (!acc[def.group]) acc[def.group] = [];
    acc[def.group].push(def);
    return acc;
  }, {});

  const enabledCount = Object.values(permissions).filter(Boolean).length;
  const totalCount = PERMISSION_DEFINITIONS.length;

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-700/20 transition-colors duration-200"
      >
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${roleColor}`}>
            <Shield className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">{roleLabel}</p>
            <p className="text-xs text-slate-500">{enabledCount} / {totalCount} permissions activées</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex gap-1">
            {Array.from({ length: Math.min(totalCount, 14) }).map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-4 rounded-full transition-colors duration-200 ${
                  i < enabledCount ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700/40 px-5 pb-5 pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            </div>
          ) : (
            <>
              <div className="space-y-5">
                {Object.entries(groups).map(([group, defs]) => (
                  <div key={group}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2.5">{group}</p>
                    <div className="space-y-2">
                      {defs.map(def => (
                        <label
                          key={def.key}
                          className="flex items-start gap-3 cursor-pointer group"
                        >
                          <div className="relative mt-0.5 shrink-0">
                            <input
                              type="checkbox"
                              checked={permissions[def.key] ?? false}
                              onChange={() => togglePermission(def.key)}
                              className="sr-only"
                            />
                            <div
                              onClick={() => togglePermission(def.key)}
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 ${
                                permissions[def.key]
                                  ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.3)]'
                                  : 'bg-slate-900/60 border-slate-600 group-hover:border-slate-500'
                              }`}
                            >
                              {permissions[def.key] && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium transition-colors duration-150 ${permissions[def.key] ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>
                              {def.label}
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5">{def.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-4 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {saved && (
                <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  Permissions sauvegardées avec succès
                </div>
              )}

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-700/40">
                <button
                  onClick={() => {
                    const allOn = Object.values(permissions).every(Boolean);
                    const newMap = {} as PermMap;
                    PERMISSION_DEFINITIONS.forEach(p => { newMap[p.key] = !allOn; });
                    setPermissions(newMap);
                    setSaved(false);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors duration-200 underline underline-offset-2"
                >
                  {Object.values(permissions).every(Boolean) ? 'Tout désactiver' : 'Tout activer'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 min-h-[36px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/20"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
