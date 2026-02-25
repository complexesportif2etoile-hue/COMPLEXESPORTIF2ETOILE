/*
  # Interdire les réservations dans le passé

  1. Modifications
    - Ajoute une fonction de validation pour empêcher les réservations avec une date_debut dans le passé
    - Ajoute un trigger BEFORE INSERT pour valider les nouvelles réservations
    - Ajoute une fonction pour empêcher le check-in avant l'heure de début

  2. Sécurité
    - Les réservations existantes ne sont pas affectées
    - Seules les nouvelles réservations sont validées
    - Le trigger empêche les créations de réservations passées au niveau de la base de données
*/

-- Fonction pour valider qu'une nouvelle réservation n'est pas dans le passé
CREATE OR REPLACE FUNCTION public.validate_reservation_not_in_past()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Vérifier que la date de début n'est pas dans le passé (avec une marge de 1 minute)
  IF NEW.date_debut < (NOW() - INTERVAL '1 minute') THEN
    RAISE EXCEPTION 'Impossible de créer une réservation pour une date passée';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger pour valider les nouvelles réservations (INSERT uniquement)
DROP TRIGGER IF EXISTS prevent_past_reservations ON public.reservations;
CREATE TRIGGER prevent_past_reservations
  BEFORE INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_reservation_not_in_past();

-- Fonction pour valider le changement de statut à check_in
CREATE OR REPLACE FUNCTION public.validate_checkin_time()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si le nouveau statut est check_in
  IF NEW.statut = 'check_in' AND OLD.statut != 'check_in' THEN
    -- Vérifier que l'heure actuelle est >= à l'heure de début (avec une marge de 5 minutes avant)
    IF NOW() < (NEW.date_debut - INTERVAL '5 minutes') THEN
      RAISE EXCEPTION 'Le check-in n''est possible qu''à partir de % (5 minutes avant)', 
        TO_CHAR(NEW.date_debut - INTERVAL '5 minutes', 'DD/MM/YYYY à HH24:MI');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger pour valider le check-in (UPDATE uniquement)
DROP TRIGGER IF EXISTS validate_checkin_before_update ON public.reservations;
CREATE TRIGGER validate_checkin_before_update
  BEFORE UPDATE OF statut ON public.reservations
  FOR EACH ROW
  WHEN (NEW.statut = 'check_in' AND OLD.statut != 'check_in')
  EXECUTE FUNCTION public.validate_checkin_time();