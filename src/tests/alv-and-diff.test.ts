import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import prisma from '../lib/db.ts';
import { parseSapDuesExport, parseCustomerContacts } from '../lib/parser.ts';
import { reconcileDailySapExport, ingestCustomerContacts } from '../lib/diff-engine.ts';

const SAMPLE_SAP_ALV_HTML = `<html>
<head><meta http-equiv='Content-Type' content='text/html;charset=utf-8'></head>
<body>
<div style='text-align:center; font-family:Arial;'>
<h1>Abhiyadna Machine Tools</h1>
<h2>Plot No 87-2 Sec 5 Auric City DMIC Shendra Chh Sambhajinagar 431154</h2>
<h3>Outstanding Receivable</h3>
<p>01-04-2026 To 31-03-2027</p>
</div>
<table border='1'>
<tr>
<th>Ledger Code</th>
<th>Party Name</th>
<th>Station</th>
<th>Branch Name</th>
<th>Branch Code</th>
<th>Bill No</th>
<th>Bill Date</th>
<th>Due Date</th>
<th>BillAmt</th>
<th>Adjustment</th>
<th>Outstanding</th>
<th>Narration</th>
</tr>
<tr>
<td>442769153</td>
<td>DHOOT AUTOCOMPONENTS PRIVATE LIMITED</td>
<td>Others</td>
<td>Abhiyadna Machine Tools</td>
<td>ABMATO</td>
<td>AMT/2026-27/0080</td>
<td>26-09-2026</td>
<td>26-09-2026</td>
<td>56640.00</td>
<td>0</td>
<td>56640</td>
<td></td>
</tr>
<tr>
<td>345325836</td>
<td>Electricity Bill</td>
<td>Others</td>
<td>Abhiyadna Machine Tools</td>
<td>ABMATO</td>
<td>AD0001 [0000001]</td>
<td>01-06-2026</td>
<td>15-05-2026</td>
<td>9074.83</td>
<td>0</td>
<td>9075</td>
<td>Paid electricity bill</td>
</tr>
<tr>
<td>262908375</td>
<td>INDO GERMAN TOOL ROOM</td>
<td>Others</td>
<td>Abhiyadna Machine Tools</td>
<td>ABMATO</td>
<td>AMT/2026-27/0007</td>
<td>23-04-2026</td>
<td>23-04-2026</td>
<td>24802.00</td>
<td>0</td>
<td>24802</td>
<td></td>
</tr>
<tr>
<td>678360322</td>
<td>TDS on Sales</td>
<td>Others</td>
<td>Abhiyadna Machine Tools</td>
<td>ABMATO</td>
<td>AD0012 [0000004]</td>
<td>18-06-2026</td>
<td>18-06-2026</td>
<td>192.00</td>
<td>0</td>
<td>192</td>
<td></td>
</tr>
<tr>
<td>698776440</td>
<td>M/s. SAMARTHA WIRE-CUT</td>
<td>Others</td>
<td>Abhiyadna Machine Tools</td>
<td>ABMATO</td>
<td>AD0005 [CN00001]</td>
<td>30-09-2026</td>
<td>30-09-2026</td>
<td>-125.00</td>
<td>0</td>
<td>-125</td>
<td>Credit Note</td>
</tr>
<tr>
<td>Grand Total</td>
<td></td><td></td><td></td><td></td><td></td><td></td><td></td>
<td>90583.83</td><td>0</td><td>90584</td><td></td>
</tr>
</table>
</body>
</html>`;

const SAMPLE_CONTACTS_CSV = `Ledger Code,Party Name,Branch Code,Contact Person Name,Designation,Mobile No,WhatsApp No (if different),Email ID,Primary Contact (Yes/No),Preferred Language (optional)
442769153,DHOOT AUTOCOMPONENTS PRIVATE LIMITED,ABMATO,Rajesh Dhoot,General Manager,9822011223,,rajesh@dhoot.com,Yes,English
262908375,INDO GERMAN TOOL ROOM,ABMATO,Mohit Agarwal,Accounts Officer,72763 00484,,ppcigtr@gmail.com,Yes,Hindi
627533496,Parason Machinery(I) Pvt Ltd 2002(R&D),ABMATO,Smit Satpute,Purchase Manager,89560 81914,,sumit.satpute@parason.com,Yes,Marathi
627533496,Parason Machinery(I) Pvt Ltd 2002(R&D),ABMATO,Vinod Kale,Finance Lead,70309 40425,,vinod.kale@parason.com,No,English
`;

describe('SAP ALV HTML Parser, Contact Master & Daily Diff Engine Tests', () => {
  let tenant: any;

  before(async () => {
    tenant = await prisma.tenant.upsert({
      where: { slug: 'test-diff-tenant' },
      update: {},
      create: {
        slug: 'test-diff-tenant',
        companyName: 'Test Diff Corporation',
        brandColor: '#4f46e5',
      },
    });
  });

  after(async () => {
    if (tenant) {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it('should parse SAP ALV HTML table, skipping letterhead and Grand Total, and flagging exclusions', () => {
    const bills = parseSapDuesExport(Buffer.from(SAMPLE_SAP_ALV_HTML));

    assert.strictEqual(bills.length, 5);

    // DHOOT AUTO - Valid trade customer
    const dhoot = bills.find(b => b.ledgerCode === '442769153');
    assert.ok(dhoot);
    assert.strictEqual(dhoot.billNo, 'AMT/2026-27/0080');
    assert.strictEqual(dhoot.outstandingAmount, 56640);
    assert.strictEqual(dhoot.priority, 'High'); // >= 50,000
    assert.strictEqual(dhoot.isExcluded, false);
    assert.strictEqual(dhoot.actionType, 'Follow-up Required');

    // Electricity Bill - Internal expense exclusion
    const electricity = bills.find(b => b.partyName === 'Electricity Bill');
    assert.ok(electricity);
    assert.strictEqual(electricity.isExcluded, true);
    assert.strictEqual(electricity.actionType, 'No Action');

    // TDS on Sales - Tax exclusion
    const tds = bills.find(b => b.partyName === 'TDS on Sales');
    assert.ok(tds);
    assert.strictEqual(tds.isExcluded, true);
    assert.strictEqual(tds.actionType, 'No Action');

    // Negative balance - Advance/Credit exclusion
    const credit = bills.find(b => b.ledgerCode === '698776440');
    assert.ok(credit);
    assert.strictEqual(credit.isExcluded, true);
    assert.strictEqual(credit.actionType, 'No Action');

    // Grand Total must NOT be present
    const grandTotal = bills.find(b => /grand\s*total/i.test(b.ledgerCode) || /grand\s*total/i.test(b.partyName));
    assert.strictEqual(grandTotal, undefined);
  });

  it('should parse Customer Contacts Master with multi-contacts linked to same Ledger Code', async () => {
    const contacts = parseCustomerContacts(SAMPLE_CONTACTS_CSV);

    assert.strictEqual(contacts.length, 4);

    // Parason Machinery has two contacts under the exact same Ledger Code (627533496)
    const parasonContacts = contacts.filter(c => c.ledgerCode === '627533496');
    assert.strictEqual(parasonContacts.length, 2);

    const primaryContact = parasonContacts.find(c => c.isPrimary);
    assert.strictEqual(primaryContact?.personName, 'Smit Satpute');
    assert.strictEqual(primaryContact?.mobileNumber, '+918956081914');
    assert.strictEqual(primaryContact?.preferredLanguage, 'Marathi');

    const secondaryContact = parasonContacts.find(c => !c.isPrimary);
    assert.strictEqual(secondaryContact?.personName, 'Vinod Kale');
    assert.strictEqual(secondaryContact?.mobileNumber, '+917030940425');

    // Ingest into database
    const result = await ingestCustomerContacts(tenant.id, contacts);
    assert.ok(result.contactsCreated >= 3);

    const customerInDb = await prisma.customer.findFirst({
      where: { tenantId: tenant.id, ledgerCode: '627533496' },
      include: { contacts: true },
    });

    assert.ok(customerInDb);
    assert.strictEqual(customerInDb.contacts.length, 2);
  });

  it('should execute Daily SAP Import Diff (identifying New, Persistent, Partial Payments, and Settled)', async () => {
    // Day 1 Import: 2 Bills
    const day1Bills = parseSapDuesExport(Buffer.from(SAMPLE_SAP_ALV_HTML)).filter(b => !b.isExcluded);
    const day1Summary = await reconcileDailySapExport(tenant.id, 'SAP_Dues_Day1.xls', day1Bills);

    assert.strictEqual(day1Summary.newEntriesCount, 2); // Dhoot + Indo German
    assert.strictEqual(day1Summary.sameEntriesCount, 0);
    assert.strictEqual(day1Summary.partialPaymentsCount, 0);
    assert.strictEqual(day1Summary.settledEntriesCount, 0);

    // Day 2 Import Simulation:
    // 1. Dhoot is unchanged (56640) -> SAME_ENTRY
    // 2. Indo German paid 10000 partially (24802 -> 14802) -> PARTIAL_PAYMENT
    // 3. New bill for Parason added -> NEW_ENTRY
    const day2Bills = [
      {
        ...day1Bills.find(b => b.ledgerCode === '442769153')!, // Dhoot unchanged
      },
      {
        ...day1Bills.find(b => b.ledgerCode === '262908375')!, // Indo German partial pay
        outstandingAmount: 14802,
        adjustment: 10000,
      },
      {
        ledgerCode: '627533496',
        partyName: 'Parason Machinery Pvt Ltd',
        branchCode: 'ABMATO',
        billNo: 'AMT/2026-27/0019',
        billDate: new Date('2026-05-21'),
        dueDate: new Date('2026-05-21'),
        billAmount: 22656,
        adjustment: 0,
        outstandingAmount: 22656,
        daysOverdue: 165,
        agingBucket: '90+ Days',
        actionType: 'Follow-up Required' as const,
        priority: 'High' as const,
        isExcluded: false,
      },
    ];

    const day2Summary = await reconcileDailySapExport(tenant.id, 'SAP_Dues_Day2.xls', day2Bills);

    assert.strictEqual(day2Summary.newEntriesCount, 1); // Parason is new
    assert.strictEqual(day2Summary.sameEntriesCount, 1); // Dhoot is same
    assert.strictEqual(day2Summary.partialPaymentsCount, 1); // Indo German had partial payment
    assert.strictEqual(day2Summary.settledEntriesCount, 0);

    // Verify auto-detected payment record for Indo German
    const igBill = await prisma.invoice.findFirst({
      where: { tenantId: tenant.id, ledgerCode: '262908375' },
      include: { payments: true },
    });

    assert.ok(igBill);
    assert.strictEqual(igBill.outstandingAmount, 14802);
    assert.strictEqual(igBill.previousOutstandingAmount, 24802);
    assert.strictEqual(igBill.payments.length, 1);
    assert.strictEqual(igBill.payments[0].amountPaid, 10000);
    assert.strictEqual(igBill.payments[0].paymentMode, 'SAP_DIFF_DETECTED');

    // Day 3 Import Simulation:
    // Dhoot has disappeared from SAP export (cleared / settled)
    const day3Bills = [
      day2Bills[1], // Indo German
      day2Bills[2], // Parason
    ];

    const day3Summary = await reconcileDailySapExport(tenant.id, 'SAP_Dues_Day3.xls', day3Bills);
    assert.strictEqual(day3Summary.settledEntriesCount, 1); // Dhoot settled!

    const dhootAfterDay3 = await prisma.invoice.findFirst({
      where: { tenantId: tenant.id, ledgerCode: '442769153' },
    });

    assert.ok(dhootAfterDay3);
    assert.strictEqual(dhootAfterDay3.outstandingAmount, 0);
    assert.strictEqual(dhootAfterDay3.status, 'Closed');
  });

  it('should parse simplified Company Name contact sheets with semicolon multi-contact splitting and name-based join', async () => {
    const csvContent = `Company Name,Contact Person Name,Mobile No.,Email ID
EQUINOX GAUGES,Rohan Bubane,80871 82898,equinox_gauges@hotmail.com
Parason Machinery(I) Pvt Ltd 2002(R&D),Smit Satpute ; Vinod Kale,89560 81914;70309 40425,sumit.satpute@parason.com; vinod.kale@parason.com
PIONEER SEMICON MATERIALS PRIVATE LIMITED,,,info@pioneersemicon.com
S S CONTROLS,Kamran Khan;,77579 07578; 70576 18529,finance@sscontrols.in; design.mech@sscontrols.in
OSHIYA METALS PRIVATE LIMITED,,,
`;

    const parsed = parseCustomerContacts(Buffer.from(csvContent));

    // Parason should have unpacked into 2 contacts
    const parasonContacts = parsed.filter(p => p.partyName.includes('Parason'));
    assert.strictEqual(parasonContacts.length, 2);
    assert.strictEqual(parasonContacts[0].personName, 'Smit Satpute');
    assert.strictEqual(parasonContacts[0].mobileNumber, '+918956081914');
    assert.strictEqual(parasonContacts[0].emailId, 'sumit.satpute@parason.com');
    assert.strictEqual(parasonContacts[0].isPrimary, true);

    assert.strictEqual(parasonContacts[1].personName, 'Vinod Kale');
    assert.strictEqual(parasonContacts[1].mobileNumber, '+917030940425');
    assert.strictEqual(parasonContacts[1].emailId, 'vinod.kale@parason.com');
    assert.strictEqual(parasonContacts[1].isPrimary, false);

    // S S Controls should have unpacked into 2 contacts with clean +91 numbers
    const ssContacts = parsed.filter(p => p.partyName.includes('S S CONTROLS'));
    assert.strictEqual(ssContacts.length, 2);
    assert.strictEqual(ssContacts[0].personName, 'Kamran Khan');
    assert.strictEqual(ssContacts[0].mobileNumber, '+917757907578');
    assert.strictEqual(ssContacts[1].mobileNumber, '+917057618529');

    // Oshiya Metals should be flagged with hasMissingContacts
    const oshiya = parsed.find(p => p.partyName.includes('OSHIYA'));
    assert.ok(oshiya);
    assert.strictEqual(oshiya.hasMissingContacts, true);

    // Ingest into DB without explicit Ledger Code
    const ingestRes = await ingestCustomerContacts(tenant.id, parsed);
    assert.ok(ingestRes.contactsCreated + ingestRes.contactsUpdated >= 5);
    assert.strictEqual(ingestRes.missingContactsCount, 1);

    // Verify customer and contacts in DB
    const parasonDb = await prisma.customer.findFirst({
      where: { tenantId: tenant.id, partyName: { contains: 'Parason' } },
      include: { contacts: true },
    });
    assert.ok(parasonDb);
    assert.strictEqual(parasonDb.contacts.length, 2);
  });
});
