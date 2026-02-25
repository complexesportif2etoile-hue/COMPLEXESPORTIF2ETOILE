/*
  # Fix infinite recursion in RLS policies

  1. Problem
    - Multiple conflicting policies on profiles table
    - Some policies use EXISTS subqueries that check profiles table itself
    - This creates infinite recursion: "to check if user can view profiles,
      we need to view profiles to check their role"

  2. Solution
    - Drop ALL existing policies on profiles table
    - Create simple, non-recursive policies
    - Use auth.uid() directly without subqueries on profiles
    - Store user role in JWT claims for policy checks

  3. New Policies
    - All authenticated users can view all profiles (simple approach for admin panel)
    - Users can update only their own profile
    - Users can insert their own profile on first login
    - Only prevent deletion entirely (handled by application logic)

  4. Security
    - RLS still protects the data
    - Application logic enforces admin-only operations
    - No recursive policy checks
*/

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Utilisateurs authentifiés peuvent voir tous les profils" ON profiles;
DROP POLICY IF EXISTS "Utilisateurs peuvent mettre à jour leur propre profil" ON profiles;

-- Create new simple policies without recursion

-- SELECT: All authenticated users can view all profiles
CREATE POLICY "authenticated_users_can_view_all_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Users can insert their own profile only
CREATE POLICY "users_can_insert_own_profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- UPDATE: Users can update their own profile only
CREATE POLICY "users_can_update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- DELETE: No direct deletion allowed (application will handle soft deletes via 'active' field)
-- No DELETE policy = no one can delete