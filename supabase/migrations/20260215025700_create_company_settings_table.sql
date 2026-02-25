/*
  # Paramètres de la société

  1. Nouvelle Table
    - `company_settings`
      - `id` (uuid, primary key) - Identifiant unique
      - `company_name` (text) - Nom de la société
      - `company_address` (text) - Adresse complète
      - `company_phone` (text) - Téléphone
      - `company_email` (text) - Email
      - `company_website` (text) - Site web
      - `tax_id` (text) - Numéro d'identification fiscale
      - `logo_url` (text) - URL ou base64 du logo
      - `currency` (text) - Devise (défaut: FCFA)
      - `tax_rate` (numeric) - Taux de TVA par défaut
      - `invoice_prefix` (text) - Préfixe pour les numéros de facture
      - `invoice_footer` (text) - Texte de bas de page des factures
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Sécurité
    - Enable RLS sur `company_settings`
    - Tous les utilisateurs authentifiés peuvent lire
    - Seuls les admins peuvent modifier

  3. Notes
    - Une seule ligne de paramètres est créée par défaut
    - Mise à jour automatique de updated_at
*/

-- Create company_settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text DEFAULT '',
  company_address text DEFAULT '',
  company_phone text DEFAULT '',
  company_email text DEFAULT '',
  company_website text DEFAULT '',
  tax_id text DEFAULT '',
  logo_url text DEFAULT '',
  currency text DEFAULT 'FCFA',
  tax_rate numeric DEFAULT 18,
  invoice_prefix text DEFAULT 'INV',
  invoice_footer text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_company_settings_updated_at ON company_settings;
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings if none exist
INSERT INTO company_settings (
  company_name,
  company_address,
  company_phone,
  company_email,
  currency,
  tax_rate,
  invoice_prefix,
  invoice_footer
)
SELECT 
  'Terrain de Football',
  '',
  '',
  '',
  'FCFA',
  18,
  'INV',
  'Merci pour votre confiance'
WHERE NOT EXISTS (SELECT 1 FROM company_settings LIMIT 1);

-- RLS Policies

-- All authenticated users can read settings
CREATE POLICY "Authenticated users can view settings"
  ON company_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update settings"
  ON company_settings
  FOR UPDATE
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

-- Only admins can insert settings
CREATE POLICY "Admins can insert settings"
  ON company_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only admins can delete settings
CREATE POLICY "Admins can delete settings"
  ON company_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS company_settings_updated_at_idx ON company_settings(updated_at);
