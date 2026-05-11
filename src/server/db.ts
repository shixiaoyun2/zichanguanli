import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'operator')) NOT NULL DEFAULT 'operator',
    departments TEXT
  );

  -- Add departments column if it doesn't exist (for existing databases)
  PRAGMA table_info(users);
`);

// Workaround for ALTER TABLE if column missing (PRAGMA above doesn't help much in exec)
try {
  db.exec("ALTER TABLE users ADD COLUMN departments TEXT;");
} catch (e) {
  // Column likely already exists
}

db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER,
    dept_id INTEGER,
    asset_code TEXT UNIQUE NOT NULL,
    card_code TEXT,
    barcode TEXT,
    name TEXT NOT NULL,
    user TEXT,
    image_path TEXT,
    location_name TEXT,
    remarks TEXT,
    model TEXT,
    status TEXT CHECK(status IN ('正常', '报废', '维修', '已盘点', '待盘点', '损坏')) NOT NULL DEFAULT '待盘点',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES organizations(id),
    FOREIGN KEY (dept_id) REFERENCES departments(id)
  );

  -- Migration helper: Add columns if they don't exist
  PRAGMA table_info(assets);
`);

// Add new columns to existing database if missing
const assetColumns = ['location_name', 'remarks', 'model'];
for (const col of assetColumns) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(assets)`).all() as any[];
    const exists = tableInfo.some(c => c.name === col);
    if (!exists) {
      db.exec(`ALTER TABLE assets ADD COLUMN ${col} TEXT;`);
      console.log(`Added column ${col} to assets table`);
    }
  } catch (e) {
    console.error(`Failed to add column ${col}:`, e);
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS inventory_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER,
    user_id INTEGER,
    action TEXT NOT NULL,
    before_data TEXT, -- JSON snapshot
    after_data TEXT,  -- JSON snapshot
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );
`);

import bcrypt from 'bcryptjs';

const adminCount = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
if (adminCount.count === 0) {
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync('admin123', salt);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run('admin', hash, 'admin');
  
  // Also add an operator for testing
  const opHash = bcrypt.hashSync('operator123', salt);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run('operator', opHash, 'operator');
}

export default db;
