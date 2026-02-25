/*
  # Add missing indexes for foreign keys

  ## Summary
  Several tables have foreign key constraints without covering indexes, causing
  suboptimal query performance (full table scans on joins/lookups).

  ## New Indexes
  - `encaissements.encaisse_par` -> `idx_encaissements_encaisse_par`
  - `encaissements.reservation_id` -> `idx_encaissements_reservation_id`
  - `factures.emise_par` -> `idx_factures_emise_par`
  - `factures.reservation_id` -> `idx_factures_reservation_id`
  - `historique_actions.user_id` -> `idx_historique_actions_user_id`
  - `reservations.created_by` -> `idx_reservations_created_by`
  - `reservations.terrain_id` -> `idx_reservations_terrain_id`
*/

CREATE INDEX IF NOT EXISTS idx_encaissements_encaisse_par ON public.encaissements(encaisse_par);
CREATE INDEX IF NOT EXISTS idx_encaissements_reservation_id ON public.encaissements(reservation_id);
CREATE INDEX IF NOT EXISTS idx_factures_emise_par ON public.factures(emise_par);
CREATE INDEX IF NOT EXISTS idx_factures_reservation_id ON public.factures(reservation_id);
CREATE INDEX IF NOT EXISTS idx_historique_actions_user_id ON public.historique_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_created_by ON public.reservations(created_by);
CREATE INDEX IF NOT EXISTS idx_reservations_terrain_id ON public.reservations(terrain_id);
