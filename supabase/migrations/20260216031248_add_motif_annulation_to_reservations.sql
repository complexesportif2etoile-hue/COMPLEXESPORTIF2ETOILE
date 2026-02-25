/*
  # Ajouter motif d'annulation aux réservations

  1. Modifications
    - Ajoute une colonne `motif_annulation` à la table `reservations`
    - Cette colonne permet de stocker la raison d'une annulation

  2. Notes
    - La colonne est nullable car elle n'est utilisée que pour les réservations annulées
    - Type TEXT pour permettre des explications détaillées
*/

-- Ajouter la colonne motif_annulation si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'motif_annulation'
  ) THEN
    ALTER TABLE public.reservations 
    ADD COLUMN motif_annulation TEXT;
  END IF;
END $$;