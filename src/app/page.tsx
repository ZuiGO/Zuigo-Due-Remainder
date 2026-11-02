'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Sparkles,
  Check,
  Building,
  Phone,
  Mail,
  FileUp
} from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [criticalDues, setCriticalDues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAutoCheck, setRunningAutoCheck] = useState(false);
  const [autoCheckMsg, setAutoCheckMsg] = useState<string | null>(null);

  // Remind modal state
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [remindChannel, setRemindChannel] = useState<'WHATSAPP' | 'SMS' | 'EMAIL'>('WHATSAPP');
  const [customRemindMessage, setCustomRemindMessage] = useState('');
  const [generatingGroq, setGeneratingGroq] = useState(false);
  const [showRemindModal, setShowRemindModal] = useState(false);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dues');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        const critical = (data.invoices || []).filter(
          (d: any) => d.customer.isFlagged || d.daysOverdue > 0 || d.agingBucket !== 'Not Yet Due'
        );
        setCriticalDues(critical.slice(0, 6));
      }
    } catch (e) {
      console.error('Fetch dashboard error:', e);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadMsg('Please select an Excel (.xlsx, .xls) or CSV file first.');
      return;
    }

    try {
      setUploading(true);
      setUploadMsg(null);
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUploadMsg(
          `Import successful! Created ${data.stats.customersCreated} customers, ${data.stats.invoicesCreated} invoices, and ₹${data.stats.totalImportedOutstanding.toLocaleString('en-IN')} outstanding.`
        );
        setTimeout(() => {
          setShowUploadModal(false);
          setSelectedFile(null);
          setUploadMsg(null);
          fetchDashboardData();
        }, 1800);
      } else {
        setUploadMsg(data.error || 'Failed to import file');
      }
    } catch (e: any) {
      setUploadMsg('Upload error: ' + e?.message);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateWithGroq = async () => {
    if (!selectedInvoice) return;
    try {
      setGeneratingGroq(true);
      const contact = selectedInvoice.customer.contacts?.[0];
      const res = await fetch('/api/groq/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: selectedInvoice.customer.rawLedgerName.replace(/\[.*?\]/g, '').trim(),
          contactPerson: contact?.personName || 'Sir / Madam',
          billNo: selectedInvoice.billNo,
          outstandingAmount: selectedInvoice.outstandingAmount,
          dueDate: new Date(selectedInvoice.dueDate).toLocaleDateString('en-IN'),
          daysOverdue: selectedInvoice.daysOverdue || 0,
          agingBucket: selectedInvoice.agingBucket,
          priority: selectedInvoice.priority,
          channel: remindChannel,
        }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setCustomRemindMessage(data.message);
      }
    } catch (err: any) {
      alert('Groq AI error: ' + err?.message);
    } finally {
      setGeneratingGroq(false);
    }
  };

  const handleSendReminder = async () => {
    if (!selectedInvoice) return;
    try {
      const res = await fetch('/api/reminders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceIds: [selectedInvoice.id],
          channel: remindChannel,
          customMessage: customRemindMessage || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.results?.[0]?.actionUrl) {
        // Open the test URL (WhatsApp/SMS/Email)
        window.open(data.results[0].actionUrl, '_blank');
        setShowRemindModal(false);
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Error sending reminder:', err);
    }
  };

  const handleQuickMarkPaid = async (invoiceId: string) => {
    try {
      const res = await fetch('/api/invoices/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          status: 'Payment Received',
          notes: 'Marked as Payment Received via Quick Action',
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <main className="p-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            Receivables & Reminder Overview
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time aging analysis, automated multi-channel cadences, Groq AI messaging, and defaulter tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 shadow-sm transition"
          >
            <Upload className="w-4 h-4 text-indigo-600" />
            Import Excel (.xlsx / .csv)
          </button>

          <button
            onClick={handleRunAutoCheck}
            disabled={runningAutoCheck}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm transition disabled:opacity-50"
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
            ₹{stats ? stats.totalReceivables.toLocaleString('en-IN') : '0'}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Total active outstanding dues from Excel
          </p>
        </div>

        {/* Total Overdue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 text-xs font-semibold uppercase tracking-wider">
            <span>Total Overdue</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-3 text-2xl font-black text-rose-600">
            ₹{stats ? stats.totalOverdueAmount.toLocaleString('en-IN') : '0'}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {stats ? stats.overdueCount : 0} invoice(s) past due date
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
            ≥ 5 unanswered notices; follow-up escalated
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
            {stats ? stats.dueTodayCount : 0} today, {stats ? stats.upcomingCount : 0} upcoming
          </p>
        </div>
      </div>

      {/* Critical Action Items & Invoices List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900">
              Priority Receivables & Overdue Watchlist
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Bills requiring immediate payment follow-up or status action.
            </p>
          </div>
          <Link
            href="/dues"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            View All Invoices ({stats ? stats.totalCount : 0}) <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-6">Customer & Contact</th>
                <th className="py-3 px-6">Bill No & Date</th>
                <th className="py-3 px-6">Bill Amount</th>
                <th className="py-3 px-6">Paid / Adjusted</th>
                <th className="py-3 px-6">Outstanding Due</th>
                <th className="py-3 px-6">Due Date & Aging</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">Loading receivables data...</td>
                </tr>
              ) : stats?.totalCount === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="max-w-md mx-auto space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <FileSpreadsheet className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-bold text-slate-900">No Excel Data Imported Yet</h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Upload your real Receivables Excel file (.xlsx / .csv) to view customer dues, multiple invoices, contact directories, and trigger automated reminders.
                      </p>
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md hover:bg-indigo-700 transition"
                      >
                        <Upload className="w-4 h-4" />
                        Import Excel File Now
                      </button>
                    </div>
                  </td>
                </tr>
              ) : criticalDues.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No critical overdue bills at this moment. All receivables in good standing.
                  </td>
                </tr>
              ) : (
                criticalDues.map((inv: any) => {
                  const contact = inv.customer.contacts?.[0];
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                      {/* Customer */}
                      <td className="py-4 px-6 font-medium text-slate-900">
                        <div>
                          <span>{inv.customer.rawLedgerName.replace(/\[.*?\]/g, '').trim()}</span>
                          {inv.customer.isFlagged && (
                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                              <ShieldAlert className="w-3 h-3" /> Flagged
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {contact?.personName || 'Accounts'} • {contact?.mobileNumber || contact?.emailId || 'No direct contact'}
                        </div>
                      </td>

                      {/* Bill No & Date */}
                      <td className="py-4 px-6 text-slate-700">
                        <div className="font-semibold text-xs font-mono">{inv.billNo}</div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(inv.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </td>

                      {/* Bill Amount */}
                      <td className="py-4 px-6 text-slate-700 font-medium">
                        ₹{inv.billAmount.toLocaleString('en-IN')}
                      </td>

                      {/* Paid / Adjusted */}
                      <td className="py-4 px-6 text-emerald-700 font-medium">
                        {inv.adjustment > 0 ? `₹${inv.adjustment.toLocaleString('en-IN')}` : '₹0'}
                      </td>

                      {/* Outstanding Due */}
                      <td className="py-4 px-6 font-bold text-slate-900">
                        <span className="text-rose-600 font-black">
                          ₹{inv.outstandingAmount.toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* Due Date & Aging */}
                      <td className="py-4 px-6">
                        <div className="text-xs font-medium text-slate-800">
                          {new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-[11px] font-semibold text-rose-600 mt-0.5">
                          {inv.daysOverdue > 0 ? `${inv.daysOverdue} days overdue` : 'Due soon'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          inv.status === 'Payment Received'
                            ? 'bg-emerald-100 text-emerald-800'
                            : inv.status === 'Partially Paid'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {inv.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleQuickMarkPaid(inv.id)}
                            title="Mark Payment Received"
                            className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition"
                          >
                            Mark Paid
                          </button>
                          <button
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setCustomRemindMessage('');
                              setShowRemindModal(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" /> Remind
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Remind Modal with Groq AI Support */}
      {showRemindModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base text-slate-900">
                  Send Payment Reminder
                </h3>
              </div>
              <button
                onClick={() => setShowRemindModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Customer:</span>
                <span className="font-bold text-slate-900">{selectedInvoice.customer.rawLedgerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Bill Number:</span>
                <span className="font-bold font-mono text-indigo-600">{selectedInvoice.billNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Outstanding Due:</span>
                <span className="font-bold text-rose-600">₹{selectedInvoice.outstandingAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Due Date:</span>
                <span className="font-medium text-slate-700">
                  {new Date(selectedInvoice.dueDate).toLocaleDateString('en-IN')} ({selectedInvoice.daysOverdue} days overdue)
                </span>
              </div>
            </div>

            {/* Channel Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Choose Dispatch Channel
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRemindChannel('WHATSAPP')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                    remindChannel === 'WHATSAPP'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setRemindChannel('SMS')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                    remindChannel === 'SMS'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-800 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" /> SMS Text
                </button>
                <button
                  type="button"
                  onClick={() => setRemindChannel('EMAIL')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                    remindChannel === 'EMAIL'
                      ? 'bg-sky-50 border-sky-500 text-sky-800 ring-2 ring-sky-500/20'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
              </div>
            </div>

            {/* Groq AI Button & Message Area */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Reminder Message Content
                </label>
                <button
                  type="button"
                  onClick={handleGenerateWithGroq}
                  disabled={generatingGroq}
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${generatingGroq ? 'animate-spin' : ''}`} />
                  {generatingGroq ? 'Drafting with Groq AI...' : '✨ Generate with Groq AI'}
                </button>
              </div>
              <textarea
                value={customRemindMessage}
                onChange={(e) => setCustomRemindMessage(e.target.value)}
                placeholder="Click 'Generate with Groq AI' or type a personalized reminder message..."
                rows={5}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Test destination notice */}
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
              {remindChannel === 'EMAIL'
                ? 'Target Email: Opening mailto: for jayesh@zuigo.ai'
                : 'Target Mobile: Opening wa.me/sms: for +918530383141'}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRemindModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendReminder}
                className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-md transition flex items-center gap-2 ${
                  remindChannel === 'WHATSAPP'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : remindChannel === 'SMS'
                    ? 'bg-indigo-600 hover:bg-indigo-700'
                    : 'bg-sky-600 hover:bg-sky-700'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                {remindChannel === 'WHATSAPP' && 'Open WhatsApp (+918530383141) & Log'}
                {remindChannel === 'SMS' && 'Open SMS (+918530383141) & Log'}
                {remindChannel === 'EMAIL' && 'Open Email (jayesh@zuigo.ai) & Log'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real Excel File Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-600">
                <FileSpreadsheet className="w-6 h-6" />
                <h3 className="font-bold text-base text-slate-900">Import Excel Sheet</h3>
              </div>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Upload your receivables workbook (.xlsx, .xls, or .csv). The system reads bill-level rows, contacts, aging brackets, and links multiple invoices per customer.
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Drag and Drop Box */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : selectedFile
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileUp className={`w-10 h-10 mx-auto mb-2 ${selectedFile ? 'text-emerald-600' : 'text-slate-400'}`} />
                {selectedFile ? (
                  <div>
                    <p className="text-xs font-bold text-slate-900">{selectedFile.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Click or drag to change
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-slate-700">Click to choose Excel file or drag & drop</p>
                    <p className="text-[11px] text-slate-400 mt-1">Supports .xlsx, .xls, and .csv files</p>
                  </div>
                )}
              </div>

              {uploadMsg && (
                <div className={`p-3.5 rounded-xl text-xs font-medium ${
                  uploadMsg.includes('successful') 
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}>
                  {uploadMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shadow-md transition flex items-center gap-1.5"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Parsing & Ingesting...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload & Ingest to PostgreSQL</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
