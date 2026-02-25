/*
  # Restrict overly permissive RLS policies

  1. Critical Security Issue
    - Several tables have RLS policies with "USING (true)" or "WITH CHECK (true)"
    - This effectively bypasses row-level security for authenticated users
    - Any authenticated user can INSERT/UPDATE any data without restrictions

  2. Affected Tables and Policies
    - encaissements: "Utilisateurs authentifiés peuvent créer des encaissements"
    - factures: "Utilisateurs authentifiés peuvent créer des factures"
    - historique_actions: "Système peut créer des entrées d'historique"
    - reservations: "Utilisateurs authentifiés peuvent créer des réservations"
    - reservations: "Utilisateurs authentifiés peuvent modifier des réservations"

  3. Solution
    - Replace permissive policies with role-based restrictions
    - Ensure proper authorization checks
    - Maintain audit trail with created_by/encaisse_par fields

  4. Security Model
    - Authenticated users can create reservations (they are customers)
    - Only staff (admin/manager/receptionist) can create encaissements
    - Only staff can create factures
    - System can create historique entries (keep permissive)
    - Only staff can update reservations
*/

-- ENCAISSEMENTS: Only staff can create payments
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent créer des encaissements" ON encaissements;
CREATE POLICY "Staff can create encaissements"
  ON encaissements FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) IN (
      SELECT id FROM profiles 
      WHERE role IN ('admin', 'manager', 'receptionist') 
      AND active = true
    )
  );

-- FACTURES: Only staff can create invoices
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent créer des factures" ON factures;
CREATE POLICY "Staff can create factures"
  ON factures FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) IN (
      SELECT id FROM profiles 
      WHERE role IN ('admin', 'manager', 'receptionist') 
      AND active = true
    )
  );

-- HISTORIQUE_ACTIONS: Keep permissive for system logging
-- This is intentionally permissive as it's an audit log
DROP POLICY IF EXISTS "Système peut créer des entrées d'historique" ON historique_actions;
CREATE POLICY "Authenticated users can log actions"
  ON historique_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can only log their own actions
    user_id = (select auth.uid())
  );

-- RESERVATIONS INSERT: Authenticated users (customers) can create reservations
-- This is acceptable as customers need to book reservations
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent créer des réservations" ON reservations;
CREATE POLICY "Authenticated users can create reservations"
  ON reservations FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must set themselves as created_by
    created_by = (select auth.uid())
  );

-- RESERVATIONS UPDATE: Only staff can modify reservations
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent modifier des réservations" ON reservations;
CREATE POLICY "Staff can update reservations"
  ON reservations FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) IN (
      SELECT id FROM profiles 
      WHERE role IN ('admin', 'manager', 'receptionist') 
      AND active = true
    )
  )
  WITH CHECK (
    (select auth.uid()) IN (
      SELECT id FROM profiles 
      WHERE role IN ('admin', 'manager', 'receptionist') 
      AND active = true
    )
  );