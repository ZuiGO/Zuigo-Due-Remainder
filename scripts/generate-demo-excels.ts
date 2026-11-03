import * as XLSX from 'xlsx';
import * as path from 'path';

const downloadsDir = 'C:/Users/Admin/Downloads';

// 1. YESTERDAY'S SAP DUES EXPORT (Day 1)
const yesterdayData = [
  {
    'Ledger Code': 442769153,
    'Party Name': 'DHOOT AUTOCOMPONENTS PRIVATE LIMITED',
    'Station': 'Others',
    'Branch Name': 'Abhiyadna Machine Tools',
    'Branch Code': 'ABMATO',
    'Bill No': 'AMT/2026-27/0080',
    'Bill Date': '26-09-2026',
    'Due Date': '26-09-2026',
    'BillAmt': 56640,
    'Adjustment': 0,
    'Outstanding': 56640,
    'Narration': 'Supplying of machined fixtures'
  },
  {
    'Ledger Code': 884729104,
    'Party Name': 'INDO GERMAN TOOL ROOM',
    'Station': 'Chh Sambhajinagar',
    'Branch Name': 'Abhiyadna Machine Tools',
    'Branch Code': 'ABMATO',
    'Bill No': 'AMT/2026-27/0007',
    'Bill Date': '23-04-2026',
    'Due Date': '23-04-2026',
    'BillAmt': 24802,
    'Adjustment': 0,
    'Outstanding': 24802,
    'Narration': 'Precision tooling components'
  },
  {
    'Ledger Code': 884729104,
    'Party Name': 'INDO GERMAN TOOL ROOM',
    'Station': 'Chh Sambhajinagar',
    'Branch Name': 'Abhiyadna Machine Tools',
    'Branch Code': 'ABMATO',
    'Bill No': 'AMT/2026-27/0008',
    'Bill Date': '23-04-2026',
    'Due Date': '23-04-2026',
    'BillAmt': 10426,
    'Adjustment': 0,
    'Outstanding': 10426,
    'Narration': 'Grinding wheel accessories'
  },
  {
    'Ledger Code': 961866379,
    'Party Name': 'EQUINOX GAUGES',
    'Station': 'Pune',
    'Branch Name': 'Abhiyadna Machine Tools',
    'Branch Code': 'ABMATO',
    'Bill No': 'AMT/2026-27/0091',
    'Bill Date': '15-10-2026',
    'Due Date': '15-10-2026',
    'BillAmt': 3328,
    'Adjustment': 0,
    'Outstanding': 3328,
    'Narration': 'Air plug gauges calibration'
  },
  {
    'Ledger Code': 771234901,
    'Party Name': 'PARASON MACHINERY I PVT LTD',
    'Station': 'Others',
    'Branch Name': 'Abhiyadna Machine Tools',
    'Branch Code': 'ABMATO',
    'Bill No': 'AMT/2026-27/0015',
    'Bill Date': '12-05-2026',
    'Due Date': '12-05-2026',
    'BillAmt': 45000,
    'Adjustment': 0,
    'Outstanding': 45000,
    'Narration': 'Hydraulic seals and packing'
  }
];

const wbYesterday = XLSX.utils.book_new();
const wsYesterday = XLSX.utils.json_to_sheet(yesterdayData);
XLSX.utils.book_append_sheet(wbYesterday, wsYesterday, 'Outstanding Receivable');
const yesterdayPath = path.join(downloadsDir, '1_Yesterday_SAP_Dues_Export.xlsx');
XLSX.writeFile(wbYesterday, yesterdayPath);
console.log('Created:', yesterdayPath);

// 2. TODAY'S SAP DUES EXPORT (Day 2 with clear reconciliation differences)
const todayData = [
  // A. PARTIALLY SETTLED: DHOOT paid 31,640 -> balance reduced to 25,000
  {
    'Ledger Code': 442769153,
    'Party Name': 'DHOOT AUTOCOMPONENTS PRIVATE LIMITED',
    'Station': 'Others',
    'Branch Name': 'Abhiyadna Machine Tools',
    'Branch Code': 'ABMATO',
    'Bill No': 'AMT/2026-27/0080',
    'Bill Date': '26-09-2026',
    'Due Date': '26-09-2026',
    'BillAmt': 56640,
    'Adjustment': 31640,
    'Outstanding': 25000,
    'Narration': 'Supplying of machined fixtures - Part payment recd'
  },
  // B. FULLY SETTLED: INDO GERMAN AMT/2026-27/0007 (24,802) is cleared to 0
  {
    'Ledger Code': 884729104,
    'Party Name': 'INDO GERMAN TOOL ROOM',
    'Station': 'Chh Sambhajinagar',
    'Branch Name': 'Abhiyadna Machine Tools',
    'Branch Code': 'ABMATO',
    'Bill No': 'AMT/2026-27/0007',
    'Bill Date': '23-04-2026',
    'Due Date': '23-04-2026',
    'BillAmt': 24802,
    'Adjustment': 24802,
    'Outstanding': 0,
    'Narration': 'Precision tooling components - Fully Settled'
  },
  // C. UNCHANGED / STILL OPEN: INDO GERMAN AMT/2026-27/0008 (10,426) remains unpaid
  {
    'Ledger Code': 884729104,
    'Party Name': 'INDO GERMAN TOOL ROOM',
    'Station': 'Chh Sambhajinagar',
    'Branch Name': 'Abhiyadna Machine Tools',
    'Branch Code': 'ABMATO',
    'Bill No': 'AMT/2026-27/0008',
    'Bill Date': '23-04-2026',
    'Due Date': '23-04-2026',
    'BillAmt': 10426,
    'Adjustment': 0,
    'Outstanding': 10426,
    'Narration': 'Grinding wheel accessories'
  },
  // D. UNCHANGED / STILL OPEN: EQUINOX GAUGES (3,328) remains unpaid
  {
    'Ledger Code': 961866379,
    'Party Name': 'EQUINOX GAUGES',
    'Station': 'Pune',
    'Branch Name': 'Abhiyadna Machine Tools',
    'Branch Code': 'ABMATO',
    'Bill No': 'AMT/2026-27/0091',
    'Bill Date': '15-10-2026',
    'Due Date': '15-10-2026',
    'BillAmt': 3328,
    'Adjustment': 0,
    'Outstanding': 3328,
    'Narration': 'Air plug gauges calibration'
  },
  // E. UNCHANGED / STILL OPEN: PARASON MACHINERY (45,000)
  {
    'Ledger Code': 771234901,
    'Party Name': 'PARASON MACHINERY I PVT LTD',
    'Station': 'Others',
    'Branch Name': 'Abhiyadna Machine Tools',
    'Branch Code': 'ABMATO',
    'Bill No': 'AMT/2026-27/0015',
    'Bill Date': '12-05-2026',
    'Due Date': '12-05-2026',
    'BillAmt': 45000,
    'Adjustment': 0,
    'Outstanding': 45000,
    'Narration': 'Hydraulic seals and packing'
  },
  // F. BRAND NEW BILL TODAY: PARASON MACHINERY (18,500)
  {
    'Ledger Code': 771234901,
    'Party Name': 'PARASON MACHINERY I PVT LTD',
    'Station': 'Others',
    'Branch Name': 'Abhiyadna Machine Tools',
    'Branch Code': 'ABMATO',
    'Bill No': 'AMT/2026-27/0112',
    'Bill Date': '03-11-2026',
    'Due Date': '03-11-2026',
    'BillAmt': 18500,
    'Adjustment': 0,
    'Outstanding': 18500,
    'Narration': 'New delivery - CNC lathe tool holders'
  }
];

const wbToday = XLSX.utils.book_new();
const wsToday = XLSX.utils.json_to_sheet(todayData);
XLSX.utils.book_append_sheet(wbToday, wsToday, 'Outstanding Receivable');
const todayPath = path.join(downloadsDir, '2_Today_SAP_Dues_Export.xlsx');
XLSX.writeFile(wbToday, todayPath);
console.log('Created:', todayPath);

// 3. CUSTOMER CONTACTS MASTER (With real contacts & demo targets)
const contactsData = [
  {
    'Company Name': 'DHOOT AUTOCOMPONENTS PRIVATE LIMITED',
    'Ledger Code': 442769153,
    'Contact Person Name': 'Sunil Sharma',
    'Designation': 'Finance Manager',
    'Mobile No.': '8530383141',
    'Email ID': 'jayesh@zuigo.ai',
    'Primary Contact (Yes/No)': 'Yes',
    'Preferred Language (optional)': 'Hindi'
  },
  {
    'Company Name': 'INDO GERMAN TOOL ROOM',
    'Ledger Code': 884729104,
    'Contact Person Name': 'Mohit Agarwal',
    'Designation': 'Accounts Head',
    'Mobile No.': '8530383141',
    'Email ID': 'jayesh@zuigo.ai',
    'Primary Contact (Yes/No)': 'Yes',
    'Preferred Language (optional)': 'English'
  },
  {
    'Company Name': 'EQUINOX GAUGES',
    'Ledger Code': 961866379,
    'Contact Person Name': 'Anand Kulkarni',
    'Designation': 'Commercial Lead',
    'Mobile No.': '8530383141',
    'Email ID': 'jayesh@zuigo.ai',
    'Primary Contact (Yes/No)': 'Yes',
    'Preferred Language (optional)': 'Marathi'
  },
  {
    'Company Name': 'PARASON MACHINERY I PVT LTD',
    'Ledger Code': 771234901,
    'Contact Person Name': 'Pravin Deshmukh',
    'Designation': 'Accounts Executive',
    'Mobile No.': '8530383141',
    'Email ID': 'jayesh@zuigo.ai',
    'Primary Contact (Yes/No)': 'Yes',
    'Preferred Language (optional)': 'English'
  }
];

const wbContacts = XLSX.utils.book_new();
const wsContacts = XLSX.utils.json_to_sheet(contactsData);
XLSX.utils.book_append_sheet(wbContacts, wsContacts, 'Customer Contacts');
const contactsPath = path.join(downloadsDir, 'Customer_Contacts_Master.xlsx');
XLSX.writeFile(wbContacts, contactsPath);
console.log('Created:', contactsPath);
