import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Terrain = {
  id: string;
  name: string;
  description: string;
  tarif_horaire: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Reservation = {
  id: string;
  terrain_id: string;
  client_name: string;
  client_phone: string;
  date_debut: string;
  date_fin: string;
  tarif_total: number;
  tva_applicable: boolean;
  montant_tva: number;
  montant_ttc: number;
  statut: 'en_attente' | 'libre' | 'réservé' | 'check_in' | 'check_out' | 'terminé' | 'annulé' | 'bloqué';
  motif_blocage: string;
  notes: string;
  code_court: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'user' | 'receptionist';
  active: boolean;
  created_at: string;
  updated_at: string;
};
