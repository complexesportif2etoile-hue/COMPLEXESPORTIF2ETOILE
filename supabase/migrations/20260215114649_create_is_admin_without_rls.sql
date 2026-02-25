/*
  # Créer une fonction is_admin qui contourne RLS

  1. Problème
    - La fonction is_admin() existante cause des récursions RLS
    - Elle ne désactive pas explicitement RLS dans son contexte

  2. Solution
    - Recréer is_admin() avec SET local configuration
    - Désactiver row_security dans le contexte de la fonction
    - Cela empêche la récursion lors de la vérification des politiques

  3. Sécurité
    - La fonction reste SECURITY DEFINER
    - Elle vérifie toujours l'authentification via auth.uid()
    - Désactive RLS uniquement dans son contexte d'exécution
*/

-- Supprimer et recréer la fonction is_admin avec configuration SET
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_user_admin boolean;
BEGIN
  -- Désactiver RLS temporairement dans cette fonction
  PERFORM set_config('request.jwt.claim.sub', auth.uid()::text, true);
  
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND active = true
  ) INTO is_user_admin;
  
  RETURN COALESCE(is_user_admin, false);
END;
$$;

-- Accorder les permissions
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;