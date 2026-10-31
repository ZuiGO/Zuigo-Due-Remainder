/**
 * Smart Excel & CSV Parser for Ledger Master & Customer Directory
 * Handles ledger code stripping (e.g. `[ ABMATO ]`), Dr/Cr parsing,
 * non-customer ledger filtering, and semicolon-delimited multi-contacts.
 */

export interface ParsedLedgerRow {
  rawLedgerName: string;
  normalizedName: string;
  balanceAmount: number;
  balanceType: 'Dr' | 'Cr';
  isCustomer: boolean;
  ignoredReason?: string;
}

export interface ParsedContactRow {
  companyName: string;
  normalizedCompanyName: string;
  contacts: {
    personName?: string;
    mobileNumber?: string;
    emailId?: string;
  }[];
}

export interface MergedCustomerDue {
  normalizedName: string;
  rawLedgerName: string;
  balanceAmount: number;
  balanceType: 'Dr' | 'Cr';
  isDebit: boolean;
  contacts: {
    personName?: string;
    mobileNumber?: string;
    emailId?: string;
  }[];
  isCustomer: boolean;
  ignoredReason?: string;
}

// Known non-customer/expense/tax keywords
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
  'office expense',
  'rent expense',
  'interest account',
];

/**
 * Normalizes company/ledger names for fuzzy matching.
 * E.g. "DHOOT AUTOCOMPONENTS PRIVATE LIMITED [ ABMATO ]" -> "DHOOT AUTOCOMPONENTS PRIVATE LIMITED"
 * E.g. "Parason Machinery(I) Pvt Ltd 2002(R&D) [ ABMATO ]" -> "PARASON MACHINERY I PVT LTD 2002 R D"
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .replace(/\[.*?\]/g, '') // remove bracketed ERP codes like [ ABMATO ]
    .replace(/[()]/g, ' ') // replace parentheses with space rather than stripping content
    .replace(/[^a-zA-Z0-9\s]/g, ' ') // replace special punctuation with spaces
    .replace(/\s+/g, ' ') // condense whitespace
    .trim()
    .toUpperCase();
}

/**
 * Checks if a ledger row represents an internal expense/tax ledger rather than a trade customer.
 */
export function isNonCustomerLedger(ledgerName: string): { isExcluded: boolean; reason?: string } {
  const lower = ledgerName.toLowerCase().replace(/\[.*?\]/g, '').trim();
  for (const keyword of NON_CUSTOMER_KEYWORDS) {
    if (lower === keyword || lower.startsWith(keyword + ' ') || lower.includes(keyword)) {
      return { isExcluded: true, reason: `Classified as internal ledger/tax account (${keyword})` };
    }
  }
  return { isExcluded: false };
}

/**
 * Parses a balance string like "56640.000 Dr" or "49467.000 Cr" or "125.000"
 */
export function parseBalance(balanceStr: string | number): { amount: number; type: 'Dr' | 'Cr' } {
  if (typeof balanceStr === 'number') {
    return {
      amount: Math.abs(balanceStr),
      type: balanceStr >= 0 ? 'Dr' : 'Cr',
    };
  }

  const str = String(balanceStr || '').trim();
  const isCr = /cr/i.test(str);
  const isDr = /dr/i.test(str) || !isCr;

  // Extract numeric part (e.g., "56,640.000")
  const numericPart = str.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(numericPart) || 0;

  return {
    amount: Math.abs(parsed),
    type: isCr ? 'Cr' : 'Dr',
  };
}

/**
 * Cleans phone number to standard format with country code
 * E.g. "80871 82898" -> "+918087182898"
 */
export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  return digits.startsWith('+') ? digits : `+${digits}`;
}

/**
 * Parses semicolon-delimited contact entries
 * Handles patterns like:
 * Persons: "Smit Satpute ; Vinod Kale"
 * Phones:  "89560 81914; 70309 40425"
 * Emails:  "sumit.satpute@parason.com; vinod.kale@parason.com"
 */
export function parseContactRow(
  companyName: string,
  personNamesStr: string = '',
  mobilesStr: string = '',
  emailsStr: string = ''
): ParsedContactRow {
  const normCompany = normalizeName(companyName);

  const persons = personNamesStr
    ? personNamesStr.split(';').map(p => p.trim()).filter(Boolean)
    : [];
  const mobiles = mobilesStr
    ? mobilesStr.split(';').map(m => cleanPhoneNumber(m.trim())).filter(Boolean)
    : [];
  const emails = emailsStr
    ? emailsStr.split(';').map(e => e.trim().toLowerCase()).filter(e => e && e.includes('@'))
    : [];

  const maxCount = Math.max(persons.length, mobiles.length, emails.length, 1);
  const contacts: ParsedContactRow['contacts'] = [];

  for (let i = 0; i < maxCount; i++) {
    const person = persons[i] || persons[0] || undefined;
    const mobile = mobiles[i] || (i === 0 ? mobiles[0] : undefined);
    const email = emails[i] || (i === 0 ? emails[0] : undefined);

    if (person || mobile || email) {
      contacts.push({
        personName: person,
        mobileNumber: mobile,
        emailId: email,
      });
    }
  }

  return {
    companyName,
    normalizedCompanyName: normCompany,
    contacts,
  };
}

/**
 * Parses raw Ledger Outstanding CSV/Text
 */
export function parseLedgerCSV(csvText: string): ParsedLedgerRow[] {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results: ParsedLedgerRow[] = [];

  let headerFound = false;

  for (const line of lines) {
    // Detect header line: "ledgerName,₹ Balance" or similar
    if (!headerFound) {
      if (/ledger\s*name/i.test(line) && /balance/i.test(line)) {
        headerFound = true;
      }
      continue;
    }

    // Process line: "EQUINOX GAUGES [ ABMATO ],3328.000 Dr"
    const lastCommaIndex = line.lastIndexOf(',');
    if (lastCommaIndex === -1) continue;

    const rawLedgerName = line.substring(0, lastCommaIndex).trim();
    const balanceStr = line.substring(lastCommaIndex + 1).trim();

    if (!rawLedgerName || !balanceStr) continue;

    const { amount, type } = parseBalance(balanceStr);
    const { isExcluded, reason } = isNonCustomerLedger(rawLedgerName);
    const normName = normalizeName(rawLedgerName);

    results.push({
      rawLedgerName,
      normalizedName: normName,
      balanceAmount: amount,
      balanceType: type,
      isCustomer: !isExcluded,
      ignoredReason: reason,
    });
  }

  return results;
}

/**
 * Merges parsed ledger records with parsed contacts.
 */
export function mergeLedgerAndContacts(
  ledgerRows: ParsedLedgerRow[],
  contactRows: ParsedContactRow[]
): MergedCustomerDue[] {
  const contactMap = new Map<string, ParsedContactRow>();

  for (const c of contactRows) {
    contactMap.set(c.normalizedCompanyName, c);
  }

  return ledgerRows.map(ledger => {
    // Exact or prefix matching on normalized name
    let matchedContact = contactMap.get(ledger.normalizedName);

    if (!matchedContact) {
      // Try substring matching
      for (const [key, val] of contactMap.entries()) {
        if (
          key.includes(ledger.normalizedName) ||
          ledger.normalizedName.includes(key) ||
          key.startsWith(ledger.normalizedName.slice(0, 10))
        ) {
          matchedContact = val;
          break;
        }
      }
    }

    return {
      normalizedName: ledger.normalizedName,
      rawLedgerName: ledger.rawLedgerName,
      balanceAmount: ledger.balanceAmount,
      balanceType: ledger.balanceType,
      isDebit: ledger.balanceType === 'Dr',
      contacts: matchedContact?.contacts || [],
      isCustomer: ledger.isCustomer,
      ignoredReason: ledger.ignoredReason,
    };
  });
}
