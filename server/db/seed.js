import bcrypt from 'bcryptjs';
import db from './database.js';
import { initializeSchema } from './schema.js';

/**
 * Production Initializer & Master Data Setup
 * Cleans all sample/demo transactions, sales, expenses, and employees.
 * Keeps only master roles, categories, shifts, and the real admin user.
 */
export function seedDatabase(forceClean = false) {
  initializeSchema();

  // If force clean or if sample data exists, clean up transactional data
  if (forceClean) {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      DELETE FROM audit_logs;
      DELETE FROM daily_card_settlements;
      DELETE FROM imported_files;
      DELETE FROM daily_closings;
      DELETE FROM employee_payments;
      DELETE FROM attendance;
      DELETE FROM employees;
      DELETE FROM cash_transactions;
      DELETE FROM bank_balances;
      DELETE FROM expenses;
      DELETE FROM sales;
      DELETE FROM password_resets;
      PRAGMA foreign_keys = ON;
    `);
  }

  // 1. Businesses
  const insertBusiness = db.prepare(`
    INSERT OR REPLACE INTO businesses (id, name, code, is_active)
    VALUES (?, ?, ?, 1)
  `);
  insertBusiness.run('DK', 'Denize Karşı', 'DK');
  insertBusiness.run('PALM', 'Palm Beach', 'PALM');
  insertBusiness.run('ORTAK', 'Merkezi / Ortak Kasa', 'ORTAK');

  // 2. Roles
  const insertRole = db.prepare(`
    INSERT OR REPLACE INTO roles (id, name, description)
    VALUES (?, ?, ?)
  `);
  insertRole.run('super_admin', 'Süper Admin', 'Tüm sistem yetkileri ve ayarlara tam erişim');
  insertRole.run('business_admin', 'İşletme Admini', 'İşletme operasyonları ve kapalı gün düzenleme');
  insertRole.run('finance', 'Finans Yetkilisi', 'Kasa, banka, satış ve gider yönetimi');
  insertRole.run('hr', 'Personel Yetkilisi', 'Personel, vardiya, puantaj ve hakediş');
  insertRole.run('readonly', 'Salt Okuma', 'Sadece görüntüleme ve rapor izleme');

  // 3. Primary Admin User: cengizhankan53@hotmail.com / asd123!
  const adminPasswordHash = bcrypt.hashSync('asd123!', 10);
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('cengizhankan53@hotmail.com');
  
  if (existingAdmin) {
    db.prepare(`
      UPDATE users SET
        username = 'cengizhankan53',
        password_hash = ?,
        full_name = 'Cengizhan Kan',
        role_id = 'super_admin',
        business_id = 'ORTAK',
        is_active = 1
      WHERE email = 'cengizhankan53@hotmail.com'
    `).run(adminPasswordHash);
  } else {
    db.prepare(`
      INSERT INTO users (email, username, password_hash, full_name, role_id, business_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run('cengizhankan53@hotmail.com', 'cengizhankan53', adminPasswordHash, 'Cengizhan Kan', 'super_admin', 'ORTAK');
  }

  // Remove old demo users (admin@demo.local, dkadmin@demo.local, etc.)
  db.prepare(`
    DELETE FROM users WHERE email IN ('admin@demo.local', 'dkadmin@demo.local', 'finance@demo.local', 'hr@demo.local', 'readonly@demo.local')
  `).run();

  // 4. Expense Categories (Master business categories)
  const insertExpenseCat = db.prepare(`
    INSERT OR IGNORE INTO expense_categories (id, name, is_active, sort_order)
    VALUES (?, ?, 1, ?)
  `);
  const expenseCats = [
    'Elektrik', 'Su', 'Doğalgaz', 'İnternet', 'Telefon', 'Kira',
    'Sarf Malzeme', 'Temizlik', 'Yakıt', 'Bakım', 'Vergi',
    'Muhasebe', 'Personel', 'Tedarikçi', 'Diğer'
  ];
  expenseCats.forEach((name, idx) => {
    insertExpenseCat.run(idx + 1, name, idx + 1);
  });

  // 5. Shifts (Default shift templates)
  const insertShift = db.prepare(`
    INSERT OR IGNORE INTO shifts (id, name, start_time, end_time, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);
  insertShift.run(1, 'Sabah Vardiyası', '09:00', '17:00');
  insertShift.run(2, 'Akşam Vardiyası', '17:00', '01:00');
  insertShift.run(3, 'Gece Vardiyası', '01:00', '09:00');
  insertShift.run(4, 'Tam Gün', '10:00', '22:00');

  console.log('✅ Sistem hazır: Tüm örnek veriler temizlendi, gerçek yönetici hesabı tanımlandı.');
}

/**
 * Total Wipe of Transactional & Employee Data
 */
export function clearAllDemoData() {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM audit_logs;
    DELETE FROM daily_card_settlements;
    DELETE FROM imported_files;
    DELETE FROM daily_closings;
    DELETE FROM employee_payments;
    DELETE FROM attendance;
    DELETE FROM employees;
    DELETE FROM cash_transactions;
    DELETE FROM bank_balances;
    DELETE FROM expenses;
    DELETE FROM sales;
    DELETE FROM password_resets;
    PRAGMA foreign_keys = ON;
  `);
  console.log('🗑️ Tüm örnek veriler (satış, gider, kasa, personel, puantaj) tamamen sıfırlandı.');
}
