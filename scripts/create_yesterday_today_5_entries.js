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

// YESTERDAY: 5 Entries (02-Nov-2026 Baseline) + Grand Total
const yesterdayEntries = [
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0007', '23-04-2026', '23-04-2026', 24802.00, 0, 24802.00, 'Carbide inserts set A'],
  ['833549088', 'S S CONTROLS', 'ABMATO', 'AMT/2026-27/0101', '30-10-2026', '30-10-2026', 9416.00, 0, 9416.00, 'Relay board units'],
  ['961866379', 'EQUINOX GAUGES', 'ABMATO', 'AMT/2026-27/0091', '10-10-2026', '10-10-2026', 3328.00, 0, 3328.00, 'Calibration gauge set'],
  ['947581601', 'MIKRONIX GAUGES PRIVATE LIMITED', 'ABMATO', 'AMT/2026-27/0029', '11-06-2026', '11-06-2026', 1764.00, 1655.00, 109.00, 'Agst: AMT/2026-27/0028, Adv: AD0010'],
  ['782921253', 'S K ENGINEERING ENTERPRISES', 'ABMATO', 'AMT/2026-27/0061', '24-08-2026', '24-08-2026', 413.00, 0, 413.00, 'Lathe cutting tool bits']
];

const yesterdayTotalRow = ['Grand Total', '', '', '', '', '', 39723.00, 1655.00, 38068.00, ''];
const yesterdayRows = [...yesterdayEntries, yesterdayTotalRow];

// TODAY: 5 Entries (03-Nov-2026 Updated) + Grand Total
const todayEntries = [
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0007', '23-04-2026', '23-04-2026', 24802.00, 10000.00, 14802.00, 'Carbide inserts set A - Partial payment ₹10,000 received'],
  ['833549088', 'S S CONTROLS', 'ABMATO', 'AMT/2026-27/0101', '30-10-2026', '30-10-2026', 9416.00, 0, 9416.00, 'Relay board units'],
  ['961866379', 'EQUINOX GAUGES', 'ABMATO', 'AMT/2026-27/0091', '10-10-2026', '10-10-2026', 3328.00, 3328.00, 0.00, 'Calibration gauge set - Fully settled today'],
  ['947581601', 'MIKRONIX GAUGES PRIVATE LIMITED', 'ABMATO', 'AMT/2026-27/0029', '11-06-2026', '11-06-2026', 1764.00, 1655.00, 109.00, 'Agst: AMT/2026-27/0028, Adv: AD0010'],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0104', '03-11-2026', '17-11-2026', 18500.00, 0, 18500.00, 'CNC milling spare set - New invoice generated 03-Nov-2026']
];

const todayTotalRow = ['Grand Total', '', '', '', '', '', 57810.00, 14983.00, 42827.00, ''];
const todayRows = [...todayEntries, todayTotalRow];

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

function safeWriteXlsx(wb, filePath) {
  try {
    XLSX.writeFile(wb, filePath);
    console.log('Written:', filePath);
  } catch (err) {
    if (err.code === 'EBUSY') {
      const altPath = filePath.replace('.xlsx', '_Totals.xlsx');
      XLSX.writeFile(wb, altPath);
      console.log('File locked by Excel. Written alternate:', altPath);
    } else {
      console.error('Error writing', filePath, err.message);
    }
  }
}

function safeWriteCsv(content, filePath) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (err) {
    if (err.code === 'EBUSY') {
      const altPath = filePath.replace('.csv', '_Totals.csv');
      fs.writeFileSync(altPath, content, 'utf8');
    }
  }
}

const targetDirs = [
  path.join(__dirname, '..', 'demo_files'),
  path.join(__dirname, '..', 'public', 'demo-files'),
  'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\21a9997d-edd4-4d21-b227-1fc51eec1345'
];

targetDirs.forEach(d => {
  if (fs.existsSync(d)) {
    // 1. Yesterday 5-entry dues with Grand Total
    const yesterdayWb = makeWorkbook('Outstanding Receivables', duesHeaders, yesterdayRows);
    safeWriteXlsx(yesterdayWb, path.join(d, 'Demo_Dues_Yesterday_5_Entries.xlsx'));
    safeWriteCsv(toCsv(duesHeaders, yesterdayRows), path.join(d, 'Demo_Dues_Yesterday_5_Entries.csv'));

    // 2. Today 5-entry dues with Grand Total
    const todayWb = makeWorkbook('Outstanding Receivables', duesHeaders, todayRows);
    safeWriteXlsx(todayWb, path.join(d, 'Demo_Dues_Today_5_Entries.xlsx'));
    safeWriteCsv(toCsv(duesHeaders, todayRows), path.join(d, 'Demo_Dues_Today_5_Entries.csv'));

    // 3. Demo Dues 5-entries (baseline with Grand Total)
    const duesWb = makeWorkbook('Outstanding Receivables', duesHeaders, yesterdayRows);
    safeWriteXlsx(duesWb, path.join(d, 'Demo_Dues_5_Entries.xlsx'));
    safeWriteCsv(toCsv(duesHeaders, yesterdayRows), path.join(d, 'Demo_Dues_5_Entries.csv'));

    // 4. Matching contacts
    const contactWb = makeWorkbook('Customer Contact Master', contactHeaders, contactRows);
    safeWriteXlsx(contactWb, path.join(d, 'Demo_Contacts_5_Entries.xlsx'));
    safeWriteCsv(toCsv(contactHeaders, contactRows), path.join(d, 'Demo_Contacts_5_Entries.csv'));

    console.log('Saved Yesterday, Today & Contacts (with Total row) in:', d);
  }
});
