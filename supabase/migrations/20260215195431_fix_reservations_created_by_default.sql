/*
  # Fix reservations RLS issue - Add default for created_by
  
  ## Problem
  The INSERT policy on reservations requires `created_by = auth.uid()`, but the column
  has no default value, causing RLS violations when creating reservations.
  
  ## Solution
  Add a default value that automatically sets `created_by` to the current authenticated user.
  
  ## Changes
  1. Set default value for `created_by` column to `auth.uid()`
  2. This ensures the policy check passes automatically on insert
*/

-- Set default value for created_by to automatically use the authenticated user's ID
ALTER TABLE reservations 
  ALTER COLUMN created_by SET DEFAULT auth.uid();
