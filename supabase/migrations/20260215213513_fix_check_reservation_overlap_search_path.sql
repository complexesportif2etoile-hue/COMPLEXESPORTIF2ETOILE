/*
  # Fix mutable search_path on check_reservation_overlap

  1. Security Fix
    - Sets an immutable `search_path` on `check_reservation_overlap` to prevent
      search_path injection attacks
    - Path is set to `public` so the function always resolves tables correctly

  2. Important Notes
    - The function body is unchanged; only the search_path attribute is added
*/

CREATE OR REPLACE FUNCTION public.check_reservation_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.reservations
    WHERE terrain_id = NEW.terrain_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND statut NOT IN ('annulé', 'terminé')
      AND (
        (NEW.date_debut >= date_debut AND NEW.date_debut < date_fin)
        OR
        (NEW.date_fin > date_debut AND NEW.date_fin <= date_fin)
        OR
        (NEW.date_debut <= date_debut AND NEW.date_fin >= date_fin)
      )
  ) THEN
    RAISE EXCEPTION 'Une réservation existe déjà pour ce terrain durant cette période';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
