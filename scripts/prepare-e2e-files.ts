import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const userUploadDir = '/Users/mac/.gemini/antigravity/brain/37ce6b16-ed24-4fda-b5da-cc4bde7796b8/.user_uploaded/';
const testFilesDir = path.resolve(process.cwd(), 'test_files');

if (!fs.existsSync(testFilesDir)) {
  fs.mkdirSync(testFilesDir, { recursive: true });
}

const findFile = (hash: string) => {
  const f = fs.readdirSync(userUploadDir).find(x => x.includes(hash));
  if (!f) throw new Error(`File with hash ${hash} not found in ${userUploadDir}`);
  return path.join(userUploadDir, f);
};

const day1Path = findFile('c9321c05');
const day2Path = findFile('da4433be');
const day3Path = findFile('fed0ee3d');

// Copy SAP Dues files to test_files
fs.copyFileSync(day1Path, path.join(testFilesDir, 'Day1_Outstanding_Receivable.xls'));
fs.copyFileSync(day2Path, path.join(testFilesDir, 'Day2_Outstanding_Receivable.xls'));
fs.copyFileSync(day3Path, path.join(testFilesDir, 'Day3_Outstanding_Receivable.xls'));

console.log('Copied Day 1, Day 2, Day 3 SAP exports to test_files/');

// Extract all 25 parties and their ledger codes from Day 1 and Day 2
const getRows = (p: string) => {
  const wb = XLSX.readFile(p);
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[];
};

const partyMap = new Map<string, string>();
for (const r of [...getRows(day1Path), ...getRows(day2Path)]) {
  const code = r['Ledger Code'];
  const name = r['Party Name'];
  if (code && name && !/grand total/i.test(name)) {
    partyMap.set(String(name).trim(), String(code).trim());
  }
}

console.log(`Found ${partyMap.size} unique parties.`);

const contactRows = Array.from(partyMap.entries()).map(([partyName, ledgerCode]) => ({
  'Company Name': partyName,
  'Ledger Code': ledgerCode,
  'Branch Code': 'ABMATO',
  'Contact Person Name': 'Jayesh (Accounts Head)',
  'Designation': 'Accounts Head',
  'Mobile No.': '+91 8530383141',
  'WhatsApp No (if different)': '+91 8530383141',
  'Email ID': 'jayesh@zuigo.ai',
  'Primary Contact (Yes/No)': 'Yes',
  'Preferred Language (optional)': 'English',
}));

const wbContacts = XLSX.utils.book_new();
const wsContacts = XLSX.utils.json_to_sheet(contactRows);
XLSX.utils.book_append_sheet(wbContacts, wsContacts, 'Customer Contacts');

const contactsMasterPath = path.join(testFilesDir, 'Customer_Contacts_Master.xlsx');
XLSX.writeFile(wbContacts, contactsMasterPath);

console.log(`Successfully generated ${contactsMasterPath} with ${contactRows.length} entries.`);
