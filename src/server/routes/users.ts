import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.ts';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.ts';

const router = Router();

// Get all users
router.get('/', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  try {
    const users = db.prepare('SELECT id, username, role, departments FROM users').all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: '服务器错误' });
  }
});

// Get departments list for reference
router.get('/departments', authenticate, requireAdmin, (req, res) => {
  try {
    const departments = db.prepare('SELECT name FROM departments ORDER BY name ASC').all();
    res.json(departments);
  } catch (err) {
    res.status(500).json({ message: '获取部门失败' });
  }
});

// Get organizations list for reference
router.get('/organizations', authenticate, requireAdmin, (req, res) => {
  try {
    const organizations = db.prepare('SELECT name FROM organizations ORDER BY name ASC').all();
    res.json(organizations);
  } catch (err) {
    res.status(500).json({ message: '获取组织失败' });
  }
});

// Create user
router.post('/', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  const { username, password, role, departments } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ message: '请填写完整信息' });
  }

  try {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    
    const result = db.prepare('INSERT INTO users (username, password_hash, role, departments) VALUES (?, ?, ?, ?)')
      .run(username, hash, role, departments || '');
      
    res.status(201).json({ id: result.lastInsertRowid, username, role, departments });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      res.status(400).json({ message: '用户名已存在' });
    } else {
      res.status(500).json({ message: '服务器错误' });
    }
  }
});

// Update user info (role, departments)
router.put('/:id', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { role, departments } = req.body;

  try {
    db.prepare('UPDATE users SET role = ?, departments = ? WHERE id = ?')
      .run(role, departments || '', id);
    res.json({ message: '更新成功' });
  } catch (err) {
    res.status(500).json({ message: '服务器错误' });
  }
});

// Reset password
router.post('/:id/reset-password', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!password) return res.status(400).json({ message: '请指定新密码' });

  try {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(hash, id);
    res.json({ message: '密码已重置' });
  } catch (err) {
    res.status(500).json({ message: '服务器错误' });
  }
});

// Delete user
router.delete('/:id', authenticate, requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  if (Number(id) === req.user?.id) {
    return res.status(400).json({ message: '不能删除自己' });
  }

  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ message: '服务器错误' });
  }
});

export default router;
