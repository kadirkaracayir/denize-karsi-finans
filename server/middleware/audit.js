import db from '../db/database.js';

export function logAudit({
  userId = null,
  userName = 'Sistem',
  action,
  entityType,
  entityId = null,
  oldValues = null,
  newValues = null,
  changeReason = null,
  ipAddress = '127.0.0.1'
}) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs 
      (user_id, user_name, action, entity_type, entity_id, old_values, new_values, change_reason, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      userName,
      action,
      entityType,
      entityId ? String(entityId) : null,
      typeof oldValues === 'object' && oldValues !== null ? JSON.stringify(oldValues) : (oldValues || null),
      typeof newValues === 'object' && newValues !== null ? JSON.stringify(newValues) : (newValues || null),
      changeReason,
      ipAddress
    );
  } catch (err) {
    console.error('Audit log write error:', err.message);
  }
}
