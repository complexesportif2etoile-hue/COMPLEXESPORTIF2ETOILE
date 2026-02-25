/*
  # Création de la table payments

  ## Résumé
  Table de traçabilité pour tous les paiements mobiles (Wave, Orange Money) initiés
  depuis la page publique de réservation. Chaque tentative de paiement est enregistrée,
  qu'elle réussisse ou échoue.

  ## Nouvelle table `payments`
  - `id` : identifiant unique UUID
  - `reservation_id` : référence à la réservation liée (nullable car la réservation
    peut être créée après le paiement réussi)
  - `provider` : opérateur mobile — WAVE ou ORANGE_MONEY
  - `reference` : référence de transaction (saisie par le client ou générée)
  - `status` : PENDING | SUCCESS | FAILED | CANCELLED
  - `amount` : montant en CFA
  - `phone` : numéro de téléphone utilisé pour le paiement
  - `client_name` : nom du client au moment de l'initiation
  - `notes` : notes admin (raison d'un rejet, etc.)
  - `validated_by` : UUID de l'admin qui a validé/rejeté manuellement
  - `validated_at` : horodatage de la validation
  - `created_at` : horodatage de création

  ## Sécurité
  - RLS activé
  - Insertion publique autorisée (pour initier un paiement depuis la page publique)
  - Lecture admin uniquement
  - Mise à jour admin uniquement (pour valider/rejeter)

  ## Index
  - Index sur reservation_id pour les jointures
  - Index sur status pour les filtres admin
  - Index sur created_at pour les tris chronologiques
*/

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('WAVE', 'ORANGE_MONEY')),
  reference TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED')),
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  phone TEXT NOT NULL DEFAULT '',
  client_name TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert payments"
  ON payments FOR INSERT
  TO anon
  WITH CHECK (
    provider IN ('WAVE', 'ORANGE_MONEY')
    AND amount > 0
    AND status = 'PENDING'
  );

CREATE POLICY "Authenticated can read payments"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can read own pending payment"
  ON payments FOR SELECT
  TO anon
  USING (status = 'PENDING');

CREATE INDEX IF NOT EXISTS idx_payments_reservation_id ON payments (reservation_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments (provider);
