import { Role } from '../types';
import { env } from '../env';
import { getAuthRole } from '../store/authStore';

export function getRole(userId: string): Role {
  if (env.OWNER_ID && userId === env.OWNER_ID) return Role.OWNER;
  const authRole = getAuthRole(userId);
  if (authRole === 'admin') return Role.ADMIN;
  if (authRole === 'normal') return Role.USER;
  return Role.NONE;
}

export function hasRole(userId: string, min: Role): boolean {
  return getRole(userId) >= min;
}

export function isAuthorized(userId: string): boolean {
  return getRole(userId) >= Role.USER;
}

export function roleLabel(role: Role): string {
  switch (role) {
    case Role.OWNER: return 'Owner';
    case Role.ADMIN: return 'Admin';
    case Role.USER: return 'Normal';
    default: return 'None';
  }
}
