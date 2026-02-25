/*
  # Restrict overly permissive public INSERT policies

  ## Summary
  The public INSERT policies on `clients` and `reservations` previously used
  `WITH CHECK (true)`, allowing anonymous users to insert any data without
  restriction. This migration replaces them with constrained policies that
  limit what anonymous users can insert.

  ## Changes

  ### public.reservations - "Public can insert reservations"
  Restricts anonymous inserts to only reservations where:
  - `statut` is exactly 'en_attente' (pending approval, not confirmed/blocked)
  - `created_by` is NULL (not impersonating a staff member)

  ### public.clients - "Public can insert clients"
  Restricts anonymous inserts to only clients where:
  - `name` is non-empty
  - `phone` is non-empty
  This prevents inserting empty/junk client records.
*/

-- reservations: restrict public INSERT to pending-only with no staff impersonation
DROP POLICY IF EXISTS "Public can insert reservations" ON public.reservations;
CREATE POLICY "Public can insert reservations"
  ON public.reservations
  FOR INSERT
  TO anon
  WITH CHECK (
    statut = 'en_attente'
    AND created_by IS NULL
  );

-- clients: restrict public INSERT to non-empty name and phone
DROP POLICY IF EXISTS "Public can insert clients" ON public.clients;
CREATE POLICY "Public can insert clients"
  ON public.clients
  FOR INSERT
  TO anon
  WITH CHECK (
    name <> ''
    AND phone <> ''
  );
