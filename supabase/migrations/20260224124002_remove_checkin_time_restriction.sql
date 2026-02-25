/*
  # Supprimer la restriction temporelle sur le check-in

  1. Problème
     - Le trigger `validate_checkin_time` empêche le passage en check_in
       plus de 5 minutes avant la date de début
     - Le trigger `auto_complete_reservation_on_full_payment` tente de passer
       en check_in lors d'un paiement complet, ce qui échoue si la date n'est
       pas encore venue, bloquant l'enregistrement du paiement
  
  2. Solution
     - Supprimer la restriction temporelle dans `validate_checkin_time`
       pour permettre le check-in et le règlement à n'importe quel moment
*/

CREATE OR REPLACE FUNCTION validate_checkin_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;
