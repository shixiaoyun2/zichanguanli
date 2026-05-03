import { Router } from 'express';
import db from '../db.ts';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.ts';
import { upload } from '../multer.ts';
import fs from 'fs';
import path from 'path';

const router = Router();

// Helper to get or create Org/Dept
function getOrCreateOrg(name: string): number {
  if (!name) return 0;
  const existing = db.prepare('SELECT id FROM organizations WHERE name = ?').get(name) as any;
  if (existing) return existing.id;
  const result = db.prepare('INSERT INTO organizations (name) VALUES (?)').run(name);
  return result.lastInsertRowid as number;
}

function getOrCreateDept(name: string): number {
  if (!name) return 0;
  const existing = db.prepare('SELECT id FROM departments WHERE name = ?').get(name) as any;
  if (existing) return existing.id;
  const result = db.prepare('INSERT INTO departments (name) VALUES (?)').run(name);
  return result.lastInsertRowid as number;
}

function logChange(assetId: number, userId: number, action: string, before: any, after: any) {
  db.prepare('INSERT INTO inventory_logs (asset_id, user_id, action, before_data, after_data) VALUES (?, ?, ?, ?, ?)')
    .run(assetId, userId, action, JSON.stringify(before), JSON.stringify(after));
}

// GET all assets
router.get('/', authenticate, (req, res) => {
  const { search, dept, status } = req.query;
  let sql = `
    SELECT a.*, o.name as org_name, d.name as dept_name 
    FROM assets a
    LEFT JOIN organizations o ON a.org_id = o.id
    LEFT JOIN departments d ON a.dept_id = d.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    sql += ` AND (a.name LIKE ? OR a.asset_code LIKE ? OR a.barcode LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (dept) {
    sql += ` AND d.name = ?`;
    params.push(dept);
  }
  if (status) {
    sql += ` AND a.status = ?`;
    params.push(status);
  }

  sql += ` ORDER BY a.updated_at DESC`;

  try {
    const assets = db.prepare(sql).all(...params);
    res.json(assets);
  } catch (err) {
    res.status(500).json({ message: '查询失败' });
  }
});

// GET single asset by ID or code/barcode
router.get('/:idOrCode', authenticate, (req, res) => {
  const { idOrCode } = req.params;
  try {
    const asset = db.prepare(`
      SELECT a.*, o.name as org_name, d.name as dept_name 
      FROM assets a
      LEFT JOIN organizations o ON a.org_id = o.id
      LEFT JOIN departments d ON a.dept_id = d.id
      WHERE a.id = ? OR a.asset_code = ? OR a.barcode = ?
    `).get(idOrCode, idOrCode, idOrCode) as any;

    if (!asset) return res.status(404).json({ message: '资产不存在' });
    res.json(asset);
  } catch (err) {
    res.status(500).json({ message: '查询资产失败' });
  }
});

// POST new asset (Admin Only)
router.post('/', authenticate, requireAdmin, upload.single('image'), (req: AuthRequest, res) => {
  const { org_name, dept_name, asset_code, card_code, barcode, name, user, status } = req.body;
  const orgId = org_name ? getOrCreateOrg(org_name) : null;
  const deptId = dept_name ? getOrCreateDept(dept_name) : null;

  let imagePath = null;
  if (req.file) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ext = path.extname(req.file.originalname) || '.jpg';
    const newFilename = `${org_name || 'ORG'}-${asset_code}-${date}${ext}`;
    const newPath = path.join(process.cwd(), 'public', 'uploads', newFilename);
    
    fs.renameSync(req.file.path, newPath);
    imagePath = `/uploads/${newFilename}`;
  }

  try {
    const result = db.prepare(`
      INSERT INTO assets (org_id, dept_id, asset_code, card_code, barcode, name, user, status, image_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orgId, deptId, asset_code, card_code, barcode, name, user, status || '待盘点', imagePath);

    const newId = result.lastInsertRowid as number;
    logChange(newId, req.user!.id, 'CREATE', null, { ...req.body, imagePath });

    res.json({ id: newId, message: '资产新增成功' });
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ message: '资产编码已存在' });
    }
    res.status(500).json({ message: '新增失败' });
  }
});

// PATCH asset
router.patch('/:id', authenticate, upload.single('image'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { org_name, dept_name, asset_code, card_code, barcode, name, user, status, last_updated_at } = req.body;
  
  try {
    const existing = db.prepare('SELECT a.*, o.name as org_name, d.name as dept_name FROM assets a LEFT JOIN organizations o ON a.org_id = o.id LEFT JOIN departments d ON a.dept_id = d.id WHERE a.id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ message: '资产不存在' });

    // Optimistic locking check
    if (last_updated_at && existing.updated_at !== last_updated_at) {
      return res.status(409).json({ message: '资产已被他人修改，请刷新后再试', current: existing });
    }

    if (req.user?.role === 'operator') {
      const userDepts = (req.user.departments || '').split(',').map(d => d.trim()).filter(Boolean);
      const assetDept = existing.dept_name || '';
      
      if (!userDepts.includes(assetDept)) {
        return res.status(403).json({ message: `您无权编辑隶属于“${assetDept}”的资产。您的管辖范围：${userDepts.join(', ') || '无'}` });
      }
    }

    const orgId = org_name ? getOrCreateOrg(org_name) : existing.org_id;
    const deptId = dept_name ? getOrCreateDept(dept_name) : existing.dept_id;

    let imagePath = existing.image_path;
    if (req.file) {
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const ext = path.extname(req.file.originalname) || '.jpg';
      const newFilename = `${org_name || existing.org_name || 'ORG'}-${asset_code || existing.asset_code}-${date}${ext}`;
      const newAbsPath = path.join(process.cwd(), 'public', 'uploads', newFilename);
      
      fs.renameSync(req.file.path, newAbsPath);
      imagePath = `/uploads/${newFilename}`;
    } else if ((asset_code && asset_code !== existing.asset_code) || (org_name && org_name !== existing.org_name)) {
        // Handle renaming if code/org changed
        if (existing.image_path) {
            const oldFilename = path.basename(existing.image_path);
            const ext = path.extname(oldFilename);
            const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const newFilename = `${org_name || existing.org_name || 'ORG'}-${asset_code || existing.asset_code}-${date}${ext}`;
            const oldAbsPath = path.join(process.cwd(), 'public', existing.image_path);
            const newAbsPath = path.join(process.cwd(), 'public', 'uploads', newFilename);
            if (fs.existsSync(oldAbsPath)) {
                fs.renameSync(oldAbsPath, newAbsPath);
                imagePath = `/uploads/${newFilename}`;
            }
        }
    }

    db.prepare(`
      UPDATE assets SET 
        org_id = ?, dept_id = ?, asset_code = ?, card_code = ?, barcode = ?, 
        name = ?, user = ?, status = ?, image_path = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(orgId, deptId, asset_code || existing.asset_code, card_code || existing.card_code, barcode || existing.barcode, 
           name || existing.name, user || existing.user, status || existing.status, imagePath, id);

    const updated = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
    logChange(Number(id), req.user!.id, 'UPDATE', existing, updated);

    res.json({ message: '修改成功' });
  } catch (err) {
    res.status(500).json({ message: '修改失败' });
  }
});

// DELETE asset (Admin Only)
router.delete('/:id', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ message: '资产不存在' });

    db.prepare('DELETE FROM assets WHERE id = ?').run(id);
    logChange(Number(id), req.user!.id, 'DELETE', existing, null);
    res.json({ message: '删除成功' });
  } catch (err) {
    res.status(500).json({ message: '删除失败' });
  }
});

export default router;
