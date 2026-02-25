/*
  # Fix RLS policy performance - wrap auth functions in SELECT

  ## Summary
  Several RLS policies call auth.uid() directly, causing them to be re-evaluated
  for every row. Wrapping them in (select auth.uid()) causes the value to be
  computed once per query, greatly improving performance at scale.

  ## Tables affected
  - public.encaissements: "Active users can create encaissements"
  - public.factures: "Active users can create factures"
  - public.reservations: "Active users can update reservations"
  - public.clients: all 4 policies
*/

-- encaissements: fix INSERT policy
DROP POLICY IF EXISTS "Active users can create encaissements" ON public.encaissements;
CREATE POLICY "Active users can create encaissements"
  ON public.encaissements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.active = true
    )
  );

-- factures: fix INSERT policy
DROP POLICY IF EXISTS "Active users can create factures" ON public.factures;
CREATE POLICY "Active users can create factures"
  ON public.factures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.active = true
    )
  );

-- reservations: fix UPDATE policy
DROP POLICY IF EXISTS "Active users can update reservations" ON public.reservations;
CREATE POLICY "Active users can update reservations"
  ON public.reservations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.active = true
    )
  );

-- clients: fix all 4 policies
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON public.clients;
CREATE POLICY "Authenticated users can view all clients"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;
CREATE POLICY "Authenticated users can insert clients"
  ON public.clients
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
CREATE POLICY "Authenticated users can update clients"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Admin and manager can delete clients" ON public.clients;
CREATE POLICY "Admin and manager can delete clients"
  ON public.clients
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.role IN ('admin', 'manager')
    )
  );
