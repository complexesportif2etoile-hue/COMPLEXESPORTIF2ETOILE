/*
  # Fix role_permissions RLS policies and drop unused indexes

  ## Changes

  ### 1. RLS Performance Fix
  Replaces `auth.uid()` with `(select auth.uid())` in all role_permissions policies.
  This prevents re-evaluation of the auth function for every row, improving query performance.

  ### 2. Multiple Permissive SELECT Policies Fix
  Drops both existing SELECT policies and replaces them with a single consolidated policy
  that covers both admin and own-role access. Having multiple permissive policies for the
  same role/action forces Postgres to evaluate all of them per row.

  ### 3. Drop Unused Indexes
  Removes indexes that have never been used and only consume storage/maintenance overhead:
  - `idx_payments_validated_by` on payments
  - `role_permissions_permission_idx` on role_permissions
*/

-- Drop all existing role_permissions policies to rebuild them correctly
DROP POLICY IF EXISTS "Authenticated users can read own role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Admins can view role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Admins can insert role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Admins can update role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Admins can delete role_permissions" ON public.role_permissions;

-- Single consolidated SELECT policy (replaces two permissive policies)
CREATE POLICY "Users can read own or admin can read all role_permissions"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (
    role = (
      SELECT p.role FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      LIMIT 1
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  );

-- INSERT policy with (select auth.uid())
CREATE POLICY "Admins can insert role_permissions"
  ON public.role_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  );

-- UPDATE policy with (select auth.uid())
CREATE POLICY "Admins can update role_permissions"
  ON public.role_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  );

-- DELETE policy with (select auth.uid())
CREATE POLICY "Admins can delete role_permissions"
  ON public.role_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    )
  );

-- Drop unused indexes
DROP INDEX IF EXISTS public.idx_payments_validated_by;
DROP INDEX IF EXISTS public.role_permissions_permission_idx;
