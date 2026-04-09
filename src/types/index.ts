export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'user' | 'receptionist';
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Terrain {
  id: string;
  name: string;
  description: string;
  tarif_horaire: number;
  tarif_jour: number;
  tarif_nuit: number;
  heure_debut_jour: string;
  heure_debut_nuit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type ReservationStatut =
  | 'en_attente'
  | 'libre'
  | 'réservé'
  | 'check_in'
  | 'check_out'
  | 'terminé'
  | 'annulé'
  | 'bloqué';

export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
export type PaymentMethod = 'ON_SITE' | 'WAVE' | 'ORANGE_MONEY';

export interface Reservation {
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
  statut: ReservationStatut;
  motif_blocage: string;
  motif_annulation?: string;
  notes: string;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  amount_due: number;
  amount_paid: number;
  deposit_amount: number;
  code_court: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  terrain?: Terrain;
}

export interface Encaissement {
  id: string;
  reservation_id: string;
  montant_total: number;
  mode_paiement: 'especes' | 'orange_money' | 'wave' | 'mixte' | 'autre';
  type_versement: 'avance' | 'acompte' | 'solde' | 'autre';
  details_paiement: Record<string, unknown>;
  encaisse_par?: string;
  created_at: string;
}

export interface Facture {
  id: string;
  reservation_id: string;
  numero_facture: string;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  date_emission: string;
  emise_par?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  reservation_id?: string;
  provider: 'WAVE' | 'ORANGE_MONEY';
  reference: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  amount: number;
  phone: string;
  client_name: string;
  notes: string;
  validated_by?: string;
  validated_at?: string;
  created_at: string;
}

export interface CompanySettings {
  id: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_website: string;
  tax_id: string;
  logo_url: string;
  currency: string;
  tax_rate: number;
  invoice_prefix: string;
  invoice_footer: string;
  created_at: string;
  updated_at: string;
}

export interface DepositSettings {
  id: number;
  deposit_type: 'PERCENTAGE' | 'FIXED';
  deposit_value: number;
  online_payment_enabled: boolean;
  wave_number: string;
  orange_money_number: string;
  created_at: string;
  updated_at: string;
}

export type DepenseCategorie =
  | 'salaires'
  | 'entretien'
  | 'electricite'
  | 'eau'
  | 'loyer'
  | 'equipement'
  | 'fournitures'
  | 'autre';

export interface Depense {
  id: string;
  libelle: string;
  montant: number;
  categorie: DepenseCategorie;
  date_depense: string;
  notes: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: string;
  role: 'manager' | 'receptionist' | 'user';
  permission: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
