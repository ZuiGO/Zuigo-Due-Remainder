import * as XLSX from 'xlsx';
import * as fs from 'fs';

const files = [
  'C:/Users/Admin/Downloads/Book 1.xlsx',
  'C:/Users/Admin/Downloads/Book 2.xlsx',
  'C:/Users/Admin/Downloads/Payment_Followup_Automation_Sheet (1).xlsx'
];

for (const f of files) {
  if (fs.existsSync(f)) {
    console.log('FILE:', f);
    const wb = XLSX.readFile(f);
    console.log('  Sheets:', wb.SheetNames);
    const s = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(s);
    console.log('  Rows count:', data.length);
    if (data.length > 0) {
      console.log('  Sample keys:', Object.keys(data[0] as any));
      console.log('  Sample row 1:', data[0]);
    }
  }
}
