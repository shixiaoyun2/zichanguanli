import { Router } from 'express';
import db from '../db.ts';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth.ts';
import { upload } from '../multer.ts';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

// Set FS for XLSX to work in Node environment
if (XLSX.set_fs) {
  XLSX.set_fs(fs);
}

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

// EXPORT EXCEL
router.get('/export', authenticate, (req: AuthRequest, res) => {
  const user = req.user!;
  console.log(`[Excel Export] Starting export for user: ${user.username}...`);
  try {
    let sql = `
      SELECT 
        a.asset_code as "资产编码", 
        a.name as "资产名称", 
        a.card_code as "卡片编号", 
        a.barcode as "条形码", 
        a.model as "规格型号",
        a.location_name as "位置名称",
        a.user as "使用人", 
        a.status as "资产状态", 
        o.name as "资产组织", 
        d.name as "管理部门",
        a.remarks as "备注",
        a.updated_at as "最后修改时间"
      FROM assets a
      LEFT JOIN organizations o ON a.org_id = o.id
      LEFT JOIN departments d ON a.dept_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user.role === 'operator') {
      const deptIds = user.deptIds || [];
      if (deptIds.length === 0) {
        return res.status(403).json({ message: '未分配部门，无法导出' });
      }
      sql += ` AND a.dept_id IN (${deptIds.map(() => '?').join(',')})`;
      params.push(...deptIds);
    }

    const assets = db.prepare(sql).all(...params);

    console.log(`[Excel Export] Found ${assets.length} assets to export`);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(assets);
    XLSX.utils.book_append_sheet(wb, ws, "Assets");

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `assets_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    console.log(`[Excel Export] Export successful: ${filename}`);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('[Excel Export] Error:', err);
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
  console.log(`[Excel Import] Previewing file: ${req.file.originalname}`);

  try {
    if (!fs.existsSync(req.file.path)) {
      console.error(`[Excel Import] File not found at ${req.file.path}`);
      return res.status(500).json({ message: '上传文件临时丢失' });
    }

    // Try multiple ways to read if XLSX.readFile fails
    let workbook;
    try {
        workbook = XLSX.readFile(req.file.path, { cellDates: true });
    } catch (readErr) {
        console.warn('[Excel Import] XLSX.readFile failed, trying stream-based read...');
        const fileBuffer = fs.readFileSync(req.file.path);
        workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    }

    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }) as any[];
    console.log(`[Excel Import] parsed ${data.length} rows from sheet: ${sheetName}`);

    const results: any[] = [];

    for (const [index, row] of data.entries()) {
      try {
        const assetCode = String(row.asset_code || row['资产编码'] || '');
        if (!assetCode) continue;

        const existing = db.prepare(`
          SELECT a.id, a.name, a.asset_code, a.card_code, a.barcode, a.user, a.status, a.location_name, a.remarks, a.model, a.updated_at,
                 o.name as org_name, d.name as dept_name 
          FROM assets a 
          LEFT JOIN organizations o ON a.org_id = o.id 
          LEFT JOIN departments d ON a.dept_id = d.id 
          WHERE a.asset_code = ?
        `).get(assetCode) as any;

        const rowData = {
          asset_code: assetCode,
          name: String(row.name || row['资产名称'] || ''),
          card_code: String(row.card_code || row['卡片编号'] || row['卡片编码'] || ''),
          barcode: String(row.barcode || row['条形码'] || ''),
          model: String(row.model || row['规格型号'] || ''),
          location_name: String(row.location_name || row['位置名称'] || ''),
          remarks: String(row.remarks || row['备注'] || ''),
          user: String(row.user || row['使用人'] || ''),
          status: String(row.status || row['资产状态'] || row['状态'] || '待盘点'),
          org_name: String(row.org_name || row['资产组织'] || ''),
          dept_name: String(row.dept_name || row['管理部门'] || ''),
          updated_at: String(row.updated_at || row['最后修改时间'] || '')
        };

        if (!existing) {
          results.push({ type: 'CREATE', data: rowData });
        } else {
          const isIdentical = 
            String(existing.name || '') === rowData.name &&
            String(existing.card_code || '') === rowData.card_code &&
            String(existing.barcode || '') === rowData.barcode &&
            String(existing.model || '') === rowData.model &&
            String(existing.location_name || '') === rowData.location_name &&
            String(existing.remarks || '') === rowData.remarks &&
            String(existing.user || '') === rowData.user &&
            String(existing.status || '') === rowData.status &&
            String(existing.org_name || '') === rowData.org_name &&
            String(existing.dept_name || '') === rowData.dept_name;

          if (isIdentical) {
            results.push({ type: 'SKIP', data: rowData, existing });
          } else {
            // Compare dates safely
            let importDate = 0;
            if (rowData.updated_at) {
                const d = new Date(rowData.updated_at);
                if (!isNaN(d.getTime())) importDate = d.getTime();
            }
            const existingDate = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;

            if (importDate > existingDate) {
              results.push({ type: 'OVERWRITE', data: rowData, existing });
            } else {
              results.push({ type: 'CONFLICT', data: rowData, existing });
            }
          }
        }
      } catch (rowErr) {
        console.error(`Error processing row ${index}:`, rowErr);
        // Continue but maybe report error in results?
      }
    }

    console.log(`[Excel Import] Conflict detection complete. Found ${results.length} valid items.`);
    fs.unlinkSync(req.file.path); // clean up
    res.json(results);
  } catch (err) {
    console.error('[Excel Import] Preview crash:', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: '解析 Excel 失败', error: String(err) });
  }
});

// IMPORT (Step 2: Commit changes)
router.post('/import-commit', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const { items } = req.body; 
  console.log(`[Excel Import] Committing ${items?.length || 0} items...`);
  
  const userId = req.user!.id;
  const stats = { created: 0, updated: 0, skipped: 0 };

  try {
    const insertAsset = db.prepare(`
      INSERT INTO assets (org_id, dept_id, asset_code, card_code, barcode, name, model, location_name, remarks, user, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateAsset = db.prepare(`
      UPDATE assets SET 
        org_id = ?, dept_id = ?, asset_code = ?, card_code = ?, barcode = ?, 
        name = ?, model = ?, location_name = ?, remarks = ?, user = ?, status = ?, updated_at = CURRENT_TIMESTAMP
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
          insertAsset.run(orgId, deptId, data.asset_code, data.card_code, data.barcode, data.name, data.model, data.location_name, data.remarks, data.user, data.status);
          stats.created++;
        } else if (type === 'OVERWRITE' || type === 'CONFLICT_RESOLVED') {
          updateAsset.run(orgId, deptId, data.asset_code, data.card_code, data.barcode, data.name, data.model, data.location_name, data.remarks, data.user, data.status, data.asset_code);
          stats.updated++;
        }
      }
    });

    transaction(items);
    console.log(`[Excel Import] Commit success: Created=${stats.created}, Updated=${stats.updated}, Skipped=${stats.skipped}`);
    res.json({ message: '导入成功', stats });
  } catch (err) {
    console.error('[Excel Import] Commit failed:', err);
    res.status(500).json({ message: '提交导入失败' });
  }
});

export default router;
