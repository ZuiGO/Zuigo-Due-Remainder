import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { calculateInstallmentPlan } from '@/lib/payment-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const invoiceId = body.invoiceId || body.dueId;
    const { numberOfInstallments = 3, intervalDays = 15, startDate = new Date() } = body;

    if (!invoiceId || numberOfInstallments <= 0) {
      return NextResponse.json({ error: 'Valid invoiceId and numberOfInstallments required' }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice record not found' }, { status: 404 });
    }

    // Clear existing pending installments if any
    await prisma.installment.deleteMany({
      where: { invoiceId: invoice.id },
    });

    // Generate new installments
    const plan = calculateInstallmentPlan(
      invoice.outstandingAmount,
      Number(numberOfInstallments),
      new Date(startDate),
      Number(intervalDays)
    );

    const createdInstallments = [];
    for (const item of plan) {
      const created = await prisma.installment.create({
        data: {
          invoiceId: invoice.id,
          installmentNumber: item.installmentNumber,
          amount: item.amount,
          dueDate: item.dueDate,
          status: item.status,
        },
      });
      createdInstallments.push(created);
    }

    // Update the next installment due date as the main invoice dueDate
    if (createdInstallments.length > 0) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { dueDate: createdInstallments[0].dueDate },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully split ₹${invoice.outstandingAmount.toLocaleString('en-IN')} into ${numberOfInstallments} installments`,
      installments: createdInstallments,
    });
  } catch (error: any) {
    console.error('Installments API error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
