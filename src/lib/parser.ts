import * as XLSX from 'xlsx';

export interface ParsedInvoice {
  billNo: string;
  billDate: Date;
  dueDate: Date;
  billAmount: number;
  adjustment: number;
  outstandingAmount: number;
  daysOverdue: number;
  agingBucket: string;
  actionType: string;
  priority: string;
  followUpChannel: string;
  remainderFrequency?: string;
  status: string;
  narration?: string;
}

export interface ParsedContact {
  personName?: string;
  mobileNumber?: string;
  mobileNumber2?: string;
  mobileNumber3?: string;
  mobileNumber4?: string;
  emailId?: string;
  emailId2?: string;
  emailId3?: string;
  emailId4?: string;
  isPrimary?: boolean;
}

export interface ParsedCustomerRecord {
  partyName: string;
  normalizedName: string;
  station?: string;
  branchName?: string;
  branchCode?: string;
  overallPriority: string;
  totalOutstanding: number;
  contacts: ParsedContact[];
  invoices: ParsedInvoice[];
  isCustomer: boolean;
  ignoredReason?: string;
}

// Internal non-customer accounts to exclude from receivables
const NON_CUSTOMER_KEYWORDS = [
  'electricity bill',
  'tds on sales',
  'tds',
  'sales return',
  'purchase return',
  'depreciation',
  'bank charges',
  'salary',
  'audit fee',
  'gst payable',
  'input tax',
  'output tax',
];

export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .replace(/\[.*?\]/g, '') // strip codes like [ ABMATO ]
    .replace(/[()]/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function cleanPhone(phone: any): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

export function cleanEmail(email: any): string {
  if (!email) return '';
  const str = String(email).trim().toLowerCase();
  return str.includes('@') ? str : '';
}

export function parseDate(dateVal: any): Date {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) return dateVal;

  const str = String(dateVal).trim();
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  // Handle DD-MM-YYYY or DD/MM/YYYY
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
  }

  return new Date();
}

/**
 * Parses an Excel Workbook Buffer or CSV text and extracts all customers,
 * multi-bill invoices, and multi-contacts.
 */
export function parseExcelWorkbook(fileBuffer: Buffer): ParsedCustomerRecord[] {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
  const customerMap = new Map<string, ParsedCustomerRecord>();

  // Process all sheets or primary sheet
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convert to 2D array of rows
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    parseSheetRows(rows, customerMap);
  }

  return Array.from(customerMap.values());
}

/**
 * Parses raw CSV string or text lines
 */
export function parseExcelCSVText(csvText: string): ParsedCustomerRecord[] {
  const workbook = XLSX.read(csvText, { type: 'string', raw: true });
  const customerMap = new Map<string, ParsedCustomerRecord>();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    parseSheetRows(rows, customerMap);
  }

  return Array.from(customerMap.values());
}

function parseSheetRows(rows: any[][], customerMap: Map<string, ParsedCustomerRecord>) {
  let section: 'UNKNOWN' | 'TRACKER' | 'PARTY_SUMMARY' | 'CONTACTS' = 'UNKNOWN';
  let headerColMap: { [key: string]: number } = {};

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rowStr = row.map(c => String(c).trim().toLowerCase()).join(',');

    // 1. Detect Header Sections
    if (rowStr.includes('party name') && rowStr.includes('bill no') && rowStr.includes('due date')) {
      section = 'TRACKER';
      headerColMap = mapHeaderColumns(row);
      continue;
    } else if (rowStr.includes('party name') && (rowStr.includes('open bills') || rowStr.includes('total outstanding'))) {
      section = 'PARTY_SUMMARY';
      headerColMap = mapHeaderColumns(row);
      continue;
    } else if (rowStr.includes('party name') && rowStr.includes('contact name')) {
      section = 'CONTACTS';
      headerColMap = mapHeaderColumns(row);
      continue;
    }

    // 2. Process Section Data Rows
    if (section === 'TRACKER') {
      const partyName = getCol(row, headerColMap, ['party name', 'partyname', 'customer']);
      const billNo = getCol(row, headerColMap, ['bill no', 'billno', 'invoice no']);
      const billAmount = parseFloat(getCol(row, headerColMap, ['bill amount', 'billamount']) || '0');
      const outstanding = parseFloat(getCol(row, headerColMap, ['outstanding amount', 'outstanding']) || String(billAmount));

      if (!partyName || !billNo) continue;

      // Filter non-customer ledgers (TDS, electricity bill, etc.)
      const isExcluded = NON_CUSTOMER_KEYWORDS.some(k => partyName.toLowerCase().includes(k));
      const actionType = getCol(row, headerColMap, ['action type']) || (outstanding < 0 ? 'Credit Balance - No Action' : 'Follow-up Required');

      const normName = normalizeName(partyName);
      let customer = customerMap.get(normName);

      if (!customer) {
        customer = {
          partyName,
          normalizedName: normName,
          overallPriority: getCol(row, headerColMap, ['priority']) || 'Medium',
          totalOutstanding: 0,
          contacts: [],
          invoices: [],
          isCustomer: !isExcluded,
        };
        customerMap.set(normName, customer);
      }

      // Add contacts if present in this tracker row
      const contactName = getCol(row, headerColMap, ['contact persons', 'contact name']);
      const m1 = cleanPhone(getCol(row, headerColMap, ['mobile 1', 'mobile number 1']));
      const m2 = cleanPhone(getCol(row, headerColMap, ['mobile 2', 'mobile no 2']));
      const e1 = cleanEmail(getCol(row, headerColMap, ['email 1', 'email id 1']));
      const e2 = cleanEmail(getCol(row, headerColMap, ['email 2', 'email id 2']));

      if (contactName || m1 || e1) {
        mergeCustomerContacts(customer, {
          personName: contactName,
          mobileNumber: m1,
          mobileNumber2: m2,
          emailId: e1,
          emailId2: e2,
        });
      }

      // Add invoice
      const billDate = parseDate(getCol(row, headerColMap, ['bill date', 'billdate']));
      const dueDate = parseDate(getCol(row, headerColMap, ['due date', 'duedate']));
      const daysOverdue = parseInt(getCol(row, headerColMap, ['days overdue']) || '0', 10);
      const agingBucket = getCol(row, headerColMap, ['aging bucket']) || (daysOverdue <= 0 ? 'Not Yet Due' : `${daysOverdue} Days`);
      const status = getCol(row, headerColMap, ['status']) || (outstanding <= 0 ? 'Payment Received' : 'Pending');

      customer.invoices.push({
        billNo,
        billDate,
        dueDate,
        billAmount,
        adjustment: parseFloat(getCol(row, headerColMap, ['adjustment']) || '0'),
        outstandingAmount: outstanding,
        daysOverdue,
        agingBucket,
        actionType,
        priority: getCol(row, headerColMap, ['priority']) || 'Medium',
        followUpChannel: getCol(row, headerColMap, ['follow-up channel']) || 'Email + SMS',
        status,
        narration: getCol(row, headerColMap, ['narration']),
      });

      if (customer.isCustomer && actionType !== 'Credit Balance - No Action' && outstanding > 0) {
        customer.totalOutstanding += outstanding;
      }
    } else if (section === 'PARTY_SUMMARY') {
      const partyName = getCol(row, headerColMap, ['party name', 'partyname']);
      if (!partyName || partyName.toLowerCase() === 'grand total') continue;

      const normName = normalizeName(partyName);
      let customer = customerMap.get(normName);

      if (!customer) {
        const isExcluded = NON_CUSTOMER_KEYWORDS.some(k => partyName.toLowerCase().includes(k));
        customer = {
          partyName,
          normalizedName: normName,
          overallPriority: getCol(row, headerColMap, ['overall priority', 'priority']) || 'Medium',
          totalOutstanding: parseFloat(getCol(row, headerColMap, ['total outstanding']) || '0'),
          contacts: [],
          invoices: [],
          isCustomer: !isExcluded,
        };
        customerMap.set(normName, customer);
      }

      // Merge contacts from Party Summary
      const contactName = getCol(row, headerColMap, ['contact person(s)', 'contact name']);
      const m1 = cleanPhone(getCol(row, headerColMap, ['mobile 1']));
      const m2 = cleanPhone(getCol(row, headerColMap, ['mobile 2']));
      const m3 = cleanPhone(getCol(row, headerColMap, ['mobile 3']));
      const m4 = cleanPhone(getCol(row, headerColMap, ['mobile 4']));
      const e1 = cleanEmail(getCol(row, headerColMap, ['email 1']));
      const e2 = cleanEmail(getCol(row, headerColMap, ['email 2']));
      const e3 = cleanEmail(getCol(row, headerColMap, ['email 3']));
      const e4 = cleanEmail(getCol(row, headerColMap, ['email 4']));

      if (contactName || m1 || e1) {
        mergeCustomerContacts(customer, {
          personName: contactName,
          mobileNumber: m1,
          mobileNumber2: m2,
          mobileNumber3: m3,
          mobileNumber4: m4,
          emailId: e1,
          emailId2: e2,
          emailId3: e3,
          emailId4: e4,
        });
      }
    }
  }
}

function mapHeaderColumns(row: any[]): { [key: string]: number } {
  const map: { [key: string]: number } = {};
  for (let i = 0; i < row.length; i++) {
    const val = String(row[i] || '').trim().toLowerCase();
    if (val) {
      map[val] = i;
    }
  }
  return map;
}

function getCol(row: any[], headerMap: { [key: string]: number }, candidateKeys: string[]): string {
  for (const k of candidateKeys) {
    if (headerMap[k] !== undefined) {
      const idx = headerMap[k];
      return String(row[idx] || '').trim();
    }
  }
  return '';
}

function mergeCustomerContacts(customer: ParsedCustomerRecord, newContact: ParsedContact) {
  // If contact already exists, enrich empty fields
  let existing = customer.contacts[0];
  if (!existing) {
    customer.contacts.push({ ...newContact, isPrimary: true });
    return;
  }

  if (!existing.personName && newContact.personName) existing.personName = newContact.personName;
  if (!existing.mobileNumber && newContact.mobileNumber) existing.mobileNumber = newContact.mobileNumber;
  if (!existing.mobileNumber2 && newContact.mobileNumber2) existing.mobileNumber2 = newContact.mobileNumber2;
  if (!existing.emailId && newContact.emailId) existing.emailId = newContact.emailId;
  if (!existing.emailId2 && newContact.emailId2) existing.emailId2 = newContact.emailId2;
}
