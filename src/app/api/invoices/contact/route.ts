import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { formatPhoneNumber } from '@/lib/parser';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      invoiceId,
      billNo,
      personName,
      mobileNumber,
      whatsappNumber,
      emailId,
      designation,
      updateCustomerDefault = false,
    } = body;

    let targetInvoice = null;
    if (invoiceId) {
      targetInvoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { customer: { include: { contacts: true } } },
      });
    } else if (billNo) {
      targetInvoice = await prisma.invoice.findFirst({
        where: { billNo: { equals: billNo.trim(), mode: 'insensitive' } },
        include: { customer: { include: { contacts: true } } },
      });
    }

    if (!targetInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const formattedMobile = mobileNumber ? formatPhoneNumber(mobileNumber) || undefined : undefined;
    const formattedWa = whatsappNumber ? formatPhoneNumber(whatsappNumber) || undefined : formattedMobile;
    const cleanEmail = emailId ? String(emailId).trim().toLowerCase() : undefined;
    const cleanPerson = personName?.trim() || 'Accounts Department';
    const cleanDesignation = designation?.trim() || null;

    // 1. Update the specific invoice with its own dedicated contact
    const updatedInvoice = await prisma.invoice.update({
      where: { id: targetInvoice.id },
      data: {
        contactPerson: cleanPerson,
        contactPhone: formattedWa || formattedMobile || null,
        contactEmail: cleanEmail || null,
        contactDesignation: cleanDesignation,
      },
      include: {
        customer: {
          include: { contacts: true },
        },
      },
    });

    // 2. Optionally also update / create customer-level contact if requested or if customer has no contacts
    if (updateCustomerDefault || targetInvoice.customer.contacts.length === 0) {
      const primaryContact = targetInvoice.customer.contacts.find((c) => c.isPrimary) || targetInvoice.customer.contacts[0];
      if (primaryContact) {
        await prisma.customerContact.update({
          where: { id: primaryContact.id },
          data: {
            personName: cleanPerson,
            mobileNumber: formattedMobile || null,
            whatsappNumber: formattedWa || null,
            emailId: cleanEmail || null,
            designation: cleanDesignation,
          },
        });
      } else {
        await prisma.customerContact.create({
          data: {
            customerId: targetInvoice.customerId,
            personName: cleanPerson,
            mobileNumber: formattedMobile || null,
            whatsappNumber: formattedWa || null,
            emailId: cleanEmail || null,
            designation: cleanDesignation,
            isPrimary: true,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      message: `Contact details updated specifically for invoice ${targetInvoice.billNo}`,
    });
  } catch (error: any) {
    console.error('Update invoice contact error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
