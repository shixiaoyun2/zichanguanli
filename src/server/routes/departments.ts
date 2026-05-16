import { Router } from 'express';
import db from '../db.ts';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.ts';

const router = Router();

// GET all departments (Available to all authenticated users for display translation)
router.get('/', authenticate, (req: AuthRequest, res) => {
  try {
    const departments = db.prepare('SELECT id, name FROM departments ORDER BY name ASC').all();
    res.json(departments);
  } catch (err) {
    res.status(500).json({ message: '获取部门失败' });
  }
});

// CREATE department (Admin only)
router.post('/', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: '部门名称不能为空' });

  try {
    const result = db.prepare('INSERT INTO departments (name) VALUES (?)').run(name);
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ message: '部门名称已存在' });
    }
    res.status(500).json({ message: '服务器错误' });
  }
});

// UPDATE department (Admin only)
router.put('/:id', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: '部门名称不能为空' });

  try {
    db.prepare('UPDATE departments SET name = ? WHERE id = ?').run(name, id);
    res.json({ message: '更新成功' });
  } catch (err) {
    res.status(500).json({ message: '服务器错误' });
  }
});

// DELETE department (Admin only)
router.delete('/:id', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    // Check if any assets still belong to this department
    const assetCount = db.prepare('SELECT COUNT(*) as count FROM assets WHERE dept_id = ?').get(id) as any;
    if (assetCount.count > 0) {
      return res.status(400).json({ message: '该部门仍有资产挂靠，无法删除。请先调拨资产或使用合并功能。' });
    }

    db.prepare('DELETE FROM departments WHERE id = ?').run(id);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ message: '服务器错误' });
  }
});

// MERGE departments (Admin only)
router.post('/merge', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const { sourceIds, newName } = req.body;
  if (!sourceIds || !Array.isArray(sourceIds) || sourceIds.length < 1 || !newName) {
    return res.status(400).json({ message: '参数非法' });
  }

  try {
    db.transaction(() => {
      // 1. Get or Create target department
      let targetDept = db.prepare('SELECT id FROM departments WHERE name = ?').get(newName) as any;
      let targetId: number;
      if (!targetDept) {
        const result = db.prepare('INSERT INTO departments (name) VALUES (?)').run(newName);
        targetId = result.lastInsertRowid as number;
      } else {
        targetId = targetDept.id;
      }

      // 2. Update assets
      const placeholders = sourceIds.map(() => '?').join(',');
      db.prepare(`UPDATE assets SET dept_id = ? WHERE dept_id IN (${placeholders})`)
        .run(targetId, ...sourceIds);

      // 3. Update transfer requests
      db.prepare(`UPDATE transfer_requests SET from_dept_id = ? WHERE from_dept_id IN (${placeholders})`)
        .run(targetId, ...sourceIds);
      db.prepare(`UPDATE transfer_requests SET to_dept_id = ? WHERE to_dept_id IN (${placeholders})`)
        .run(targetId, ...sourceIds);

      // 4. Update users departments string (cleanup)
      const users = db.prepare("SELECT id, departments FROM users WHERE departments IS NOT NULL AND departments != ''").all() as any[];
      for (const user of users) {
        let depts = user.departments.split(',').map((d: string) => d.trim()).filter(Boolean);
        let changed = false;
        
        // Remove sources, add target
        const hasSource = depts.some((d: string) => sourceIds.includes(parseInt(d)));
        if (hasSource) {
          depts = depts.filter((d: string) => !sourceIds.includes(parseInt(d)));
          if (!depts.includes(String(targetId))) {
            depts.push(String(targetId));
          }
          changed = true;
        }

        if (changed) {
          db.prepare('UPDATE users SET departments = ? WHERE id = ?').run(depts.join(','), user.id);
        }
      }

      // 5. Delete old departments (excluding targetId if it was one of the sources)
      const idsToDelete = sourceIds.filter(id => id !== targetId);
      if (idsToDelete.length > 0) {
        const delPlaceholders = idsToDelete.map(() => '?').join(',');
        db.prepare(`DELETE FROM departments WHERE id IN (${delPlaceholders})`).run(...idsToDelete);
      }
    })();

    res.json({ message: '部门合并成功' });
  } catch (err) {
    console.error('Merge error:', err);
    res.status(500).json({ message: '合并失败' });
  }
});

export default router;
