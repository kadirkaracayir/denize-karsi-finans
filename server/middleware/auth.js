import jwt from 'jsonwebtoken';
import db from '../db/database.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'denize_karsi_finans_secret_key_2026_xyz';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Oturum açmanız gerekiyor (Token bulunamadı).' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Oturum süresi dolmuş veya geçersiz token.' });
    }

    // Refresh user from DB to verify active status
    const user = db.prepare(`
      SELECT u.id, u.email, u.username, u.full_name, u.role_id, u.business_id, u.is_active, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).get(decoded.id);

    if (!user || user.is_active !== 1) {
      return res.status(403).json({ success: false, message: 'Kullanıcı hesabı aktif değil.' });
    }

    req.user = user;
    next();
  });
}
