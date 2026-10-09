import React, { createContext, useContext, useState } from 'react';

const FilterContext = createContext(null);

export function FilterProvider({ children }) {
  // 'ALL' (Konsolide Ortak), 'DK', 'PALM'
  const [selectedBusiness, setSelectedBusiness] = useState('ALL');
  
  const getTodayStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const TODAY_STR = getTodayStr();

  const [dateMode, setDateMode] = useState('single'); // 'single' | 'range'
  const [period, setPeriod] = useState('bugun');
  
  const savedDate = (() => {
    try {
      const d = localStorage.getItem('dk_selected_date');
      return d || TODAY_STR;
    } catch {
      return TODAY_STR;
    }
  })();

  const [customStartDate, setCustomStartDate] = useState(savedDate);
  const [customEndDate, setCustomEndDate] = useState(savedDate);

  // Incremented to trigger re-fetching in active pages
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  const setSingleDate = (newDate) => {
    if (!newDate) return;
    try {
      localStorage.setItem('dk_selected_date', newDate);
    } catch {}
    setCustomStartDate(newDate);
    setCustomEndDate(newDate);
    setPeriod(newDate === TODAY_STR ? 'bugun' : 'ozel');
    setDateMode('single');
  };

  const goToPreviousDay = () => {
    const [y, m, d] = customEndDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() - 1);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    setSingleDate(`${year}-${month}-${day}`);
  };

  const goToNextDay = () => {
    const [y, m, d] = customEndDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + 1);
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    setSingleDate(`${year}-${month}-${day}`);
  };

  const goToToday = () => {
    setSingleDate(TODAY_STR);
  };

  return (
    <FilterContext.Provider
      value={{
        selectedBusiness,
        setSelectedBusiness,
        period,
        setPeriod,
        customStartDate,
        setCustomStartDate,
        customEndDate,
        setCustomEndDate,
        dateMode,
        setDateMode,
        setSingleDate,
        goToPreviousDay,
        goToNextDay,
        goToToday,
        isToday: customEndDate === TODAY_STR && customStartDate === TODAY_STR,
        todayStr: TODAY_STR,
        refreshKey,
        triggerRefresh,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
