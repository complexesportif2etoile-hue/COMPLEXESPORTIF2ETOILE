/*
  # Autoriser le check-in 10 minutes avant l'heure de début

  1. Modification
     - La fonction `validate_checkin_time` est mise à jour pour autoriser
       le check-in à partir de 10 minutes avant l'heure de début de la réservation
*/

CREATE OR REPLACE FUNCTION validate_checkin_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.statut = 'check_in' AND OLD.statut != 'check_in' THEN
    IF NOW() < (NEW.date_debut - INTERVAL '10 minutes') THEN
      RAISE EXCEPTION 'Le check-in n''est possible qu''à partir de % (10 minutes avant)',
        TO_CHAR(NEW.date_debut - INTERVAL '10 minutes', 'DD/MM/YYYY à HH24:MI');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
