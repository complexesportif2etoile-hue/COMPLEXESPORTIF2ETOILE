/*
  # Optimize RLS policies with SELECT wrapper for auth.uid()

  1. Performance Issue
    - Multiple RLS policies re-evaluate auth.uid() for each row
    - This causes significant performance degradation at scale
    - Each row scan triggers a new auth.uid() call

  2. Solution
    - Replace `auth.uid()` with `(select auth.uid())` in all policies
    - This evaluates auth.uid() once and caches the result
    - Dramatically improves query performance for large datasets

  3. Affected Tables
    - profiles (2 policies)
    - terrains (3 policies)
    - reservations (1 policy)
    - configuration (1 policy)
    - company_settings (3 policies)

  4. Security
    - Maintains exact same security model
    - Only optimizes the evaluation strategy
*/

-- PROFILES TABLE
-- Drop and recreate optimized policies

DROP POLICY IF EXISTS "users_and_admins_can_insert_profiles" ON profiles;
CREATE POLICY "users_and_admins_can_insert_profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = id
    OR
    (select auth.uid()) IN (
      SELECT id FROM profiles WHERE role = 'admin' AND active = true
    )
  );

DROP POLICY IF EXISTS "users_and_admins_can_update_profiles" ON profiles;
CREATE POLICY "users_and_admins_can_update_profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = id
    OR
    (select auth.uid()) IN (
      SELECT id FROM profiles WHERE role = 'admin' AND active = true
    )
  )
  WITH CHECK (
    (select auth.uid()) = id
    OR
    (select auth.uid()) IN (
      SELECT id FROM profiles WHERE role = 'admin' AND active = true
    )
  );

-- TERRAINS TABLE
-- Optimize existing policies

DROP POLICY IF EXISTS "Admins et managers peuvent créer des terrains" ON terrains;
CREATE POLICY "Admins et managers peuvent créer des terrains"
  ON terrains FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Admins et managers peuvent modifier des terrains" ON terrains;
CREATE POLICY "Admins et managers peuvent modifier des terrains"
  ON terrains FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role IN ('admin', 'manager')
    )
  );

DROP POLICY IF EXISTS "Seuls les admins peuvent supprimer des terrains" ON terrains;
CREATE POLICY "Seuls les admins peuvent supprimer des terrains"
  ON terrains FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- RESERVATIONS TABLE

DROP POLICY IF EXISTS "Admins peuvent supprimer des réservations" ON reservations;
CREATE POLICY "Admins peuvent supprimer des réservations"
  ON reservations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- CONFIGURATION TABLE

DROP POLICY IF EXISTS "Admins peuvent modifier la configuration" ON configuration;
CREATE POLICY "Admins peuvent modifier la configuration"
  ON configuration FOR UPDATE
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

-- COMPANY_SETTINGS TABLE (if exists)

DROP POLICY IF EXISTS "Admins can insert settings" ON company_settings;
CREATE POLICY "Admins can insert settings"
  ON company_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update settings" ON company_settings;
CREATE POLICY "Admins can update settings"
  ON company_settings FOR UPDATE
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

DROP POLICY IF EXISTS "Admins can delete settings" ON company_settings;
CREATE POLICY "Admins can delete settings"
  ON company_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'admin'
    )
  );