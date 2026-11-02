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
  BellRing,
  ShieldAlert,
  LogOut,
  UserCheck
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
              Settings & API
            </Link>
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-800 text-xs space-y-3">
          <div className="flex items-center justify-between bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'Z'}
              </div>
              <div className="truncate">
                <div className="font-bold text-white truncate">{currentUser?.name || 'zuigo'}</div>
                <div className="text-[11px] text-slate-400 truncate">{currentUser?.email || 'jayesh@zuigo.ai'}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>PostgreSQL & Groq AI Active</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
