/*
  # Fonctions de gestion des permissions administrateur

  1. Nouvelles Fonctions
    - `promote_user_to_admin` - Promouvoir un utilisateur en administrateur
    - `ensure_first_user_is_admin` - S'assurer que le premier utilisateur est admin
    
  2. Sécurité
    - Seuls les admins existants peuvent promouvoir d'autres utilisateurs
    - Si aucun admin n'existe, le premier utilisateur authentifié peut se promouvoir
    
  3. Notes
    - Ces fonctions facilitent la gestion des permissions
    - Protection contre la suppression du dernier admin
*/

-- Fonction pour promouvoir un utilisateur en admin
CREATE OR REPLACE FUNCTION promote_user_to_admin(target_user_id uuid)
RETURNS boolean AS $$
DECLARE
  admin_count integer;
  current_user_role text;
BEGIN
  -- Compter le nombre d'admins existants
  SELECT COUNT(*) INTO admin_count 
  FROM profiles 
  WHERE role = 'admin' AND active = true;
  
  -- Vérifier le rôle de l'utilisateur actuel
  SELECT role INTO current_user_role 
  FROM profiles 
  WHERE id = auth.uid();
  
  -- Autoriser si:
  -- 1. L'utilisateur actuel est admin, OU
  -- 2. Il n'y a aucun admin et c'est la première promotion
  IF current_user_role = 'admin' OR admin_count = 0 THEN
    UPDATE profiles 
    SET role = 'admin', 
        active = true,
        updated_at = now()
    WHERE id = target_user_id;
    
    RETURN true;
  ELSE
    RAISE EXCEPTION 'Permission denied: Only admins can promote users';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour s'assurer que le premier utilisateur est admin
CREATE OR REPLACE FUNCTION ensure_first_user_is_admin()
RETURNS boolean AS $$
DECLARE
  admin_count integer;
  first_user_id uuid;
BEGIN
  -- Compter les admins
  SELECT COUNT(*) INTO admin_count 
  FROM profiles 
  WHERE role = 'admin';
  
  -- S'il n'y a pas d'admin, promouvoir le premier utilisateur
  IF admin_count = 0 THEN
    SELECT id INTO first_user_id 
    FROM profiles 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF first_user_id IS NOT NULL THEN
      UPDATE profiles 
      SET role = 'admin', 
          active = true,
          updated_at = now()
      WHERE id = first_user_id;
      
      RETURN true;
    END IF;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si l'utilisateur actuel est admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir les statistiques des rôles
CREATE OR REPLACE FUNCTION get_role_stats()
RETURNS TABLE(
  role_name text,
  user_count bigint,
  active_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    role::text as role_name,
    COUNT(*)::bigint as user_count,
    COUNT(*) FILTER (WHERE active = true)::bigint as active_count
  FROM profiles
  GROUP BY role
  ORDER BY role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accorder les permissions d'exécution
GRANT EXECUTE ON FUNCTION promote_user_to_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_first_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_role_stats() TO authenticated;
