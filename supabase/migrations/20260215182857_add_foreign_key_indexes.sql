/*
  # Re-add foreign key indexes for query performance

  1. Problem
    - 7 foreign key columns lack covering indexes after previous cleanup
    - This causes suboptimal JOIN and constraint validation performance

  2. New Indexes
    - `idx_encaissements_encaisse_par` on `encaissements(encaisse_par)`
    - `idx_encaissements_reservation_id` on `encaissements(reservation_id)`
    - `idx_factures_emise_par` on `factures(emise_par)`
    - `idx_factures_reservation_id` on `factures(reservation_id)`
    - `idx_historique_actions_user_id` on `historique_actions(user_id)`
    - `idx_reservations_created_by` on `reservations(created_by)`
    - `idx_reservations_terrain_id` on `reservations(terrain_id)`

  3. Impact
    - Improves query performance for JOINs on these columns
    - Speeds up foreign key constraint validation on DELETE/UPDATE
    - Required by PostgreSQL best practices for all foreign key columns
*/

CREATE INDEX IF NOT EXISTS idx_encaissements_encaisse_par
  ON encaissements(encaisse_par);

CREATE INDEX IF NOT EXISTS idx_encaissements_reservation_id
  ON encaissements(reservation_id);

CREATE INDEX IF NOT EXISTS idx_factures_emise_par
  ON factures(emise_par);

CREATE INDEX IF NOT EXISTS idx_factures_reservation_id
  ON factures(reservation_id);

CREATE INDEX IF NOT EXISTS idx_historique_actions_user_id
  ON historique_actions(user_id);

CREATE INDEX IF NOT EXISTS idx_reservations_created_by
  ON reservations(created_by);

CREATE INDEX IF NOT EXISTS idx_reservations_terrain_id
  ON reservations(terrain_id);
