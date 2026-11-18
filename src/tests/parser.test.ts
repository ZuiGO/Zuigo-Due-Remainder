import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  normalizeName,
  cleanPhone,
  cleanEmail,
  parseDate,
  parseExcelCSVText,
  parseSapDuesExport,
  parseNumeric,
  getRowVal,
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

  it('should parse negative credit notes (e.g. -49467) and mark them as excluded from reminders', () => {
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
    assert.strictEqual(parsed.length, 1, 'Negative credit note rows must be retained for ledger accuracy');
    assert.strictEqual(parsed[0].billAmount, -49467);
    assert.strictEqual(parsed[0].outstandingAmount, -49467);
    assert.strictEqual(parsed[0].isExcluded, true, 'Credit note must be excluded from reminders');
    assert.strictEqual(parsed[0].actionType, 'No Action', 'Credit note must have actionType No Action');
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

describe('Regression: bill settled against an advance stays a live receivable', () => {
  it('keeps all 5 rows of the demo sheet, drops Grand Total, and totals ₹38,068', () => {
    const rows = [
      ['Ledger Code','Party Name','Branch Code','Bill No','Bill Date','Due Date','BillAmt','Adjustment','Outstanding','Narration'],
      ['1','INDO GERMAN TOOL ROOM','ABMATO','AMT/2026-27/0007','23-04-2026','23-04-2026',24802,0,24802,'x'],
      ['2','S S CONTROLS','ABMATO','AMT/2026-27/0101','30-10-2026','30-10-2026',9416,0,9416,'x'],
      ['3','EQUINOX GAUGES','ABMATO','AMT/2026-27/0091','10-10-2026','10-10-2026',3328,0,3328,'x'],
      ['4','MIKRONIX GAUGES PRIVATE LIMITED','ABMATO','AMT/2026-27/0029','11-06-2026','11-06-2026',1764,1655,109,'Agst: AMT/2026-27/0028, Adv: AD0010'],
      ['5','S K ENGINEERING ENTERPRISES','ABMATO','AMT/2026-27/0061','24-08-2026','24-08-2026',413,0,413,'x'],
      ['Grand Total','','','','','',39723,1655,38068,''],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Outstanding Receivables');
    const parsed = parseSapDuesExport(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    assert.strictEqual(parsed.length, 5);
    assert.ok(parsed.every(b => !b.isExcluded));
    assert.strictEqual(parsed.reduce((s, b) => s + b.outstandingAmount, 0), 38068);
    const mik = parsed.find(b => b.billNo.endsWith('0029'))!;
    assert.strictEqual(mik.outstandingAmount, 109);
    assert.strictEqual(mik.adjustment, 1655);
  });

  it('should parse strings with commas, currency symbols, and negatives accurately using parseNumeric', () => {
    assert.strictEqual(parseNumeric('24,802.50'), 24802.5);
    assert.strictEqual(parseNumeric('₹ 1,00,000'), 100000);
    assert.strictEqual(parseNumeric('-5,000'), -5000);
    assert.strictEqual(parseNumeric('(1,500)'), -1500);
    assert.strictEqual(parseNumeric(''), 0);
    assert.strictEqual(parseNumeric(null), 0);
    assert.strictEqual(parseNumeric(undefined), 0);
    assert.strictEqual(parseNumeric(50000), 50000);
  });

  it('should find normalized row values regardless of casing, spacing, and punctuation using getRowVal', () => {
    const row = {
      '  Paid / Adjusted  ': 15000,
      'Bill_Amount': 60000,
    };
    assert.strictEqual(getRowVal(row, ['paid', 'Paid/Adjusted', 'Paid / Adjusted']), 15000);
    assert.strictEqual(getRowVal(row, ['Bill Amount', 'bill_amount']), 60000);
  });

  it('should subtract paid/adjusted amount from outstanding when gross amount was entered in outstanding column', () => {
    const rows = [
      ['Ledger Code', 'Party Name', 'Branch Code', 'Bill No', 'Bill Date', 'Due Date', 'Bill Amount', 'Paid / Adjusted', 'Outstanding Amount'],
      ['101', 'Test Customer', 'ABMATO', 'INV-001', '01-10-2026', '15-10-2026', 100000, 30000, 100000],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Dues');
    const parsed = parseSapDuesExport(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].billAmount, 100000);
    assert.strictEqual(parsed[0].adjustment, 30000);
    assert.strictEqual(parsed[0].outstandingAmount, 70000, 'Outstanding must be strictly 100,000 - 30,000 = 70,000');
  });

  it('should strictly throw error when Excel does not contain Ledger Code column', () => {
    const rowsWithoutLedger = [
      ['Party Name', 'Branch Code', 'Bill No', 'Bill Date', 'Due Date', 'Bill Amount', 'Paid / Adjusted', 'Outstanding Amount'],
      ['Test Customer', 'ABMATO', 'INV-001', '01-10-2026', '15-10-2026', 100000, 30000, 70000],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsWithoutLedger), 'Dues');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    assert.throws(
      () => parseSapDuesExport(buf),
      /Missing required column: 'Ledger Code'/
    );
  });
});
