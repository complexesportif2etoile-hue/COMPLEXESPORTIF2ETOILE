/*
  # Drop unused indexes

  ## Summary
  The following indexes have never been used and add unnecessary overhead
  on write operations without providing any query performance benefit.

  ## Dropped Indexes
  - `idx_clients_phone` on public.clients
  - `idx_reservations_statut_pending` on public.reservations
*/

DROP INDEX IF EXISTS public.idx_clients_phone;
DROP INDEX IF EXISTS public.idx_reservations_statut_pending;
