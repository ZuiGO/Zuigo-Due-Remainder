'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ArrowUpRight, 
  RefreshCw, 
  Upload, 
  Send, 
  CreditCard, 
  ShieldAlert, 
  TrendingUp,
  FileSpreadsheet,
  Check
} from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [criticalDues, setCriticalDues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAutoCheck, setRunningAutoCheck] = useState(false);
  const [autoCheckMsg, setAutoCheckMsg] = useState<string | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [ledgerCsvText, setLedgerCsvText] = useState('');
  const [contactsCsvText, setContactsCsvText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dues');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        // Find critical dues: overdue or flagged
        const critical = data.dues.filter((d: any) => d.customer.isFlagged || d.status === 'OVERDUE');
        setCriticalDues(critical.slice(0, 6));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRunAutoCheck = async () => {
    try {
      setRunningAutoCheck(true);
      setAutoCheckMsg(null);
      const res = await fetch('/api/reminders/auto-check', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setAutoCheckMsg(data.message);
        fetchDashboardData();
      }
    } catch (e: any) {
      setAutoCheckMsg('Error running check: ' + e?.message);
    } finally {
      setRunningAutoCheck(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUploading(true);
      setUploadMsg(null);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ledgerCsvText: ledgerCsvText || undefined,
          contactsCsvText: contactsCsvText || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUploadMsg(`Successfully processed! Created: ${data.report.duesCreated} dues, Reconciled: ${data.report.paymentsAutoDetected} payments.`);
        setTimeout(() => {
          setShowUploadModal(false);
          setLedgerCsvText('');
          setContactsCsvText('');
          setUploadMsg(null);
          fetchDashboardData();
        }, 2000);
      } else {
        setUploadMsg(data.error || 'Upload error');
      }
    } catch (e: any) {
      setUploadMsg('Error: ' + e?.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="p-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">
            Receivables & Reminder Overview
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time aging analysis, automated multi-channel cadences, and defaulter tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 shadow-sm transition"
          >
            <Upload className="w-4 h-4 text-indigo-600" />
            Import Excel / CSV
          </button>

          <button
            onClick={handleRunAutoCheck}
            disabled={runningAutoCheck}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${runningAutoCheck ? 'animate-spin' : ''}`} />
            {runningAutoCheck ? 'Checking Cadences...' : 'Run Auto Cadence Check'}
          </button>
        </div>
      </div>

      {/* Auto-Check Notification Banner */}
      {autoCheckMsg && (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            <span>{autoCheckMsg}</span>
          </div>
          <button onClick={() => setAutoCheckMsg(null)} className="text-xs font-bold text-indigo-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Receivables */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Receivables</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">
            ₹{stats ? stats.totalReceivables.toLocaleString('en-IN') : '...'}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Active Dr balance across trade customers
          </p>
        </div>

        {/* Total Overdue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 text-xs font-semibold uppercase tracking-wider">
            <span>Total Overdue</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-3 text-2xl font-black text-rose-600">
            ₹{stats ? stats.totalOverdueAmount.toLocaleString('en-IN') : '...'}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {stats ? stats.overdueCount : 0} customers past due date
          </p>
        </div>

        {/* Flagged Chronic Defaulters */}
        <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/40 shadow-sm">
          <div className="flex items-center justify-between text-rose-700 text-xs font-semibold uppercase tracking-wider">
            <span>Defaulters Flagged</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-3 text-2xl font-black text-rose-700">
            {stats ? stats.flaggedCount : 0}
          </div>
          <p className="mt-1 text-xs text-rose-800">
            ≥ 5 unanswered reminders; auto-halted
          </p>
        </div>

        {/* Due Today & Upcoming */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 text-xs font-semibold uppercase tracking-wider">
            <span>Due Today / Soon</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">
            {stats ? stats.dueTodayCount + stats.upcomingCount : 0}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {stats ? stats.dueTodayCount : 0} due today, {stats ? stats.upcomingCount : 0} within 7 days
          </p>
        </div>
      </div>

      {/* Critical Action Items & Quick Dispatch */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900">
              Priority Overdue & Defaulter Watchlist
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Customers requiring immediate payment follow-up or manual management.
            </p>
          </div>
          <Link
            href="/dues"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            View All Dues ({stats ? stats.totalCount : 0}) <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-6">Customer / Company</th>
                <th className="py-3 px-6">Primary Contact</th>
                <th className="py-3 px-6">Due Amount</th>
                <th className="py-3 px-6">Due Date & Status</th>
                <th className="py-3 px-6">Reminders</th>
                <th className="py-3 px-6 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {criticalDues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No critical overdue or flagged accounts currently found. All clear!
                  </td>
                </tr>
              ) : (
                criticalDues.map((due: any) => {
                  const contact = due.customer.contacts?.[0];
                  return (
                    <tr key={due.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-6 font-medium text-slate-900">
                        <div>
                          <span>{due.customer.rawLedgerName.replace(/\[.*?\]/g, '').trim()}</span>
                          {due.customer.isFlagged && (
                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                              <ShieldAlert className="w-3 h-3" /> Flagged Defaulter
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-600">
                        <div className="font-semibold text-slate-800">{contact?.personName || 'Accounts'}</div>
                        <div className="text-slate-500">{contact?.mobileNumber || contact?.emailId || 'No direct phone'}</div>
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-900">
                        ₹{due.remainingBalance.toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                          due.customer.isFlagged
                            ? 'bg-rose-100 text-rose-800'
                            : due.status === 'OVERDUE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {due.customer.isFlagged ? 'ESCALATED' : due.status}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Due: {new Date(due.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800">
                            {due.customer.consecutiveRemindersCount} / 5
                          </span>
                          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${due.customer.isFlagged ? 'bg-rose-600' : 'bg-indigo-600'}`}
                              style={{ width: `${Math.min(100, (due.customer.consecutiveRemindersCount / 5) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <Link
                          href={`/dues?search=${encodeURIComponent(due.customer.rawLedgerName.slice(0, 10))}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                        >
                          <Send className="w-3 h-3" /> Remind / Pay
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-600">
                <FileSpreadsheet className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Import Ledger & Contacts</h3>
              </div>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Paste your Ledger Outstanding CSV (Tally format) and/or Customer Contact Directory. The system automatically reconciles reduced balances as partial payments.
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  1. Ledger Master Outstanding Report (CSV or Text)
                </label>
                <textarea
                  value={ledgerCsvText}
                  onChange={(e) => setLedgerCsvText(e.target.value)}
                  placeholder="Paste CSV with ledgerName,₹ Balance..."
                  rows={4}
                  className="w-full text-xs font-mono p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  2. Customer Contact Directory (CSV or Text)
                </label>
                <textarea
                  value={contactsCsvText}
                  onChange={(e) => setContactsCsvText(e.target.value)}
                  placeholder="Paste CSV with Company Name,Contact Person Name,Mobile No.,Email ID..."
                  rows={4}
                  className="w-full text-xs font-mono p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {uploadMsg && (
                <div className="p-3 rounded-lg text-xs bg-indigo-50 text-indigo-900 font-medium">
                  {uploadMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {uploading ? 'Processing & Reconciling...' : 'Upload & Reconcile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
