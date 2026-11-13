const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 1. Target Directories
const demoDir = path.join(__dirname, '..', 'demo_files');
const publicDir = path.join(__dirname, '..', 'public', 'demo-files');
const brainDir = 'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\21a9997d-edd4-4d21-b227-1fc51eec1345';

[demoDir, publicDir].forEach(d => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
});

// 2. Customer Contacts Master (10 columns)
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
  ['999999999', 'ABC Engineering Pvt Ltd (example)', 'ABMATO', 'Rakesh Shah', 'Accounts Manager', '9822012345', '', 'rakesh@abcengineering.com', 'Yes', 'Marathi'],
  ['442769153', 'DHOOT AUTOCOMPONENTS PRIVATE LIMITED', 'ABMATO', '', '', '', '', '', '', ''],
  ['961866379', 'EQUINOX GAUGES', 'ABMATO', 'Rohan Bubane', '', '80871 82898', '', 'equinox_gauges@hotmail.com', 'Yes', 'English'],
  ['197978356', 'FYTOMAX NUTRITION PRIVATE LIMITED', 'ABMATO', '', '', '', '', '', '', ''],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'Mohit Agarwal', 'Purchase Officer', '72763 00484', '', 'ppcigtr@gmail.com', 'Yes', 'Hindi'],
  ['227801757', 'INFINITY TOOLINGS', 'ABMATO', '', '', '', '', '', '', ''],
  ['698776440', 'M/s. SAMARTHA WIRE-CUT', 'ABMATO', '', '', '', '', '', '', ''],
  ['105228753', 'MENSURA TECHNOLOGIES', 'ABMATO', '', '', '', '', '', '', ''],
  ['947581601', 'MIKRONIX GAUGES PRIVATE LIMITED', 'ABMATO', 'Sudarshan Bhubane', 'Commercial Head', '90110 47368', '', 'sudarshan@mgpl.in', 'Yes', 'English'],
  ['640851289', 'NRB IBC BEARINGS PVT LTD', 'ABMATO', '', '', '', '', '', '', ''],
  ['674877339', 'NRB INDUSTRIAL BEARINGS LIMITED', 'ABMATO', '', '', '', '', '', '', ''],
  ['627533496', 'Parason Machinery(I) Pvt Ltd 2002(R&D)', 'ABMATO', 'Smit Satpute', 'Finance Executive', '89560 81914', '', 'sumit.satpute@parason.com', 'Yes', 'English'],
  ['627533496', 'Parason Machinery(I) Pvt Ltd 2002(R&D)', 'ABMATO', 'Vinod Kale', 'General Manager', '70309 40425', '', 'vinod.kale@parason.com', 'No', 'Marathi'],
  ['772301421', 'RATIONAL TECHNOLOGIES', 'ABMATO', '', '', '', '', '', '', ''],
  ['782921253', 'S K ENGINEERING ENTERPRISES', 'ABMATO', 'Nagesh Morewar', 'Proprietor', '98509 65117', '', 'namorewar@gmail.com', 'Yes', 'Marathi'],
  ['833549088', 'S S CONTROLS', 'ABMATO', 'Kamran Khan', 'Accounts Manager', '77579 07578', '', 'finance@sscontrols.in', 'Yes', 'Hindi'],
  ['833549088', 'S S CONTROLS', 'ABMATO', 'Pravin Shinde', 'Design Lead', '70576 18529', '', 'design.mech@sscontrols.in', 'No', 'Marathi'],
  ['670212689', 'Shobha Packaging Company', 'ABMATO', '', '', '', '', '', '', ''],
  ['666880224', 'TATA ADVANCED SYSTEMS LIMITED', 'ABMATO', '', '', '', '', '', '', ''],
  ['650772316', 'Tragen Technology Pvt Ltd', 'ABMATO', '', '', '', '', '', '', ''],
  ['649831463', 'TURBONOVA POLYMERS PRIVATE LIMITED', 'ABMATO', '', '', '', '', '', '', ''],
  ['325467870', 'VIGHNARAJENDRA PROPACK PRIVATE LIMITED', 'ABMATO', '', '', '', '', '', '', ''],
];

// 3. Outstanding Receivables - 10 Columns
// Column 1: Ledger Code
// Column 2: Party Name
// Column 3: Branch Code
// Column 4: Bill No
// Column 5: Bill Date
// Column 6: Due Date
// Column 7: BillAmt
// Column 8: Adjustment
// Column 9: Outstanding
// Column 10: Narration

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

// Yesterday's Baseline Data (02-11-2026)
const yesterdayRows = [
  ['442769153', 'DHOOT AUTOCOMPONENTS PRIVATE LIMITED', 'ABMATO', 'AMT/2026-27/0080', '26-09-2026', '26-09-2026', 56640.00, 0, 56640.00, 'Machine tooling supply batch 1'],
  ['345325836', 'Electricity Bill', 'ABMATO', 'AD0001 [0000001]', '01-06-2026', '15-05-2026', 9074.83, 0, 9075.00, 'Paid electricity bill for the month of April 2026 via PhonePe'],
  ['961866379', 'EQUINOX GAUGES', 'ABMATO', 'AMT/2026-27/0091', '10-10-2026', '10-10-2026', 3328.00, 0, 3328.00, 'Calibration gauge set'],
  ['197978356', 'FYTOMAX NUTRITION PRIVATE LIMITED', 'ABMATO', 'AMT/2026-27/0083', '28-09-2026', '28-09-2026', 1605.00, 0, 1605.00, 'Nutrient mixing blades'],
  ['197978356', 'FYTOMAX NUTRITION PRIVATE LIMITED', 'ABMATO', 'AMT/2026-27/0097', '26-10-2026', '26-10-2026', 2502.00, 0, 2502.00, 'Replacement rotor kit'],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0007', '23-04-2026', '23-04-2026', 24802.00, 0, 24802.00, 'Carbide inserts set A'],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0008', '23-04-2026', '23-04-2026', 10426.00, 0, 10426.00, 'Carbide inserts set B'],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0009', '23-04-2026', '23-04-2026', 8756.00, 0, 8756.00, 'Tool holders and fixtures'],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0010', '23-04-2026', '23-04-2026', 21890.00, 0, 21890.00, 'Milling head attachments'],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0055', '14-08-2026', '14-08-2026', 2257.00, 0, 2257.00, 'Boring bar spare parts'],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0092', '10-10-2026', '24-11-2026', 3006.00, 0, 3006.00, 'Upcoming scheduled delivery'],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0096', '23-10-2026', '07-12-2026', 6048.00, 0, 6048.00, 'December service tooling'],
  ['227801757', 'INFINITY TOOLINGS', 'ABMATO', 'AMT/2026-27/0089', '08-10-2026', '08-10-2026', 1416.00, 0, 1416.00, 'Die springs batch'],
  ['698776440', 'M/s. SAMARTHA WIRE-CUT', 'ABMATO', 'AD0005 [CN00001]', '30-09-2026', '30-09-2026', -125.00, 0, -125.00, 'Amount Return to Samarth wirecut'],
  ['105228753', 'MENSURA TECHNOLOGIES', 'ABMATO', 'AD0002 [0000020]', '23-07-2026', '15-07-2026', -35.00, 0, -35.00, 'Agst: AMT/2026-27/0034Adv: AD0002,'],
  ['947581601', 'MIKRONIX GAUGES PRIVATE LIMITED', 'ABMATO', 'AMT/2026-27/0029 [0000024]', '11-06-2026', '11-06-2026', 1764.00, 1655, 109.00, 'Agst:AMT/2026-27/0028, AMT/2026-27/0029 Cheque: 010560, Adv: AD0010, TDS'],
  ['640851289', 'NRB IBC BEARINGS PVT LTD', 'ABMATO', 'AMT/2026-27/0084', '29-09-2026', '13-11-2026', 75933.00, 0, 75933.00, 'Deep groove ball bearings lot 1'],
  ['640851289', 'NRB IBC BEARINGS PVT LTD', 'ABMATO', 'AMT/2026-27/0087', '05-10-2026', '19-11-2026', 88358.00, 0, 88358.00, 'Cylindrical roller bearings lot 2'],
  ['674877339', 'NRB INDUSTRIAL BEARINGS LIMITED', 'ABMATO', 'AMT/2026-27/0082', '28-09-2026', '28-09-2026', 784.00, 0, 784.00, 'Bearing sleeve kit'],
  ['627533496', 'Parason Machinery(I) Pvt Ltd 2002(R&D)', 'ABMATO', 'AMT/2026-27/0019 [0000010]', '21-05-2026', '21-05-2026', 22656.00, 22464, 192.00, 'Agst: AMT/2026-27/0017, AMT/2026-27/0018, AMT/2026-27/0019'],
  ['627533496', 'Parason Machinery(I) Pvt Ltd 2002(R&D)', 'ABMATO', 'AMT/2026-27/0037 [0000059]', '29-06-2026', '29-06-2026', 22656.00, 22464, 192.00, 'Agst: AMT/2026-27/0037'],
  ['772301421', 'RATIONAL TECHNOLOGIES', 'ABMATO', 'AMT/2026-27/0100', '29-10-2026', '29-10-2026', 47200.00, 0, 47200.00, 'Automated lathe controller'],
  ['782921253', 'S K ENGINEERING ENTERPRISES', 'ABMATO', 'AMT/2026-27/0061', '24-08-2026', '24-08-2026', 413.00, 0, 413.00, 'Lathe cutting tool bits'],
  ['833549088', 'S S CONTROLS', 'ABMATO', 'AMT/2026-27/0101', '30-10-2026', '30-10-2026', 9416.00, 0, 9416.00, 'Relay board units'],
  ['813361163', 'Sales Return', 'ABMATO', 'AD0006 [CN00001]', '30-09-2026', '30-09-2026', 125.00, 0, 125.00, 'Amount Return to Samarth wirecut'],
  ['670212689', 'Shobha Packaging Company', 'ABMATO', 'AD0009 [0000050]', '03-10-2026', '03-10-2026', -49467.00, 0, -49467.00, 'Agst: AMT/2026-27/0085Adv: AD0009,'],
  ['666880224', 'TATA ADVANCED SYSTEMS LIMITED', 'ABMATO', 'AMT/2026-27/0099', '29-10-2026', '13-12-2026', 94872.00, 0, 94872.00, 'Aerospace alloy machining components'],
  ['678360322', 'TDS on Sales', 'ABMATO', 'AD0012 [0000004]', '18-06-2026', '18-06-2026', 192.00, 0, 192.00, 'Internal tax entry'],
  ['678360322', 'TDS on Sales', 'ABMATO', 'AD0013 [0000005]', '10-07-2026', '10-07-2026', 192.00, 0, 192.00, 'Internal tax entry'],
  ['678360322', 'TDS on Sales', 'ABMATO', 'AD0007 [0000002]', '03-10-2026', '03-10-2026', 1840.00, 0, 1840.00, 'Adv: AD0007, TDS AMT/2026-27/075 & 065'],
  ['678360322', 'TDS on Sales', 'ABMATO', 'AD0010 [0000003]', '06-10-2026', '06-10-2026', 109.00, 0, 109.00, 'Adv: AD0010, TDS'],
  ['678360322', 'TDS on Sales', 'ABMATO', 'AD0014 [0000006]', '12-10-2026', '12-10-2026', 229.00, 0, 229.00, 'Adv: AD0014,'],
  ['650772316', 'Tragen Technology Pvt Ltd', 'ABMATO', 'AMT/2026-27/0088', '08-10-2026', '08-10-2026', 114460.00, 0, 114460.00, 'Custom CNC spindle assembly'],
  ['649831463', 'TURBONOVA POLYMERS PRIVATE LIMITED', 'ABMATO', 'AMT/2026-27/0047', '28-07-2026', '28-07-2026', 5682.00, 0, 5682.00, 'Polymer injection moulds'],
  ['325467870', 'VIGHNARAJENDRA PROPACK PRIVATE LIMITED', 'ABMATO', 'AMT/2026-27/0046', '14-07-2026', '14-07-2026', 661.00, 0, 661.00, 'Packaging seal strips'],
];

// Today's Updated Data (03-11-2026)
// Key Differences for Demo Reconciliation:
// 1. SETTLED (Cleared): EQUINOX GAUGES (AMT/2026-27/0091 - ₹3,328 cleared to 0 / omitted)
// 2. SETTLED (Cleared): TURBONOVA POLYMERS (AMT/2026-27/0047 - ₹5,682 cleared to 0 / omitted)
// 3. PARTIAL PAYMENT: Tragen Technology (AMT/2026-27/0088: ₹50,000 paid -> ₹64,460 remaining)
// 4. PARTIAL PAYMENT: DHOOT AUTOCOMPONENTS (AMT/2026-27/0080: ₹20,000 paid -> ₹36,640 remaining)
// 5. PARTIAL PAYMENT: INDO GERMAN TOOL ROOM (AMT/2026-27/0007: ₹10,000 paid -> ₹14,802 remaining)
// 6. NEW ENTRY: TATA ADVANCED SYSTEMS LIMITED (AMT/2026-27/0105: ₹52,400.00 due 18-12-2026)
// 7. NEW ENTRY: INDO GERMAN TOOL ROOM (AMT/2026-27/0104: ₹18,500.00 due 17-11-2026)
// 8. NEW ENTRY (Due Today!): S S CONTROLS (AMT/2026-27/0106: ₹14,250.00 due 03-11-2026)

const todayRows = [
  // 1. Dhoot - Partial payment received (₹20,000 paid)
  ['442769153', 'DHOOT AUTOCOMPONENTS PRIVATE LIMITED', 'ABMATO', 'AMT/2026-27/0080', '26-09-2026', '26-09-2026', 56640.00, 20000.00, 36640.00, 'Machine tooling supply batch 1 - Partial payment received ₹20,000 via NEFT'],
  ['345325836', 'Electricity Bill', 'ABMATO', 'AD0001 [0000001]', '01-06-2026', '15-05-2026', 9074.83, 0, 9075.00, 'Paid electricity bill for the month of April 2026 via PhonePe'],
  // EQUINOX GAUGES bill AMT/2026-27/0091 is SETTLED (omitted from today's active receivables)
  ['197978356', 'FYTOMAX NUTRITION PRIVATE LIMITED', 'ABMATO', 'AMT/2026-27/0083', '28-09-2026', '28-09-2026', 1605.00, 0, 1605.00, 'Nutrient mixing blades'],
  ['197978356', 'FYTOMAX NUTRITION PRIVATE LIMITED', 'ABMATO', 'AMT/2026-27/0097', '26-10-2026', '26-10-2026', 2502.00, 0, 2502.00, 'Replacement rotor kit'],
  // Indo German - Partial payment on Bill 0007 (₹10,000 paid)
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0007', '23-04-2026', '23-04-2026', 24802.00, 10000.00, 14802.00, 'Carbide inserts set A - RTGS payment received ₹10,000'],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0008', '23-04-2026', '23-04-2026', 10426.00, 0, 10426.00, 'Carbide inserts set B'],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0009', '23-04-2026', '23-04-2026', 8756.00, 0, 8756.00, 'Tool holders and fixtures'],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0010', '23-04-2026', '23-04-2026', 21890.00, 0, 21890.00, 'Milling head attachments'],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0055', '14-08-2026', '14-08-2026', 2257.00, 0, 2257.00, 'Boring bar spare parts'],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0092', '10-10-2026', '24-11-2026', 3006.00, 0, 3006.00, 'Upcoming scheduled delivery'],
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0096', '23-10-2026', '07-12-2026', 6048.00, 0, 6048.00, 'December service tooling'],
  // Indo German - NEW BILL GENERATED TODAY
  ['262908375', 'INDO GERMAN TOOL ROOM', 'ABMATO', 'AMT/2026-27/0104', '03-11-2026', '17-11-2026', 18500.00, 0, 18500.00, 'CNC milling spare set - Dispatched 03-Nov-2026'],
  ['227801757', 'INFINITY TOOLINGS', 'ABMATO', 'AMT/2026-27/0089', '08-10-2026', '08-10-2026', 1416.00, 0, 1416.00, 'Die springs batch'],
  ['698776440', 'M/s. SAMARTHA WIRE-CUT', 'ABMATO', 'AD0005 [CN00001]', '30-09-2026', '30-09-2026', -125.00, 0, -125.00, 'Amount Return to Samarth wirecut'],
  ['105228753', 'MENSURA TECHNOLOGIES', 'ABMATO', 'AD0002 [0000020]', '23-07-2026', '15-07-2026', -35.00, 0, -35.00, 'Agst: AMT/2026-27/0034Adv: AD0002,'],
  ['947581601', 'MIKRONIX GAUGES PRIVATE LIMITED', 'ABMATO', 'AMT/2026-27/0029 [0000024]', '11-06-2026', '11-06-2026', 1764.00, 1655, 109.00, 'Agst:AMT/2026-27/0028, AMT/2026-27/0029 Cheque: 010560, Adv: AD0010, TDS'],
  ['640851289', 'NRB IBC BEARINGS PVT LTD', 'ABMATO', 'AMT/2026-27/0084', '29-09-2026', '13-11-2026', 75933.00, 0, 75933.00, 'Deep groove ball bearings lot 1'],
  ['640851289', 'NRB IBC BEARINGS PVT LTD', 'ABMATO', 'AMT/2026-27/0087', '05-10-2026', '19-11-2026', 88358.00, 0, 88358.00, 'Cylindrical roller bearings lot 2'],
  ['674877339', 'NRB INDUSTRIAL BEARINGS LIMITED', 'ABMATO', 'AMT/2026-27/0082', '28-09-2026', '28-09-2026', 784.00, 0, 784.00, 'Bearing sleeve kit'],
  ['627533496', 'Parason Machinery(I) Pvt Ltd 2002(R&D)', 'ABMATO', 'AMT/2026-27/0019 [0000010]', '21-05-2026', '21-05-2026', 22656.00, 22464, 192.00, 'Agst: AMT/2026-27/0017, AMT/2026-27/0018, AMT/2026-27/0019'],
  ['627533496', 'Parason Machinery(I) Pvt Ltd 2002(R&D)', 'ABMATO', 'AMT/2026-27/0037 [0000059]', '29-06-2026', '29-06-2026', 22656.00, 22464, 192.00, 'Agst: AMT/2026-27/0037'],
  ['772301421', 'RATIONAL TECHNOLOGIES', 'ABMATO', 'AMT/2026-27/0100', '29-10-2026', '29-10-2026', 47200.00, 0, 47200.00, 'Automated lathe controller'],
  ['782921253', 'S K ENGINEERING ENTERPRISES', 'ABMATO', 'AMT/2026-27/0061', '24-08-2026', '24-08-2026', 413.00, 0, 413.00, 'Lathe cutting tool bits'],
  ['833549088', 'S S CONTROLS', 'ABMATO', 'AMT/2026-27/0101', '30-10-2026', '30-10-2026', 9416.00, 0, 9416.00, 'Relay board units'],
  // S S Controls - NEW BILL DUE TODAY (03-11-2026)
  ['833549088', 'S S CONTROLS', 'ABMATO', 'AMT/2026-27/0106', '03-11-2026', '03-11-2026', 14250.00, 0, 14250.00, 'Control panel assembly - Due Today'],
  ['813361163', 'Sales Return', 'ABMATO', 'AD0006 [CN00001]', '30-09-2026', '30-09-2026', 125.00, 0, 125.00, 'Amount Return to Samarth wirecut'],
  ['670212689', 'Shobha Packaging Company', 'ABMATO', 'AD0009 [0000050]', '03-10-2026', '03-10-2026', -49467.00, 0, -49467.00, 'Agst: AMT/2026-27/0085Adv: AD0009,'],
  ['666880224', 'TATA ADVANCED SYSTEMS LIMITED', 'ABMATO', 'AMT/2026-27/0099', '29-10-2026', '13-12-2026', 94872.00, 0, 94872.00, 'Aerospace alloy machining components'],
  // Tata Advanced - NEW BILL GENERATED TODAY
  ['666880224', 'TATA ADVANCED SYSTEMS LIMITED', 'ABMATO', 'AMT/2026-27/0105', '03-11-2026', '18-12-2026', 52400.00, 0, 52400.00, 'High-precision titanium tooling components batch 2'],
  ['678360322', 'TDS on Sales', 'ABMATO', 'AD0012 [0000004]', '18-06-2026', '18-06-2026', 192.00, 0, 192.00, 'Internal tax entry'],
  ['678360322', 'TDS on Sales', 'ABMATO', 'AD0013 [0000005]', '10-07-2026', '10-07-2026', 192.00, 0, 192.00, 'Internal tax entry'],
  ['678360322', 'TDS on Sales', 'ABMATO', 'AD0007 [0000002]', '03-10-2026', '03-10-2026', 1840.00, 0, 1840.00, 'Adv: AD0007, TDS AMT/2026-27/075 & 065'],
  ['678360322', 'TDS on Sales', 'ABMATO', 'AD0010 [0000003]', '06-10-2026', '06-10-2026', 109.00, 0, 109.00, 'Adv: AD0010, TDS'],
  ['678360322', 'TDS on Sales', 'ABMATO', 'AD0014 [0000006]', '12-10-2026', '12-10-2026', 229.00, 0, 229.00, 'Adv: AD0014,'],
  // Tragen Technology - Partial payment received (₹50,000 paid)
  ['650772316', 'Tragen Technology Pvt Ltd', 'ABMATO', 'AMT/2026-27/0088', '08-10-2026', '08-10-2026', 114460.00, 50000.00, 64460.00, 'Custom CNC spindle assembly - ₹50,000 partial payment received via IMPS'],
  // TURBONOVA POLYMERS bill AMT/2026-27/0047 is SETTLED (omitted from today's active receivables)
  ['325467870', 'VIGHNARAJENDRA PROPACK PRIVATE LIMITED', 'ABMATO', 'AMT/2026-27/0046', '14-07-2026', '14-07-2026', 661.00, 0, 661.00, 'Packaging seal strips'],
];

// Helper: Build Workbook with nice column widths
function createWorkbook(sheetName, headers, rows) {
  const wb = XLSX.utils.book_new();
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths based on longest string
  ws['!cols'] = headers.map((h, i) => {
    let maxLen = h.length;
    for (const r of rows) {
      const val = r[i] !== undefined && r[i] !== null ? String(r[i]) : '';
      if (val.length > maxLen) maxLen = val.length;
    }
    return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
  });

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

// Helper: CSV stringifier
function toCsv(headers, rows) {
  const all = [headers, ...rows];
  return all.map(r => r.map(cell => {
    const s = cell === null || cell === undefined ? '' : String(cell);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }).join(',')).join('\r\n');
}

// Write Files
const files = [
  {
    name: 'Customer_Contacts_Master',
    sheet: 'Customer Contact Master',
    headers: contactHeaders,
    rows: contactRows
  },
  {
    name: 'Outstanding_Receivables_Yesterday_02_Nov',
    sheet: 'Outstanding Receivables',
    headers: duesHeaders,
    rows: yesterdayRows
  },
  {
    name: 'Outstanding_Receivables_Today_03_Nov',
    sheet: 'Outstanding Receivables',
    headers: duesHeaders,
    rows: todayRows
  }
];

for (const f of files) {
  const wb = createWorkbook(f.sheet, f.headers, f.rows);
  const csvContent = toCsv(f.headers, f.rows);

  // Save to demo_files
  const xlsxPath1 = path.join(demoDir, `${f.name}.xlsx`);
  const csvPath1 = path.join(demoDir, `${f.name}.csv`);
  XLSX.writeFile(wb, xlsxPath1);
  fs.writeFileSync(csvPath1, csvContent, 'utf8');

  // Save to public/demo-files
  const xlsxPath2 = path.join(publicDir, `${f.name}.xlsx`);
  const csvPath2 = path.join(publicDir, `${f.name}.csv`);
  XLSX.writeFile(wb, xlsxPath2);
  fs.writeFileSync(csvPath2, csvContent, 'utf8');

  // Also write to brain conversation directory if exists
  if (fs.existsSync(brainDir)) {
    const xlsxBrain = path.join(brainDir, `${f.name}.xlsx`);
    const csvBrain = path.join(brainDir, `${f.name}.csv`);
    XLSX.writeFile(wb, xlsxBrain);
    fs.writeFileSync(csvBrain, csvContent, 'utf8');
  }

  console.log(`Generated: ${f.name}.xlsx and ${f.name}.csv (${f.rows.length} rows, ${f.headers.length} columns)`);
}

console.log('All files created successfully!');
