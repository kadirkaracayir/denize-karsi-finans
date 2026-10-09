import db from '../db/database.js';

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Yetkisiz erişim.' });
    }

    if (req.user.role_id === 'super_admin') {
      return next(); // Super admin has access to everything
    }

    if (allowedRoles.includes(req.user.role_id)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Bu işlem için yetkiniz bulunmamaktadır.'
    });
  };
}

export function checkClosedDate(getDateFn) {
  return (req, res, next) => {
    // Gün kapama/açma engeli tamamen kaldırıldı - Tüm tarihler serbestçe düzenlenebilir
    return next();
  };
}
