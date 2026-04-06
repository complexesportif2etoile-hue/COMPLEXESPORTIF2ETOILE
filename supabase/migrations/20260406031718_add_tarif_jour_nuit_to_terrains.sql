/*
  # Ajouter tarifs jour et nuit aux terrains

  ## Modifications
  - Table `terrains` : ajout de 4 nouvelles colonnes
    - `tarif_jour` (numeric) : tarif pour le créneau journée (ex: 08h00 - 18h00)
    - `tarif_nuit` (numeric) : tarif pour le créneau nuit (ex: 18h00 - 06h00)
    - `heure_debut_jour` (time) : heure de début du créneau journée, défaut 08:00
    - `heure_debut_nuit` (time) : heure de début du créneau nuit, défaut 18:00

  ## Notes
  - Les colonnes sont nullable pour compatibilité avec l'existant
  - tarif_horaire reste présent comme tarif de fallback
  - Les valeurs par défaut reflètent les créneaux typiques d'un complexe sportif
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'terrains' AND column_name = 'tarif_jour'
  ) THEN
    ALTER TABLE terrains ADD COLUMN tarif_jour numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'terrains' AND column_name = 'tarif_nuit'
  ) THEN
    ALTER TABLE terrains ADD COLUMN tarif_nuit numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'terrains' AND column_name = 'heure_debut_jour'
  ) THEN
    ALTER TABLE terrains ADD COLUMN heure_debut_jour time DEFAULT '08:00:00';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'terrains' AND column_name = 'heure_debut_nuit'
  ) THEN
    ALTER TABLE terrains ADD COLUMN heure_debut_nuit time DEFAULT '18:00:00';
  END IF;
END $$;
