import { Router } from 'express';
import db from '../db.ts';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.ts';

const router = Router();

// GET all logs (Admin only)
router.get('/', authenticate, requireAdmin, (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT l.*, u.username, a.name as asset_name, a.asset_code
      FROM inventory_logs l
      LEFT JOIN users u ON l.user_id = u.id
      LEFT JOIN assets a ON l.asset_id = a.id
      ORDER BY l.timestamp DESC
      LIMIT 100
    `).all();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: '获取日志失败' });
  }
});

// GET log detail
router.get('/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  try {
    const log = db.prepare(`
      SELECT l.*, u.username, a.name as asset_name, a.asset_code
      FROM inventory_logs l
      LEFT JOIN users u ON l.user_id = u.id
      LEFT JOIN assets a ON l.asset_id = a.id
      WHERE l.id = ?
    `).get(id);
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: '获取日志详情失败' });
  }
});

// ROLLBACK to a specific log state (Admin only)
router.post('/rollback/:id', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const log = db.prepare('SELECT * FROM inventory_logs WHERE id = ?').get(id) as any;
    if (!log) return res.status(404).json({ message: '日志不存在' });

    // Rollback means: apply 'before_data' to the asset
    // BUT if the action was 'CREATE', rollback means 'DELETE'?
    // Usually rollback to a state means making the asset look like 'before_data'
    const before = JSON.parse(log.before_data);
    const assetId = log.asset_id;

    if (log.action === 'CREATE') {
      // Rollback a create = delete
      db.prepare('DELETE FROM assets WHERE id = ?').run(assetId);
    } else if (log.action === 'DELETE') {
      // Rollback a delete = re-insert (might be complex due to auto-increment IDs)
      // For now, let's focus on UPDATE rollback
      if (!before) return res.status(400).json({ message: '该记录无法自动回滚' });
      // Re-insert logic would go here
      return res.status(501).json({ message: '删除撤回功能开发中' });
    } else {
      // UPDATE rollback
      if (!before) return res.status(400).json({ message: '无历史数据可回滚' });

      db.prepare(`
        UPDATE assets SET 
          org_id = ?, dept_id = ?, asset_code = ?, card_code = ?, barcode = ?, 
          name = ?, user = ?, status = ?, image_path = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(before.org_id, before.dept_id, before.asset_code, before.card_code, before.barcode,
             before.name, before.user, before.status, before.image_path, assetId);
    }

    const current = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
    db.prepare('INSERT INTO inventory_logs (asset_id, user_id, action, before_data, after_data) VALUES (?, ?, ?, ?, ?)')
      .run(assetId, req.user!.id, 'ROLLBACK', JSON.stringify({ note: `Rollback using log ${id}` }), JSON.stringify(current));

    res.json({ message: '回滚成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '回滚失败' });
  }
});

export default router;
