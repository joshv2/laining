import { Role } from "@prisma/client";

export const ROLE_ORDER: Record<Role, number> = {
  USER: 0,
  TEACHER: 1,
  MODERATOR: 2,
  SUPERUSER: 3,
};

export function hasAtLeastRole(current: Role, required: Role): boolean {
  return ROLE_ORDER[current] >= ROLE_ORDER[required];
}

export function isModeratorOrAbove(role: Role): boolean {
  return hasAtLeastRole(role, Role.MODERATOR);
}

export function isTeacher(role: Role): boolean {
  return role === Role.TEACHER;
}

export function isSuperuser(role: Role): boolean {
  return role === Role.SUPERUSER;
}
