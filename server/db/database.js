import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'denize_karsi.db');
const db = new DatabaseSync(dbPath);

// Enable WAL mode and foreign keys for high performance & integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Turso Cloud Sync Configuration
const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://denize-karsi-kadirkaracayir.aws-eu-north-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJleHAiOjE4MjMxNzc2NTMsImlhdCI6MTc5MTY0MTY1MywiaWQiOiIwMWExMjYyOS03ODAxLTc0YjUtOTMzMy1mM2RhNTEwMTU2YTkiLCJraWQiOiJCc2E0dkpLOVJDT2E3RXByckduNWJ4Undyb1YzdEFnZHYtYzZISEZlZzdjIiwicmlkIjoiOWViNTJmNzQtNTk1Mi00NTZlLWI0NDYtNzhhYzdkM2JkNzE3In0.r6zqXuNi21nZ84tx_9r3voTOkxD2Da4yXrZEG1ejNkc4UgDSkjmpNKIe3uavKDpetM3hUFeMXHgFtSjgshjbCw';

export const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN
});

// Intercept write queries to automatically mirror to Turso Cloud in background
const originalPrepare = db.prepare.bind(db);
db.prepare = function(sql) {
  const stmt = originalPrepare(sql);
  const isWrite = /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql);
  
  if (isWrite) {
    const originalRun = stmt.run.bind(stmt);
    stmt.run = function(...args) {
      const res = originalRun(...args);
      // Asynchronously mirror write to Turso cloud
      turso.execute({ sql, args }).catch(err => {
        console.error('⚠️ Turso cloud write error:', err.message);
      });
      return res;
    };
  }
  return stmt;
};

// Sync latest state from Turso cloud to local SQLite on boot
export async function syncFromTurso() {
  try {
    console.log('🔄 Turso bulut veritabanından en güncel veriler çekiliyor...');
    const tables = [
      'businesses', 'roles', 'users', 'shifts', 'expense_categories',
      'employees', 'attendance', 'sales', 'expenses', 'bank_balances',
      'cash_transactions', 'employee_payments', 'daily_closings',
      'imported_files', 'daily_card_settlements', 'audit_logs',
      'password_resets', 'system_settings', 'menu_categories',
      'menu_products', 'site_settings', 'working_hours', 'qr_tables'
    ];

    let totalSyncedRows = 0;
    db.exec('PRAGMA foreign_keys = OFF;');

    for (const tableName of tables) {
      try {
        const res = await turso.execute(`SELECT * FROM ${tableName}`);
        if (res.rows.length === 0) continue;

        const columns = Object.keys(res.rows[0]);
        const placeholders = columns.map(() => '?').join(', ');
        const insertSql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        const stmt = originalPrepare(insertSql);

        for (const row of res.rows) {
          stmt.run(...columns.map(c => row[c]));
          totalSyncedRows++;
        }
      } catch (err) {
        // Table might not exist or error, continue
      }
    }

    db.exec('PRAGMA foreign_keys = ON;');
    console.log(`✅ Turso senkronizasyonu tamamlandı (${totalSyncedRows} kayıt güncellendi).`);
  } catch (err) {
    console.error('⚠️ Turso ilk açılış senkronizasyon hatası:', err.message);
  }
}

export default db;
