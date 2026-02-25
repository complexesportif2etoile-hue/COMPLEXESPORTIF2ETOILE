/*
  # Drop Unused Indexes

  1. Dropped Indexes
    - `idx_encaissements_encaisse_par` on `public.encaissements`
    - `idx_encaissements_reservation_id` on `public.encaissements`
    - `idx_factures_emise_par` on `public.factures`
    - `idx_factures_reservation_id` on `public.factures`
    - `idx_historique_actions_user_id` on `public.historique_actions`
    - `idx_reservations_created_by` on `public.reservations`
    - `idx_reservations_terrain_id` on `public.reservations`

  2. Reason
    - All indexes flagged as unused by Supabase security advisor
    - Removing them reduces storage overhead and write latency
*/

DROP INDEX IF EXISTS idx_encaissements_encaisse_par;
DROP INDEX IF EXISTS idx_encaissements_reservation_id;
DROP INDEX IF EXISTS idx_factures_emise_par;
DROP INDEX IF EXISTS idx_factures_reservation_id;
DROP INDEX IF EXISTS idx_historique_actions_user_id;
DROP INDEX IF EXISTS idx_reservations_created_by;
DROP INDEX IF EXISTS idx_reservations_terrain_id;
