'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Receipt, 
  Users, 
  MessageSquare, 
  Settings, 
  History, 
  LogOut,
  ExternalLink,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, title: 'Dashboard overview' },
  { href: '/dues', label: 'Dues & Invoices', icon: Receipt, title: 'Dues & invoices' },
  { href: '/customers', label: 'Customer Contacts', icon: Users, title: 'Customer contacts' },
  { href: '/templates', label: 'Message Templates', icon: MessageSquare, title: 'Message templates' },
  { href: '/logs', label: 'Reminder History', icon: History, title: 'Reminder history' },
  { href: '/settings', label: 'Settings & Gateways', icon: Settings, title: 'Settings & gateways' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isAuthPage = pathname === '/login' || pathname === '/register';

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
          if (!isAuthPage) {
            router.push('/login');
          }
        }
      } catch (err) {
        console.error('Auth check error:', err);
        if (!isAuthPage) {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [pathname, isAuthPage, router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      window.location.href = '/login';
    } catch (err) {
      console.error(err);
      window.location.href = '/login';
    }
  };

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (loading && !currentUser) {
    return (
      <div className="min-h-screen bg-[#F5F8FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Checking authentication...</span>
        </div>
      </div>
    );
  }

  const activeItem = NAV_ITEMS.find((n) => n.href === pathname) || NAV_ITEMS[0];

  return (
    <div className="bg-[#F5F8FA] text-[#3A3A3A] font-sans antialiased min-h-screen flex w-full">
      {/* SIDEBAR (fixed, white, teal active state) */}
      <aside className="w-[248px] bg-white flex flex-col justify-between shrink-0 border-r border-[#e5eaed] fixed left-0 top-0 bottom-0 h-screen z-40 overflow-y-auto">
        <div>
          {/* Brand: Abhiyadna Machine Tools logo */}
          <a
            href="https://abhiyadnamt.com/"
            target="_blank"
            rel="noopener noreferrer"
            title="Visit Abhiyadna Machine Tools (https://abhiyadnamt.com/)"
            className="flex flex-col items-center gap-2 px-4 py-4 border-b border-[#edf0f2] hover:bg-[#f7fcfc] transition"
          >
            <img src="/amt-logo.png" alt="Abhiyadna Machine Tools Logo" className="w-full max-w-[190px] h-auto object-contain" />
            <div className="text-[10px] text-[#9aa3aa] flex items-center gap-1 font-mono">
              <span>abhiyadnamt.com</span>
              <ExternalLink className="w-2.5 h-2.5 text-[#09AEB8] shrink-0" />
            </div>
          </a>

          <div className="px-[22px] pt-6 pb-2 text-[10px] font-bold uppercase tracking-[1.1px] text-[#9aa3aa]">Workspace</div>
          <nav className="px-3 grid gap-1 text-[13px] font-medium">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-[11px] rounded-[9px] transition ${
                    active
                      ? 'bg-[#e8f9fa] text-[#078d96] font-bold'
                      : 'text-[#68737c] hover:bg-[#f2fbfb] hover:text-[#09AEB8]'
                  }`}
                >
                  <Icon className="w-[17px] h-[17px]" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User card, Zuigo branding & logout */}
        <div className="p-4 border-t border-[#edf0f2] text-xs space-y-3">
          <div className="flex items-center justify-between bg-[#f1fbfb] border border-[#d6f1f2] p-2.5 rounded-xl">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-[#dff6f7] text-[#087f87] flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'Z'}
              </div>
              <div className="truncate">
                <div className="font-bold text-[#3A3A3A] truncate">{currentUser?.name || 'Admin'}</div>
                <div className="text-[11px] text-[#7a858d] truncate">{currentUser?.email || 'Administrator'}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="text-[#7a858d] hover:text-rose-500 p-1.5 rounded-lg hover:bg-white transition shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <a
            href="https://zuigo.ai/"
            target="_blank"
            rel="noopener noreferrer"
            title="Visit ZuiGO AI (https://zuigo.ai/)"
            className="flex items-center justify-between p-2.5 rounded-xl bg-white hover:bg-[#f7fcfc] border border-[#e5eaed] transition group"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] text-[#7a858d]">Built by</span>
            </div>
            {/* Colour logo on the light sidebar */}
            <img src="/zuigo-logo.png" alt="ZuiGO Logo" className="h-4 w-auto object-contain" />
          </a>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col min-w-0 pl-[248px] min-h-screen">
        <header className="sticky top-0 z-30 bg-white border-b border-[#e7ecef] px-[30px] min-h-[78px] py-2.5 flex items-center justify-between gap-5 shadow-[0_3px_12px_rgba(25,45,55,.04)]">
          <div>
            <div className="text-[11px] text-[#9aa3aa] mb-1">
              Payment Follow-up Automation <span className="mx-1">/</span> <span>{activeItem.label}</span>
            </div>
            <div className="font-display font-semibold text-[18px] tracking-tight text-[#3A3A3A]">{activeItem.title}</div>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2.5">
              <div className="w-[35px] h-[35px] rounded-full bg-[#dff6f7] text-[#087f87] font-bold flex items-center justify-center text-xs">
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden lg:block text-left">
                <div className="font-bold text-xs text-[#3A3A3A] leading-tight">{currentUser?.name || 'Administrator'}</div>
                <div className="text-[10px] text-[#1a9b71] font-medium mt-0.5">Online</div>
              </div>
            </div>

            {/* ZuiGO logo pinned to the far right corner */}
            <a
              href="https://zuigo.ai/"
              target="_blank"
              rel="noopener noreferrer"
              title="ZuiGO AI (https://zuigo.ai/)"
              className="flex items-center pl-5 border-l border-[#e5eaed]"
            >
              <img src="/zuigo-logo.png" alt="ZuiGO Logo" className="h-8 w-auto object-contain" />
            </a>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
