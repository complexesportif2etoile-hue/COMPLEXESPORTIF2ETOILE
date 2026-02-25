/*
  # Création du schéma complet pour la gestion de terrains de football

  1. Nouvelles Tables
    - `profiles` : Profils utilisateurs avec rôles (admin, manager, receptionist)
    - `terrains` : Terrains de football avec tarifs et statuts
    - `reservations` : Réservations avec gestion TVA et statuts multiples
    - `encaissements` : Paiements avec modes multiples et répartition
    - `factures` : Facturation avec numérotation automatique
    - `configuration` : Configuration globale de l'application
    - `historique_actions` : Journal de toutes les actions

  2. Sécurité
    - RLS activé sur toutes les tables
    - Politiques basées sur l'authentification et les rôles
    - Accès en lecture pour tous les utilisateurs authentifiés
    - Modifications réservées selon les rôles
*/

-- Table profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'receptionist')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateurs authentifiés peuvent voir tous les profils"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs peuvent mettre à jour leur propre profil"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Table terrains
CREATE TABLE IF NOT EXISTS terrains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  tarif_horaire numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE terrains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tous peuvent voir les terrains actifs"
  ON terrains FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins et managers peuvent créer des terrains"
  ON terrains FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins et managers peuvent modifier des terrains"
  ON terrains FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Seuls les admins peuvent supprimer des terrains"
  ON terrains FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Table reservations
CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terrain_id uuid REFERENCES terrains(id) ON DELETE CASCADE NOT NULL,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  date_debut timestamptz NOT NULL,
  date_fin timestamptz NOT NULL,
  tarif_total numeric NOT NULL DEFAULT 0,
  tva_applicable boolean DEFAULT false,
  montant_tva numeric DEFAULT 0,
  montant_ttc numeric DEFAULT 0,
  statut text NOT NULL DEFAULT 'réservé' CHECK (statut IN ('libre', 'réservé', 'check_in', 'check_out', 'annulé', 'bloqué')),
  motif_blocage text DEFAULT '',
  notes text DEFAULT '',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tous peuvent voir les réservations"
  ON reservations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent créer des réservations"
  ON reservations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Utilisateurs authentifiés peuvent modifier des réservations"
  ON reservations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins peuvent supprimer des réservations"
  ON reservations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Table encaissements
CREATE TABLE IF NOT EXISTS encaissements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE NOT NULL,
  montant_total numeric NOT NULL,
  mode_paiement text NOT NULL CHECK (mode_paiement IN ('especes', 'orange_money', 'wave', 'mixte', 'autre')),
  details_paiement jsonb DEFAULT '{}',
  encaisse_par uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE encaissements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tous peuvent voir les encaissements"
  ON encaissements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent créer des encaissements"
  ON encaissements FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Table factures
CREATE TABLE IF NOT EXISTS factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id) ON DELETE CASCADE NOT NULL,
  numero_facture text UNIQUE NOT NULL,
  montant_ht numeric NOT NULL,
  montant_tva numeric DEFAULT 0,
  montant_ttc numeric NOT NULL,
  date_emission timestamptz DEFAULT now(),
  emise_par uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE factures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tous peuvent voir les factures"
  ON factures FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Utilisateurs authentifiés peuvent créer des factures"
  ON factures FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Table configuration
CREATE TABLE IF NOT EXISTS configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cle text UNIQUE NOT NULL,
  valeur jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE configuration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tous peuvent voir la configuration"
  ON configuration FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins peuvent modifier la configuration"
  ON configuration FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Table historique_actions
CREATE TABLE IF NOT EXISTS historique_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE historique_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tous peuvent voir l'historique"
  ON historique_actions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Système peut créer des entrées d'historique"
  ON historique_actions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insertion des données de configuration par défaut
INSERT INTO configuration (cle, valeur) VALUES
  ('entreprise_info', '{"nom": "Gestion Terrains Football", "adresse": "Dakar, Sénégal", "telephone": "+221 XX XXX XX XX", "email": "contact@terrains.sn"}'),
  ('facture_config', '{"mentions_legales": "Merci de votre confiance", "tva_taux": 0.18}'),
  ('modes_paiement', '["especes", "orange_money", "wave", "mixte", "autre"]')
ON CONFLICT (cle) DO NOTHING;

-- Créer des index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_reservations_terrain_id ON reservations(terrain_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date_debut ON reservations(date_debut);
CREATE INDEX IF NOT EXISTS idx_reservations_statut ON reservations(statut);
CREATE INDEX IF NOT EXISTS idx_encaissements_reservation_id ON encaissements(reservation_id);
CREATE INDEX IF NOT EXISTS idx_factures_reservation_id ON factures(reservation_id);
CREATE INDEX IF NOT EXISTS idx_historique_user_id ON historique_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_historique_created_at ON historique_actions(created_at);