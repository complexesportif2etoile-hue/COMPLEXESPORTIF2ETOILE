/*
  # Allow Public (Unauthenticated) Reservations

  ## Purpose
  Enable clients to create reservations via a public booking link without needing
  to log in. Also allows public read access to active terrains so the booking
  form can display available fields.

  ## Changes

  ### reservations table
  - Add INSERT policy for anonymous (unauthenticated) users so clients can book directly
  - The reservation is created with `created_by = NULL` (no authenticated user)

  ### terrains table
  - Add SELECT policy for anonymous users to read active terrains (needed to populate the booking form)

  ### clients table
  - Add INSERT policy for anonymous users so new clients can be auto-created during booking

  ## Security Notes
  - Anonymous users can ONLY insert reservations (no select/update/delete)
  - Anonymous users can ONLY read terrains where is_active = true
  - Anonymous users can ONLY insert clients (no read/update/delete)
  - Existing authenticated RLS policies are unchanged
*/

CREATE POLICY "Public can read active terrains"
  ON terrains FOR SELECT
  TO anon
  USING (is_active = true);

CREATE POLICY "Public can insert reservations"
  ON reservations FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can insert clients"
  ON clients FOR INSERT
  TO anon
  WITH CHECK (true);
