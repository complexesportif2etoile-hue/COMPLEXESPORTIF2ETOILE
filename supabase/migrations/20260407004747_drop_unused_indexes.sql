/*
  # Drop unused indexes

  ## Changes
  Remove indexes that have never been used and are only adding write overhead:

  - `idx_payments_reservation_id` on `public.payments`
  - `idx_factures_emise_par` on `public.factures`
  - `idx_historique_actions_user_id` on `public.historique_actions`
  - `depenses_categorie_idx` on `public.depenses`

  Note: These indexes were reported as unused. Dropping them reduces storage and
  improves INSERT/UPDATE performance. They can be recreated if query patterns change.
*/

DROP INDEX IF EXISTS public.idx_payments_reservation_id;
DROP INDEX IF EXISTS public.idx_factures_emise_par;
DROP INDEX IF EXISTS public.idx_historique_actions_user_id;
DROP INDEX IF EXISTS public.depenses_categorie_idx;
