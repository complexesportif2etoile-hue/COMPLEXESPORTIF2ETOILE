/*
  # Ajout des champs de paiement aux réservations

  ## Résumé
  Ajout de la gestion du mode de paiement directement dans le flux de réservation publique.
  Les clients peuvent désormais choisir entre payer sur place ou payer en ligne (Wave/Orange Money).
  En cas de paiement en ligne, ils peuvent choisir de payer un acompte ou le montant total.

  ## Nouveaux champs sur la table `reservations`
  - `payment_status` : UNPAID | PARTIAL | PAID — statut du paiement
  - `payment_method` : ON_SITE | WAVE | ORANGE_MONEY — mode de paiement choisi
  - `amount_due` : montant total dû (copie de montant_ttc pour traçabilité)
  - `amount_paid` : montant déjà réglé
  - `deposit_amount` : montant de l'acompte (si paiement partiel)

  ## Nouvelle table `deposit_settings`
  Paramètres configurables par l'administrateur pour les acomptes :
  - `deposit_type` : PERCENTAGE | FIXED — type de calcul de l'acompte
  - `deposit_value` : valeur (pourcentage ou montant fixe)
  - `online_payment_enabled` : activer/désactiver le paiement en ligne
  - `wave_number` : numéro Wave pour les paiements
  - `orange_money_number` : numéro Orange Money pour les paiements

  ## Sécurité
  - RLS activé sur `deposit_settings`
  - Seuls les admins peuvent modifier les paramètres
  - Lecture publique des paramètres de dépôt (pour affichage sur page publique)
  - Les nouveaux champs de `reservations` sont accessibles en INSERT public avec contraintes
*/

-- Ajout des champs de paiement sur la table reservations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE reservations
      ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'UNPAID'
        CHECK (payment_status IN ('UNPAID', 'PARTIAL', 'PAID')),
      ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'ON_SITE'
        CHECK (payment_method IN ('ON_SITE', 'WAVE', 'ORANGE_MONEY')),
      ADD COLUMN amount_due NUMERIC(10, 2) NOT NULL DEFAULT 0,
      ADD COLUMN amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
      ADD COLUMN deposit_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Table des paramètres d'acompte
CREATE TABLE IF NOT EXISTS deposit_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  deposit_type TEXT NOT NULL DEFAULT 'PERCENTAGE' CHECK (deposit_type IN ('PERCENTAGE', 'FIXED')),
  deposit_value NUMERIC(10, 2) NOT NULL DEFAULT 30,
  online_payment_enabled BOOLEAN NOT NULL DEFAULT false,
  wave_number TEXT NOT NULL DEFAULT '',
  orange_money_number TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS pour deposit_settings
ALTER TABLE deposit_settings ENABLE ROW LEVEL SECURITY;

-- Lecture publique des paramètres (page de réservation publique en a besoin)
CREATE POLICY "Public can read deposit settings"
  ON deposit_settings FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated can read deposit settings"
  ON deposit_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert deposit settings"
  ON deposit_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update deposit settings"
  ON deposit_settings FOR UPDATE
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

-- Insertion des paramètres par défaut
INSERT INTO deposit_settings (id, deposit_type, deposit_value, online_payment_enabled, wave_number, orange_money_number)
VALUES (1, 'PERCENTAGE', 30, false, '', '')
ON CONFLICT (id) DO NOTHING;

-- Index pour les requêtes sur payment_status
CREATE INDEX IF NOT EXISTS idx_reservations_payment_status ON reservations (payment_status);
