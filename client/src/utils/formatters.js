// Format currency as 1.250,50 TL
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0,00 TL';
  }
  const num = Number(amount);
  return num.toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' TL';
}

// Format integer currency without decimals if .00
export function formatCurrencyShort(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0 TL';
  }
  const num = Number(amount);
  return num.toLocaleString('tr-TR', {
    maximumFractionDigits: 0
  }) + ' TL';
}

// Format date string YYYY-MM-DD to DD.MM.YYYY
export function formatDateTR(dateStr) {
  if (!dateStr) return '';
  const parts = String(dateStr).split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

// Format timestamp YYYY-MM-DD HH:mm:ss to DD.MM.YYYY HH:mm
export function formatDateTimeTR(dateTimeStr) {
  if (!dateTimeStr) return '';
  try {
    const d = new Date(dateTimeStr);
    const datePart = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    const timePart = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${datePart} ${timePart}`;
  } catch {
    return dateTimeStr;
  }
}

// Format date string YYYY-MM-DD to "8 Ekim 2026, Per"
export function formatDateLongTR(dateStr) {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'short'
    });
  } catch {
    return dateStr;
  }
}
