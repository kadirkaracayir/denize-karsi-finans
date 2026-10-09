export function resolveDateRange(period = 'bugun', customStart = null, customEnd = null) {
  // Use 2026-10-08 as current anchor (or system now)
  const now = new Date(2026, 9, 8); // Oct 8, 2026

  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = formatDate(now);

  if (period === 'bugun') {
    return { startDate: todayStr, endDate: todayStr, label: 'Bugün' };
  }

  if (period === 'dun') {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    const s = formatDate(d);
    return { startDate: s, endDate: s, label: 'Dün' };
  }

  if (period === 'bu_hafta') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return { startDate: formatDate(monday), endDate: formatDate(sunday), label: 'Bu Hafta' };
  }

  if (period === 'gecen_hafta') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return { startDate: formatDate(monday), endDate: formatDate(sunday), label: 'Geçen Hafta' };
  }

  if (period === 'bu_ay') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: formatDate(start), endDate: formatDate(end), label: 'Bu Ay' };
  }

  if (period === 'gecen_ay') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: formatDate(start), endDate: formatDate(end), label: 'Geçen Ay' };
  }

  if (period === 'ozel' || period === 'custom') {
    return {
      startDate: customStart || todayStr,
      endDate: customEnd || todayStr,
      label: 'Özel Tarih'
    };
  }

  return { startDate: todayStr, endDate: todayStr, label: 'Bugün' };
}
