import { Router } from 'express';
import db from '../db.ts';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.ts';
import { upload } from '../multer.ts';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

const router = Router();

// Helper to get or create Org/Dept (duplicated from assets.ts, maybe should move to common)
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

// EXPORT EXCEL (Admin Only)
router.get('/export', authenticate, requireAdmin, (req, res) => {
  try {
    const assets = db.prepare(`
      SELECT a.asset_code, a.name, a.card_code, a.barcode, a.user, a.status, o.name as org_name, d.name as dept_name, a.updated_at
      FROM assets a
      LEFT JOIN organizations o ON a.org_id = o.id
      LEFT JOIN departments d ON a.dept_id = d.id
    `).all();

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(assets);
    XLSX.utils.book_append_sheet(wb, ws, "Assets");

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `assets_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ message: '导出失败' });
  }
});

// EXPORT IMAGES ZIP (Admin Only)
router.get('/export-images', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  const filename = `asset_images_${new Date().toISOString().slice(0, 10)}.zip`;
  
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  archive.on('error', (err) => {
    res.status(500).send({ error: err.message });
  });

  archive.pipe(res);

  // Append files from public/uploads
  const uploadsPath = path.join(process.cwd(), 'public', 'uploads');
  if (fs.existsSync(uploadsPath)) {
    archive.directory(uploadsPath, false);
  }

  // Record in audit log
  db.prepare('INSERT INTO inventory_logs (user_id, action, timestamp) VALUES (?, ?, ?)')
    .run(req.user!.id, '批量下载资产图片', new Date().toISOString());

  archive.finalize();
});

// IMPORT (Step 1: Parse and detect conflicts)
router.post('/import-preview', authenticate, requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请上传文件' });

  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];

    const results: any[] = [];

    for (const row of data) {
      const assetCode = String(row.asset_code || row['资产编码'] || '');
      if (!assetCode) continue;

      const existing = db.prepare('SELECT a.*, o.name as org_name, d.name as dept_name FROM assets a LEFT JOIN organizations o ON a.org_id = o.id LEFT JOIN departments d ON a.dept_id = d.id WHERE a.asset_code = ?').get(assetCode) as any;

      const rowData = {
        asset_code: assetCode,
        name: row.name || row['资产名称'] || '',
        card_code: row.card_code || row['卡片编码'] || '',
        barcode: row.barcode || row['条形码'] || '',
        user: row.user || row['使用人'] || '',
        status: row.status || row['资产状态'] || row['状态'] || '待盘点',
        org_name: row.org_name || row['资产组织'] || '',
        dept_name: row.dept_name || row['管理部门'] || '',
        updated_at: row.updated_at || row['最后修改时间'] || ''
      };

      if (!existing) {
        results.push({ type: 'CREATE', data: rowData });
      } else {
        // Conflict detection logic
        // If file updatedAt is newer -> OVERWRITE
        // If file updatedAt is older or empty -> PROMPT (if differences exist)
        
        const isIdentical = 
          existing.name === rowData.name &&
          existing.card_code === rowData.card_code &&
          existing.barcode === rowData.barcode &&
          existing.user === rowData.user &&
          existing.status === rowData.status &&
          existing.org_name === rowData.org_name &&
          existing.dept_name === rowData.dept_name;

        if (isIdentical) {
          results.push({ type: 'SKIP', data: rowData, existing });
        } else {
          // Compare dates if available
          const existingDate = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
          const importDate = rowData.updated_at ? new Date(rowData.updated_at).getTime() : 0;

          if (importDate > existingDate) {
            results.push({ type: 'OVERWRITE', data: rowData, existing });
          } else {
            results.push({ type: 'CONFLICT', data: rowData, existing });
          }
        }
      }
    }

    fs.unlinkSync(req.file.path); // clean up
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: '解析 Excel 失败' });
  }
});

// IMPORT (Step 2: Commit changes)
router.post('/import-commit', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const { items } = req.body; // Array of { type: 'CREATE'|'OVERWRITE'|'CONFLICT_RESOLVED', data: ... }
  
  const userId = req.user!.id;
  const stats = { created: 0, updated: 0, skipped: 0 };

  try {
    const insertAsset = db.prepare(`
      INSERT INTO assets (org_id, dept_id, asset_code, card_code, barcode, name, user, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateAsset = db.prepare(`
      UPDATE assets SET 
        org_id = ?, dept_id = ?, asset_code = ?, card_code = ?, barcode = ?, 
        name = ?, user = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE asset_code = ?
    `);

    const transaction = db.transaction((rows: any[]) => {
      for (const row of rows) {
        const { type, data } = row;
        if (type === 'SKIP') {
            stats.skipped++;
            continue;
        }

        const orgId = data.org_name ? getOrCreateOrg(data.org_name) : null;
        const deptId = data.dept_name ? getOrCreateDept(data.dept_name) : null;

        if (type === 'CREATE') {
          insertAsset.run(orgId, deptId, data.asset_code, data.card_code, data.barcode, data.name, data.user, data.status);
          stats.created++;
        } else if (type === 'OVERWRITE' || type === 'CONFLICT_RESOLVED') {
          updateAsset.run(orgId, deptId, data.asset_code, data.card_code, data.barcode, data.name, data.user, data.status, data.asset_code);
          stats.updated++;
        }
      }
    });

    transaction(items);
    res.json({ message: '导入成功', stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '提交导入失败' });
  }
});

export default router;
