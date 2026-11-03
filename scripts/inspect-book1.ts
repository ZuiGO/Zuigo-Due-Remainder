import * as XLSX from 'xlsx';

const wb = XLSX.readFile('C:/Users/Admin/Downloads/Book 1.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
console.log('Book 1 Rows (first 12):');
for (let i = 0; i < Math.min(12, rows.length); i++) {
  console.log(rows[i]);
}
