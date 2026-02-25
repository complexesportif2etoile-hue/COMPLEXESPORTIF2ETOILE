/*
  # Fix RLS policies for factures and reservations

  1. Changes
    - `factures`: Update INSERT policy to allow all active authenticated users
    - `reservations`: Update UPDATE policy to allow all active authenticated users

  2. Reason
    - Users with role 'user' were blocked from creating invoices and updating reservations
    - All active authenticated users should have access to these operations
*/

-- Fix factures INSERT policy
DROP POLICY IF EXISTS "Staff can create factures" ON factures;

CREATE POLICY "Active users can create factures"
  ON factures
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE active = true
    )
  );

-- Fix reservations UPDATE policy
DROP POLICY IF EXISTS "Staff can update reservations" ON reservations;

CREATE POLICY "Active users can update reservations"
  ON reservations
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE active = true
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE active = true
    )
  );
