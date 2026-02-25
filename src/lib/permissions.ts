export type Permission =
  | 'view_dashboard'
  | 'view_calendar'
  | 'view_terrains'
  | 'manage_terrains'
  | 'view_clients'
  | 'manage_clients'
  | 'delete_clients'
  | 'view_reservations'
  | 'manage_reservations'
  | 'cancel_reservations'
  | 'view_rapports'
  | 'view_payments'
  | 'manage_payments'
  | 'view_backup';

export type OperationalRole = 'manager' | 'receptionist' | 'user';

export interface PermissionDefinition {
  key: Permission;
  label: string;
  description: string;
  group: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: 'view_dashboard', label: 'Voir le tableau de bord', description: 'Accès à la page principale avec statistiques', group: 'Tableau de bord' },
  { key: 'view_calendar', label: 'Voir le calendrier', description: 'Accès au calendrier des réservations', group: 'Calendrier' },
  { key: 'view_terrains', label: 'Voir les terrains', description: 'Accès à la liste des terrains', group: 'Terrains' },
  { key: 'manage_terrains', label: 'Gérer les terrains', description: 'Créer, modifier et supprimer des terrains', group: 'Terrains' },
  { key: 'view_clients', label: 'Voir les clients', description: 'Accès à la liste des clients', group: 'Clients' },
  { key: 'manage_clients', label: 'Gérer les clients', description: 'Créer et modifier des clients', group: 'Clients' },
  { key: 'delete_clients', label: 'Supprimer des clients', description: 'Supprimer des fiches clients', group: 'Clients' },
  { key: 'view_reservations', label: 'Voir les réservations', description: 'Accès à la liste des réservations', group: 'Réservations' },
  { key: 'manage_reservations', label: 'Gérer les réservations', description: 'Créer et modifier des réservations', group: 'Réservations' },
  { key: 'cancel_reservations', label: 'Annuler des réservations', description: 'Annuler et bloquer des réservations', group: 'Réservations' },
  { key: 'view_rapports', label: 'Voir les rapports', description: 'Accès aux statistiques et rapports', group: 'Rapports' },
  { key: 'view_payments', label: 'Voir les paiements', description: 'Accès à la liste des paiements', group: 'Paiements' },
  { key: 'manage_payments', label: 'Gérer les paiements', description: 'Enregistrer et modifier des paiements', group: 'Paiements' },
  { key: 'view_backup', label: 'Sauvegarde & Restauration', description: 'Accès à la page de sauvegarde', group: 'Administration' },
];

export const MENU_PERMISSION_MAP: Record<string, Permission> = {
  dashboard: 'view_dashboard',
  calendar: 'view_calendar',
  terrains: 'view_terrains',
  clients: 'view_clients',
  reservations: 'view_reservations',
  rapports: 'view_rapports',
  payments: 'view_payments',
  backup: 'view_backup',
};

export type RolePermissionsMap = Record<Permission, boolean>;

export function hasPermission(
  role: string,
  permission: Permission,
  rolePermissions: RolePermissionsMap | null
): boolean {
  if (role === 'admin') return true;
  if (!rolePermissions) return false;
  return rolePermissions[permission] === true;
}
