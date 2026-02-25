/*
  # Permettre aux admins de modifier tous les profils

  1. Problème
    - Les admins ne peuvent pas créer de nouveaux utilisateurs
    - La politique RLS actuelle ne permet de modifier que son propre profil
    - Erreur: "Database error saving new user" lors de la création

  2. Solution
    - Ajouter une politique permettant aux admins de mettre à jour tous les profils
    - Utiliser la fonction `is_admin()` SECURITY DEFINER pour éviter la récursion
    - Conserver la politique existante pour les utilisateurs normaux

  3. Sécurité
    - Seuls les admins actifs peuvent modifier les autres profils
    - Les utilisateurs non-admin peuvent toujours modifier leur propre profil
    - Utilise SECURITY DEFINER pour vérifier le rôle sans récursion
*/

-- Ajouter une politique permettant aux admins de mettre à jour tous les profils
CREATE POLICY "admins_can_update_all_profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());