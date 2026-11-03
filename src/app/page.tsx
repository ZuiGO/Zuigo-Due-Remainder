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
  FileUp, 
  Layers, 
  CalendarClock, 
  BadgeCheck,
  ListChecks,
  Eye,
  CheckSquare,
  Square,
  X,
  MessageSquare,
  AlertTriangle,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  CheckCheck
} from 'lucide-react';
import { selectBestTemplate, populateInvoiceTemplate } from '@/lib/template-renderer';

export default function DashboardPage() {
  const [tenant, setTenant] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [latestBatch, setLatestBatch] = useState<any>(null);
  const [recentBatches, setRecentBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [comparisonSearch, setComparisonSearch] = useState('');
  const [showComparisonDetails, setShowComparisonDetails] = useState(true);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [criticalDues, setCriticalDues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAutoCheck, setRunningAutoCheck] = useState(false);
  const [autoCheckMsg, setAutoCheckMsg] = useState<string | null>(null);

  // Approval Queue State (Semi-Automated Dispatch Mode)
  const [showApprovalQueue, setShowApprovalQueue] = useState(false);
  const [queuedItems, setQueuedItems] = useState<any[]>([]);
  const [selectedQueueIds, setSelectedQueueIds] = useState<Set<string>>(new Set());
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [dispatchingQueue, setDispatchingQueue] = useState(false);
  const [queueActionMsg, setQueueActionMsg] = useState<string | null>(null);
  const [inspectMessage, setInspectMessage] = useState<any | null>(null);
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const [queueFilter, setQueueFilter] = useState<'ALL' | 'ELIGIBLE' | 'MISSING_CONTACTS' | 'SENT_TODAY'>('ALL');

  // Remind modal state
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [remindChannel, setRemindChannel] = useState<'WHATSAPP' | 'SMS' | 'EMAIL'>('WHATSAPP');
  const [remindLanguage, setRemindLanguage] = useState<string>('English');
  const [remindSubject, setRemindSubject] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customRemindMessage, setCustomRemindMessage] = useState('');
  const [showRemindModal, setShowRemindModal] = useState(false);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatDateTime = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const fetchDashboardData = async (batchId?: string) => {
    try {
      setLoading(true);
      const bId = batchId !== undefined ? batchId : selectedBatchId;
      const url = bId ? `/api/dues?batchId=${bId}` : '/api/dues';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setTenant(data.tenant);
        setStats(data.stats);
        setLatestBatch(data.latestBatch);
        setRecentBatches(data.recentBatches || []);
        setAllInvoices(data.invoices || []);
        const critical = (data.invoices || []).filter(
          (d: any) => d.customer.isFlagged || d.daysOverdue > 0 || d.agingBucket !== 'Not Yet Due'
        );
        setCriticalDues(critical.slice(0, 6));
      }

      // Fetch pending approval queue count
      try {
        const qRes = await fetch('/api/reminders/approval-queue');
        const qData = await qRes.json();
        if (qData.success) {
          setQueuedCount(qData.totalQueuedCount || 0);
        }
      } catch (err) {
        console.error('Queue count fetch error:', err);
      }

      // Fetch message templates from settings
      fetch('/api/templates')
        .then((r) => r.json())
        .then((td) => {
          if (td.success && Array.isArray(td.templates)) {
            setTemplates(td.templates);
          }
        })
        .catch(console.error);
    } catch (e) {
      console.error('Fetch dashboard error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBatch = (bId: string) => {
    setSelectedBatchId(bId);
    fetchDashboardData(bId);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const isItemEligible = (item: any) => {
    const allSent = item.alreadySentToday?.whatsapp && item.alreadySentToday?.sms && item.alreadySentToday?.email;
    return Boolean(item.hasContacts && item.reminderEnabled && !allSent);
  };

  const fetchApprovalQueue = async () => {
    try {
      setLoadingQueue(true);
      setQueueActionMsg(null);
      const res = await fetch('/api/reminders/approval-queue');
      const data = await res.json();
      if (data.success) {
        setQueuedItems(data.queue || []);
        setQueuedCount(data.totalQueuedCount || 0);
        // Pre-select all eligible customers who have registered contacts and unsent channels
        const autoSelected = new Set<string>();
        (data.queue || []).forEach((item: any) => {
          if (isItemEligible(item)) {
            autoSelected.add(item.customerId);
          }
        });
        setSelectedQueueIds(autoSelected);
      }
    } catch (e) {
      console.error('Fetch approval queue error:', e);
    } finally {
      setLoadingQueue(false);
    }
  };

  const handleOpenApprovalQueue = () => {
    setShowApprovalQueue(true);
    fetchApprovalQueue();
  };

  const handleToggleQueueSelect = (id: string) => {
    const next = new Set(selectedQueueIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedQueueIds(next);
  };

  const handleSelectEligibleOnly = () => {
    const eligibleIds = new Set(queuedItems.filter(isItemEligible).map(q => q.customerId));
    setSelectedQueueIds(eligibleIds);
  };

  const handleSelectAllInView = (itemsInView: any[]) => {
    const next = new Set(selectedQueueIds);
    itemsInView.forEach(item => next.add(item.customerId));
    setSelectedQueueIds(next);
  };

  const handleDeselectAllInView = (itemsInView: any[]) => {
    const next = new Set(selectedQueueIds);
    itemsInView.forEach(item => next.delete(item.customerId));
    setSelectedQueueIds(next);
  };

  const handleToggleSelectAllInView = (itemsInView: any[]) => {
    const allSelected = itemsInView.length > 0 && itemsInView.every(item => selectedQueueIds.has(item.customerId));
    if (allSelected) {
      handleDeselectAllInView(itemsInView);
    } else {
      handleSelectAllInView(itemsInView);
    }
  };

  const handleDeselectAll = () => {
    setSelectedQueueIds(new Set());
  };

  const handleDispatchApprovedQueue = async () => {
    if (selectedQueueIds.size === 0) {
      alert('Please select at least one customer to approve.');
      return;
    }

    try {
      setDispatchingQueue(true);
      setQueueActionMsg(null);
      const res = await fetch('/api/reminders/approval-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvedCustomerIds: Array.from(selectedQueueIds),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setQueueActionMsg(data.message);
        fetchDashboardData();
        fetchApprovalQueue();
      } else {
        setQueueActionMsg('Error: ' + data.error);
      }
    } catch (err: any) {
      setQueueActionMsg('Error: ' + err?.message);
    } finally {
      setDispatchingQueue(false);
    }
  };

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
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setUploadMsg('Please select an Excel (.xlsx, .xls) or CSV file first.');
      return;
    }

    try {
      setUploading(true);
      setUploadMsg(null);
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUploadMsg(data.message || 'Import successful!');
        fetchDashboardData(); // Synchronize dashboard metrics immediately!
        setTimeout(() => {
          setShowUploadModal(false);
          setSelectedFiles([]);
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

  const applyTemplateToModal = (
    channel: 'WHATSAPP' | 'SMS' | 'EMAIL',
    lang: string,
    inv: any,
    targetTemplateId?: string,
    templateList: any[] = templates
  ) => {
    if (!inv) return;

    let match = targetTemplateId
      ? templateList.find((t) => t.id === targetTemplateId)
      : null;

    if (!match) {
      match = selectBestTemplate(templateList, channel, lang, inv.daysOverdue || 0);
    }

    if (match) {
      setSelectedTemplateId(match.id);
      const populated = populateInvoiceTemplate(
        match,
        inv,
        tenant?.companyName || 'Abhiyadna Machine Tools',
        tenant?.bankDetails || 'HDFC Bank, A/C: 50200012345678, IFSC: HDFC0001234'
      );
      setCustomRemindMessage(populated.body);
      setRemindSubject(populated.subject);
    } else {
      setSelectedTemplateId('');
      setCustomRemindMessage(`Payment Reminder: Outstanding balance for Bill ${inv.billNo}`);
      setRemindSubject(`Payment Reminder: Bill ${inv.billNo}`);
    }
  };

  const handleOpenRemind = (inv: any) => {
    setSelectedInvoice(inv);
    const initialChannel: 'WHATSAPP' | 'SMS' | 'EMAIL' = 'WHATSAPP';
    const initialLang = inv.customer?.preferredLanguage || 'English';
    setRemindChannel(initialChannel);
    setRemindLanguage(initialLang);

    if (templates.length === 0) {
      fetch('/api/templates')
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.templates)) {
            setTemplates(d.templates);
            applyTemplateToModal(initialChannel, initialLang, inv, undefined, d.templates);
          }
        })
        .catch(console.error);
    } else {
      applyTemplateToModal(initialChannel, initialLang, inv);
    }

    setShowRemindModal(true);
  };

  const handleRemindChannelChange = (ch: 'WHATSAPP' | 'SMS' | 'EMAIL') => {
    setRemindChannel(ch);
    applyTemplateToModal(ch, remindLanguage, selectedInvoice);
  };

  const handleRemindLanguageChange = (lang: string) => {
    setRemindLanguage(lang);
    applyTemplateToModal(remindChannel, lang, selectedInvoice);
  };

  const handleTemplateDropdownChange = (tId: string) => {
    setSelectedTemplateId(tId);
    applyTemplateToModal(remindChannel, remindLanguage, selectedInvoice, tId);
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
          language: remindLanguage,
          templateId: selectedTemplateId || undefined,
          subject: remindSubject || undefined,
          customMessage: customRemindMessage || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.results?.[0]?.actionUrl) {
        window.open(data.results[0].actionUrl, '_blank');
        setShowRemindModal(false);
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Error sending reminder:', err);
    }
  };

  const handleRemindFromDiff = (log: any) => {
    const match = allInvoices.find(
      (inv: any) =>
        (log.billNo && inv.billNo?.toUpperCase().trim() === log.billNo.toUpperCase().trim()) ||
        (inv.customer?.partyName && log.partyName && inv.customer.partyName.toLowerCase().includes(log.partyName.toLowerCase()))
    );

    if (match) {
      handleOpenRemind(match);
    } else {
      const syntheticInvoice = {
        id: log.invoiceId || `diff_${Date.now()}`,
        billNo: log.billNo || 'Open Bill',
        outstandingAmount: log.currentBalance || 0,
        dueDate: new Date().toISOString(),
        daysOverdue: 15,
        agingBucket: '1 - 30 Days Overdue',
        priority: 'High',
        customer: {
          partyName: log.partyName || 'Customer',
          rawLedgerName: log.partyName || 'Customer',
          contacts: [],
        },
      };
      handleOpenRemind(syntheticInvoice);
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
      {/* Top Header with Dynamic White-Label Tenant Branding */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700">
              Multi-Tenant Active
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-600">
              {tenant?.companyName || 'Abhiyadna Machine Tools'}
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 mt-1 flex items-center gap-2">
            Receivables & Reminder Overview
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time aging analysis, daily SAP diff reconciliation, Promise-to-Pay commitments, and Groq AI messaging.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchDashboardData()}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 shadow-sm transition disabled:opacity-50"
            title="Refresh and sync latest receivables & metrics"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            Sync Metrics
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 shadow-sm transition"
          >
            <Upload className="w-4 h-4 text-indigo-600" />
            Import SAP Dues / Contacts
          </button>

          <button
            onClick={handleOpenApprovalQueue}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold hover:bg-purple-100 shadow-sm transition"
          >
            <ListChecks className="w-4 h-4 text-purple-600" />
            <span>Review Approval Queue</span>
            {queuedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-600 text-white font-extrabold shadow-sm">
                {queuedCount}
              </span>
            )}
          </button>

          <button
            onClick={handleRunAutoCheck}
            disabled={runningAutoCheck}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${runningAutoCheck ? 'animate-spin' : ''}`} />
            {runningAutoCheck ? 'Dispatching...' : 'Quick Auto-Dispatch'}
          </button>
        </div>
      </div>

      {/* Auto-Check Notification Banner */}
      {autoCheckMsg && (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-medium flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{autoCheckMsg}</span>
          </div>
          <button onClick={() => setAutoCheckMsg(null)} className="text-xs font-bold text-indigo-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Receivables</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">
            ₹{stats ? stats.totalReceivables.toLocaleString('en-IN') : '0'}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Active Dr balance across trade customers
          </p>
        </div>

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
              Bills requiring payment follow-up or with active Promise-to-Pay commitments.
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
                <th className="py-3 px-6">Customer & Contacts</th>
                <th className="py-3 px-6">Bill No & Date</th>
                <th className="py-3 px-6">Bill Amount</th>
                <th className="py-3 px-6">Paid / Adjusted</th>
                <th className="py-3 px-6 text-rose-600">Outstanding Due</th>
                <th className="py-3 px-6">Due Date & Commitment</th>
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
                        Upload your SAP Outstanding Receivable export or Customer Contact sheet to start tracking dues, managing multiple invoices, and running digest reminders.
                      </p>
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md hover:bg-indigo-700 transition"
                      >
                        <Upload className="w-4 h-4" />
                        Import SAP Dues / Contacts
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
                  const commitment = inv.commitments && inv.commitments.length > 0 ? inv.commitments[0] : null;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                      {/* Customer */}
                      <td className="py-4 px-6 font-medium text-slate-900">
                        <div>
                          <span className="font-bold">{inv.customer.partyName || inv.customer.rawLedgerName}</span>
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

                      {/* Due Date & Commitment */}
                      <td className="py-4 px-6">
                        <div className="text-xs font-medium text-slate-800">
                          {new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-[11px] font-semibold text-rose-600 mt-0.5">
                          {inv.daysOverdue > 0 ? `${inv.daysOverdue} days overdue` : 'Due soon'}
                        </div>

                        {/* Promise to Pay Badge */}
                        {commitment && (
                          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <CalendarClock className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>
                              Promised ₹{commitment.promisedAmount.toLocaleString('en-IN')} on{' '}
                              {new Date(commitment.promisedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          inv.status === 'Payment Received' || inv.status === 'Closed'
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
                            onClick={() => handleOpenRemind(inv)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-xs"
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
                <span className="font-bold text-slate-900">
                  {selectedInvoice.customer.partyName || selectedInvoice.customer.rawLedgerName}
                </span>
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
                  onClick={() => handleRemindChannelChange('WHATSAPP')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                    remindChannel === 'WHATSAPP'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => handleRemindChannelChange('SMS')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                    remindChannel === 'SMS'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-800 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" /> SMS Text
                </button>
                <button
                  type="button"
                  onClick={() => handleRemindChannelChange('EMAIL')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                    remindChannel === 'EMAIL'
                      ? 'bg-sky-50 border-sky-500 text-sky-800 ring-2 ring-sky-500/20 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
              </div>
            </div>

            {/* Language Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Reminder Language
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'English', label: 'English' },
                  { id: 'Hindi', label: 'हिन्दी' },
                  { id: 'Marathi', label: 'मराठी' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleRemindLanguageChange(item.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      remindLanguage === item.id
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-800 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Preset Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Message Template</span>
                <span className="text-[10px] text-indigo-600 font-semibold">Synced from Settings</span>
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateDropdownChange(e.target.value)}
                className="w-full text-xs font-semibold py-2 px-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer"
              >
                {templates
                  .filter((t) => t.channel === remindChannel && t.language === remindLanguage)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                {templates.filter((t) => t.channel === remindChannel && t.language === remindLanguage).length === 0 && (
                  <option value="">Default {remindChannel} Template</option>
                )}
              </select>
            </div>

            {remindChannel === 'EMAIL' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={remindSubject}
                  onChange={(e) => setRemindSubject(e.target.value)}
                  placeholder="Email subject..."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Reminder Message Content
                </label>
                <span className="text-[11px] text-slate-400 font-medium">Pre-populated from template & editable</span>
              </div>
              <textarea
                value={customRemindMessage}
                onChange={(e) => setCustomRemindMessage(e.target.value)}
                placeholder="Type or edit reminder message..."
                rows={7}
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
              />
            </div>

            {/* Destination notice */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-500">Intended Customer:</span>
                <span className="font-bold text-slate-900 font-mono">
                  {remindChannel === 'EMAIL'
                    ? selectedInvoice?.customer?.contacts?.[0]?.emailId || 'Registered Contact Email'
                    : selectedInvoice?.customer?.contacts?.[0]?.mobileNumber ||
                      selectedInvoice?.customer?.contacts?.[0]?.whatsappNumber ||
                      'Registered Contact Mobile'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-amber-700 font-medium">
                <span>Safe Test Routing:</span>
                <span>Redirected to {remindChannel === 'EMAIL' ? 'jayesh@zuigo.ai' : '+918530383141'}</span>
              </div>
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
                {remindChannel === 'WHATSAPP' && 'Open WhatsApp & Send Reminder'}
                {remindChannel === 'SMS' && 'Send SMS Text Reminder'}
                {remindChannel === 'EMAIL' && 'Send Email Reminder & Log'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real Excel / SAP File Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-600">
                <FileSpreadsheet className="w-6 h-6" />
                <h3 className="font-bold text-base text-slate-900">Import SAP Dues / Contacts</h3>
              </div>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Upload your daily SAP Outstanding Receivable export and/or Customer Contact master. <strong>You can select or drag both files at once</strong>; contacts are mapped first, dues reconciled second, and autonomous reminders triggered automatically.
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-50/50'
                    : selectedFiles.length > 0
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".xlsx, .xls, .csv, .html"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileUp className={`w-9 h-9 mx-auto mb-2 ${selectedFiles.length > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
                {selectedFiles.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-900">
                      {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected:
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 max-h-32 overflow-y-auto">
                      {selectedFiles.map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 text-[11px] font-semibold">
                          📄 {f.name} ({(f.size / 1024).toFixed(1)} KB)
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Click or drag more files to replace</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-slate-700">Click to choose file(s) or drag & drop</p>
                    <p className="text-[11px] text-indigo-600 font-semibold mt-1">
                      💡 Pro-Tip: You can select both SAP Dues (.xls) and Contact Sheet (.xlsx) together!
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Supports SAP ALV HTML, Excel (.xlsx/.xls), and CSV</p>
                  </div>
                )}
              </div>

              {uploadMsg && (
                <div className={`p-3.5 rounded-xl text-xs font-medium ${
                  uploadMsg.includes('successful') || uploadMsg.includes('processed')
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
                  disabled={uploading || selectedFiles.length === 0}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shadow-md transition flex items-center gap-1.5"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing & Reconciling...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {selectedFiles.length > 1
                          ? `Ingest Both ${selectedFiles.length} Files Simultaneously`
                          : 'Ingest & Reconcile with DB'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval Queue Modal (Semi-Automated Dispatch Mode) */}
      {showApprovalQueue && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-100 text-purple-700 rounded-xl">
                  <ListChecks className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                    Daily Digest Approval Queue
                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-800">
                      Semi-Automated Review
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Review consolidated digests before dispatching. Exclude or pause sensitive customer accounts with one click.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowApprovalQueue(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notification Banner */}
            {queueActionMsg && (
              <div className="mx-6 mt-4 p-3.5 bg-purple-50 border border-purple-200 text-purple-900 text-xs font-semibold rounded-xl flex items-center justify-between">
                <span>{queueActionMsg}</span>
                <button onClick={() => setQueueActionMsg(null)} className="text-purple-700 font-bold">✕</button>
              </div>
            )}

            {/* Summary & Controls Bar */}
            {(() => {
              const eligibleItems = queuedItems.filter(isItemEligible);
              const missingContactsItems = queuedItems.filter((i: any) => !i.hasContacts);
              const sentTodayItems = queuedItems.filter((i: any) => i.alreadySentToday?.whatsapp || i.alreadySentToday?.sms || i.alreadySentToday?.email);

              const displayedQueueItems = queuedItems.filter((item: any) => {
                if (queueFilter === 'ELIGIBLE') return isItemEligible(item);
                if (queueFilter === 'MISSING_CONTACTS') return !item.hasContacts;
                if (queueFilter === 'SENT_TODAY') return item.alreadySentToday?.whatsapp || item.alreadySentToday?.sms || item.alreadySentToday?.email;
                return true;
              });

              const allInViewSelected = displayedQueueItems.length > 0 && displayedQueueItems.every(i => selectedQueueIds.has(i.customerId));
              const selectedEligibleCount = Array.from(selectedQueueIds).filter(id => {
                const item = queuedItems.find(q => q.customerId === id);
                return item && isItemEligible(item);
              }).length;
              const selectedMissingCount = Array.from(selectedQueueIds).filter(id => {
                const item = queuedItems.find(q => q.customerId === id);
                return item && !item.hasContacts;
              }).length;

              return (
                <>
                  <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
                    <div className="flex items-center gap-4 text-slate-600">
                      <span>
                        <strong className="text-slate-900">{queuedItems.length}</strong> Accounts
                      </span>
                      <span>•</span>
                      <span>
                        Total Due:{' '}
                        <strong className="text-rose-600 font-bold">
                          ₹{queuedItems.reduce((sum, item) => sum + item.totalDue, 0).toLocaleString('en-IN')}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Selected for Dispatch:{' '}
                        <strong className="text-purple-700 font-bold">{selectedQueueIds.size}</strong>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectEligibleOnly}
                        className="px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 font-bold text-purple-700 hover:bg-purple-100 transition shadow-xs flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Select Ready to Send ({eligibleItems.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleSelectAllInView(displayedQueueItems)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 transition shadow-xs"
                      >
                        {allInViewSelected ? 'Deselect View' : 'Select All in View'}
                      </button>
                      {selectedQueueIds.size > 0 && (
                        <button
                          type="button"
                          onClick={handleDeselectAll}
                          className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 transition font-medium"
                        >
                          Clear Selection
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={fetchApprovalQueue}
                        disabled={loadingQueue}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                        title="Refresh Queue"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingQueue ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Filter Tabs Bar */}
                  <div className="px-6 py-2 border-b border-slate-100 flex items-center gap-2 bg-white text-xs shrink-0 overflow-x-auto">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">Filter View:</span>
                    <button
                      type="button"
                      onClick={() => setQueueFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        queueFilter === 'ALL'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      All Accounts ({queuedItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setQueueFilter('ELIGIBLE')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                        queueFilter === 'ELIGIBLE'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-purple-700 hover:bg-purple-50'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      Ready to Send ({eligibleItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setQueueFilter('MISSING_CONTACTS')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                        queueFilter === 'MISSING_CONTACTS'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-amber-700 hover:bg-amber-50'
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      Missing Contacts ({missingContactsItems.length})
                    </button>
                    {sentTodayItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setQueueFilter('SENT_TODAY')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                          queueFilter === 'SENT_TODAY'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Sent Today ({sentTodayItems.length})
                      </button>
                    )}
                  </div>

                  {/* Queue Table */}
                  <div className="overflow-y-auto flex-1 p-6">
                    {loadingQueue ? (
                      <div className="py-16 text-center text-slate-400">Loading queued reminders...</div>
                    ) : displayedQueueItems.length === 0 ? (
                      <div className="py-16 text-center text-slate-500">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                        <p className="font-bold text-sm text-slate-800">No customer accounts in this view</p>
                        <p className="text-xs text-slate-400 mt-1">Try switching to &quot;All Accounts&quot; to review the complete queue.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {displayedQueueItems.map((item) => {
                          const isSelected = selectedQueueIds.has(item.customerId);
                          const isEligible = isItemEligible(item);
                          const sentChannels = [
                            item.alreadySentToday?.whatsapp && 'WhatsApp',
                            item.alreadySentToday?.sms && 'SMS',
                            item.alreadySentToday?.email && 'Email',
                          ].filter(Boolean);

                          return (
                            <div
                              key={item.customerId}
                              onClick={() => handleToggleQueueSelect(item.customerId)}
                              className={`p-4 rounded-2xl border transition cursor-pointer select-none ${
                                isSelected
                                  ? 'bg-purple-50/70 border-purple-300 shadow-sm ring-1 ring-purple-200'
                                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-start gap-3">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleQueueSelect(item.customerId);
                                    }}
                                    className={`mt-1 text-slate-400 transition hover:scale-110 ${
                                      isSelected ? 'text-purple-600' : 'hover:text-slate-600'
                                    }`}
                                    title={isSelected ? 'Deselect customer' : 'Select customer for dispatch'}
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="w-5 h-5 text-purple-600 fill-purple-50" />
                                    ) : (
                                      <Square className="w-5 h-5 text-slate-400" />
                                    )}
                                  </button>

                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h4 className="font-bold text-slate-900 text-sm">
                                        {item.partyName}
                                      </h4>
                                      {!item.hasContacts ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1 border border-amber-200">
                                          <AlertCircle className="w-3 h-3 text-amber-600" />
                                          Missing Contacts
                                        </span>
                                      ) : isEligible ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                          Ready to Send
                                        </span>
                                      ) : null}

                                      {!item.reminderEnabled && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                          Reminders Paused
                                        </span>
                                      )}

                                      {sentChannels.length > 0 && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-200">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                          Sent Today ({sentChannels.join(', ')})
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-mono mt-1">
                                      <span>Ledger: {item.ledgerCode}</span>
                                      <span>•</span>
                                      <span>Contact: <strong className="text-slate-700 font-sans">{item.contactPerson}</strong></span>
                                      {item.mobileNumber && (
                                        <>
                                          <span>•</span>
                                          <span className="flex items-center gap-1">
                                            <Phone className="w-3 h-3 text-slate-400" /> {item.mobileNumber}
                                          </span>
                                        </>
                                      )}
                                      {item.emailId && (
                                        <>
                                          <span>•</span>
                                          <span className="flex items-center gap-1">
                                            <Mail className="w-3 h-3 text-slate-400" /> {item.emailId}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 sm:text-right shrink-0">
                                  <div>
                                    <div className="font-extrabold text-slate-900 text-base">
                                      ₹{item.totalDue.toLocaleString('en-IN')}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {item.invoicesCount} open bill(s)
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setInspectMessage(item);
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-sm transition"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Preview Digest</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-5 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowApprovalQueue(false)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                      >
                        Close
                      </button>
                      {selectedQueueIds.size > 0 && (
                        <span className="text-xs text-slate-600">
                          <strong className="text-purple-700">{selectedQueueIds.size}</strong> account(s) approved.
                          {selectedMissingCount > 0 && (
                            <span className="text-amber-700 font-semibold ml-1">
                              ({selectedMissingCount} with missing contacts will be skipped)
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleDispatchApprovedQueue}
                      disabled={dispatchingQueue || selectedQueueIds.size === 0}
                      className="px-6 py-2.5 rounded-xl text-xs font-extrabold bg-purple-600 hover:bg-purple-700 text-white shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {dispatchingQueue ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Dispatching Digests...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Approve & Dispatch Selected ({selectedQueueIds.size})</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Inspect Message Modal */}
      {inspectMessage && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">
                  Digest Copy Preview: {inspectMessage.partyName}
                </h4>
                <p className="text-[11px] text-slate-500 font-mono">
                  Target: {inspectMessage.mobileNumber || inspectMessage.emailId}
                </p>
              </div>
              <button
                onClick={() => setInspectMessage(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Compiled WhatsApp & SMS Copy
              </label>
              <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                {inspectMessage.previewMessage}
              </pre>

              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>Language: <strong>{inspectMessage.language}</strong></span>
                <span>Includes <strong>{inspectMessage.invoicesCount}</strong> open invoice(s)</span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setInspectMessage(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
