import * as XLSX from 'xlsx';

export interface ParsedSapBill {
  ledgerCode: string;
  partyName: string;
  station?: string;
  branchName?: string;
  branchCode: string;
  billNo: string;
  billDate: Date;
  dueDate: Date;
  billAmount: number;
  adjustment: number;
  outstandingAmount: number;
  daysOverdue: number;
  agingBucket: string;
  actionType: 'Follow-up Required' | 'No Action';
  priority: 'High' | 'Medium' | 'Low';
  narration?: string;
  isExcluded: boolean;
}

export interface ParsedContactRecord {
  ledgerCode?: string;
  partyName: string;
  branchCode?: string;
  personName: string;
  designation?: string;
  mobileNumber?: string;
  whatsappNumber?: string;
  emailId?: string;
  isPrimary: boolean;
  preferredLanguage?: string;
  hasMissingContacts?: boolean;
}

export type FeedType = 'SAP_DUES' | 'CUSTOMER_CONTACTS' | 'MULTI_SHEET' | 'UNKNOWN';

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
export const NON_CUSTOMER_KEYWORDS = [
  'electricity bill',
  'electricity',
  'msedcl',
  'mseb',
  'tds on sales',
  'tds payable',
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

export function isNonTradeOrExcludedAccount(partyName: string): boolean {
  if (!partyName) return false;
  const lower = partyName.toLowerCase().trim();
  return (
    NON_CUSTOMER_KEYWORDS.some((k) => lower.includes(k)) ||
    /^electricity\b/i.test(lower) ||
    /^tds\b/i.test(lower)
  );
}

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

/**
 * Splits delimited multi-contact strings (semicolons, newlines, slashes).
 * Used when a single Excel cell contains multiple people, phones, or emails.
 */
export function splitDelimited(val: any): string[] {
  if (!val) return [];
  const str = String(val).trim();
  if (!str) return [];
  return str
    .split(/[;\n\r/]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Standardizes phone numbers to clean E.164 (+91...) format
 */
export function formatPhoneNumber(rawPhone: string): string | null {
  if (!rawPhone) return null;
  const digits = rawPhone.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.length === 10) {
    return `+91${digits}`;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  } else if (digits.length >= 10 && digits.length <= 13) {
    return `+${digits}`;
  }
  return null;
}

/**
 * Parses date string in DD-MM-YYYY, YYYY-MM-DD, or Excel serial format
 */
export function parseDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;

  if (typeof val === 'number') {
    // Excel serial number (days since Jan 1 1900)
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + val * 86400000);
  }

  const str = String(val).trim();
  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Detects feed type by inspecting column headers and structure, agnostic of file name.
 */
export function detectFeedType(workbook: XLSX.WorkBook): FeedType {
  const sheetNames = workbook.SheetNames;
  if (!sheetNames || sheetNames.length === 0) return 'UNKNOWN';

  const getSheetKeywords = (sheet: XLSX.WorkSheet): string[] => {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    const topRows = rows.slice(0, 15);
    const keywords: string[] = [];
    for (const r of topRows) {
      if (Array.isArray(r)) {
        for (const cell of r) {
          if (cell !== undefined && cell !== null) {
            keywords.push(String(cell).trim().toLowerCase());
          }
        }
      }
    }
    return keywords;
  };

  const isDuesSheet = (keywords: string[]): boolean => {
    return keywords.some(
      k =>
        /bill\s*no/i.test(k) ||
        /outstanding/i.test(k) ||
        /bill\s*amt/i.test(k) ||
        /bill\s*date/i.test(k)
    );
  };

  const isContactsSheet = (keywords: string[]): boolean => {
    return keywords.some(
      k =>
        /contact\s*person/i.test(k) ||
        /mobile/i.test(k) ||
        /designation/i.test(k) ||
        (/company\s*name/i.test(k) && keywords.some(x => /email/i.test(x) || /mobile/i.test(x))) ||
        (/party\s*name/i.test(k) && keywords.some(x => /email/i.test(x) || /mobile/i.test(x)))
    );
  };

  if (sheetNames.length > 1) {
    let hasDues = false;
    let hasContacts = false;
    for (const name of sheetNames) {
      const kw = getSheetKeywords(workbook.Sheets[name]);
      if (isDuesSheet(kw)) hasDues = true;
      if (isContactsSheet(kw)) hasContacts = true;
    }
    if (hasDues && hasContacts) return 'MULTI_SHEET';
  }

  const firstKeywords = getSheetKeywords(workbook.Sheets[sheetNames[0]]);
  if (isDuesSheet(firstKeywords)) return 'SAP_DUES';
  if (isContactsSheet(firstKeywords)) return 'CUSTOMER_CONTACTS';

  return 'UNKNOWN';
}

/**
 * Parses SAP Dues Export (Outstanding Receivable) from HTML ALV, XLSX, or CSV.
 * Automatically skips company letterhead and discards Grand Total.
 */
export function parseSapDuesExport(bufferOrText: Buffer | string): ParsedSapBill[] {
  const buffer = typeof bufferOrText === 'string' ? Buffer.from(bufferOrText) : bufferOrText;
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);
  const now = new Date();
  const parsedBills: ParsedSapBill[] = [];

  for (const row of rawRows) {
    const rawLedger = String(row['Ledger Code'] || row['ledger_code'] || row['LedgerCode'] || '').trim();
    const rawParty = String(row['Party Name'] || row['party_name'] || row['PartyName'] || '').trim();

    // Discard Grand Total or empty rows
    if (!rawLedger || /grand\s*total/i.test(rawLedger) || /grand\s*total/i.test(rawParty)) {
      continue;
    }

    const billNo = String(row['Bill No'] || row['bill_no'] || row['BillNo'] || '').trim();
    if (!billNo) continue;

    const branchCode = String(row['Branch Code'] || row['branch_code'] || 'ABMATO').trim();
    const branchName = row['Branch Name'] ? String(row['Branch Name']).trim() : undefined;
    const station = row['Station'] ? String(row['Station']).trim() : undefined;
    const narration = row['Narration'] ? String(row['Narration']).trim() : undefined;

    const billDate = parseDate(row['Bill Date'] || row['bill_date']);
    const dueDate = parseDate(row['Due Date'] || row['due_date']);

    const rawBillAmt = Number(row['BillAmt'] || row['Bill Amount'] || row['bill_amount'] || 0);
    const rawAdjustment = Number(row['Adjustment'] || row['adjustment'] || 0);
    const rawOutstanding = Number(row['Outstanding'] || row['Outstanding Amount'] || row['outstanding_amount'] || 0);

    // Strictly exclude rows with negative amounts (e.g. -123 or -49899 etc.)
    if (rawBillAmt < 0 || rawOutstanding < 0) {
      continue;
    }

    // Identify if entry is an Advance Receipt / Credit Note (AD voucher, negative balance, or advance narration)
    const isCreditOrAdvance =
      rawBillAmt < 0 ||
      rawOutstanding < 0 ||
      billNo.startsWith('AD') ||
      /adv/i.test(narration || '') ||
      /advance/i.test(narration || '');

    const billAmount = Math.abs(rawBillAmt);
    // If it is an advance receipt from a customer, the money was received upfront as an advance deposit
    const adjustment = isCreditOrAdvance && rawAdjustment === 0
      ? billAmount
      : Math.abs(rawAdjustment);
    const outstandingAmount = isCreditOrAdvance ? 0 : Math.max(0, rawOutstanding);

    // Days Overdue = ReferenceDate - DueDate
    const dueTime = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
    const refTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const daysOverdue = Math.round((refTime - dueTime) / 86400000);

    // Aging Bucket
    let agingBucket = 'Not Yet Due';
    if (daysOverdue > 90) agingBucket = '90+ Days';
    else if (daysOverdue >= 61) agingBucket = '61-90 Days';
    else if (daysOverdue >= 31) agingBucket = '31-60 Days';
    else if (daysOverdue >= 1) agingBucket = '1-30 Days';

    // Exclusion Rules: TDS on Sales, Electricity Bill, Sales Return, or credit/advance vouchers
    const isExcluded =
      isNonTradeOrExcludedAccount(rawParty) ||
      isCreditOrAdvance ||
      outstandingAmount <= 0;

    const actionType = isExcluded ? 'No Action' : 'Follow-up Required';

    // Priority: High >= 50,000 or > 90 days; Medium >= 10,000 or > 30 days; Low: rest
    let priority: 'High' | 'Medium' | 'Low' = 'Low';
    if (!isExcluded) {
      if (outstandingAmount >= 50000 || daysOverdue > 90) {
        priority = 'High';
      } else if (outstandingAmount >= 10000 || daysOverdue > 30) {
        priority = 'Medium';
      }
    }

    parsedBills.push({
      ledgerCode: rawLedger,
      partyName: rawParty,
      station,
      branchName,
      branchCode,
      billNo,
      billDate,
      dueDate,
      billAmount,
      adjustment,
      outstandingAmount,
      daysOverdue,
      agingBucket,
      actionType,
      priority,
      narration,
      isExcluded,
    });
  }

  return parsedBills;
}

/**
 * Parses Customer Contacts Master (CSV or Excel).
 * Supports both full ALV/ERP contact sheets (with Ledger Code) and simple customer contact lists
 * (e.g. "Company Name", "Contact Person Name", "Mobile No.", "Email ID").
 * Unpacks multiple contacts in single cells separated by semicolons (;) or slashes (/).
 */
export function parseCustomerContacts(bufferOrText: Buffer | string): ParsedContactRecord[] {
  const buffer = typeof bufferOrText === 'string' ? Buffer.from(bufferOrText) : bufferOrText;
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // Use sheet with contact headers if multi-sheet
  let targetSheet = workbook.Sheets[workbook.SheetNames[0]];
  for (const name of workbook.SheetNames) {
    const s = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(s, { header: 1 }) as any[][];
    if (
      rows.some(
        r =>
          Array.isArray(r) &&
          r.some(
            c =>
              typeof c === 'string' &&
              (/contact\s*person/i.test(c) || /mobile/i.test(c) || /company\s*name/i.test(c))
          )
      )
    ) {
      targetSheet = s;
      break;
    }
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(targetSheet);
  const contacts: ParsedContactRecord[] = [];

  for (const row of rawRows) {
    const partyName = String(
      row['Company Name'] ||
      row['Party Name'] ||
      row['company_name'] ||
      row['party_name'] ||
      row['Customer Name'] ||
      row['customer_name'] ||
      row['Party'] ||
      row['Company'] ||
      ''
    ).trim();

    const ledgerCode = String(
      row['Ledger Code'] ||
      row['ledger_code'] ||
      row['LedgerCode'] ||
      row['Ledger'] ||
      ''
    ).trim();

    // Skip empty lines or header/footer rows
    if (!partyName && !ledgerCode) continue;
    if (
      /example/i.test(ledgerCode) ||
      /grand\s*total/i.test(ledgerCode) ||
      /example/i.test(partyName) ||
      /grand\s*total/i.test(partyName)
    ) {
      continue;
    }

    const branchCode = String(row['Branch Code'] || row['branch_code'] || 'ABMATO').trim();
    const designation = row['Designation'] ? String(row['Designation']).trim() : undefined;
    const rawPrimary = String(row['Primary Contact (Yes/No)'] || row['is_primary'] || '').trim().toLowerCase();
    const explicitPrimary = rawPrimary.length > 0
      ? (rawPrimary === 'yes' || rawPrimary === 'true' || rawPrimary === '1')
      : undefined;

    const preferredLanguage = row['Preferred Language (optional)'] || row['preferred_language']
      ? String(row['Preferred Language (optional)'] || row['preferred_language']).trim()
      : undefined;

    // Extract multi-contact fields
    const rawPerson = String(
      row['Contact Person Name'] ||
      row['Contact Person'] ||
      row['Contact Name'] ||
      row['contact_person_name'] ||
      row['contact_person'] ||
      ''
    ).trim();

    const rawMobile = String(
      row['Mobile No.'] ||
      row['Mobile No'] ||
      row['mobile_no'] ||
      row['Mobile'] ||
      row['Mobile Number'] ||
      row['Phone'] ||
      ''
    ).trim();

    const rawWa = String(
      row['WhatsApp No (if different)'] ||
      row['whatsapp_no'] ||
      row['WhatsApp No'] ||
      row['WhatsApp'] ||
      ''
    ).trim();

    const rawEmail = String(
      row['Email ID'] ||
      row['email_id'] ||
      row['Email'] ||
      row['Email Address'] ||
      ''
    ).trim();

    const personList = splitDelimited(rawPerson);
    const mobileList = splitDelimited(rawMobile);
    const waList = splitDelimited(rawWa);
    const emailList = splitDelimited(rawEmail);

    const count = Math.max(personList.length, mobileList.length, emailList.length, waList.length);

    if (count === 0) {
      // Company is listed with no contacts (e.g. OSHIYA METALS)
      contacts.push({
        ledgerCode: ledgerCode || undefined,
        partyName: partyName || `Customer ${ledgerCode}`,
        branchCode,
        personName: 'Accounts Department',
        isPrimary: true,
        hasMissingContacts: true,
        preferredLanguage,
      });
      continue;
    }

    for (let i = 0; i < count; i++) {
      const personName =
        personList[i] ||
        (personList.length === 1 && i > 0 ? `${personList[0]} (Alt)` : undefined) ||
        'Accounts Department';

      const rawMob = mobileList[i] || undefined;
      const rawW = waList[i] || undefined;
      const emailId = emailList[i] ? emailList[i].trim() : undefined;

      const mobileNumber = rawMob ? formatPhoneNumber(rawMob) || undefined : undefined;
      const whatsappNumber = rawW ? formatPhoneNumber(rawW) || undefined : mobileNumber;

      contacts.push({
        ledgerCode: ledgerCode || undefined,
        partyName: partyName || `Customer ${ledgerCode}`,
        branchCode,
        personName,
        designation,
        mobileNumber,
        whatsappNumber,
        emailId,
        isPrimary: explicitPrimary !== undefined ? explicitPrimary : (i === 0),
        preferredLanguage,
        hasMissingContacts: !mobileNumber && !emailId,
      });
    }
  }

  return contacts;
}

/**
 * Parses an Excel Workbook Buffer and extracts all customers,
 * multi-bill invoices, and multi-contacts.
 */
export function parseExcelWorkbook(fileBuffer: Buffer): ParsedCustomerRecord[] {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
  const customerMap = new Map<string, ParsedCustomerRecord>();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
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

    if (section === 'TRACKER') {
      const partyName = getCol(row, headerColMap, ['party name', 'partyname', 'ledger name']);
      const billNo = getCol(row, headerColMap, ['bill no', 'billno', 'invoice no']);
      const outstanding = parseFloat(getCol(row, headerColMap, ['outstanding amount', 'outstanding', 'balance']) || '0');
      const billAmount = parseFloat(getCol(row, headerColMap, ['bill amount', 'amount', 'invoice amount']) || '0');
      const actionType = getCol(row, headerColMap, ['action type', 'action']) || 'Follow-up Required';

      // Strictly exclude negative amounts (e.g. -123 or -49899)
      if (outstanding < 0 || billAmount < 0) continue;

      if (!partyName || !billNo || partyName.toLowerCase() === 'grand total') continue;

      const normName = normalizeName(partyName);
      let customer = customerMap.get(normName);

      if (!customer) {
        const isExcluded = NON_CUSTOMER_KEYWORDS.some(k => partyName.toLowerCase().includes(k));
        customer = {
          partyName,
          normalizedName: normName,
          station: getCol(row, headerColMap, ['station']),
          branchName: getCol(row, headerColMap, ['branch name']),
          branchCode: getCol(row, headerColMap, ['branch code']),
          overallPriority: getCol(row, headerColMap, ['priority']) || 'Medium',
          totalOutstanding: 0,
          contacts: [],
          invoices: [],
          isCustomer: !isExcluded,
        };
        customerMap.set(normName, customer);
      }

      const contactName = getCol(row, headerColMap, ['contact persons', 'contact person', 'contact name']);
      const m1 = cleanPhone(getCol(row, headerColMap, ['mobile 1', 'mobile no 1']));
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
