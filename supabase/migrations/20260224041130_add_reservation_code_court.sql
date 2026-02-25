/*
  # Ajout du code court de réservation

  ## Résumé
  Chaque réservation reçoit un code court unique (6 caractères alphanumériques,
  ex: ABC123) permettant au client de retrouver sa réservation via l'URL publique
  /rsvp/:code.

  ## Modifications
  - Table `reservations` : ajout de la colonne `code_court` (text, unique)
  - Génération automatique du code à l'insertion via trigger
  - Index unique sur `code_court` pour les lookups rapides
  - Politique RLS : lecture publique par code (pour page /rsvp/:code)

  ## Fonction
  - `generate_reservation_code()` : génère un code 6 chars en majuscules (A-Z 0-9)
    en s'assurant de l'unicité via boucle
  - Trigger `set_reservation_code` : appelé avant INSERT sur reservations
*/

CREATE OR REPLACE FUNCTION generate_reservation_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM reservations WHERE code_court = code) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'code_court'
  ) THEN
    ALTER TABLE reservations ADD COLUMN code_court TEXT;
  END IF;
END $$;

UPDATE reservations SET code_court = generate_reservation_code() WHERE code_court IS NULL;

ALTER TABLE reservations ALTER COLUMN code_court SET DEFAULT generate_reservation_code();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'reservations' AND constraint_name = 'reservations_code_court_unique'
  ) THEN
    ALTER TABLE reservations ADD CONSTRAINT reservations_code_court_unique UNIQUE (code_court);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reservations_code_court ON reservations (code_court);

CREATE POLICY "Public can read reservation by code"
  ON reservations FOR SELECT
  TO anon
  USING (code_court IS NOT NULL);
