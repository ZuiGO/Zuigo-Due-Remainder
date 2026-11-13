import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { formatPhoneNumber } from '@/lib/parser';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerId,
      contactId,
      personName,
      designation,
      mobileNumber,
      whatsappNumber,
      emailId,
      preferredLanguage,
      isPrimary = true,
    } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const formattedMobile = mobileNumber ? formatPhoneNumber(mobileNumber) || undefined : undefined;
    const formattedWa = whatsappNumber ? formatPhoneNumber(whatsappNumber) || undefined : formattedMobile;
    const cleanEmail = emailId ? String(emailId).trim().toLowerCase() : undefined;

    // If marked primary, unset primary on other contacts for this customer
    if (isPrimary) {
      await prisma.customerContact.updateMany({
        where: { customerId },
        data: { isPrimary: false },
      });
    }

    let contact;
    if (contactId) {
      contact = await prisma.customerContact.update({
        where: { id: contactId },
        data: {
          personName: personName?.trim() || 'Accounts Department',
          designation: designation?.trim() || null,
          mobileNumber: formattedMobile || null,
          whatsappNumber: formattedWa || null,
          emailId: cleanEmail || null,
          isPrimary,
        },
      });
    } else {
      contact = await prisma.customerContact.create({
        data: {
          customerId,
          personName: personName?.trim() || 'Accounts Department',
          designation: designation?.trim() || null,
          mobileNumber: formattedMobile || null,
          whatsappNumber: formattedWa || null,
          emailId: cleanEmail || null,
          isPrimary,
        },
      });
    }

    if (preferredLanguage) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { preferredLanguage },
      });
    }

    const updatedCustomer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { contacts: true },
    });

    return NextResponse.json({
      success: true,
      contact,
      customer: updatedCustomer,
      message: 'Contact saved successfully',
    });
  } catch (error: any) {
    console.error('Save customer contact error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 });
    }

    await prisma.customerContact.delete({
      where: { id: contactId },
    });

    return NextResponse.json({ success: true, message: 'Contact deleted' });
  } catch (error: any) {
    console.error('Delete customer contact error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
