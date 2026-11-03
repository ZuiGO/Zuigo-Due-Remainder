import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizeName,
  cleanPhone,
  cleanEmail,
  parseDate,
  parseExcelCSVText,
  parseSapDuesExport,
} from '../lib/parser.js';
import * as XLSX from 'xlsx';

describe('Excel Workbook & Multi-Invoice Multi-Contact Parser Tests', () => {
  it('should normalize names by stripping ERP brackets and symbols', () => {
    assert.strictEqual(normalizeName('INDO GERMAN TOOL ROOM'), 'INDO GERMAN TOOL ROOM');
    assert.strictEqual(normalizeName('Parason Machinery(I) Pvt Ltd 2002(R&D) [ ABMATO ]'), 'PARASON MACHINERY I PVT LTD 2002 R D');
  });

  it('should clean and format phone numbers with country code', () => {
    assert.strictEqual(cleanPhone('72763 00484'), '+917276300484');
    assert.strictEqual(cleanPhone('+91 80871 82898'), '+918087182898');
  });

  it('should accurately detect advance deposit receipts and credit notes without showing 0 0 0 error', () => {
    const rawData = [
      {
        'Ledger Code': '670212689',
        'Party Name': 'Shobha Packaging Company',
        'Bill No': 'AD0009 [0000050]',
        'Bill Date': '10 Mar 2026',
        'Due Date': '10 Mar 2026',
        'BillAmt': -49467,
        'Adjustment': 0,
        'Outstanding': -49467,
        'Narration': 'Agst: AMT/2026-27/0085Adv: AD0009,',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rawData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Outstanding');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const parsed = parseSapDuesExport(buf);
    assert.strictEqual(parsed.length, 1);
    const adv = parsed[0];
    assert.strictEqual(adv.billNo, 'AD0009 [0000050]');
    assert.strictEqual(adv.partyName, 'Shobha Packaging Company');
    assert.strictEqual(adv.billAmount, 49467);
    assert.strictEqual(adv.adjustment, 49467); // Credited as collected advance
    assert.strictEqual(adv.outstandingAmount, 0); // No dues owed
    assert.strictEqual(adv.isExcluded, true);
    assert.strictEqual(adv.actionType, 'No Action');
  });

  it('should parse multi-invoice multi-contact customer data from user format', () => {
    const rawCSV = `LedgerCode,Party Name,Station,Branch Name,Branch Code,Bill No,Bill Date,Due Date,Bill Amount,Adjustment,Outstanding Amount,Narration,Bill No,Bill Date,Due Date,Bill Amount,Adjustment,Outstanding Amount,Days Overdue,Aging Bucket,Action Type,Priority,Follow-up Channel,Remainder Frequency,Contact Persons,Mobile 1,Mobile 2,Email 1,Email 2,Last Follow-up Date,Next Follow-up Date,Status,
,INDO GERMAN TOOL ROOM,,,,AMT/2026-27/0007,2026-04-23,2026-04-23,24802,0,24802,,AMT/2026-27/0007,2026-04-23,2026-04-23,24802,0,24802,193,90+ Days,Follow-up Required,High,Call + Email + SMS,,,,,,,,,Pending,
,INDO GERMAN TOOL ROOM,,,,AMT/2026-27/0008,2026-04-23,2026-04-23,10426,0,10426,,AMT/2026-27/0008,2026-04-23,2026-04-23,10426,0,10426,193,90+ Days,Follow-up Required,High,Call + Email + SMS,,,,,,,,,Pending,
,MIKRONIX GAUGES PRIVATE LIMITED,,,,AMT/2026-27/0029,2026-06-11,2026-06-11,1764,1655,109,,AMT/2026-27/0029,2026-06-11,2026-06-11,1764,1655,109,144,90+ Days,Follow-up Required,High,Call + Email + SMS,,,,,,,,,Pending,
Party Name,Contact Person(s),Mobile 1,Mobile 2,Mobile 3,Mobile 4,Email 1,Email 2,Email 3,Email 4,No. of Open Bills,Total Outstanding,Oldest Due Date,Max Days Overdue,Overall Priority
INDO GERMAN TOOL ROOM,Mohit Agarwal,72763 00484,,,,ppcigtr@gmail.com,,,,7,77185,2026-04-23,193,High
MIKRONIX GAUGES PRIVATE LIMITED,Sudarshan Bhubane,90110 47368,,,,sudarshan@mgpl.in,,,,1,109,2026-06-11,144,High`;

    const customers = parseExcelCSVText(rawCSV);
    assert.ok(customers.length >= 2);

    const igtr = customers.find(c => c.partyName.includes('INDO GERMAN TOOL ROOM'));
    assert.ok(igtr);
    assert.strictEqual(igtr.invoices.length, 2);
    assert.strictEqual(igtr.invoices[0].billNo, 'AMT/2026-27/0007');
    assert.strictEqual(igtr.invoices[0].billAmount, 24802);
    assert.strictEqual(igtr.invoices[0].outstandingAmount, 24802);
    assert.strictEqual(igtr.invoices[0].status, 'Pending');
    assert.strictEqual(igtr.contacts.length, 1);
    assert.strictEqual(igtr.contacts[0].personName, 'Mohit Agarwal');
    assert.strictEqual(igtr.contacts[0].mobileNumber, '+917276300484');
    assert.strictEqual(igtr.contacts[0].emailId, 'ppcigtr@gmail.com');
  });
});
