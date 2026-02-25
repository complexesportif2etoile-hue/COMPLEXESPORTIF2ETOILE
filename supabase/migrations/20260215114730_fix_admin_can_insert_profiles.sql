/*
  # Permettre aux admins d'insérer des profils pour nouveaux utilisateurs

  1. Problème Principal
    - Quand un admin crée un nouvel utilisateur via auth.signUp()
    - Le trigger "on_auth_user_created" essaie d'insérer dans la table profiles
    - La politique RLS actuelle : "WITH CHECK (auth.uid() = id)"
    - Cette politique bloque l'insertion car auth.uid() (admin) != id (nouvel utilisateur)
    - Résultat: "Database error saving new user"

  2. Solution
    - Supprimer l'ancienne politique INSERT restrictive
    - Créer une nouvelle politique qui permet:
      a) Aux utilisateurs d'insérer leur propre profil
      b) Aux admins d'insérer des profils pour d'autres utilisateurs

  3. Sécurité
    - Les utilisateurs normaux peuvent seulement créer leur propre profil
    - Les admins peuvent créer des profils pour n'importe qui
    - Vérifié via sous-requête directe pour éviter la récursion
*/

-- Supprimer l'ancienne politique INSERT
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON profiles;

-- Créer une nouvelle politique qui permet aux admins d'insérer des profils
CREATE POLICY "users_and_admins_can_insert_profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    -- L'utilisateur peut insérer son propre profil
    auth.uid() = id
    OR
    -- OU l'utilisateur est un admin actif
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin' AND active = true
    )
  );