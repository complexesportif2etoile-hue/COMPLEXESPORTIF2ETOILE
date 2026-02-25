/*
  # Drop unused indexes

  1. Dropped Indexes
    - `idx_reservations_terrain_id` on `reservations`
    - `idx_reservations_date_debut` on `reservations`
    - `idx_reservations_statut` on `reservations`
    - `idx_reservations_created_by` on `reservations`
    - `idx_encaissements_reservation_id` on `encaissements`
    - `idx_encaissements_encaisse_par` on `encaissements`
    - `idx_factures_reservation_id` on `factures`
    - `idx_factures_emise_par` on `factures`
    - `idx_historique_user_id` on `historique_actions`
    - `idx_historique_created_at` on `historique_actions`
    - `profiles_role_idx` on `profiles`
    - `profiles_active_idx` on `profiles`
    - `profiles_email_idx` on `profiles`

  2. Rationale
    - All 13 indexes were flagged as unused by Supabase security advisor
    - Removing them reduces storage overhead and write amplification
    - Indexes can be re-added later if query performance analysis warrants it
*/

DROP INDEX IF EXISTS idx_reservations_terrain_id;
DROP INDEX IF EXISTS idx_reservations_date_debut;
DROP INDEX IF EXISTS idx_reservations_statut;
DROP INDEX IF EXISTS idx_reservations_created_by;
DROP INDEX IF EXISTS idx_encaissements_reservation_id;
DROP INDEX IF EXISTS idx_encaissements_encaisse_par;
DROP INDEX IF EXISTS idx_factures_reservation_id;
DROP INDEX IF EXISTS idx_factures_emise_par;
DROP INDEX IF EXISTS idx_historique_user_id;
DROP INDEX IF EXISTS idx_historique_created_at;
DROP INDEX IF EXISTS profiles_role_idx;
DROP INDEX IF EXISTS profiles_active_idx;
DROP INDEX IF EXISTS profiles_email_idx;