/*
  # Activer le realtime sur la table clients

  1. Modifications
    - Ajout de la table `clients` a la publication realtime de Supabase
    - Permet aux abonnements realtime de recevoir les changements sur les clients

  2. Notes
    - Corrige un probleme ou les nouveaux clients crees depuis la page de reservation
      n'apparaissaient pas dans la liste des clients sans rafraichir la page
*/

ALTER PUBLICATION supabase_realtime ADD TABLE clients;
