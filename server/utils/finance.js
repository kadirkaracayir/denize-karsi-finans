import db from '../db/database.js';

export function getFinancialSummary(startDate, endDate) {
  // Sales summary
  const salesSummary = db.prepare(`
    SELECT 
      business_id,
      payment_type,
      SUM(amount) as total_amount
    FROM sales
    WHERE date >= ? AND date <= ? AND is_cancelled = 0
    GROUP BY business_id, payment_type
  `).all(startDate, endDate);

  const sales = {
    DK: { nakit: 0, kart: 0, total: 0 },
    PALM: { nakit: 0, kart: 0, total: 0 },
    ORTAK: { nakit: 0, kart: 0, total: 0 }
  };

  for (const s of salesSummary) {
    if (s.business_id === 'DK') {
      if (s.payment_type === 'NAKIT') sales.DK.nakit += s.total_amount;
      if (s.payment_type === 'KART') sales.DK.kart += s.total_amount;
      sales.DK.total += s.total_amount;
    } else if (s.business_id === 'PALM') {
      if (s.payment_type === 'NAKIT') sales.PALM.nakit += s.total_amount;
      if (s.payment_type === 'KART') sales.PALM.kart += s.total_amount;
      sales.PALM.total += s.total_amount;
    }
  }

  sales.ORTAK.nakit = sales.DK.nakit + sales.PALM.nakit;
  sales.ORTAK.kart = sales.DK.kart + sales.PALM.kart;
  sales.ORTAK.total = sales.DK.total + sales.PALM.total;

  // Expenses summary
  const expensesSummary = db.prepare(`
    SELECT 
      business_id,
      payment_source,
      SUM(amount) as total_amount
    FROM expenses
    WHERE date >= ? AND date <= ? AND is_cancelled = 0
    GROUP BY business_id, payment_source
  `).all(startDate, endDate);

  const expenses = {
    DK: 0,
    PALM: 0,
    ORTAK_EXPENSE: 0,
    TOTAL: 0,
    bySource: {
      KASA: 0,
      DK_KASA: 0,
      PALM_KASA: 0,
      DK_BANKA: 0,
      PALM_BANKA: 0
    }
  };

  for (const e of expensesSummary) {
    if (e.business_id === 'DK') expenses.DK += e.total_amount;
    else if (e.business_id === 'PALM') expenses.PALM += e.total_amount;
    else if (e.business_id === 'ORTAK') expenses.ORTAK_EXPENSE += e.total_amount;

    if (expenses.bySource[e.payment_source] !== undefined) {
      expenses.bySource[e.payment_source] += e.total_amount;
    }
    expenses.TOTAL += e.total_amount;
  }

  // Employee Accruals (Hakediş) in period
  const accruals = db.prepare(`
    SELECT 
      business_id,
      SUM(accrual_amount) as total_accrual
    FROM attendance
    WHERE date >= ? AND date <= ?
    GROUP BY business_id
  `).all(startDate, endDate);

  const employeeAccruals = { DK: 0, PALM: 0, ORTAK: 0 };
  for (const a of accruals) {
    if (a.business_id === 'DK') employeeAccruals.DK += a.total_accrual;
    else if (a.business_id === 'PALM') employeeAccruals.PALM += a.total_accrual;
    else if (a.business_id === 'ORTAK') employeeAccruals.ORTAK += a.total_accrual;
  }
  // ORTAK total includes all business accruals if consolidated
  employeeAccruals.ORTAK = employeeAccruals.ORTAK + employeeAccruals.DK + employeeAccruals.PALM;

  // Employee Payments in period
  const payments = db.prepare(`
    SELECT 
      payment_source,
      SUM(amount) as total_paid
    FROM employee_payments
    WHERE date >= ? AND date <= ? AND is_cancelled = 0
    GROUP BY payment_source
  `).all(startDate, endDate);

  const employeePayments = {
    KASA: 0,
    DK_KASA: 0,
    PALM_KASA: 0,
    DK_BANKA: 0,
    PALM_BANKA: 0,
    TOTAL: 0
  };
  for (const p of payments) {
    if (employeePayments[p.payment_source] !== undefined) {
      employeePayments[p.payment_source] += p.total_paid;
    }
    employeePayments.TOTAL += p.total_paid;
  }

  // Cash In / Cash Out / Transfers
  const cashTx = db.prepare(`
    SELECT 
      business_id,
      type,
      source_account,
      target_account,
      SUM(amount) as total_amount
    FROM cash_transactions
    WHERE date >= ? AND date <= ? AND is_cancelled = 0
    GROUP BY business_id, type, source_account, target_account
  `).all(startDate, endDate);

  const cashMovements = {
    DK: { in: 0, out: 0, transferIn: 0, transferOut: 0 },
    PALM: { in: 0, out: 0, transferIn: 0, transferOut: 0 },
    ORTAK: { in: 0, out: 0, transferIn: 0, transferOut: 0 },
    TOTAL_IN: 0,
    TOTAL_OUT: 0
  };

  for (const tx of cashTx) {
    if (tx.type === 'IN') {
      if (tx.business_id === 'DK') cashMovements.DK.in += tx.total_amount;
      else if (tx.business_id === 'PALM') cashMovements.PALM.in += tx.total_amount;
      else if (tx.business_id === 'ORTAK') cashMovements.ORTAK.in += tx.total_amount;
      cashMovements.TOTAL_IN += tx.total_amount;
    } else if (tx.type === 'OUT') {
      if (tx.business_id === 'DK') cashMovements.DK.out += tx.total_amount;
      else if (tx.business_id === 'PALM') cashMovements.PALM.out += tx.total_amount;
      else if (tx.business_id === 'ORTAK') cashMovements.ORTAK.out += tx.total_amount;
      cashMovements.TOTAL_OUT += tx.total_amount;
    } else if (tx.type === 'TRANSFER') {
      if (tx.target_account === 'KASA') {
        if (tx.business_id === 'DK') cashMovements.DK.transferIn += tx.total_amount;
        else if (tx.business_id === 'PALM') cashMovements.PALM.transferIn += tx.total_amount;
        else cashMovements.ORTAK.transferIn += tx.total_amount;
      }
      if (tx.source_account === 'KASA') {
        if (tx.business_id === 'DK') cashMovements.DK.transferOut += tx.total_amount;
        else if (tx.business_id === 'PALM') cashMovements.PALM.transferOut += tx.total_amount;
        else cashMovements.ORTAK.transferOut += tx.total_amount;
      }
    }
  }

  // Calculate Cumulative Cash Balances up to endDate
  // User Rule: "DK ve Palm Nakitleri Tek bir kasa"
  const dkAllNakitSales = db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM sales WHERE business_id = 'DK' AND payment_type = 'NAKIT' AND is_cancelled = 0 AND date <= ?`).get(endDate).s;
  const palmAllNakitSales = db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM sales WHERE business_id = 'PALM' AND payment_type = 'NAKIT' AND is_cancelled = 0 AND date <= ?`).get(endDate).s;
  const totalNakitSalesAllTime = dkAllNakitSales + palmAllNakitSales;

  const totalCashInAllTime = db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM cash_transactions WHERE type = 'IN' AND is_cancelled = 0 AND date <= ?`).get(endDate).s;
  const totalTransfersInKasa = db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM cash_transactions WHERE type = 'TRANSFER' AND target_account = 'KASA' AND is_cancelled = 0 AND date <= ?`).get(endDate).s;

  const totalCashExpensesAllTime = db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM expenses WHERE payment_source IN ('DK_KASA', 'PALM_KASA', 'KASA') AND is_cancelled = 0 AND date <= ?`).get(endDate).s;
  const totalCashEmpPaymentsAllTime = db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM employee_payments WHERE payment_source IN ('DK_KASA', 'PALM_KASA', 'KASA') AND is_cancelled = 0 AND date <= ?`).get(endDate).s;
  const totalCashOutAllTime = db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM cash_transactions WHERE type = 'OUT' AND is_cancelled = 0 AND date <= ?`).get(endDate).s;
  const totalTransfersOutKasa = db.prepare(`SELECT COALESCE(SUM(amount), 0) as s FROM cash_transactions WHERE type = 'TRANSFER' AND source_account = 'KASA' AND is_cancelled = 0 AND date <= ?`).get(endDate).s;

  // Single Unified Central Cash Register Balance
  const tekNakitKasaBalance = (totalNakitSalesAllTime + totalCashInAllTime + totalTransfersInKasa) - 
                              (totalCashExpensesAllTime + totalCashEmpPaymentsAllTime + totalCashOutAllTime + totalTransfersOutKasa);

  // Kredi Kartları Ayrı Kasalarda Toplanıyor: POS Settlement & Commission Engine
  // Query custom commission rates and rate difference for the date
  const dkSettlement = db.prepare(`
    SELECT * FROM daily_card_settlements WHERE business_id = 'DK' AND date = ?
  `).get(endDate);

  const palmSettlement = db.prepare(`
    SELECT * FROM daily_card_settlements WHERE business_id = 'PALM' AND date = ?
  `).get(endDate);

  // Default rates from system_settings
  let defaultDk = 2.5;
  let defaultPalm = 2.5;
  try {
    const getSetting = db.prepare('SELECT value FROM system_settings WHERE key = ?');
    const genVal = getSetting.get('card_commission_rate')?.value;
    const dkVal = getSetting.get('dk_card_commission_rate')?.value || genVal;
    const palmVal = getSetting.get('palm_card_commission_rate')?.value || genVal;
    if (dkVal) defaultDk = parseFloat(dkVal) || 2.5;
    if (palmVal) defaultPalm = parseFloat(palmVal) || 2.5;
  } catch {}

  const dkCommissionRate = dkSettlement ? dkSettlement.commission_rate : defaultDk;
  const dkRateDiff = dkSettlement ? dkSettlement.rate_difference : 0; // manual +/- TL difference
  const dkGrossCard = sales.DK.kart;
  const dkCommissionAmount = Math.round((dkGrossCard * dkCommissionRate / 100) * 100) / 100;
  const dkNetBankCard = Math.round((dkGrossCard - dkCommissionAmount - dkRateDiff) * 100) / 100;

  const palmCommissionRate = palmSettlement ? palmSettlement.commission_rate : defaultPalm;
  const palmRateDiff = palmSettlement ? palmSettlement.rate_difference : 0; // manual +/- TL difference
  const palmGrossCard = sales.PALM.kart;
  const palmCommissionAmount = Math.round((palmGrossCard * palmCommissionRate / 100) * 100) / 100;
  const palmNetBankCard = Math.round((palmGrossCard - palmCommissionAmount - palmRateDiff) * 100) / 100;

  const ortakGrossCard = dkGrossCard + palmGrossCard;
  const ortakCommissionAmount = dkCommissionAmount + palmCommissionAmount;
  const ortakRateDiff = dkRateDiff + palmRateDiff;
  const ortakNetBankCard = dkNetBankCard + palmNetBankCard;

  // Bank Balances (Latest actual manual entry on or before endDate)
  const dkBankLatest = db.prepare(`
    SELECT balance, date FROM bank_balances WHERE business_id = 'DK' AND date <= ? ORDER BY date DESC LIMIT 1
  `).get(endDate);
  const palmBankLatest = db.prepare(`
    SELECT balance, date FROM bank_balances WHERE business_id = 'PALM' AND date <= ? ORDER BY date DESC LIMIT 1
  `).get(endDate);

  const dkBankBalance = dkBankLatest ? dkBankLatest.balance : 0;
  const palmBankBalance = palmBankLatest ? palmBankLatest.balance : 0;
  const ortakBankBalance = dkBankBalance + palmBankBalance;

  // Bank balance change vs yesterday
  const yesterday = new Date(new Date(endDate).getTime() - 86400000).toISOString().split('T')[0];
  const dkBankPrev = db.prepare(`
    SELECT balance FROM bank_balances WHERE business_id = 'DK' AND date <= ? ORDER BY date DESC LIMIT 1
  `).get(yesterday);
  const palmBankPrev = db.prepare(`
    SELECT balance FROM bank_balances WHERE business_id = 'PALM' AND date <= ? ORDER BY date DESC LIMIT 1
  `).get(yesterday);

  const dkBankPrevious = dkBankPrev ? dkBankPrev.balance : dkBankBalance;
  const palmBankPrevious = palmBankPrev ? palmBankPrev.balance : palmBankBalance;

  return {
    period: { startDate, endDate },
    finansOzeti: {
      // TEK NAKİT KASA (DK ve Palm nakitleri tek kasada toplanır)
      tekNakitKasa: {
        toplamBakiye: tekNakitKasaBalance,
        donemDkNakitKatki: sales.DK.nakit,
        donemPalmNakitKatki: sales.PALM.nakit,
        donemToplamNakitGiris: sales.ORTAK.nakit
      },

      // KREDİ KARTLARI (DK ve Palm AYRI kasalarda toplanır, komisyon ve oran farkları düşülür)
      dkKart: {
        brut: dkGrossCard,
        komisyonOrani: dkCommissionRate,
        komisyonTutari: dkCommissionAmount,
        oranFarki: dkRateDiff,
        netBankayaDusen: dkNetBankCard,
        hasSettlement: !!dkSettlement,
        notes: dkSettlement?.notes || ''
      },
      palmKart: {
        brut: palmGrossCard,
        komisyonOrani: palmCommissionRate,
        komisyonTutari: palmCommissionAmount,
        oranFarki: palmRateDiff,
        netBankayaDusen: palmNetBankCard,
        hasSettlement: !!palmSettlement,
        notes: palmSettlement?.notes || ''
      },
      ortakKart: {
        brut: ortakGrossCard,
        komisyonTutari: ortakCommissionAmount,
        oranFarki: ortakRateDiff,
        netBankayaDusen: ortakNetBankCard
      },

      // BANKALAR (Gerçek ekstre bakiyeleri)
      banka: {
        dk: {
          current: dkBankBalance,
          previous: dkBankPrevious,
          change: dkBankBalance - dkBankPrevious
        },
        palm: {
          current: palmBankBalance,
          previous: palmBankPrevious,
          change: palmBankBalance - palmBankPrevious
        },
        ortak: {
          current: ortakBankBalance,
          previous: dkBankPrevious + palmBankPrevious,
          change: (dkBankBalance + palmBankBalance) - (dkBankPrevious + palmBankPrevious)
        }
      },

      // Geriye dönük uyumluluk alanları
      dk: {
        nakit: tekNakitKasaBalance,
        kart: dkGrossCard,
        kartNet: dkNetBankCard,
        banka: dkBankBalance,
        bankaPrevious: dkBankPrevious,
        bankaChange: dkBankBalance - dkBankPrevious
      },
      palm: {
        nakit: tekNakitKasaBalance,
        kart: palmGrossCard,
        kartNet: palmNetBankCard,
        banka: palmBankBalance,
        bankaPrevious: palmBankPrevious,
        bankaChange: palmBankBalance - palmBankPrevious
      },
      ortak: {
        toplamNakit: tekNakitKasaBalance,
        toplamKart: ortakGrossCard,
        toplamKartNet: ortakNetBankCard,
        toplamBanka: ortakBankBalance,
        toplamBankaPrevious: dkBankPrevious + palmBankPrevious,
        toplamBankaChange: (dkBankBalance + palmBankBalance) - (dkBankPrevious + palmBankPrevious)
      }
    },
    gunlukOzet: {
      toplamSatis: sales.ORTAK.total,
      nakitSatis: sales.ORTAK.nakit,
      kartSatis: sales.ORTAK.kart,
      netKartSatis: ortakNetBankCard,
      toplamKomisyonKesintisi: ortakCommissionAmount,
      toplamOranFarki: ortakRateDiff,
      dkSatis: sales.DK.total,
      palmSatis: sales.PALM.total,
      gider: expenses.TOTAL,
      dkGider: expenses.DK,
      palmGider: expenses.PALM,
      ortakGider: expenses.ORTAK_EXPENSE,
      personelHakedis: employeeAccruals.ORTAK,
      dkPersonelHakedis: employeeAccruals.DK,
      palmPersonelHakedis: employeeAccruals.PALM,
      personelOdemesi: employeePayments.TOTAL,
      digerOdemeler: cashMovements.TOTAL_OUT,
      paraGirisleri: cashMovements.TOTAL_IN,
      paraCikislari: cashMovements.TOTAL_OUT
    }
  };
}
