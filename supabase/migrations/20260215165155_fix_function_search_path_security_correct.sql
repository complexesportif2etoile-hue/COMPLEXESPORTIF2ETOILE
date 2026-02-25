/*
  # Fix function search_path security issues

  1. Security Issue
    - Functions with role mutable search_path are vulnerable to search_path attacks
    - Malicious users can manipulate schema search order
    - This can lead to function hijacking and privilege escalation

  2. Solution
    - Add `SET search_path = public` to all SECURITY DEFINER functions
    - This locks the search path to public schema only
    - Prevents search_path manipulation attacks

  3. Affected Functions
    - ensure_profile_exists (2 overloads)
    - auto_complete_reservation_on_full_payment
    - update_updated_at_column
    - handle_new_user
    - get_role_stats
    - promote_user_to_admin
    - ensure_first_user_is_admin
    - is_admin

  4. Security Impact
    - Prevents schema injection attacks
    - Ensures functions always reference correct schema
    - Maintains SECURITY DEFINER safety
*/

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix handle_new_user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count integer;
BEGIN
  -- Count existing profiles
  SELECT COUNT(*) INTO user_count FROM profiles;
  
  -- Insert new profile
  INSERT INTO profiles (id, email, full_name, role, active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    -- First user becomes admin, others are regular users
    CASE WHEN user_count = 0 THEN 'admin' ELSE 'user' END,
    true
  );
  
  RETURN NEW;
END;
$$;

-- Fix is_admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_user_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND active = true
  ) INTO is_user_admin;
  
  RETURN COALESCE(is_user_admin, false);
END;
$$;

-- Fix auto_complete_reservation_on_full_payment
CREATE OR REPLACE FUNCTION auto_complete_reservation_on_full_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_paid numeric;
  reservation_total numeric;
BEGIN
  -- Get total amount paid for this reservation
  SELECT COALESCE(SUM(montant_total), 0)
  INTO total_paid
  FROM encaissements
  WHERE reservation_id = NEW.reservation_id;
  
  -- Get reservation total
  SELECT montant_ttc
  INTO reservation_total
  FROM reservations
  WHERE id = NEW.reservation_id;
  
  -- If fully paid, update status
  IF total_paid >= reservation_total THEN
    UPDATE reservations
    SET statut = 'check_in'
    WHERE id = NEW.reservation_id
    AND statut = 'réservé';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix get_role_stats - drop and recreate with correct signature
DROP FUNCTION IF EXISTS get_role_stats();
CREATE FUNCTION get_role_stats()
RETURNS TABLE(role_name text, user_count bigint, active_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.role,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE p.active = true)::bigint
  FROM profiles p
  GROUP BY p.role;
END;
$$;

-- Fix promote_user_to_admin - drop and recreate with correct signature
DROP FUNCTION IF EXISTS promote_user_to_admin(uuid);
CREATE FUNCTION promote_user_to_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to promote users
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND active = true
  ) THEN
    RETURN false;
  END IF;
  
  UPDATE profiles
  SET role = 'admin'
  WHERE id = target_user_id;
  
  RETURN true;
END;
$$;

-- Fix ensure_first_user_is_admin - returns boolean
CREATE OR REPLACE FUNCTION ensure_first_user_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM profiles;
  RETURN (user_count = 0);
END;
$$;

-- Fix ensure_profile_exists (3 params)
DROP FUNCTION IF EXISTS ensure_profile_exists(uuid, text, text);
CREATE FUNCTION ensure_profile_exists(p_user_id uuid, p_email text, p_full_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, active)
  VALUES (
    p_user_id,
    p_email,
    p_full_name,
    'user',
    true
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Fix ensure_profile_exists (4 params)
DROP FUNCTION IF EXISTS ensure_profile_exists(uuid, text, text, boolean);
CREATE FUNCTION ensure_profile_exists(p_user_id uuid, p_email text, p_full_name text, p_is_first boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, active)
  VALUES (
    p_user_id,
    p_email,
    p_full_name,
    CASE WHEN p_is_first THEN 'admin' ELSE 'user' END,
    true
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;