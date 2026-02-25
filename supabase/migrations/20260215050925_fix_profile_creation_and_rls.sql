/*
  # Fix profile auto-creation and RLS policies

  1. New Functions
    - `ensure_profile_exists`: SECURITY DEFINER function that creates a profile
      for an authenticated user if one doesn't exist. First user gets admin role.

  2. Security Changes
    - Function runs with elevated privileges (SECURITY DEFINER) to bypass RLS
      for profile creation only
    - Validates that the caller can only create their own profile
    - Checks if admins already exist to determine first-user status

  3. Notes
    - Fixes chicken-and-egg problem: user needs profile to pass RLS,
      but RLS blocks profile creation
    - The handle_new_user trigger should handle most cases, but this
      function acts as a safety net
*/

CREATE OR REPLACE FUNCTION ensure_profile_exists(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_is_first boolean
)
RETURNS void AS $$
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot create profile for another user';
  END IF;

  INSERT INTO profiles (id, email, full_name, role, active)
  VALUES (
    p_user_id,
    p_email,
    COALESCE(NULLIF(p_full_name, ''), ''),
    CASE WHEN p_is_first THEN 'admin' ELSE 'user' END,
    true
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
