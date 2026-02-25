/*
  # Fix Security Issues and Performance

  1. Add covering index for payments.validated_by foreign key (unindexed FK)
  2. Fix deposit_settings INSERT/UPDATE RLS policies to use (select auth.uid())
     to avoid per-row re-evaluation of auth functions
  3. Fix payments UPDATE policy - restrict to admins only (was always-true)
  4. Remove duplicate permissive INSERT policy on reservations for anon role
  5. Drop unused indexes to reduce write overhead
*/

-- 1. Add covering index for payments.validated_by foreign key
CREATE INDEX IF NOT EXISTS idx_payments_validated_by ON public.payments(validated_by);

-- 2. Fix deposit_settings RLS - use (select auth.uid()) pattern
DROP POLICY IF EXISTS "Admins can insert deposit settings" ON public.deposit_settings;
DROP POLICY IF EXISTS "Admins can update deposit settings" ON public.deposit_settings;

CREATE POLICY "Admins can insert deposit settings"
  ON public.deposit_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
        AND profiles.active = true
    )
  );

CREATE POLICY "Admins can update deposit settings"
  ON public.deposit_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
        AND profiles.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
        AND profiles.active = true
    )
  );

-- 3. Fix payments UPDATE policy - was always true, restrict to authenticated admins
DROP POLICY IF EXISTS "Authenticated can update payments" ON public.payments;

CREATE POLICY "Authenticated can update payments"
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role IN ('admin', 'manager')
        AND profiles.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role IN ('admin', 'manager')
        AND profiles.active = true
    )
  );

-- 4. Remove the less restrictive duplicate anon INSERT policy on reservations
DROP POLICY IF EXISTS "Public can insert reservations" ON public.reservations;

-- 5. Drop unused indexes
DROP INDEX IF EXISTS public.idx_reservations_payment_status;
DROP INDEX IF EXISTS public.idx_payments_reservation_id;
DROP INDEX IF EXISTS public.idx_payments_status;
DROP INDEX IF EXISTS public.idx_payments_provider;
DROP INDEX IF EXISTS public.idx_reservations_code_court;
DROP INDEX IF EXISTS public.idx_encaissements_encaisse_par;
DROP INDEX IF EXISTS public.idx_encaissements_reservation_id;
DROP INDEX IF EXISTS public.idx_factures_emise_par;
DROP INDEX IF EXISTS public.idx_factures_reservation_id;
DROP INDEX IF EXISTS public.idx_historique_actions_user_id;
DROP INDEX IF EXISTS public.idx_reservations_created_by;
DROP INDEX IF EXISTS public.idx_reservations_terrain_id;
