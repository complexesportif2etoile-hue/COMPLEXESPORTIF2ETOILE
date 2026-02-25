/*
  # Document decision on "unused" indexes

  1. Context
    - Supabase reports several indexes as "unused"
    - This is expected for a new/development database
    - Indexes show usage only after queries are executed

  2. Analysis of Reported Unused Indexes
    - idx_reservations_terrain_id: KEEP - Essential for terrain -> reservations joins
    - idx_reservations_date_debut: KEEP - Critical for date-based calendar queries
    - idx_reservations_statut: KEEP - Frequently filtered by status
    - idx_encaissements_reservation_id: KEEP - Essential for payment lookups
    - idx_factures_reservation_id: KEEP - Essential for invoice lookups
    - idx_historique_user_id: KEEP - Common filter for audit logs
    - idx_historique_created_at: KEEP - Time-based queries for history
    - profiles_role_idx: KEEP - Role-based authorization checks
    - profiles_active_idx: KEEP - Filter active users
    - profiles_email_idx: KEEP - Email lookups for authentication
    - company_settings_updated_at_idx: CONSIDER REMOVING - Less likely to be queried by date

  3. Decision
    - Keep all indexes except company_settings_updated_at_idx
    - All are justified by expected query patterns
    - Will show usage once application is in production
    - Better to have them now than add later with table locks

  4. Action
    - Remove only company_settings_updated_at_idx
    - Monitor index usage in production
    - Remove others only if proven unnecessary after 30+ days
*/

-- Remove the one index that's truly unlikely to be used frequently
DROP INDEX IF EXISTS company_settings_updated_at_idx;

-- All other indexes are kept as they support common query patterns
-- They will show usage once the application receives real traffic