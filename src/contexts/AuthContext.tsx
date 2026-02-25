import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';
import { Permission, RolePermissionsMap, hasPermission } from '../lib/permissions';

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  rolePermissions: RolePermissionsMap | null;
  loading: boolean;
  can: (permission: Permission) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsMap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setRolePermissions(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadPermissions = async (role: string) => {
    if (role === 'admin') {
      setRolePermissions(null);
      return;
    }
    try {
      const { data } = await supabase
        .from('role_permissions')
        .select('permission, enabled')
        .eq('role', role);

      if (data) {
        const map = data.reduce<RolePermissionsMap>((acc, row) => {
          acc[row.permission as Permission] = row.enabled;
          return acc;
        }, {} as RolePermissionsMap);
        setRolePermissions(map);
      }
    } catch (e) {
      console.error('Error loading permissions:', e);
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const currentUser = (await supabase.auth.getUser()).data.user;
        if (currentUser) {
          const { error: insertError } = await supabase.rpc(
            'ensure_profile_exists',
            {
              p_user_id: currentUser.id,
              p_email: currentUser.email || '',
              p_full_name: currentUser.user_metadata?.full_name || '',
            }
          );

          if (!insertError) {
            const result = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle();
            data = result.data;
          }
        }
      }

      setProfile(data);
      if (data?.role) {
        await loadPermissions(data.role);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  const refreshPermissions = async () => {
    if (profile?.role) {
      await loadPermissions(profile.role);
    }
  };

  const can = (permission: Permission): boolean => {
    return hasPermission(profile?.role ?? '', permission, rolePermissions);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email,
          full_name: fullName,
          role,
        });

      if (profileError) throw profileError;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, profile, rolePermissions, loading, can, signIn, signUp, signOut, refreshProfile, refreshPermissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
