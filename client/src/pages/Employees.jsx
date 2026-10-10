import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Edit2, 
  Trash2, 
  Phone, 
  Search, 
  X, 
  Check, 
  Clock, 
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';

export default function Employees({ onNavigate }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role: '',
    hourly_rate: ''
  });

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch employees
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get('/employees');
      if (res.success) {
        setEmployees(res.employees || []);
      }
    } catch (err) {
      console.error('Personel listesi yüklenemedi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Filtered employees by search query
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase().trim();
    return employees.filter(emp => 
      (emp.name || '').toLowerCase().includes(q) ||
      (emp.role || '').toLowerCase().includes(q) ||
      (emp.phone || '').toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  // Open Add / Edit Modal
  const handleOpenModal = (emp = null) => {
    setErrorMsg('');
    if (emp) {
      setEditingEmp(emp);
      setFormData({
        name: emp.name || '',
        phone: emp.phone || '',
        role: emp.role || '',
        hourly_rate: emp.hourly_rate ?? ''
      });
    } else {
      setEditingEmp(null);
      setFormData({
        name: '',
        phone: '',
        role: '',
        hourly_rate: '200'
      });
    }
    setShowModal(true);
  };

  // Save (Create or Update)
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Lütfen personelin adını ve soyadını giriniz.');
      return;
    }
    if (!formData.role.trim()) {
      setErrorMsg('Lütfen personelin görevini giriniz.');
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        full_name: formData.name.trim(),
        phone: formData.phone.trim(),
        role: formData.role.trim(),
        hourly_rate: parseFloat(formData.hourly_rate) || 0,
        business_id: 'ORTAK',
        accrual_type: 'SAATLIK',
        payment_period: 'HAFTALIK'
      };

      if (editingEmp) {
        await api.put(`/employees/${editingEmp.id}`, payload);
        setSuccessMsg(`"${payload.name}" personel bilgileri başarıyla güncellendi.`);
      } else {
        await api.post('/employees', payload);
        setSuccessMsg(`"${payload.name}" adlı yeni personel başarıyla eklendi.`);
      }

      setShowModal(false);
      fetchEmployees();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Kayıt işlemi başarısız oldu.');
    }
  };

  // Delete
  const handleDelete = async (emp) => {
    const confirmed = window.confirm(
      `"${emp.name}" adlı personeli silmek istediğinize emin misiniz?\n\nBu işlem personeli ve ilişkili kayıtlarını sistemden kaldıracaktır.`
    );
    if (!confirmed) return;

    try {
      const res = await api.delete(`/employees/${emp.id}`);
      if (res.success) {
        setSuccessMsg(res.message || `"${emp.name}" başarıyla silindi.`);
        fetchEmployees();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      alert('Personel silinirken hata oluştu: ' + (err.message || 'Bilinmeyen hata'));
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Personel Listesi</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            İşletme personellerinin iletişim, görev ve saatlik ücret kayıtları.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {onNavigate && (
            <button
              onClick={() => onNavigate('attendance')}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Personel & Puantaj'a Git</span>
            </button>
          )}

          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Yeni Personel Ekle</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search & Stats Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Personel adı, görev veya telefon ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-500 font-medium">
          <span>Toplam Personel:</span>
          <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
            {filteredEmployees.length} {filteredEmployees.length !== employees.length && `(Toplam ${employees.length})`}
          </span>
        </div>
      </div>

      {/* Personel Tablosu - YALNIZCA İSTENEN 4 KOLON + İŞLEMLER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[700px] text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 w-12 text-center text-slate-400 font-semibold">#</th>
                <th className="py-3 px-4">Personel Adı Soyadı</th>
                <th className="py-3 px-4">İletişim Bilgileri</th>
                <th className="py-3 px-4">Görevi</th>
                <th className="py-3 px-4 text-right">Saatlik Ücreti</th>
                <th className="py-3 px-4 text-center w-28">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-xs">Personel listesi yükleniyor...</p>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    {searchQuery ? (
                      <div>
                        <p className="font-semibold text-slate-600">Aramanıza uygun personel bulunamadı.</p>
                        <p className="text-slate-400 text-[11px] mt-1">"{searchQuery}" araması için sonuç yok.</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-slate-600">Henüz personel kaydı bulunmuyor.</p>
                        <button
                          onClick={() => handleOpenModal()}
                          className="mt-2 text-blue-600 hover:text-blue-700 font-bold text-xs"
                        >
                          + İlk Personeli Ekleyin
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, idx) => (
                  <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                    {/* Sıra No */}
                    <td className="py-3 px-4 text-center text-slate-400 font-medium">
                      {idx + 1}
                    </td>

                    {/* Personel Adı Soyadı */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-sm">{emp.name}</div>
                    </td>

                    {/* İletişim Bilgileri */}
                    <td className="py-3 px-4">
                      {emp.phone ? (
                        <a 
                          href={`tel:${emp.phone}`}
                          className="inline-flex items-center space-x-1.5 text-slate-700 hover:text-blue-600 font-semibold transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{emp.phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">- İletişim yok -</span>
                      )}
                    </td>

                    {/* Görevi */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-semibold">
                        <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                        <span>{emp.role || 'Personel'}</span>
                      </span>
                    </td>

                    {/* Saatlik Ücreti */}
                    <td className="py-3 px-4 text-right">
                      <div className="font-extrabold text-blue-700 text-sm">
                        {formatCurrency(emp.hourly_rate || 0)}
                        <span className="text-[11px] font-normal text-slate-500 ml-1">/ sa</span>
                      </div>
                    </td>

                    {/* İşlemler (Düzenle / Sil) */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => handleOpenModal(emp)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Personeli Düzenle"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(emp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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

      {/* Personel Ekle / Düzenle Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">
                  {editingEmp ? 'Personel Bilgilerini Düzenle' : 'Yeni Personel Ekle'}
                </h3>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 1. Personel Adı Soyadı */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                  Personel Adı Soyadı <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ahmet Yılmaz"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  autoFocus
                />
              </div>

              {/* 2. İletişim Bilgileri (Telefon) */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                  İletişim Bilgileri (Telefon)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="tel"
                    placeholder="0532 000 0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* 3. Görevi */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                  Görevi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Garson, Barista, Mutfak, Şef, Kasiyer..."
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                />
              </div>

              {/* 4. Saatlik Ücreti */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                  Saatlik Ücreti (TL) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">₺</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="200"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                    className="w-full pl-8 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-black text-blue-700 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Puantajda çalışılan saat bu ücret ile çarpılarak hakediş hesaplanır.
                </p>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingEmp ? 'Güncellemeleri Kaydet' : 'Personeli Kaydet'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
