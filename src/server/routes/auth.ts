import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.ts';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'assets-inventory-secret-change-me';

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

    if (!user) {
      return res.status(401).json({ message: '用户不存在' });
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: '密码错误' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, departments: user.departments },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        departments: user.departments
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: '未登录' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = db.prepare('SELECT id, username, role, departments FROM users WHERE id = ?').get(decoded.id) as any;
    if (!user) return res.status(401).json({ message: '用户不存在' });
    res.json({ user });
  } catch (err) {
    res.status(401).json({ message: '无效 Token' });
  }
});

export default router;
