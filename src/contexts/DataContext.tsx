import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { supabase, Terrain, Reservation, Client } from '../lib/supabase';
import { useAuth } from './AuthContext';

type DataContextType = {
  terrains: Terrain[];
  reservations: Reservation[];
  clients: Client[];
  terrainsMap: Record<string, string>;
  ready: boolean;
  newReservationSignal: number;
  refreshTerrains: () => Promise<void>;
  refreshReservations: () => Promise<void>;
  refreshClients: () => Promise<void>;
  refreshAll: () => Promise<void>;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [terrains, setTerrains] = useState<Terrain[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [terrainsMap, setTerrainsMap] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [newReservationSignal, setNewReservationSignal] = useState(0);

  const refreshTerrains = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('terrains')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) {
        setTerrains(data);
        const map: Record<string, string> = {};
        data.forEach((t) => { map[t.id] = t.name; });
        setTerrainsMap(map);
      }
    } catch (e) {
      console.error('Error fetching terrains:', e);
    }
  }, []);

  const refreshReservations = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('reservations')
        .select('*')
        .order('date_debut', { ascending: false });
      if (data) setReservations(data);
    } catch (e) {
      console.error('Error fetching reservations:', e);
    }
  }, []);

  const refreshClients = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });
      if (data) setClients(data);
    } catch (e) {
      console.error('Error fetching clients:', e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshTerrains(), refreshReservations(), refreshClients()]);
  }, [refreshTerrains, refreshReservations, refreshClients]);

  const userId = user?.id;

  const refreshReservationsRef = useRef(refreshReservations);
  const refreshTerrainsRef = useRef(refreshTerrains);
  const refreshClientsRef = useRef(refreshClients);
  const reservationsRef = useRef(reservations);

  useEffect(() => { refreshReservationsRef.current = refreshReservations; }, [refreshReservations]);
  useEffect(() => { refreshTerrainsRef.current = refreshTerrains; }, [refreshTerrains]);
  useEffect(() => { refreshClientsRef.current = refreshClients; }, [refreshClients]);
  useEffect(() => { reservationsRef.current = reservations; }, [reservations]);

  useEffect(() => {
    if (!userId) {
      setTerrains([]);
      setReservations([]);
      setClients([]);
      setTerrainsMap({});
      setReady(false);
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        await Promise.all([refreshTerrainsRef.current(), refreshReservationsRef.current(), refreshClientsRef.current()]);
      } catch (e) {
        console.error('Error loading data:', e);
      }
      if (mounted) setReady(true);
    };

    load();

    const channelName = `realtime-sync-${userId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reservations' },
        (payload) => {
          if (!mounted) return;
          const newRow = payload.new as { statut?: string };
          if (newRow?.statut === 'en_attente') {
            setNewReservationSignal(s => s + 1);
          }
          refreshReservationsRef.current();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'reservations' },
        () => { if (mounted) refreshReservationsRef.current(); }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'reservations' },
        () => { if (mounted) refreshReservationsRef.current(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'terrains' },
        () => { if (mounted) refreshTerrainsRef.current(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'encaissements' },
        () => { if (mounted) refreshReservationsRef.current(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        () => { if (mounted) refreshClientsRef.current(); }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error, retrying...');
        }
      });

    const pollInterval = setInterval(async () => {
      if (!mounted) return;
      try {
        const { data } = await supabase
          .from('reservations')
          .select('id, statut, updated_at')
          .eq('statut', 'en_attente')
          .order('created_at', { ascending: false })
          .limit(20);

        if (!data || !mounted) return;

        const currentPendingIds = new Set(
          reservationsRef.current
            .filter(r => r.statut === 'en_attente')
            .map(r => r.id)
        );

        const hasNew = data.some(r => !currentPendingIds.has(r.id));
        if (hasNew) {
          setNewReservationSignal(s => s + 1);
          refreshReservationsRef.current();
        }
      } catch {
      }
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <DataContext.Provider value={{ terrains, reservations, clients, terrainsMap, ready, newReservationSignal, refreshTerrains, refreshReservations, refreshClients, refreshAll }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}
