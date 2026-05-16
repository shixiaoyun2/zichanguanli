import { Router } from 'express';
import db from '../db.ts';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.ts';

const router = Router();

// Create a transfer request
router.post('/', authenticate, (req: AuthRequest, res) => {
  const { asset_id, to_dept_id, reason } = req.body;
  const user = req.user!;

  if (!asset_id || !to_dept_id) {
    return res.status(400).json({ message: '缺失必要信息' });
  }

  try {
    const asset = db.prepare('SELECT dept_id FROM assets WHERE id = ?').get(asset_id) as any;
    if (!asset) return res.status(404).json({ message: '资产不存在' });

    // Check if user is authorized for the target department
    if (user.role === 'operator') {
      const deptIds = user.deptIds || [];
      if (!deptIds.includes(parseInt(to_dept_id))) {
        return res.status(403).json({ message: '您只能申请将资产调拨至您管辖的部门' });
      }
    }

    db.prepare(`
      INSERT INTO transfer_requests (asset_id, from_dept_id, to_dept_id, requester_id, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(asset_id, asset.dept_id, to_dept_id, user.id, reason);

    res.json({ message: '调拨申请已提交，请等待管理员审批' });
  } catch (err) {
    console.error('Transfer request error:', err);
    res.status(500).json({ message: '提交申请失败' });
  }
});

// GET all transfer requests (Admin only)
router.get('/', authenticate, requireAdmin, (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT tr.*, 
             a.name as asset_name, a.asset_code,
             fd.name as from_dept_name,
             td.name as to_dept_name,
             u.username as requester_name
      FROM transfer_requests tr
      JOIN assets a ON tr.asset_id = a.id
      LEFT JOIN departments fd ON tr.from_dept_id = fd.id
      JOIN departments td ON tr.to_dept_id = td.id
      JOIN users u ON tr.requester_id = u.id
      WHERE tr.status = 'pending'
      ORDER BY tr.created_at DESC
    `).all();
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: '获取申请列表失败' });
  }
});

// Approve/Reject a transfer request (Admin only)
router.patch('/:id', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: '无效状态' });
  }

  try {
    const request = db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(id) as any;
    if (!request) return res.status(404).json({ message: '申请不存在' });
    if (request.status !== 'pending') return res.status(400).json({ message: '申请已处理' });

    if (status === 'approved') {
      const assetBefore = db.prepare('SELECT * FROM assets WHERE id = ?').get(request.asset_id) as any;
      if (!assetBefore) return res.status(404).json({ message: '资产已不存在' });

      // Perform transfer within a transaction
      const transfer = db.transaction(() => {
        // Update asset department
        db.prepare('UPDATE assets SET dept_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(request.to_dept_id, request.asset_id);
        
        // Update request status
        db.prepare('UPDATE transfer_requests SET status = ? WHERE id = ?')
          .run('approved', id);
        
        // Log the change
        const assetAfter = db.prepare('SELECT * FROM assets WHERE id = ?').get(request.asset_id) as any;
        db.prepare('INSERT INTO inventory_logs (asset_id, user_id, action, before_data, after_data) VALUES (?, ?, ?, ?, ?)')
          .run(request.asset_id, req.user!.id, 'TRANSFER', JSON.stringify(assetBefore), JSON.stringify(assetAfter));
      });
      
      transfer();
      res.json({ message: '调拨申请已批准，资产已转移' });
    } else {
      db.prepare('UPDATE transfer_requests SET status = ? WHERE id = ?')
        .run('rejected', id);
      res.json({ message: '申请已驳回' });
    }
  } catch (err) {
    console.error('Transfer approval error:', err);
    res.status(500).json({ message: '操作失败' });
  }
});

export default router;
