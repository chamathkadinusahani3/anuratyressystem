import { ROLE_PERMISSIONS } from "./roles";

export function hasPermission(role: string, permission: string) {
  return ROLE_PERMISSIONS[role]?.includes(permission);
}