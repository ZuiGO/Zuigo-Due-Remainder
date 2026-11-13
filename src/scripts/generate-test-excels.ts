import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const outDir = path.join(process.cwd(), 'data', 'test_excels');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Customer Contacts Master
const contactsData = [
  {
    'Ledger Code': 'P001',
    'Party Name': 'PARASON MACHINERY INDIA PVT LTD',
    'Branch Code': 'ABMATO',
    'Contact Person Name': 'Smit Satpute ; Vinod Kale',
    'Designation': 'Purchase Manager',
    'Mobile No': '8530383141 ; 7030940425',
    'WhatsApp No': '8530383141',
    'Email ID': 'sumit.satpute@parason.com ; jayesh@zuigo.ai',
    'Primary Contact': 'Yes',
    'Preferred Language': 'English',
  },
  {
    'Ledger Code': 'K002',
    'Party Name': 'KIRLOSKAR OIL ENGINES LTD',
    'Branch Code': 'ABMATO',
    'Contact Person Name': 'Rajesh Sharma',
    'Designation': 'Finance Head',
    'Mobile No': '8530383141',
    'WhatsApp No': '8530383141',
    'Email ID': 'jayesh@zuigo.ai',
    'Primary Contact': 'Yes',
    'Preferred Language': 'Hindi',
  },
  {
    'Ledger Code': 'M003',
    'Party Name': 'MAHINDRA & MAHINDRA LTD',
    'Branch Code': 'ABMATO',
    'Contact Person Name': 'Amit Patil',
    'Designation': 'Accounts Executive',
    'Mobile No': '8530383141',
    'WhatsApp No': '8530383141',
    'Email ID': 'jayesh@zuigo.ai',
    'Primary Contact': 'Yes',
    'Preferred Language': 'Marathi',
  },
];

const wsContacts = XLSX.utils.json_to_sheet(contactsData);
const wbContacts = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbContacts, wsContacts, 'Customer_Contacts');
XLSX.writeFile(wbContacts, path.join(outDir, 'Customer_Contacts_Master.xlsx'));

// 2. Day 1: Yesterday SAP Export
const day1Dues = [
  {
    'Ledger Code': 'P001',
    'Party Name': 'PARASON MACHINERY INDIA PVT LTD',
    'Station': 'Chhatrapati Sambhajinagar',
    'Branch Name': 'Waluj Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-001',
    'Bill Date': '01-09-2026',
    'Due Date': '01-10-2026',
    'BillAmt': 50000,
    'Adjustment': 0,
    'Outstanding': 50000,
    'Narration': 'Machinery Spare Parts Supply',
  },
  {
    'Ledger Code': 'P001',
    'Party Name': 'PARASON MACHINERY INDIA PVT LTD',
    'Station': 'Chhatrapati Sambhajinagar',
    'Branch Name': 'Waluj Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-002',
    'Bill Date': '15-09-2026',
    'Due Date': '20-10-2026',
    'BillAmt': 25000,
    'Adjustment': 0,
    'Outstanding': 25000,
    'Narration': 'Hydraulic Pump Assembly',
  },
  {
    'Ledger Code': 'K002',
    'Party Name': 'KIRLOSKAR OIL ENGINES LTD',
    'Station': 'Pune',
    'Branch Name': 'Khadki Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-003',
    'Bill Date': '10-08-2026',
    'Due Date': '15-09-2026',
    'BillAmt': 100000,
    'Adjustment': 0,
    'Outstanding': 100000,
    'Narration': 'Industrial Engine Components',
  },
  {
    'Ledger Code': 'K002',
    'Party Name': 'KIRLOSKAR OIL ENGINES LTD',
    'Station': 'Pune',
    'Branch Name': 'Khadki Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-004',
    'Bill Date': '20-09-2026',
    'Due Date': '25-10-2026',
    'BillAmt': 40000,
    'Adjustment': 0,
    'Outstanding': 40000,
    'Narration': 'Cylinder Block Castings',
  },
  {
    'Ledger Code': 'M003',
    'Party Name': 'MAHINDRA & MAHINDRA LTD',
    'Station': 'Nashik',
    'Branch Name': 'Satpur Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-005',
    'Bill Date': '05-09-2026',
    'Due Date': '10-10-2026',
    'BillAmt': 60000,
    'Adjustment': 0,
    'Outstanding': 60000,
    'Narration': 'Gearbox Housing Set',
  },
];

const wsDay1 = XLSX.utils.json_to_sheet(day1Dues);
const wbDay1 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbDay1, wsDay1, 'Outstanding_Receivable');
XLSX.writeFile(wbDay1, path.join(outDir, 'Day1_Yesterday_SAP_Export.xlsx'));

// 3. Day 2: Today SAP Export
// - INV-2024-001 (P001): SAME (50k)
// - INV-2024-002 (P001): PARTIAL PAYMENT (paid 15k, outstanding 10k)
// - INV-2024-003 (K002): SAME (100k)
// - INV-2024-004 (K002): SETTLED (not present in export)
// - INV-2024-005 (M003): SAME (60k)
// - INV-2024-006 (P001): NEW ENTRY (35k)
// - INV-2024-007 (M003): NEW ENTRY (20k)
const day2Dues = [
  {
    'Ledger Code': 'P001',
    'Party Name': 'PARASON MACHINERY INDIA PVT LTD',
    'Station': 'Chhatrapati Sambhajinagar',
    'Branch Name': 'Waluj Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-001',
    'Bill Date': '01-09-2026',
    'Due Date': '01-10-2026',
    'BillAmt': 50000,
    'Adjustment': 0,
    'Outstanding': 50000,
    'Narration': 'Machinery Spare Parts Supply',
  },
  {
    'Ledger Code': 'P001',
    'Party Name': 'PARASON MACHINERY INDIA PVT LTD',
    'Station': 'Chhatrapati Sambhajinagar',
    'Branch Name': 'Waluj Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-002',
    'Bill Date': '15-09-2026',
    'Due Date': '20-10-2026',
    'BillAmt': 25000,
    'Adjustment': 15000,
    'Outstanding': 10000, // Reduced from 25000 -> Partial payment of 15000
    'Narration': 'Hydraulic Pump Assembly',
  },
  {
    'Ledger Code': 'K002',
    'Party Name': 'KIRLOSKAR OIL ENGINES LTD',
    'Station': 'Pune',
    'Branch Name': 'Khadki Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-003',
    'Bill Date': '10-08-2026',
    'Due Date': '15-09-2026',
    'BillAmt': 100000,
    'Adjustment': 0,
    'Outstanding': 100000,
    'Narration': 'Industrial Engine Components',
  },
  // INV-2024-004 omitted -> Settled in SAP!
  {
    'Ledger Code': 'M003',
    'Party Name': 'MAHINDRA & MAHINDRA LTD',
    'Station': 'Nashik',
    'Branch Name': 'Satpur Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-005',
    'Bill Date': '05-09-2026',
    'Due Date': '10-10-2026',
    'BillAmt': 60000,
    'Adjustment': 0,
    'Outstanding': 60000,
    'Narration': 'Gearbox Housing Set',
  },
  {
    'Ledger Code': 'P001',
    'Party Name': 'PARASON MACHINERY INDIA PVT LTD',
    'Station': 'Chhatrapati Sambhajinagar',
    'Branch Name': 'Waluj Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-006',
    'Bill Date': '25-10-2026',
    'Due Date': '01-11-2026',
    'BillAmt': 35000,
    'Adjustment': 0,
    'Outstanding': 35000, // NEW BILL
    'Narration': 'Precision Tooling Set',
  },
  {
    'Ledger Code': 'M003',
    'Party Name': 'MAHINDRA & MAHINDRA LTD',
    'Station': 'Nashik',
    'Branch Name': 'Satpur Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-007',
    'Bill Date': '28-10-2026',
    'Due Date': '02-11-2026',
    'BillAmt': 20000,
    'Adjustment': 0,
    'Outstanding': 20000, // NEW BILL
    'Narration': 'Clutch Plate Kit',
  },
];

const wsDay2 = XLSX.utils.json_to_sheet(day2Dues);
const wbDay2 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbDay2, wsDay2, 'Outstanding_Receivable');
XLSX.writeFile(wbDay2, path.join(outDir, 'Day2_Today_SAP_Export.xlsx'));

// 4. Day 3: Tomorrow SAP Export
// - INV-2024-001 (P001): Settled in SAP (omitted)
// - INV-2024-002 (P001): Another partial payment of 5000 -> 5000 remaining
// - INV-2024-003 (K002): Partial payment of 40000 -> 60000 remaining
// - INV-2024-005 (M003): SAME (60k)
// - INV-2024-006 (P001): SAME (35k)
// - INV-2024-007 (M003): SAME (20k)
// - INV-2024-008 (K002): NEW BILL (80k)
const day3Dues = [
  {
    'Ledger Code': 'P001',
    'Party Name': 'PARASON MACHINERY INDIA PVT LTD',
    'Station': 'Chhatrapati Sambhajinagar',
    'Branch Name': 'Waluj Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-002',
    'Bill Date': '15-09-2026',
    'Due Date': '20-10-2026',
    'BillAmt': 25000,
    'Adjustment': 20000,
    'Outstanding': 5000, // Reduced from 10000 to 5000
    'Narration': 'Hydraulic Pump Assembly',
  },
  {
    'Ledger Code': 'K002',
    'Party Name': 'KIRLOSKAR OIL ENGINES LTD',
    'Station': 'Pune',
    'Branch Name': 'Khadki Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-003',
    'Bill Date': '10-08-2026',
    'Due Date': '15-09-2026',
    'BillAmt': 100000,
    'Adjustment': 40000,
    'Outstanding': 60000, // Reduced from 100000 to 60000
    'Narration': 'Industrial Engine Components',
  },
  {
    'Ledger Code': 'M003',
    'Party Name': 'MAHINDRA & MAHINDRA LTD',
    'Station': 'Nashik',
    'Branch Name': 'Satpur Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-005',
    'Bill Date': '05-09-2026',
    'Due Date': '10-10-2026',
    'BillAmt': 60000,
    'Adjustment': 0,
    'Outstanding': 60000,
    'Narration': 'Gearbox Housing Set',
  },
  {
    'Ledger Code': 'P001',
    'Party Name': 'PARASON MACHINERY INDIA PVT LTD',
    'Station': 'Chhatrapati Sambhajinagar',
    'Branch Name': 'Waluj Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-006',
    'Bill Date': '25-10-2026',
    'Due Date': '01-11-2026',
    'BillAmt': 35000,
    'Adjustment': 0,
    'Outstanding': 35000,
    'Narration': 'Precision Tooling Set',
  },
  {
    'Ledger Code': 'M003',
    'Party Name': 'MAHINDRA & MAHINDRA LTD',
    'Station': 'Nashik',
    'Branch Name': 'Satpur Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-007',
    'Bill Date': '28-10-2026',
    'Due Date': '02-11-2026',
    'BillAmt': 20000,
    'Adjustment': 0,
    'Outstanding': 20000,
    'Narration': 'Clutch Plate Kit',
  },
  {
    'Ledger Code': 'K002',
    'Party Name': 'KIRLOSKAR OIL ENGINES LTD',
    'Station': 'Pune',
    'Branch Name': 'Khadki Branch',
    'Branch Code': 'ABMATO',
    'Bill No': 'INV-2024-008',
    'Bill Date': '01-11-2026',
    'Due Date': '03-11-2026',
    'BillAmt': 80000,
    'Adjustment': 0,
    'Outstanding': 80000, // NEW BILL
    'Narration': 'Turbocharger Kit',
  },
];

const wsDay3 = XLSX.utils.json_to_sheet(day3Dues);
const wbDay3 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbDay3, wsDay3, 'Outstanding_Receivable');
XLSX.writeFile(wbDay3, path.join(outDir, 'Day3_Tomorrow_SAP_Export.xlsx'));

console.log('✅ Generated 4 realistic test files:');
console.log(' - Customer_Contacts_Master.xlsx');
console.log(' - Day1_Yesterday_SAP_Export.xlsx (5 bills, 3 customers)');
console.log(' - Day2_Today_SAP_Export.xlsx (2 new, 3 same, 1 partial payment, 1 settled)');
console.log(' - Day3_Tomorrow_SAP_Export.xlsx (1 new, 3 same, 2 partial payments, 1 settled)');
