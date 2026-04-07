/*
  # Fix depenses RLS policies - Auth initialization plan optimization

  ## Changes
  - Drop and recreate the 3 affected RLS policies on `depenses`
  - Replace `auth.uid()` with `(select auth.uid())` in all policies
  - This ensures auth functions are evaluated once per query, not once per row
  - Significant performance improvement at scale

  ## Affected policies
  1. Admins and managers can delete depenses
  2. Admins and managers can insert depenses
  3. Admins and managers can update depenses
*/

DROP POLICY IF EXISTS "Admins and managers can delete depenses" ON public.depenses;
DROP POLICY IF EXISTS "Admins and managers can insert depenses" ON public.depenses;
DROP POLICY IF EXISTS "Admins and managers can update depenses" ON public.depenses;

CREATE POLICY "Admins and managers can delete depenses"
  ON public.depenses
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.role = ANY (ARRAY['admin'::text, 'manager'::text])
    )
  );

CREATE POLICY "Admins and managers can insert depenses"
  ON public.depenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.role = ANY (ARRAY['admin'::text, 'manager'::text])
    )
  );

CREATE POLICY "Admins and managers can update depenses"
  ON public.depenses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.role = ANY (ARRAY['admin'::text, 'manager'::text])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.role = ANY (ARRAY['admin'::text, 'manager'::text])
    )
  );
