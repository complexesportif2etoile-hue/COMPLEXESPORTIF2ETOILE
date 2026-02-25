/*
  # Add 'en_attente' to reservations statut check constraint

  ## Summary
  The reservations_statut_check constraint did not include 'en_attente'.
  This migration drops the old constraint and recreates it with the new value.

  ## Changes
  - reservations table: extends statut CHECK constraint to include 'en_attente'
*/

ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_statut_check;

ALTER TABLE reservations
  ADD CONSTRAINT reservations_statut_check
    CHECK (statut = ANY (ARRAY[
      'en_attente'::text,
      'libre'::text,
      'réservé'::text,
      'check_in'::text,
      'check_out'::text,
      'terminé'::text,
      'annulé'::text,
      'bloqué'::text
    ]));
