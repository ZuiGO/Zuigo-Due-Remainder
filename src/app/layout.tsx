import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Receipt, 
  Users, 
  MessageSquare, 
  Settings, 
  History, 
  BellRing,
  ShieldAlert
} from 'lucide-react';

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
      <body className="bg-slate-50 text-slate-900 font-sans antialiased min-h-screen flex">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between shrink-0 shadow-xl border-r border-slate-800">
          <div>
            {/* Brand Header */}
            <div className="p-6 border-b border-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight tracking-wide">Zuigo Remainder</h1>
                <p className="text-xs text-indigo-300 font-medium">Abhiyadna Machine Tools</p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="p-4 space-y-1 text-sm font-medium">
              <Link 
                href="/" 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                <LayoutDashboard className="w-4 h-4 text-indigo-400" />
                Dashboard
              </Link>
              <Link 
                href="/dues" 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                <Receipt className="w-4 h-4 text-emerald-400" />
                Dues & Installments
              </Link>
              <Link 
                href="/customers" 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                <Users className="w-4 h-4 text-sky-400" />
                Customer Directory
              </Link>
              <Link 
                href="/templates" 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                <MessageSquare className="w-4 h-4 text-amber-400" />
                Message Templates
              </Link>
              <Link 
                href="/logs" 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                <History className="w-4 h-4 text-purple-400" />
                Reminder History
              </Link>
              <Link 
                href="/settings" 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                Settings & API
              </Link>
            </nav>
          </div>

          {/* Footer Card */}
          <div className="p-4 border-t border-slate-800 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-semibold">
              <ShieldAlert className="w-4 h-4" />
              <span>Defaulter Protection</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Auto-flags customer & halts reminders after 5 consecutive unanswered notices.
            </p>
            <div className="pt-1 text-[10px] text-slate-400">
              User: <span className="text-slate-300 font-mono">zuigo</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
