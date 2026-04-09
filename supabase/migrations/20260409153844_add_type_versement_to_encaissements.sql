/*
  # Add type_versement to encaissements table

  1. Changes
    - `encaissements` table: add `type_versement` column (text)
      - Stores the type of payment: 'avance', 'acompte', 'solde', 'autre'
      - Defaults to 'solde' for backwards compatibility

  2. Notes
    - Non-destructive addition only
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'encaissements' AND column_name = 'type_versement'
  ) THEN
    ALTER TABLE encaissements ADD COLUMN type_versement text NOT NULL DEFAULT 'solde';
  END IF;
END $$;
