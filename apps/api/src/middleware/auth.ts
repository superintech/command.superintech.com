import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JWTPayload } from '../lib/jwt.js';
import prisma from '../lib/prisma.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    departmentId: string | null;
  };
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];

    let payload: JWTPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        departmentId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ success: false, error: 'User not found or inactive' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, error: 'Authentication error' });
  }
}

export function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  authenticate(req, res, next);
}
