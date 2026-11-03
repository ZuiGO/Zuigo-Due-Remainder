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
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react';

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
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="bg-slate-50 text-slate-900 font-sans antialiased min-h-screen flex w-full">
      {/* 
        FIXED SIDEBAR:
        Stays strictly pinned in place on the left (fixed left-0 top-0 bottom-0)
        and does NOT scroll with the page.
      */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between shrink-0 shadow-2xl border-r border-slate-800 fixed left-0 top-0 bottom-0 h-screen z-40 overflow-y-auto">
        <div>
          {/* Top Left: Abhiyadna Machine Tools Logo (Click opens https://abhiyadnamt.com/) */}
          <div className="p-4 border-b border-slate-800/90 bg-slate-950/40">
            <a
              href="https://abhiyadnamt.com/"
              target="_blank"
              rel="noopener noreferrer"
              title="Visit Abhiyadna Machine Tools (https://abhiyadnamt.com/)"
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/80 transition group border border-transparent hover:border-slate-700/60"
            >
              <div className="w-12 h-12 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-md border border-slate-700/60 group-hover:border-indigo-400 group-hover:scale-105 transition-all">
                <img
                  src="/amt-logo.png"
                  alt="Abhiyadna Machine Tools Logo"
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
              <div className="overflow-hidden">
                <div className="font-extrabold text-xs text-white group-hover:text-indigo-300 transition tracking-tight leading-tight">
                  Abhiyadna Machine Tools
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                  <span>abhiyadnamt.com</span>
                  <ExternalLink className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                </div>
              </div>
            </a>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1 text-sm font-medium">
            <Link 
              href="/" 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                pathname === '/' 
                  ? 'bg-indigo-600/20 text-indigo-400 font-semibold' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-indigo-400" />
              Dashboard
            </Link>
            <Link 
              href="/dues" 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                pathname === '/dues' 
                  ? 'bg-indigo-600/20 text-indigo-400 font-semibold' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Receipt className="w-4 h-4 text-emerald-400" />
              Dues & Invoices
            </Link>
            <Link 
              href="/customers" 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                pathname === '/customers' 
                  ? 'bg-indigo-600/20 text-indigo-400 font-semibold' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4 text-sky-400" />
              Customer Directory
            </Link>
            <Link 
              href="/templates" 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                pathname === '/templates' 
                  ? 'bg-indigo-600/20 text-indigo-400 font-semibold' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-amber-400" />
              Message Templates
            </Link>
            <Link 
              href="/logs" 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                pathname === '/logs' 
                  ? 'bg-indigo-600/20 text-indigo-400 font-semibold' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <History className="w-4 h-4 text-purple-400" />
              Reminder History
            </Link>
            <Link 
              href="/settings" 
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                pathname === '/settings' 
                  ? 'bg-indigo-600/20 text-indigo-400 font-semibold' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-400" />
              Settings & Gateways
            </Link>
          </nav>
        </div>

        {/* User Card, Zuigo White Branding & Logout */}
        <div className="p-4 border-t border-slate-800 text-xs space-y-3 bg-slate-950/40">
          <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'Z'}
              </div>
              <div className="truncate">
                <div className="font-bold text-white truncate">{currentUser?.name || 'Admin'}</div>
                <div className="text-[11px] text-slate-400 truncate">{currentUser?.email || 'Administrator'}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Zuigo White Logo link in sidebar bottom */}
          <a
            href="https://zuigo.ai/"
            target="_blank"
            rel="noopener noreferrer"
            title="Visit ZuiGO AI (https://zuigo.ai/)"
            className="flex items-center justify-between p-2 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/40 transition group"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] text-slate-400 group-hover:text-slate-200">Built by</span>
            </div>
            <img
              src="/zuigo-logo-white.png"
              alt="ZuiGO Logo"
              className="h-4 w-auto object-contain opacity-90 group-hover:opacity-100 transition"
            />
          </a>
        </div>
      </aside>

      {/* 
        MAIN CONTENT AREA:
        Offset with pl-64 so it cleanly clears the fixed sidebar.
      */}
      <div className="flex-1 flex flex-col min-w-0 pl-64 min-h-screen">
        {/* 
          TOP NAVIGATION HEADER:
          Fixed/Sticky across all pages.
          Top Right: ZuiGO Logo (Click opens https://zuigo.ai/)
        */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-8 py-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="font-extrabold text-sm text-slate-800 tracking-tight">Payment Follow-up Automation</span>
            <span className="text-slate-300 hidden md:inline">•</span>
            <span className="text-xs text-slate-500 font-medium hidden md:inline">
              Enterprise Dues Recovery
            </span>
          </div>

          {/* Top Right: ZuiGO Logo linking to https://zuigo.ai/ */}
          <div className="flex items-center gap-4">
            <a
              href="https://zuigo.ai/"
              target="_blank"
              rel="noopener noreferrer"
              title="Powered by ZuiGO AI (https://zuigo.ai/)"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 shadow-xs transition group"
            >
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 group-hover:text-indigo-600 transition hidden sm:inline">
                Powered by
              </span>
              <img
                src="/zuigo-logo.png"
                alt="ZuiGO Logo"
                className="h-6 w-auto object-contain transition-transform group-hover:scale-105"
              />
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition" />
            </a>

            {/* User Avatar */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden lg:block text-left text-xs">
                <div className="font-bold text-slate-800 leading-tight">{currentUser?.name || 'Administrator'}</div>
                <div className="text-[10px] text-emerald-600 font-medium">Online</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
