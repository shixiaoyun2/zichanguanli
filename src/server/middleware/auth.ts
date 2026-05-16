import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'assets-inventory-secret-change-me';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: 'admin' | 'operator';
    departments?: string;
    deptIds?: number[];
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: '未授权' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Always fetch latest role and departments from DB to ensure RBAC is up to date
    try {
      const user = db.prepare('SELECT role, departments FROM users WHERE id = ?').get(decoded.id) as any;
      if (user) {
        decoded.role = user.role;
        decoded.departments = user.departments;
      }
    } catch (dbErr) {
      console.error('Auth DB sync failed:', dbErr);
    }
    
    // Parse department IDs if present
    if (decoded.departments) {
      decoded.deptIds = decoded.departments
        .split(',')
        .map((s: string) => parseInt(s.trim()))
        .filter((n: number) => !isNaN(n));
    } else {
      decoded.deptIds = [];
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: '无效 Token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: '权限不足，仅限管理员' });
  }
  next();
};
