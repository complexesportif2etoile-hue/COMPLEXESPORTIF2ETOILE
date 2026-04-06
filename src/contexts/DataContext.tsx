import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Terrain, Client, Reservation, Encaissement, CompanySettings, DepositSettings, RolePermission, Depense } from '../types';

interface DataContextType {
  terrains: Terrain[];
  clients: Client[];
  reservations: Reservation[];
  encaissements: Encaissement[];
  depenses: Depense[];
  companySettings: CompanySettings | null;
  depositSettings: DepositSettings | null;
  rolePermissions: RolePermission[];
  ready: boolean;
  refreshTerrains: () => Promise<void>;
  refreshClients: () => Promise<void>;
  refreshReservations: () => Promise<void>;
  refreshEncaissements: () => Promise<void>;
  refreshDepenses: () => Promise<void>;
  refreshCompanySettings: () => Promise<void>;
  refreshDepositSettings: () => Promise<void>;
  refreshRolePermissions: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [encaissements, setEncaissements] = useState<Encaissement[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [depositSettings, setDepositSettings] = useState<DepositSettings | null>(null);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [ready, setReady] = useState(false);

  const refreshTerrains = useCallback(async () => {
    const { data } = await supabase.from('terrains').select('*').order('name');
    if (data) setTerrains(data);
  }, []);

  const refreshClients = useCallback(async () => {
    const { data } = await supabase.from('clients').select('*').order('name');
    if (data) setClients(data);
  }, []);

  const refreshReservations = useCallback(async () => {
    const { data } = await supabase
      .from('reservations')
      .select('*, terrain:terrains(*)')
      .order('date_debut', { ascending: false });
    if (data) setReservations(data as Reservation[]);
  }, []);

  const refreshEncaissements = useCallback(async () => {
    const { data } = await supabase.from('encaissements').select('*').order('created_at', { ascending: false });
    if (data) setEncaissements(data);
  }, []);

  const refreshDepenses = useCallback(async () => {
    const { data } = await supabase.from('depenses').select('*').order('date_depense', { ascending: false });
    if (data) setDepenses(data as Depense[]);
  }, []);

  const refreshCompanySettings = useCallback(async () => {
    const { data } = await supabase.from('company_settings').select('*').maybeSingle();
    if (data) setCompanySettings(data);
  }, []);

  const refreshDepositSettings = useCallback(async () => {
    const { data } = await supabase.from('deposit_settings').select('*').eq('id', 1).maybeSingle();
    if (data) setDepositSettings(data);
  }, []);

  const refreshRolePermissions = useCallback(async () => {
    const { data } = await supabase.from('role_permissions').select('*');
    if (data) setRolePermissions(data);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshTerrains(),
      refreshClients(),
      refreshReservations(),
      refreshEncaissements(),
      refreshDepenses(),
      refreshCompanySettings(),
      refreshDepositSettings(),
      refreshRolePermissions(),
    ]);
  }, [refreshTerrains, refreshClients, refreshReservations, refreshEncaissements, refreshDepenses, refreshCompanySettings, refreshDepositSettings, refreshRolePermissions]);

  useEffect(() => {
    refreshAll().finally(() => setReady(true));

    const resChannel = supabase.channel('reservations-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => refreshReservations())
      .subscribe();

    const encChannel = supabase.channel('encaissements-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'encaissements' }, () => refreshEncaissements())
      .subscribe();

    const clientsChannel = supabase.channel('clients-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => refreshClients())
      .subscribe();

    const depensesChannel = supabase.channel('depenses-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'depenses' }, () => refreshDepenses())
      .subscribe();

    return () => {
      resChannel.unsubscribe();
      encChannel.unsubscribe();
      clientsChannel.unsubscribe();
      depensesChannel.unsubscribe();
    };
  }, [refreshAll, refreshReservations, refreshEncaissements, refreshClients, refreshDepenses]);

  return (
    <DataContext.Provider value={{
      terrains, clients, reservations, encaissements, depenses,
      companySettings, depositSettings, rolePermissions, ready,
      refreshTerrains, refreshClients, refreshReservations,
      refreshEncaissements, refreshDepenses, refreshCompanySettings,
      refreshDepositSettings, refreshRolePermissions, refreshAll,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
