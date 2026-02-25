/*
  # Add missing foreign key indexes

  1. Performance Issue
    - Several foreign key columns lack covering indexes
    - This causes suboptimal query performance for joins and foreign key checks
    - PostgreSQL recommends indexes on all foreign key columns

  2. Solution
    - Add indexes for encaissements.encaisse_par
    - Add indexes for factures.emise_par
    - Add indexes for reservations.created_by

  3. Impact
    - Improves query performance for joins on these columns
    - Speeds up foreign key constraint validation
    - Reduces table scan costs
*/

-- Add index for encaissements.encaisse_par foreign key
CREATE INDEX IF NOT EXISTS idx_encaissements_encaisse_par 
  ON encaissements(encaisse_par);

-- Add index for factures.emise_par foreign key
CREATE INDEX IF NOT EXISTS idx_factures_emise_par 
  ON factures(emise_par);

-- Add index for reservations.created_by foreign key
CREATE INDEX IF NOT EXISTS idx_reservations_created_by 
  ON reservations(created_by);