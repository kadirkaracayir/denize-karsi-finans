import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import db from '../db/database.js';
import { JWT_SECRET, authenticateToken } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';
import { sendPasswordResetEmail } from '../utils/mailer.js';

const router = express.Router();

// Sistem Kuralı: Bu finans uygulamasına sadece yetkili ana yönetici hesabı giriş yapabilir.
const AUTHORIZED_EMAIL = 'cengizhankan53@hotmail.com';
const AUTHORIZED_USERNAME = 'cengizhankan53';

// In-Memory Brute-Force Rate Limiter for Login
const loginAttempts = new Map(); // ip -> { count: number, blockedUntil: number }

function checkRateLimit(ip) {
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };
  if (record.blockedUntil && Date.now() < record.blockedUntil) {
    const remainingSeconds = Math.ceil((record.blockedUntil - Date.now()) / 1000);
    return { 
      allowed: false, 
      message: `Çok fazla hatalı giriş denemesi yapıldı. Lütfen ${remainingSeconds} saniye sonra tekrar deneyiniz.` 
    };
  }
  return { allowed: true };
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  record.count += 1;
  // Block for 5 minutes after 5 failed attempts
  if (record.count >= 5) {
    record.blockedUntil = now + (5 * 60 * 1000);
    record.count = 0; // reset counter for next cycle
  }
  loginAttempts.set(ip, record);
}

function clearRateLimit(ip) {
  loginAttempts.delete(ip);
}

// 1. Login with Brute-Force Protection
router.post('/login', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return res.status(429).json({ success: false, message: rateCheck.message });
  }

  const identifier = (req.body.identifier || req.body.username || '').toString().trim();
  const password = req.body.password;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Lütfen kullanıcı adı / e-posta ve şifrenizi giriniz.' });
  }

  const cleanIdentifier = identifier.toLowerCase();

  // Kural: Bu uygulamaya sadece cengizhankan53@hotmail.com giriş yapabilir
  if (cleanIdentifier !== AUTHORIZED_EMAIL && cleanIdentifier !== AUTHORIZED_USERNAME) {
    recordFailedLogin(ip);
    return res.status(403).json({
      success: false,
      message: 'Bu finans uygulamasına sadece yetkili ana yönetici hesabı (cengizhankan53@hotmail.com) giriş yapabilir.'
    });
  }

  const user = db.prepare(`
    SELECT u.*, r.name as role_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE (lower(u.email) = ? OR lower(u.username) = ?) AND u.is_active = 1
  `).get(cleanIdentifier, cleanIdentifier);

  if (!user) {
    recordFailedLogin(ip);
    return res.status(401).json({ success: false, message: 'Geçersiz kullanıcı adı / e-posta veya şifre.' });
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
  if (!isPasswordValid) {
    recordFailedLogin(ip);
    return res.status(401).json({ success: false, message: 'Geçersiz kullanıcı adı / e-posta veya şifre.' });
  }

  // Login successful
  clearRateLimit(ip);

  const token = jwt.sign(
    { id: user.id, username: user.username, role_id: user.role_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  logAudit({
    userId: user.id,
    userName: user.full_name,
    action: 'LOGIN',
    entityType: 'AUTH',
    entityId: user.id,
    newValues: { username: user.username, role: user.role_id },
    ipAddress: ip
  });

  return res.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.full_name,
      roleId: user.role_id,
      roleName: user.role_name,
      businessId: user.business_id
    }
  });
});

// 2. Forgot Password Request (Şifremi Unuttum) - Kod Mail Olarak Gönderilir
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Lütfen geçerli bir e-posta adresi giriniz.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Kural: Şifre sıfırlama işlemi yalnızca cengizhankan53@hotmail.com için geçerlidir
    if (cleanEmail !== AUTHORIZED_EMAIL) {
      return res.status(403).json({ 
        success: false, 
        message: 'Şifre sıfırlama işlemi yalnızca yetkili ana yönetici hesabı (cengizhankan53@hotmail.com) için geçerlidir.' 
      });
    }

    const user = db.prepare('SELECT id, email, full_name FROM users WHERE lower(email) = ? AND is_active = 1').get(cleanEmail);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Bu e-posta adresine kayıtlı kullanıcı bulunamadı.' });
    }

    // Generate 6-digit verification code and secure token
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

    // Invalidate previous unused codes for this email
    db.prepare('UPDATE password_resets SET is_used = 1 WHERE lower(email) = ? AND is_used = 0').run(cleanEmail);

    // Insert new reset record
    db.prepare(`
      INSERT INTO password_resets (email, code, token, expires_at, is_used)
      VALUES (?, ?, ?, ?, 0)
    `).run(user.email, code, token, expiresAt);

    logAudit({
      userId: user.id,
      userName: user.full_name,
      action: 'PASSWORD_RESET_REQUEST',
      entityType: 'AUTH',
      entityId: user.id,
      newValues: { email: user.email },
      ipAddress: req.ip
    });

    // Send code to user's real email address via Hostinger SMTP
    try {
      await sendPasswordResetEmail(user.email, code);
      console.log(`✉️ Şifre sıfırlama e-postası başarıyla gönderildi -> ${user.email}`);
    } catch (mailErr) {
      console.error('SMTP Gönderim Hatası:', mailErr);
      return res.status(500).json({ 
        success: false, 
        message: 'Doğrulama kodu e-posta adresinize gönderilirken bir hata oluştu: ' + (mailErr.message || 'SMTP Hatası') 
      });
    }

    // Güvenlik Kuralı: 'code' alanı API cevabında ASLA geri döndürülmez!
    return res.json({
      success: true,
      message: `6 haneli doğrulama kodunuz ${user.email} e-posta adresinize gönderildi. Lütfen gelen kutunuzu (ve spam/önemsiz klasörünü) kontrol ediniz.`,
      email: user.email,
      expiresInMinutes: 15
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ success: false, message: 'Şifre sıfırlama talebi oluşturulamadı: ' + err.message });
  }
});

// 3. Reset Password Confirmation (Yeni Şifre Belirleme)
router.post('/reset-password', (req, res) => {
  try {
    const { email, code, token, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: 'E-posta ve yeni şifre zorunludur.' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'Yeni şifreniz en az 6 karakter olmalıdır.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = (code || '').trim();
    const cleanToken = (token || '').trim();

    if (cleanEmail !== AUTHORIZED_EMAIL) {
      return res.status(403).json({
        success: false,
        message: 'Şifre sıfırlama işlemi yalnızca yetkili ana yönetici hesabı (cengizhankan53@hotmail.com) için geçerlidir.'
      });
    }

    // Verify token/code
    const reset = db.prepare(`
      SELECT * FROM password_resets
      WHERE lower(email) = ? 
        AND (code = ? OR token = ?) 
        AND is_used = 0 
        AND expires_at > datetime('now')
      ORDER BY id DESC LIMIT 1
    `).get(cleanEmail, cleanCode, cleanToken);

    if (!reset) {
      return res.status(400).json({ 
        success: false, 
        message: 'Girdiğiniz doğrulama kodu geçersiz veya süresi dolmuş.' 
      });
    }

    // Hash new password and update user
    const newHash = bcrypt.hashSync(String(newPassword), 10);

    db.prepare('UPDATE users SET password_hash = ? WHERE lower(email) = ?').run(newHash, cleanEmail);
    db.prepare('UPDATE password_resets SET is_used = 1 WHERE id = ?').run(reset.id);

    const user = db.prepare('SELECT id, full_name, username FROM users WHERE lower(email) = ?').get(cleanEmail);

    logAudit({
      userId: user?.id || null,
      userName: user?.full_name || cleanEmail,
      action: 'PASSWORD_RESET_SUCCESS',
      entityType: 'AUTH',
      entityId: user?.id || null,
      newValues: { email: cleanEmail },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: 'Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, message: 'Şifre güncellenirken hata oluştu.' });
  }
});

// 4. Current User Profile
router.get('/me', authenticateToken, (req, res) => {
  return res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      fullName: req.user.full_name,
      roleId: req.user.role_id,
      roleName: req.user.role_name,
      businessId: req.user.business_id
    }
  });
});

// 5. Logout
router.post('/logout', authenticateToken, (req, res) => {
  logAudit({
    userId: req.user.id,
    userName: req.user.full_name,
    action: 'LOGOUT',
    entityType: 'AUTH',
    entityId: req.user.id,
    ipAddress: req.ip
  });
  return res.json({ success: true, message: 'Başarıyla çıkış yapıldı.' });
});

export default router;
