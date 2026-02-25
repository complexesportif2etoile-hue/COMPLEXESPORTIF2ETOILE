/*
  # Creation de la table clients

  1. Nouvelle Table
    - `clients`
      - `id` (uuid, cle primaire)
      - `name` (text, nom du client)
      - `phone` (text, telephone)
      - `email` (text, optionnel)
      - `address` (text, optionnel)
      - `notes` (text, optionnel)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Securite
    - RLS active sur la table `clients`
    - Politique de lecture pour tous les utilisateurs authentifies
    - Politique d'insertion pour les utilisateurs authentifies
    - Politique de mise a jour pour les utilisateurs authentifies
    - Politique de suppression pour admin et manager uniquement

  3. Index
    - Index sur `name` pour la recherche
    - Index sur `phone` pour la recherche

  4. Notes
    - Les clients sont un carnet d'adresses partage entre tous les utilisateurs
    - La suppression est reservee aux admin/manager pour eviter les pertes accidentelles
*/

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients (name);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients (phone);

CREATE POLICY "Authenticated users can view all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
    )
  );

CREATE POLICY "Admin and manager can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );
