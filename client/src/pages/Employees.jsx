import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Edit2, 
  Trash2,
  Phone, 
  Building2, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  X, 
  Check, 
  RefreshCw 
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFilters } from '../context/FilterContext';
import { formatCurrency } from '../utils/formatters';

export default function Employees({ onNavigate }) {
  const { user } = useAuth();
  const { selectedBusiness, refreshKey, triggerRefresh } = useFilters();

  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    business_id: 'DK',
    role: '',
    department: 'Servis',
    hourly_rate: '',
    daily_rate: '',
    accrual_type: 'SAATLIK',
    payment_period: 'HAFTALIK',
    default_shift_id: 1,
  });

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/employees', { business_id: selectedBusiness }),
      api.get('/employees/shifts')
    ])
      .then(([empRes, shiftRes]) => {
        if (empRes.success) setEmployees(empRes.employees);
        if (shiftRes.success) setShifts(shiftRes.shifts);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedBusiness, refreshKey]);

  const handleOpenModal = (emp = null) => {
    if (emp) {
      setEditingEmp(emp);
      setFormData({
        name: emp.name,
        phone: emp.phone || '',
        business_id: emp.business_id,
        role: emp.role,
        department: emp.department || 'Servis',
        hourly_rate: emp.hourly_rate || '',
        daily_rate: emp.daily_rate || '',
        accrual_type: emp.accrual_type,
        payment_period: emp.payment_period,
        default_shift_id: emp.default_shift_id || 1,
      });
    } else {
      setEditingEmp(null);
      setFormData({
        name: '',
        phone: '',
        business_id: selectedBusiness === 'ALL' ? 'DK' : selectedBusiness,
        role: '',
        department: 'Servis',
        hourly_rate: '200',
        daily_rate: '1600',
        accrual_type: 'SAATLIK',
        payment_period: 'HAFTALIK',
        default_shift_id: 1,
      });
    }
    setErrorMsg('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.role) {
      setErrorMsg('Lütfen ad soyad ve görev alanlarını doldurunuz.');
      return;
    }

    try {
      if (editingEmp) {
        await api.put(`/employees/${editingEmp.id}`, formData);
        setSuccessMsg('Personel güncellendi.');
      } else {
        await api.post('/employees', formData);
        setSuccessMsg('Personel başarıyla eklendi.');
      }
      setShowModal(false);
      triggerRefresh();
    } catch (err) {
      setErrorMsg(err.message || 'Kayıt başarısız.');
    }
  };

  const handleDeleteEmployee = async (emp) => {
    if (!window.confirm(`${emp.name} adlı personeli ve ilişkili tüm kayıtları silmek istediğinize emin misiniz?`)) {
      return;
    }
    try {
      const res = await api.delete(`/employees/${emp.id}`);
      if (res.success) {
        setSuccessMsg(res.message || 'Personel başarıyla silindi.');
        if (showModal) setShowModal(false);
        triggerRefresh();
      }
    } catch (err) {
      setErrorMsg(err.message || 'Personel silinemedi.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Personel Yönetimi</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            DK, Palm ve Ortak personellerin tanımları, ücretleri ve güncel borç durumları.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onNavigate('attendance')}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            Puantaja Git
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Yeni Personel Ekle</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
          {successMsg}
        </div>
      )}

      {/* Employees Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Personel</th>
                <th className="py-3 px-4">İşletme</th>
                <th className="py-3 px-4">Görev / Departman</th>
                <th className="py-3 px-4">Ücret Tipi</th>
                <th className="py-3 px-4">Ödeme Periyodu</th>
                <th className="py-3 px-4 text-right">Toplam Hakediş</th>
                <th className="py-3 px-4 text-right">Toplam Ödenen</th>
                <th className="py-3 px-4 text-right">Kalan Borç</th>
                <th className="py-3 px-4 text-center">Düzenle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">Yükleniyor...</td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">Personel bulunamadı.</td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{emp.name}</div>
                      <div className="text-[11px] text-slate-400">{emp.phone || '-'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        emp.business_id === 'DK' ? 'bg-blue-100 text-blue-800' :
                        emp.business_id === 'PALM' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {emp.business_id === 'ORTAK' ? 'ORTAK PERSONEL' : emp.business_id}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800">{emp.role}</span>
                      <span className="text-slate-400 block text-[11px]">{emp.department}</span>
                    </td>
                    <td className="py-3 px-4">
                      {emp.accrual_type === 'SAATLIK' ? (
                        <span className="text-slate-700">Saatlik ({formatCurrency(emp.hourly_rate)}/saat)</span>
                      ) : (
                        <span className="text-slate-700">Günlük ({formatCurrency(emp.daily_rate)}/gün)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">{emp.payment_period}</td>
                    <td className="py-3 px-4 text-right text-slate-600 font-medium">
                      {formatCurrency(emp.totalAccrued)}
                    </td>
                    <td className="py-3 px-4 text-right text-blue-700 font-medium">
                      {formatCurrency(emp.totalPaid)}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-rose-700 text-sm">
                      {formatCurrency(emp.balanceDebt)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleOpenModal(emp)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Bilgileri Düzenle"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Personeli Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-base">
                {editingEmp ? 'Personel Bilgilerini Düzenle' : 'Yeni Personel Ekle'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs">{errorMsg}</div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Ad Soyad</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ahmet Yılmaz"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Telefon</label>
                  <input
                    type="text"
                    placeholder="0532 000 0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">İşletme</label>
                  <select
                    value={formData.business_id}
                    onChange={(e) => setFormData({ ...formData, business_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold"
                  >
                    <option value="DK">DK (Denize Karşı)</option>
                    <option value="PALM">Palm Beach</option>
                    <option value="ORTAK">Ortak Personel</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Görev</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Barista / Garson"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Departman</label>
                  <input
                    type="text"
                    placeholder="Örn: Servis / Mutfak"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Hakediş Tipi</label>
                  <select
                    value={formData.accrual_type}
                    onChange={(e) => setFormData({ ...formData, accrual_type: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="SAATLIK">Saatlik Ücret</option>
                    <option value="GUNLUK">Günlük Sabit Ücret</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Ödeme Periyodu</label>
                  <select
                    value={formData.payment_period}
                    onChange={(e) => setFormData({ ...formData, payment_period: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="GUNLUK">Günlük</option>
                    <option value="HAFTALIK">Haftalık</option>
                    <option value="AYLIK">Aylık</option>
                  </select>
                </div>

                {formData.accrual_type === 'SAATLIK' ? (
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Saatlik Ücret (TL)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="250"
                      value={formData.hourly_rate}
                      onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                    />
                  </div>
                ) : (
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Günlük Ücret (TL)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="1800"
                      value={formData.daily_rate}
                      onChange={(e) => setFormData({ ...formData, daily_rate: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-4">
                {editingEmp ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteEmployee(editingEmp)}
                    className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Personeli Sil</span>
                  </button>
                ) : <div />}

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingEmp ? 'Güncellemeleri Kaydet' : 'Personeli Kaydet'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
