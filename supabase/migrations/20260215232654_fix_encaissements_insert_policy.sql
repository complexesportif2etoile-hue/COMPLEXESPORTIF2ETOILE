/*
  # Fix encaissements INSERT RLS policy

  1. Changes
    - Drop the existing "Staff can create encaissements" policy which restricts inserts
      to admin/manager/receptionist roles only
    - Create a new policy that allows ALL active authenticated users to insert payments
  
  2. Reason
    - Users with role 'user' were blocked from recording payments
    - All active authenticated users should be able to record encaissements
*/

DROP POLICY IF EXISTS "Staff can create encaissements" ON encaissements;

CREATE POLICY "Active users can create encaissements"
  ON encaissements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE active = true
    )
  );
