import db from './database.js';

export function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role_id TEXT NOT NULL REFERENCES roles(id),
      business_id TEXT REFERENCES businesses(id),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      date TEXT NOT NULL,
      payment_type TEXT NOT NULL CHECK(payment_type IN ('NAKIT', 'KART')),
      amount REAL NOT NULL,
      description TEXT,
      source TEXT DEFAULT 'MANUEL',
      is_cancelled INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id TEXT NOT NULL CHECK(business_id IN ('DK', 'PALM', 'ORTAK')),
      date TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES expense_categories(id),
      amount REAL NOT NULL,
      payment_source TEXT NOT NULL, -- 'DK_KASA', 'PALM_KASA', 'DK_BANKA', 'PALM_BANKA'
      description TEXT,
      is_cancelled INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bank_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      date TEXT NOT NULL,
      balance REAL NOT NULL,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(business_id, date)
    );

    CREATE TABLE IF NOT EXISTS cash_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      date TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('IN', 'OUT', 'TRANSFER')),
      sub_type TEXT NOT NULL, 
      amount REAL NOT NULL,
      source_account TEXT, -- 'KASA', 'BANKA'
      target_account TEXT, -- 'KASA', 'BANKA' (used for TRANSFER)
      description TEXT,
      is_cancelled INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      business_id TEXT NOT NULL CHECK(business_id IN ('DK', 'PALM', 'ORTAK')),
      role TEXT NOT NULL,
      department TEXT,
      hourly_rate REAL DEFAULT 0,
      daily_rate REAL DEFAULT 0,
      accrual_type TEXT NOT NULL CHECK(accrual_type IN ('SAATLIK', 'GUNLUK')),
      payment_period TEXT NOT NULL CHECK(payment_period IN ('GUNLUK', 'HAFTALIK', 'AYLIK')),
      default_shift_id INTEGER REFERENCES shifts(id),
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      business_id TEXT NOT NULL REFERENCES businesses(id), -- Work attributed to DK or PALM
      shift_id INTEGER REFERENCES shifts(id),
      check_in_time TEXT,
      check_out_time TEXT,
      hours_worked REAL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('CALISTI', 'GELMEDI', 'IZINLI', 'RAPORLU', 'YARIM_GUN')),
      accrual_amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, employee_id)
    );

    CREATE TABLE IF NOT EXISTS employee_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      period_info TEXT,
      amount REAL NOT NULL,
      payment_source TEXT NOT NULL, -- 'DK_KASA', 'PALM_KASA', 'DK_BANKA', 'PALM_BANKA'
      description TEXT,
      is_cancelled INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_closings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      is_closed INTEGER DEFAULT 1,
      closed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_by INTEGER REFERENCES users(id),
      snapshot_json TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS imported_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      file_size INTEGER,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      imported_by INTEGER REFERENCES users(id),
      target_date TEXT NOT NULL,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      record_count INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'COMPLETED'
    );

    CREATE TABLE IF NOT EXISTS daily_card_settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id TEXT NOT NULL REFERENCES businesses(id),
      date TEXT NOT NULL,
      commission_rate REAL NOT NULL DEFAULT 2.5,
      rate_difference REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(business_id, date)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_values TEXT,
      new_values TEXT,
      change_reason TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      is_used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
    CREATE INDEX IF NOT EXISTS idx_sales_business ON sales(business_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    CREATE INDEX IF NOT EXISTS idx_emp_payments_date ON employee_payments(date);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_pw_resets_email ON password_resets(email);
  `);
}
