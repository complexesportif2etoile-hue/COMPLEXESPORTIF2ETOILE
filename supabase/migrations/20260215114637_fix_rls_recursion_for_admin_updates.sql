/*
  # Fix RLS recursion for admin updates

  1. Problème
    - La fonction is_admin() cause une récursion RLS lors des UPDATE
    - Lors de la mise à jour d'un profil, PostgreSQL vérifie is_admin()
    - is_admin() fait un SELECT sur profiles, qui déclenche à nouveau les politiques RLS
    - Cela crée une boucle de récursion

  2. Solution
    - Remplacer la politique "admins_can_update_all_profiles" par une politique en ligne
    - Utiliser une sous-requête directe sans fonction intermédiaire
    - La sous-requête vérifie directement si l'utilisateur actuel est admin

  3. Sécurité
    - Les admins actifs peuvent mettre à jour tous les profils
    - Les utilisateurs normaux peuvent mettre à jour leur propre profil
    - Pas de récursion RLS
*/

-- Supprimer l'ancienne politique qui utilise is_admin()
DROP POLICY IF EXISTS "admins_can_update_all_profiles" ON profiles;

-- Supprimer l'ancienne politique pour les utilisateurs
DROP POLICY IF EXISTS "users_can_update_own_profile" ON profiles;

-- Créer une nouvelle politique combinée qui évite la récursion
CREATE POLICY "users_and_admins_can_update_profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    -- L'utilisateur peut mettre à jour son propre profil
    auth.uid() = id
    OR
    -- OU l'utilisateur est un admin actif (vérifié directement sans fonction)
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin' AND active = true
    )
  )
  WITH CHECK (
    -- Même logique pour WITH CHECK
    auth.uid() = id
    OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin' AND active = true
    )
  );