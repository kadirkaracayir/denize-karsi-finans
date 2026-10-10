import nodemailer from 'nodemailer';

/**
 * Hostinger SMTP Mail Transporters with Fast Timeouts
 * Port 587 (STARTTLS): Faster, modern, avoids ISP/firewall blocks
 * Port 465 (SSL): Automatic secondary fallback
 */
const smtpUser = process.env.SMTP_USER || 'finans@denizekarsigarden.com';
const smtpPass = process.env.SMTP_PASS || 'Finans2026#';
const smtpHost = process.env.SMTP_HOST || 'smtp.hostinger.com';

const transporter587 = nodemailer.createTransport({
  host: smtpHost,
  port: 587,
  secure: false,
  requireTLS: true,
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 10000,
  auth: { user: smtpUser, pass: smtpPass },
  tls: { rejectUnauthorized: false }
});

const transporter465 = nodemailer.createTransport({
  host: smtpHost,
  port: 465,
  secure: true,
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 10000,
  auth: { user: smtpUser, pass: smtpPass },
  tls: { rejectUnauthorized: false }
});

/**
 * Send 6-digit Password Reset Code via Email
 */
export async function sendPasswordResetEmail(toEmail, verificationCode) {
  const fromAddress = process.env.SMTP_FROM || `"Denize Karşı Finans" <${smtpUser}>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>Şifre Sıfırlama Kodu</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
        .container { max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 28px 24px; text-align: center; }
        .logo-title { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
        .logo-sub { font-size: 12px; color: #94a3b8; margin-top: 4px; }
        .body { padding: 32px 24px; text-align: center; }
        .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #0f172a; }
        .info-text { font-size: 13px; color: #64748b; line-height: 1.6; margin-bottom: 24px; }
        .code-box { background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 18px 24px; display: inline-block; margin-bottom: 24px; }
        .code { font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #2563eb; margin: 0; }
        .warning-box { background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 10px; padding: 12px 16px; text-align: left; font-size: 12px; color: #991b1b; margin-top: 12px; }
        .footer { background-color: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 class="logo-title">Denize Karşı & Palm Beach</h1>
          <div class="logo-sub">Finans ve Personel Yönetim Portalı</div>
        </div>
        <div class="body">
          <div class="greeting">Merhaba Sayın Yönetici,</div>
          <div class="info-text">
            Finans sisteminde <strong>${toEmail}</strong> hesabı için şifre sıfırlama talebinde bulundunuz. Aşağıdaki 6 haneli doğrulama kodunu sisteme girerek yeni şifrenizi belirleyebilirsiniz:
          </div>
          <div class="code-box">
            <div class="code">${verificationCode}</div>
          </div>
          <div class="info-text" style="margin-bottom: 16px;">
            ⏱️ Bu güvenlik kodu <strong>15 dakika</strong> boyunca geçerlidir.
          </div>
          <div class="warning-box">
            <strong>⚠️ Güvenlik Uyarısı:</strong> Bu talebi siz gerçekleştirmediyseniz bu e-postayı dikkate almayınız. Sistem şifreniz siz yeni bir şifre tanımlayana kadar değişmeyecektir.
          </div>
        </div>
        <div class="footer">
          Denize Karşı Garden & Palm Beach Finans Yönetimi &copy; 2026<br/>
          Bu otomatik bir bildirimdir, lütfen bu e-postayı yanıtlamayınız.
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Denize Karşı & Palm Beach - Finans Portalı
Şifre Sıfırlama Doğrulama Kodu

Merhaba,
Finans portalı şifre sıfırlama talebiniz için 6 haneli doğrulama kodunuz:

KOD: ${verificationCode}

Bu kod 15 dakika boyunca geçerlidir.
Bu talebi siz yapmadıysanız lütfen bu mesajı dikkate almayınız.
  `;

  const mailOptions = {
    from: fromAddress,
    to: toEmail,
    subject: `🔑 Denize Karşı Finans - Şifre Sıfırlama Kodunuz: ${verificationCode}`,
    text: textContent,
    html: htmlContent
  };

  try {
    return await transporter587.sendMail(mailOptions);
  } catch (err587) {
    console.warn('Port 587 SMTP gönderim hatası, Port 465 deneniyor...', err587.message);
    return await transporter465.sendMail(mailOptions);
  }
}

export default {
  sendPasswordResetEmail
};
