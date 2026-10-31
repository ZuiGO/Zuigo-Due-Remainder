import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { calculateInstallmentPlan } from '@/lib/payment-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dueId, numberOfInstallments = 3, intervalDays = 15, startDate = new Date() } = body;

    if (!dueId || numberOfInstallments <= 0) {
      return NextResponse.json({ error: 'Valid dueId and numberOfInstallments required' }, { status: 400 });
    }

    const due = await prisma.due.findUnique({ where: { id: dueId } });
    if (!due) {
      return NextResponse.json({ error: 'Due record not found' }, { status: 404 });
    }

    // Clear existing pending installments if any
    await prisma.installment.deleteMany({
      where: { dueId: due.id },
    });

    // Generate new installments
    const plan = calculateInstallmentPlan(
      due.remainingBalance,
      Number(numberOfInstallments),
      new Date(startDate),
      Number(intervalDays)
    );

    const createdInstallments = [];
    for (const item of plan) {
      const created = await prisma.installment.create({
        data: {
          dueId: due.id,
          installmentNumber: item.installmentNumber,
          amount: item.amount,
          dueDate: item.dueDate,
          status: item.status,
        },
      });
      createdInstallments.push(created);
    }

    // Update the first installment due date as the main due date
    if (createdInstallments.length > 0) {
      await prisma.due.update({
        where: { id: due.id },
        data: { dueDate: createdInstallments[0].dueDate },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully split ₹${due.remainingBalance} into ${numberOfInstallments} installments`,
      installments: createdInstallments,
    });
  } catch (error: any) {
    console.error('Installments API error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
