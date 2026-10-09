import XLSX from 'xlsx';
import db from '../server/db/database.js';
import { initializeSchema } from '../server/db/schema.js';
import { clearAllDemoData } from '../server/db/seed.js';

initializeSchema();

// Read Excel
const wb = XLSX.readFile('puantaj.xlsx');
console.log('Sheets found:', wb.SheetNames);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Total raw rows:', rows.length);
console.log('Row 0 (Header 1):', rows[0]);
console.log('Row 1 (Header 2):', rows[1]);

// Let's print rows 2 to 45
for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  if (!r || !r[1]) continue; // Column 1 is Name
  console.log(`Row ${i}: Name="${r[1]}", Ucret=${r[15]}, ToplamTutar=${r[18]}`);
}
