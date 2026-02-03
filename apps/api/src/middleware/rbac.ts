import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';

type Role = 'ADMIN' | 'CEO' | 'CFO' | 'COO' | 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE';

const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 100,
  CEO: 100,
  CFO: 90,
  COO: 90,
  MANAGER: 70,
  TEAM_LEAD: 50,
  EMPLOYEE: 10,
};

export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const userRole = req.user.role as Role;

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: userRole
      });
      return;
    }

    next();
  };
}

export function requireMinRole(minRole: Role) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const userRole = req.user.role as Role;
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: minRole,
        current: userRole
      });
      return;
    }

    next();
  };
}

export function isManager(req: AuthenticatedRequest): boolean {
  if (!req.user) return false;
  const role = req.user.role as Role;
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.MANAGER;
}

export function isAdmin(req: AuthenticatedRequest): boolean {
  if (!req.user) return false;
  const role = req.user.role as Role;
  return ['ADMIN', 'CEO', 'CFO', 'COO'].includes(role);
}
