/*
  # Fix reservations INSERT policy for authenticated users

  ## Problem
  The INSERT policy "Authenticated users can create reservations" checks
  `created_by = (select auth.uid())` but column defaults are applied AFTER
  RLS checks, so when created_by is omitted from the payload it is NULL at
  check time and the policy rejects the row.

  ## Fix
  Allow the insert when created_by is NULL (will be filled by column default)
  OR when it explicitly matches the authenticated user's id.
*/

DROP POLICY IF EXISTS "Authenticated users can create reservations" ON public.reservations;

CREATE POLICY "Authenticated users can create reservations"
  ON public.reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (created_by IS NULL OR created_by = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.active = true
    )
  );
