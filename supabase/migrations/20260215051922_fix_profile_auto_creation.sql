/*
  # Fix automatic profile creation

  1. Updates
    - Modify `ensure_profile_exists` function to check for existing admins internally
    - Function no longer requires `p_is_first` parameter
    - Uses SECURITY DEFINER to bypass RLS when checking for admins

  2. Security
    - Function validates caller can only create their own profile
    - Safely checks admin count without RLS blocking
    - First user automatically becomes admin

  3. Notes
    - Fixes infinite loading issue when profile doesn't exist
    - Removes client-side RLS permission error
*/

CREATE OR REPLACE FUNCTION ensure_profile_exists(
  p_user_id uuid,
  p_email text,
  p_full_name text
)
RETURNS void AS $$
DECLARE
  admin_count integer;
BEGIN
  -- Verify caller is creating their own profile
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot create profile for another user';
  END IF;

  -- Check if any admins exist (SECURITY DEFINER bypasses RLS)
  SELECT COUNT(*) INTO admin_count 
  FROM profiles 
  WHERE role = 'admin';

  -- Insert profile if it doesn't exist
  INSERT INTO profiles (id, email, full_name, role, active)
  VALUES (
    p_user_id,
    p_email,
    COALESCE(NULLIF(p_full_name, ''), ''),
    CASE WHEN admin_count = 0 THEN 'admin' ELSE 'user' END,
    true
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
