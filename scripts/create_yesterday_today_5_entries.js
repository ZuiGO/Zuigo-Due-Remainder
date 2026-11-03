const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 10 Columns Standard Headers for Dues
const duesHeaders = [
  'Ledger Code',
  'Party Name',
  'Branch Code',
  'Bill No',
  'Bill Date',
  'Due Date',
  'BillAmt',
  'Adjustment',
  'Outstanding',
  'Narration'
];

// YESTERDAY: 5 Entries (02-Nov-2026 Baseline)
// All 5 have verified contacts in Contact Master, 0 TDS, 0 utility bills
const yesterdayRows = [
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0007', '23-04-2026', '23-04-2026', 24802.00, 0, 24802.00, 'Carbide inserts set A'],
  ['833549088', 'S S CONTROLS', 'ABMATO', 'AMT/2026-27/0101', '30-10-2026', '30-10-2026', 9416.00, 0, 9416.00, 'Relay board units'],
  ['961866379', 'EQUINOX GAUGES', 'ABMATO', 'AMT/2026-27/0091', '10-10-2026', '10-10-2026', 3328.00, 0, 3328.00, 'Calibration gauge set'],
  ['947581601', 'MIKRONIX GAUGES PRIVATE LIMITED', 'ABMATO', 'AMT/2026-27/0029', '11-06-2026', '11-06-2026', 1764.00, 1655, 109.00, 'Agst: AMT/2026-27/0028, Adv: AD0010'],
  ['782921253', 'S K ENGINEERING ENTERPRISES', 'ABMATO', 'AMT/2026-27/0061', '24-08-2026', '24-08-2026', 413.00, 0, 413.00, 'Lathe cutting tool bits']
];

// TODAY: 5 Entries (03-Nov-2026 Updated)
// Demonstrates daily diff reconciliation:
// 1. Indo German Tool Room: Partial payment of ₹10,000 received (Outstanding: ₹24,802 -> ₹14,802)
// 2. S S Controls: Unchanged (Outstanding: ₹9,416)
// 3. Equinox Gauges: Bill AMT/2026-27/0091 cleared in full (Adjustment: ₹3,328, Outstanding: ₹0)
// 4. Mikronix Gauges: Unchanged (Outstanding: ₹109)
// 5. Indo German Tool Room: Brand new invoice AMT/2026-27/0104 generated today for ₹18,500
const todayRows = [
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0007', '23-04-2026', '23-04-2026', 24802.00, 10000.00, 14802.00, 'Carbide inserts set A - Partial payment ₹10,000 received'],
  ['833549088', 'S S CONTROLS', 'ABMATO', 'AMT/2026-27/0101', '30-10-2026', '30-10-2026', 9416.00, 0, 9416.00, 'Relay board units'],
  ['961866379', 'EQUINOX GAUGES', 'ABMATO', 'AMT/2026-27/0091', '10-10-2026', '10-10-2026', 3328.00, 3328.00, 0.00, 'Calibration gauge set - Fully settled today'],
  ['947581601', 'MIKRONIX GAUGES PRIVATE LIMITED', 'ABMATO', 'AMT/2026-27/0029', '11-06-2026', '11-06-2026', 1764.00, 1655, 109.00, 'Agst: AMT/2026-27/0028, Adv: AD0010'],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0104', '03-11-2026', '17-11-2026', 18500.00, 0, 18500.00, 'CNC milling spare set - New invoice generated 03-Nov-2026']
];

// Matching Contact Master (10 columns, only these parties)
const contactHeaders = [
  'Ledger Code',
  'Party Name',
  'Branch Code',
  'Contact Person Name',
  'Designation',
  'Mobile No',
  'WhatsApp No (if different)',
  'Email ID',
  'Primary Contact (Yes/No)',
  'Preferred Language (optional)'
];

const contactRows = [
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'Mohit Agarwal', 'Purchase Officer', '72763 00484', '', 'ppcigtr@gmail.com', 'Yes', 'Hindi'],
  ['833549088', 'S S CONTROLS', 'ABMATO', 'Kamran Khan', 'Accounts Manager', '77579 07578', '', 'finance@sscontrols.in', 'Yes', 'Hindi'],
  ['961866379', 'EQUINOX GAUGES', 'ABMATO', 'Rohan Bubane', 'Operations Head', '80871 82898', '', 'equinox_gauges@hotmail.com', 'Yes', 'English'],
  ['947581601', 'MIKRONIX GAUGES PRIVATE LIMITED', 'ABMATO', 'Sudarshan Bhubane', 'Commercial Head', '90110 47368', '', 'sudarshan@mgpl.in', 'Yes', 'English'],
  ['782921253', 'S K ENGINEERING ENTERPRISES', 'ABMATO', 'Nagesh Morewar', 'Proprietor', '98509 65117', '', 'namorewar@gmail.com', 'Yes', 'Marathi']
];

function makeWorkbook(sheetName, headers, rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h, i) => {
    let maxLen = h.length;
    for (const r of rows) {
      const val = r[i] !== undefined && r[i] !== null ? String(r[i]) : '';
      if (val.length > maxLen) maxLen = val.length;
    }
    return { wch: Math.min(Math.max(maxLen + 3, 14), 45) };
  });
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

function toCsv(headers, rows) {
  return [headers, ...rows].map(r => r.map(c => {
    const s = c === null || c === undefined ? '' : String(c);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(',')).join('\r\n');
}

const targetDirs = [
  path.join(__dirname, '..', 'demo_files'),
  path.join(__dirname, '..', 'public', 'demo-files'),
  'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\21a9997d-edd4-4d21-b227-1fc51eec1345'
];

targetDirs.forEach(d => {
  if (fs.existsSync(d)) {
    // 1. Yesterday 5-entry dues
    const yesterdayWb = makeWorkbook('Outstanding Receivables', duesHeaders, yesterdayRows);
    XLSX.writeFile(yesterdayWb, path.join(d, 'Demo_Dues_Yesterday_5_Entries.xlsx'));
    fs.writeFileSync(path.join(d, 'Demo_Dues_Yesterday_5_Entries.csv'), toCsv(duesHeaders, yesterdayRows), 'utf8');

    // 2. Today 5-entry dues
    const todayWb = makeWorkbook('Outstanding Receivables', duesHeaders, todayRows);
    XLSX.writeFile(todayWb, path.join(d, 'Demo_Dues_Today_5_Entries.xlsx'));
    fs.writeFileSync(path.join(d, 'Demo_Dues_Today_5_Entries.csv'), toCsv(duesHeaders, todayRows), 'utf8');

    // 3. Matching contacts
    const contactWb = makeWorkbook('Customer Contact Master', contactHeaders, contactRows);
    XLSX.writeFile(contactWb, path.join(d, 'Demo_Contacts_5_Entries.xlsx'));
    fs.writeFileSync(path.join(d, 'Demo_Contacts_5_Entries.csv'), toCsv(contactHeaders, contactRows), 'utf8');

    console.log('Saved Yesterday, Today & Contacts in:', d);
  }
});
