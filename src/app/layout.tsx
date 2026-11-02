import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Zuigo Due Remainder | Receivables & Payment Recovery Platform',
  description: 'Automated and manual receivables recovery platform with WhatsApp, SMS, and Email reminders',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 font-sans antialiased min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
