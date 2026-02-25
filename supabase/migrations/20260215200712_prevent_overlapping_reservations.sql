/*
  # Prevent Overlapping Reservations
  
  ## Purpose
  Prevents multiple reservations from overlapping on the same terrain during the same time period.
  
  ## Changes
  1. Creates a function to check for overlapping reservations
  2. Adds a trigger to validate reservations before insert/update
  3. Ensures data integrity by preventing double-bookings
  
  ## How it Works
  Two time periods overlap if:
  - The new reservation starts during an existing reservation
  - The new reservation ends during an existing reservation
  - The new reservation completely contains an existing reservation
*/

-- Function to check for overlapping reservations
CREATE OR REPLACE FUNCTION check_reservation_overlap()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if there's any overlapping reservation for the same terrain
  IF EXISTS (
    SELECT 1 
    FROM reservations 
    WHERE terrain_id = NEW.terrain_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND statut NOT IN ('annulé', 'terminé')
      AND (
        -- New reservation starts during existing reservation
        (NEW.date_debut >= date_debut AND NEW.date_debut < date_fin)
        OR
        -- New reservation ends during existing reservation
        (NEW.date_fin > date_debut AND NEW.date_fin <= date_fin)
        OR
        -- New reservation completely contains existing reservation
        (NEW.date_debut <= date_debut AND NEW.date_fin >= date_fin)
      )
  ) THEN
    RAISE EXCEPTION 'Une réservation existe déjà pour ce terrain durant cette période';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to check overlaps before insert or update
DROP TRIGGER IF EXISTS check_reservation_overlap_trigger ON reservations;
CREATE TRIGGER check_reservation_overlap_trigger
  BEFORE INSERT OR UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION check_reservation_overlap();
