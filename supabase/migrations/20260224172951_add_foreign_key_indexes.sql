/*
  # Add covering indexes for all unindexed foreign keys

  ## Purpose
  Creates indexes on foreign key columns that currently lack covering indexes.
  This improves JOIN and lookup query performance significantly.

  ## New Indexes
  - `encaissements.encaisse_par` → references auth.users
  - `encaissements.reservation_id` → references reservations
  - `factures.emise_par` → references auth.users
  - `factures.reservation_id` → references reservations
  - `historique_actions.user_id` → references auth.users
  - `payments.reservation_id` → references reservations
  - `reservations.created_by` → references auth.users
  - `reservations.terrain_id` → references terrains
*/

CREATE INDEX IF NOT EXISTS idx_encaissements_encaisse_par
  ON public.encaissements (encaisse_par);

CREATE INDEX IF NOT EXISTS idx_encaissements_reservation_id
  ON public.encaissements (reservation_id);

CREATE INDEX IF NOT EXISTS idx_factures_emise_par
  ON public.factures (emise_par);

CREATE INDEX IF NOT EXISTS idx_factures_reservation_id
  ON public.factures (reservation_id);

CREATE INDEX IF NOT EXISTS idx_historique_actions_user_id
  ON public.historique_actions (user_id);

CREATE INDEX IF NOT EXISTS idx_payments_reservation_id
  ON public.payments (reservation_id);

CREATE INDEX IF NOT EXISTS idx_reservations_created_by
  ON public.reservations (created_by);

CREATE INDEX IF NOT EXISTS idx_reservations_terrain_id
  ON public.reservations (terrain_id);
