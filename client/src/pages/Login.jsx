import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, X, KeyRound, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function Login() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email entry, 2: Code & New Password entry
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!identifier || !password) {
      setError('Lütfen kullanıcı adı / e-posta ve şifrenizi giriniz.');
      return;
    }
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      await login(identifier.trim(), password);
    } catch (err) {
      setError(err.message || 'Giriş yapılamadı. Bilgilerinizi kontrol ediniz.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Send verification code request
  const handleRequestResetCode = async (e) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.trim()) {
      setForgotError('Lütfen kayıtlı e-posta adresinizi giriniz.');
      return;
    }

    setForgotError('');
    setForgotLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email: forgotEmail.trim() });
      if (res.success) {
        setForgotStep(2);
        setForgotSuccess(res.message || '6 haneli doğrulama kodunuz e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol ediniz.');
        setForgotCode('');
      } else {
        setForgotError(res.message || 'Doğrulama kodu gönderilemedi.');
      }
    } catch (err) {
      setForgotError(err.message || 'Bu e-posta adresine kayıtlı kullanıcı bulunamadı.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 2: Confirm Code and Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!forgotCode || !newPassword) {
      setForgotError('Lütfen doğrulama kodunu ve yeni şifrenizi giriniz.');
      return;
    }

    if (newPassword.length < 6) {
      setForgotError('Yeni şifreniz en az 6 karakter olmalıdır.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setForgotError('Şifreler birbiriyle eşleşmiyor.');
      return;
    }

    setForgotError('');
    setForgotLoading(true);

    try {
      const res = await api.post('/auth/reset-password', {
        email: forgotEmail.trim(),
        code: forgotCode.trim(),
        newPassword
      });

      if (res.success) {
        setShowForgotModal(false);
        setSuccessMsg('Şifreniz başarıyla yenilendi! Yeni şifrenizle giriş yapabilirsiniz.');
        setIdentifier(forgotEmail);
        setPassword('');
        // Reset modal state
        setForgotStep(1);
        setForgotEmail('');
        setForgotCode('');
        setNewPassword('');
        setConfirmPassword('');
        setForgotError('');
        setForgotSuccess('');
      } else {
        setForgotError(res.message || 'Şifre güncellenemedi.');
      }
    } catch (err) {
      setForgotError(err.message || 'Geçersiz veya süresi dolmuş doğrulama kodu.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleOpenForgot = () => {
    setForgotStep(1);
    setForgotEmail(identifier.includes('@') ? identifier : '');
    setForgotCode('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
    setShowForgotModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-emerald-500 text-white font-black text-2xl shadow-xl shadow-emerald-500/20 mb-4">
            DK
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">DENİZE KARŞI & PALM</h1>
          <p className="text-slate-400 text-sm mt-1">İşletme Finans, Kasa, Satış ve Personel Takip Sistemi</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-1">Kullanıcı Girişi</h2>
          <p className="text-xs text-slate-500 mb-6">Sisteme erişmek için kimlik bilgilerinizi giriniz.</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                E-posta veya Kullanıcı Adı
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="E-posta veya kullanıcı adınızı girin"
                  required
                  autoComplete="username"
                  className="w-full px-3.5 py-2.5 pl-10 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-800"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
                Şifre
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pl-10 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-slate-800"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span className="text-xs text-slate-600">Beni hatırla</span>
              </label>

              <button
                type="button"
                onClick={handleOpenForgot}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Şifremi Unuttum?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Kontrol Ediliyor...</span>
                </>
              ) : (
                <>
                  <span>Giriş Yap</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center space-x-2 text-slate-400 text-xs mt-6">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Güvenli SSL Bağlantısı & RBAC Yetkilendirme</span>
        </div>
      </div>

      {/* ŞİFREMİ UNUTTUM MODALI */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Şifremi Unuttum / Sıfırlama</h3>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {forgotError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{forgotError}</span>
                </div>
              )}

              {forgotSuccess && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600" />
                  <span>{forgotSuccess}</span>
                </div>
              )}

              {/* STEP 1: Enter email */}
              {forgotStep === 1 && (
                <form onSubmit={handleRequestResetCode} className="space-y-4">
                  <p className="text-xs text-slate-600">
                    Sistemde yetkili e-posta adresinizi giriniz. Şifrenizi yenilemeniz için 6 haneli güvenlik doğrulama kodu e-postanıza gönderilecektir.
                  </p>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                      Yetkili E-posta Adresi
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="E-posta adresinizi girin"
                        required
                        className="w-full px-3.5 py-2.5 pl-10 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 text-slate-800"
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      {forgotLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>E-posta Gönderiliyor...</span>
                        </>
                      ) : (
                        <span>Doğrulama Kodu Gönder →</span>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: Enter code & new password */}
              {forgotStep === 2 && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start space-x-2">
                    <Mail className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">E-postanızı Kontrol Ediniz:</span>
                      <p className="mt-0.5 text-blue-800">
                        <strong>{forgotEmail}</strong> adresinize 6 haneli güvenlik kodu gönderilmiştir. Lütfen gelen kutunuzu (ve gereksiz / spam klasörünü) kontrol ederek kodu giriniz.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                      6 Haneli Doğrulama Kodu
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={forgotCode}
                      onChange={(e) => setForgotCode(e.target.value)}
                      placeholder="Örn: 123456"
                      required
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-mono tracking-widest text-center font-bold focus:ring-2 focus:ring-blue-600 text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                      Yeni Şifre
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="En az 6 karakter"
                        required
                        className="w-full px-3.5 py-2.5 pl-10 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 text-slate-800"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                      Yeni Şifre (Tekrar)
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Şifreyi tekrar giriniz"
                        required
                        className="w-full px-3.5 py-2.5 pl-10 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 text-slate-800"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                    >
                      ← E-posta Değiştir
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      {forgotLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Güncelleniyor...</span>
                        </>
                      ) : (
                        <span>Şifremi Yenile & Kaydet</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
