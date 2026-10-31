import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizeName,
  parseBalance,
  isNonCustomerLedger,
  cleanPhoneNumber,
  parseContactRow,
  parseLedgerCSV,
  mergeLedgerAndContacts,
} from '../lib/parser.ts';

describe('Smart Ledger & Contact Parser Tests', () => {
  it('should sanitize ledger names by stripping bracketed codes and extra characters', () => {
    const raw1 = 'DHOOT AUTOCOMPONENTS PRIVATE LIMITED [ ABMATO ]';
    assert.strictEqual(normalizeName(raw1), 'DHOOT AUTOCOMPONENTS PRIVATE LIMITED');

    const raw2 = 'Parason Machinery(I) Pvt Ltd 2002(R&D) [ ABMATO ]';
    assert.strictEqual(normalizeName(raw2), 'PARASON MACHINERY I PVT LTD 2002 R D');

    const raw3 = 'M/s. SAMARTHA WIRE-CUT [ ABMATO ]';
    assert.strictEqual(normalizeName(raw3), 'M S SAMARTHA WIRE CUT');
  });

  it('should parse Dr and Cr ledger balances correctly', () => {
    const deb = parseBalance('56640.000 Dr');
    assert.strictEqual(deb.amount, 56640);
    assert.strictEqual(deb.type, 'Dr');

    const cred = parseBalance('49467.000 Cr');
    assert.strictEqual(cred.amount, 49467);
    assert.strictEqual(cred.type, 'Cr');

    const num = parseBalance(3328);
    assert.strictEqual(num.amount, 3328);
    assert.strictEqual(num.type, 'Dr');
  });

  it('should filter out internal non-customer ledgers (taxes, expenses, returns)', () => {
    assert.strictEqual(isNonCustomerLedger('Electricity Bill [ ABMATO ]').isExcluded, true);
    assert.strictEqual(isNonCustomerLedger('TDS on Sales [ ABMATO ]').isExcluded, true);
    assert.strictEqual(isNonCustomerLedger('Sales Return [ ABMATO ]').isExcluded, true);

    // Trade customers must NOT be excluded
    assert.strictEqual(isNonCustomerLedger('EQUINOX GAUGES [ ABMATO ]').isExcluded, false);
    assert.strictEqual(isNonCustomerLedger('TATA ADVANCED SYSTEMS LIMITED [ ABMATO ]').isExcluded, false);
  });

  it('should clean and format Indian mobile numbers with country code', () => {
    assert.strictEqual(cleanPhoneNumber('80871 82898'), '+918087182898');
    assert.strictEqual(cleanPhoneNumber('9049443333'), '+919049443333');
    assert.strictEqual(cleanPhoneNumber('+91 72763 00484'), '+917276300484');
  });

  it('should parse semicolon-delimited multi-contact persons, phones, and emails', () => {
    const company = 'Parason Machinery(I) Pvt Ltd 2002(R&D)';
    const persons = 'Smit Satpute ; Vinod Kale';
    const phones = '89560 81914; 70309 40425';
    const emails = 'sumit.satpute@parason.com; vinod.kale@parason.com';

    const parsed = parseContactRow(company, persons, phones, emails);
    assert.strictEqual(parsed.contacts.length, 2);

    assert.strictEqual(parsed.contacts[0].personName, 'Smit Satpute');
    assert.strictEqual(parsed.contacts[0].mobileNumber, '+918956081914');
    assert.strictEqual(parsed.contacts[0].emailId, 'sumit.satpute@parason.com');

    assert.strictEqual(parsed.contacts[1].personName, 'Vinod Kale');
    assert.strictEqual(parsed.contacts[1].mobileNumber, '+917030940425');
    assert.strictEqual(parsed.contacts[1].emailId, 'vinod.kale@parason.com');
  });

  it('should parse full user-provided ledger CSV and distinguish trade customers from expenses', () => {
    const sampleCSV = `Abhiyadna Machine Tools,
Plot No 87-2 Sec 5 Auric City DMIC Shendra Chh Sambhajinagar 431154,
Ledger Master : Outstanding Receivable Report,
01-04-2026 To 31-03-2027,
ledgerName,₹ Balance
DHOOT AUTOCOMPONENTS PRIVATE LIMITED [ ABMATO ],56640.000 Dr
Electricity Bill [ ABMATO ],9074.830 Dr
EQUINOX GAUGES [ ABMATO ],3328.000 Dr
M/s. SAMARTHA WIRE-CUT [ ABMATO ],125.000 Cr
Sales Return [ ABMATO ],125.000 Dr
TDS on Sales [ ABMATO ],2141.000 Dr
TATA ADVANCED SYSTEMS LIMITED [ ABMATO ],189744.000 Dr`;

    const parsed = parseLedgerCSV(sampleCSV);
    assert.strictEqual(parsed.length, 7);

    // Dhoot should be a customer with Dr balance
    const dhoot = parsed.find(p => p.rawLedgerName.includes('DHOOT'));
    assert.ok(dhoot);
    assert.strictEqual(dhoot.isCustomer, true);
    assert.strictEqual(dhoot.balanceAmount, 56640);
    assert.strictEqual(dhoot.balanceType, 'Dr');

    // Electricity Bill must be excluded
    const elec = parsed.find(p => p.rawLedgerName.includes('Electricity'));
    assert.ok(elec);
    assert.strictEqual(elec.isCustomer, false);

    // Sales Return must be excluded
    const ret = parsed.find(p => p.rawLedgerName.includes('Sales Return'));
    assert.ok(ret);
    assert.strictEqual(ret.isCustomer, false);
  });
});
