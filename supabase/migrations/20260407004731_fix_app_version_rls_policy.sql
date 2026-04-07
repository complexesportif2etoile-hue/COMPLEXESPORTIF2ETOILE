/*
  # Fix app_version RLS UPDATE policy

  ## Problem
  The "Authenticated users can update app version" policy uses USING (true) and WITH CHECK (true),
  which effectively bypasses row-level security for all authenticated users.

  ## Fix
  Restrict UPDATE access to admin role only, since app version updates should be
  a privileged operation. Regular authenticated users should not be able to modify the app version.
*/

DROP POLICY IF EXISTS "Authenticated users can update app version" ON public.app_version;

CREATE POLICY "Only admins can update app version"
  ON public.app_version
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
        AND profiles.role = 'admin'
    )
  );
