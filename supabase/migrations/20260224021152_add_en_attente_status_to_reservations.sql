/*
  # Add 'en_attente' Status to Reservations

  ## Summary
  Adds a new reservation status 'en_attente' (pending validation) for reservations
  submitted via the public booking link. These reservations require operator approval
  before being confirmed as 'réservé'.

  ## Changes

  ### reservations table
  - The statut column already uses text type (no enum constraint), so existing data
    is unaffected. This migration simply documents the new status value.
  - Adds an index on statut = 'en_attente' for efficient querying of pending reservations.

  ## Notes
  - 'en_attente' is only assigned to reservations made via the public booking page
  - Operators must manually change status to 'réservé' to confirm, or 'annulé' to reject
  - Existing reservations created by authenticated users keep their current statuses
*/

CREATE INDEX IF NOT EXISTS idx_reservations_statut_pending
  ON reservations (statut)
  WHERE statut = 'en_attente';
