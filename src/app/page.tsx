'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  CheckCheck,
  Receipt,
  Users,
  Filter
} from 'lucide-react';
import { selectBestTemplate, populateInvoiceTemplate } from '@/lib/template-renderer';

export default function DashboardPage() {
  const [tenant, setTenant] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [latestBatch, setLatestBatch] = useState<any>(null);
  const [recentBatches, setRecentBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAutoCheck, setRunningAutoCheck] = useState(false);
  const [autoCheckMsg, setAutoCheckMsg] = useState<string | null>(null);
  const [autoSchedule, setAutoSchedule] = useState<{ enabled: boolean; time: string; timeZone: string; lastRun: any } | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [sendingBatch, setSendingBatch] = useState(false);
  const [sendingRemind, setSendingRemind] = useState(false);

  // Table Filters & Search
  const [filter, setFilter] = useState<string>('CUSTOMER_DUES');
  const [search, setSearch] = useState<string>('');
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());

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

  // Partial Settlement Modal State
  const [partialModal, setPartialModal] = useState<{
    isOpen: boolean;
    invoice: any | null;
    amount: string;
  }>({
    isOpen: false,
    invoice: null,
    amount: '',
  });

  // Dedicated Import Modal State (with distinct tabs for SAP Dues, Contacts, and Both)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTab, setUploadTab] = useState<'SAP_DUES' | 'CUSTOMER_CONTACTS' | 'BOTH'>('SAP_DUES');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDashboardData = async (batchId?: string, activeFilter: string = filter, activeSearch: string = search) => {
    try {
      setLoading(true);
      const bId = batchId !== undefined ? batchId : selectedBatchId;
      const params = new URLSearchParams();
      if (bId) params.set('batchId', bId);
      if (activeFilter) params.set('filter', activeFilter);
      if (activeSearch && activeSearch.trim().length > 0) params.set('search', activeSearch.trim());

      const url = `/api/dues?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setTenant(data.tenant);
        setStats(data.stats);
        setLatestBatch(data.latestBatch);
        setRecentBatches(data.recentBatches || []);
        setAllInvoices(data.invoices || data.dues || []);
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

  useEffect(() => {
    fetchDashboardData(selectedBatchId || undefined, filter, search);
  }, [filter, search]);

  useEffect(() => {
    fetch('/api/reminders/auto-schedule')
      .then((r) => r.json())
      .then((d) => { if (d.success) setAutoSchedule(d); })
      .catch(() => {});
  }, [autoCheckMsg]);

  // Approval Queue logic
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
        // Pre-select only customers who have registered contacts and unsent channels
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
    const item = queuedItems.find(q => q.customerId === id);
    if (!item?.hasContacts) {
      alert('Cannot select customer without contact details. Please add contact info in Customer Contacts first.');
      return;
    }
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
    itemsInView.filter(i => i.hasContacts).forEach(item => next.add(item.customerId));
    setSelectedQueueIds(next);
  };

  const handleDeselectAllInView = (itemsInView: any[]) => {
    const next = new Set(selectedQueueIds);
    itemsInView.forEach(item => next.delete(item.customerId));
    setSelectedQueueIds(next);
  };

  const handleToggleSelectAllInView = (itemsInView: any[]) => {
    const eligibleInView = itemsInView.filter(i => i.hasContacts);
    const allSelected = eligibleInView.length > 0 && eligibleInView.every(item => selectedQueueIds.has(item.customerId));
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
      const res = await fetch('/api/reminders/auto-check?force=true', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setAutoCheckMsg(data.message);
        fetchDashboardData();
      } else {
        setAutoCheckMsg('Auto-dispatch failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e: any) {
      setAutoCheckMsg('Error running check: ' + e?.message);
    } finally {
      setRunningAutoCheck(false);
    }
  };

  // Upload Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
      setUploadMsg(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
      setUploadMsg(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setUploadMsg('Please select a file to import.');
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
        fetchDashboardData();
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

  // Manual Remind Logic
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
    if (!inv) return;
    const party = (inv.customer?.partyName || inv.customer?.rawLedgerName || '').toLowerCase();
    const narration = (inv.narration || '').toLowerCase();
    const billNo = (inv.billNo || '').toUpperCase();

    const isInternal =
      inv.customer?.status === 'INTERNAL_MUTED' ||
      inv.customer?.status === 'EXCLUDED' ||
      inv.status === 'Internal / Muted' ||
      party.includes('tds') ||
      party.includes('electricity') ||
      party.includes('mseb') ||
      party.includes('msedcl') ||
      party.includes('sales return') ||
      party.includes('purchase return') ||
      narration.includes('phonepe') ||
      narration.includes('paid by abhiyadna');

    const isAdvance =
      /^AD\d/.test(billNo) ||
      /^CN[\s\d\-\/]/.test(billNo) ||
      narration.includes('advance') ||
      party.includes('advance');

    const isCreditNote = inv.outstandingAmount <= 0 || inv.billAmount <= 0 || inv.status === 'Credit Note';

    if (isInternal || isAdvance || isCreditNote || inv.actionType === 'No Action' || inv.isExcluded) {
      alert('Messaging disabled: Credit Notes, advance payments, negative balances, and internal/TDS bills cannot receive payment reminders.');
      return;
    }

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

    const primaryContact = selectedInvoice.customer?.contacts?.find((c: any) => c.isPrimary) || selectedInvoice.customer?.contacts?.[0];
    const hasPhone = Boolean(primaryContact?.mobileNumber || primaryContact?.whatsappNumber);
    const hasEmail = Boolean(primaryContact?.emailId);

    if (!primaryContact || (!hasPhone && !hasEmail)) {
      alert('Cannot send reminder: Customer has no registered contact information. Please add mobile number or email in Customer Contacts first.');
      return;
    }

    if (remindChannel === 'EMAIL' && !hasEmail) {
      alert('Cannot send Email reminder: No email address found for this customer contact.');
      return;
    }

    if ((remindChannel === 'WHATSAPP' || remindChannel === 'SMS') && !hasPhone) {
      alert(`Cannot send ${remindChannel} reminder: No mobile or WhatsApp number found for this customer contact.`);
      return;
    }

    const isWaOrSms = remindChannel === 'WHATSAPP' || remindChannel === 'SMS';
    // Open a blank tab synchronously during user click to prevent browser popup blockers from blocking WhatsApp Web
    const popup = isWaOrSms ? window.open('', '_blank') : null;

    try {
      setSendingRemind(true);
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
      if (data.success) {
        if (popup) {
          if (data.results?.[0]?.actionUrl && data.results[0].actionUrl !== '#') {
            popup.location.href = data.results[0].actionUrl;
          } else {
            popup.close();
          }
        }
        setShowRemindModal(false);
        setActionMessage(
          remindChannel === 'EMAIL'
            ? `📧 Live email payment reminder dispatched directly to jayesh@zuigo.ai!`
            : `📱 WhatsApp payment reminder opened for +91 8530383141!`
        );
        fetchDashboardData();
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        if (popup) popup.close();
        alert('Failed to send reminder: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      if (popup) popup.close();
      alert('Error sending reminder: ' + err?.message);
    } finally {
      setSendingRemind(false);
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
        setActionMessage('Marked invoice as Payment Received.');
        fetchDashboardData();
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (e: any) {
      alert('Error updating invoice: ' + e?.message);
    }
  };

  const handleConfirmPartialSettled = async () => {
    if (!partialModal.invoice || !partialModal.amount) return;
    const settledAmt = Number(partialModal.amount);
    if (isNaN(settledAmt) || settledAmt <= 0) {
      alert('Please enter a valid amount greater than ₹0');
      return;
    }

    try {
      const res = await fetch('/api/invoices/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: partialModal.invoice.id,
          status: 'Partially Settled',
          settledAmount: settledAmt,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Recorded partial payment of ₹${settledAmt.toLocaleString('en-IN')}`);
        setPartialModal({ isOpen: false, invoice: null, amount: '' });
        fetchDashboardData();
        setTimeout(() => setActionMessage(null), 3500);
      } else {
        alert(data.error || 'Failed to record partial settlement');
      }
    } catch (err: any) {
      alert('Error: ' + err?.message);
    }
  };

  // Batch Table Selection Logic
  const handleToggleInvoiceSelect = (id: string) => {
    const next = new Set(selectedInvoiceIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedInvoiceIds(next);
  };

  const handleSelectAllVisible = () => {
    if (selectedInvoiceIds.size === allInvoices.length && allInvoices.length > 0) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(allInvoices.map((inv: any) => inv.id)));
    }
  };

  const handleBatchMarkPaid = async () => {
    if (selectedInvoiceIds.size === 0) return;
    if (!confirm(`Mark ${selectedInvoiceIds.size} selected invoice(s) as Payment Received?`)) return;

    try {
      setLoading(true);
      for (const id of Array.from(selectedInvoiceIds)) {
        await fetch('/api/invoices/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceId: id,
            status: 'Payment Received',
            notes: 'Batch marked as Payment Received from Dashboard',
          }),
        });
      }
      setSelectedInvoiceIds(new Set());
      setActionMessage(`Successfully marked ${selectedInvoiceIds.size} invoice(s) as paid.`);
      fetchDashboardData();
      setTimeout(() => setActionMessage(null), 3500);
    } catch (e: any) {
      alert('Error updating invoices: ' + e?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchSendSelectedReminders = async () => {
    if (selectedInvoiceIds.size === 0) return;

    const selectedList = allInvoices.filter((inv: any) => selectedInvoiceIds.has(inv.id));

    // Filter out credit notes and internal accounts
    const actionableList = selectedList.filter((inv: any) => {
      const isInternal =
        inv.customer?.status === 'INTERNAL_MUTED' ||
        inv.customer?.status === 'EXCLUDED' ||
        inv.status === 'Internal / Muted' ||
        inv.actionType === 'No Action' ||
        inv.isExcluded;
      const isCreditNote = inv.outstandingAmount <= 0 || inv.billAmount <= 0 || inv.status === 'Credit Note';
      return !isInternal && !isCreditNote;
    });

    if (actionableList.length === 0) {
      alert('Messaging disabled: All selected items are Credit Notes, advance balances, or internal/TDS bills.');
      return;
    }

    // Check for customers without contacts
    const withoutContacts = actionableList.filter((inv: any) => {
      const c = inv.customer?.contacts?.find((x: any) => x.isPrimary) || inv.customer?.contacts?.[0];
      return !c || (!c.mobileNumber && !c.whatsappNumber && !c.emailId);
    });

    const validCustomerIds = Array.from(
      new Set(
        actionableList
          .filter((inv: any) => {
            const c = inv.customer?.contacts?.find((x: any) => x.isPrimary) || inv.customer?.contacts?.[0];
            return Boolean(c && (c.mobileNumber || c.whatsappNumber || c.emailId));
          })
          .map((inv: any) => inv.customerId)
      )
    );

    if (validCustomerIds.length === 0) {
      alert('None of the selected customer accounts have registered contact phone or email numbers. Please add contact info in Customer Contacts first.');
      return;
    }

    if (withoutContacts.length > 0) {
      alert(`Notice: ${withoutContacts.length} selected invoice(s) belong to customers with NO registered contacts and will be skipped. Reminders will only be sent for customers with valid contacts.`);
    }

    try {
      setSendingBatch(true);
      const res = await fetch('/api/reminders/approval-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvedCustomerIds: validCustomerIds,
          specificInvoiceIds: Array.from(selectedInvoiceIds),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSelectedInvoiceIds(new Set());
        setActionMessage(
          `🚀 Successfully sent payment reminder digest(s) to ${data.summary?.customersProcessed || validCustomerIds.length} customer account(s) (${data.summary?.messagesSent || 0} message(s) dispatched)!`
        );
        fetchDashboardData();
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        alert(data.error || 'Failed to dispatch reminders');
      }
    } catch (err: any) {
      alert('Error sending reminders: ' + err?.message);
    } finally {
      setSendingBatch(false);
    }
  };

  // Selected Invoices stats
  const selectedStats = useMemo(() => {
    const list = allInvoices.filter((inv: any) => selectedInvoiceIds.has(inv.id));
    const totalDue = list.reduce((sum, inv) => sum + (inv.outstandingAmount > 0 ? inv.outstandingAmount : 0), 0);
    const uniqueCustomers = new Set(list.map((inv: any) => inv.customerId)).size;
    return { count: list.length, totalDue, uniqueCustomers };
  }, [allInvoices, selectedInvoiceIds]);

  return (
    <main className="px-[30px] pt-[27px] pb-10 max-w-[1600px] mx-auto w-full space-y-6">
      {/* Welcome header with action buttons */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#e8f9fa] text-[#078d96]">
              Multi-Tenant Active
            </span>
            <span className="text-xs text-[#9aa3aa]">•</span>
            <span className="text-xs font-semibold text-[#68737c]">
              {tenant?.companyName || 'Abhiyadna Machine Tools'}
            </span>
          </div>
          <h2 className="font-display text-[23px] font-semibold tracking-[-0.03em] text-[#3A3A3A] mb-1.5">
            Dashboard & Receivables Overview
          </h2>
          <p className="text-xs text-[#7a858d] max-w-xl">
            Real-time aging analysis, daily SAP diff reconciliation, multi-customer batch reminders, and Groq AI messaging.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchDashboardData()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-white border border-[#dfe6e9] text-[#59646c] text-[11px] font-semibold hover:bg-[#f7fcfc] hover:-translate-y-px transition disabled:opacity-50"
            title="Refresh and sync latest receivables & metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync Metrics
          </button>

          <button
            onClick={() => {
              setSelectedFiles([]);
              setUploadMsg(null);
              setShowUploadModal(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-white border border-[#dfe6e9] text-[#59646c] text-[11px] font-semibold hover:bg-[#f7fcfc] hover:-translate-y-px transition shadow-2xs"
            title="Import daily SAP dues or customer contact sheets"
          >
            <Upload className="w-3.5 h-3.5 text-[#09AEB8]" />
            Import SAP Dues / Contacts
          </button>

          <button
            onClick={handleOpenApprovalQueue}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#fff7dc] border border-[#ffe9a6] text-[#7a5d0c] text-[11px] font-semibold hover:brightness-95 hover:-translate-y-px transition shadow-2xs"
            title="Review and dispatch consolidated payment reminder digests"
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>Review Approval Queue</span>
            {queuedCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#FFD763] text-[#4e452a] font-bold">
                {queuedCount}
              </span>
            )}
          </button>

          <button
            onClick={handleRunAutoCheck}
            disabled={runningAutoCheck}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-[#09AEB8] text-white text-[11px] font-semibold shadow-[0_4px_10px_#09aeb82e] hover:brightness-95 hover:-translate-y-px transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningAutoCheck ? 'animate-spin' : ''}`} />
            {runningAutoCheck ? 'Dispatching...' : 'Quick Auto-Dispatch'}
          </button>
        </div>
      </div>

      {/* Scheduled auto-dispatch status */}
      {autoSchedule && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#68737c]">
          <span className={`status-pill ${autoSchedule.enabled ? 'status-paid' : 'status-hold'}`}>
            Auto-dispatch {autoSchedule.enabled ? 'ON' : 'OFF'}
          </span>
          <span>
            {autoSchedule.enabled
              ? `Runs automatically every day at ${autoSchedule.time} (${autoSchedule.timeZone}).`
              : 'Turn on "Automated reminders" in Settings & Gateways to send daily without clicking.'}
          </span>
          {autoSchedule.lastRun && (
            <span className="text-[#9aa3aa]">
              Last run: {new Date(autoSchedule.lastRun.at).toLocaleString('en-IN')} · {autoSchedule.lastRun.messagesSent} sent
            </span>
          )}
        </div>
      )}

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-emerald-700 font-bold text-xs hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Auto-Check Notification Banner */}
      {autoCheckMsg && (
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-medium flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{autoCheckMsg}</span>
          </div>
          <button onClick={() => setAutoCheckMsg(null)} className="text-xs font-bold text-indigo-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Financial Overview Cards */}
      {(() => {
        const pct = (n: number, d: number) => (d > 0 ? Math.min(100, Math.round((n / d) * 100)) : 0);
        const cards = [
          {
            label: 'Total Bill Amount',
            value: `₹${stats ? stats.totalReceivables.toLocaleString('en-IN') : '0'}`,
            note: `Matches Excel Ledger 1:1 (${stats?.totalCount || 0} bills in SAP export)`,
            foot: `${stats?.tradeInvoiceCount || 0} customer bills`,
            percent: 100,
            icon: <TrendingUp className="w-4 h-4" />,
            chip: 'kpi-chip-teal',
          },
          {
            label: 'Total Outstanding',
            value: `₹${stats ? stats.totalOutstandingAmount.toLocaleString('en-IN') : '0'}`,
            note: `Matches Excel Ledger 1:1 (Customer Trade Dues: ₹${stats ? stats.tradeOutstanding.toLocaleString('en-IN') : '0'})`,
            foot: 'of total billed',
            percent: pct(stats?.totalOutstandingAmount || 0, stats?.totalReceivables || 0),
            icon: <CreditCard className="w-4 h-4" />,
            chip: 'kpi-chip-blue',
          },
          {
            label: 'Paid / Adjusted',
            value: `₹${stats ? stats.totalPaidAmount.toLocaleString('en-IN') : '0'}`,
            note: 'Matches Excel Ledger 1:1 (Total collected / adjusted)',
            foot: 'collected / adjusted',
            percent: pct(stats?.totalPaidAmount || 0, stats?.totalReceivables || 0),
            icon: <CheckCircle2 className="w-4 h-4" />,
            chip: 'kpi-chip-teal',
          },
          {
            label: 'Actionable Overdue',
            value: `₹${stats ? stats.totalOverdueAmount.toLocaleString('en-IN') : '0'}`,
            note: `${stats ? stats.overdueCount : 0} customer bills past due date (Eligible for reminders)`,
            foot: 'of total outstanding overdue',
            percent: pct(stats?.totalOverdueAmount || 0, stats?.totalOutstandingAmount || 0),
            icon: <AlertCircle className="w-4 h-4" />,
            chip: 'kpi-chip-red',
            valueClass: 'text-[#ce514c]',
          },
        ];
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c) => (
              <div key={c.label} className="bg-white p-[18px] rounded-[13px] border border-[#e7ecef] shadow-2xs">
                <div className="flex items-center justify-between text-[#7d8990] text-[11px] font-medium">
                  <span>{c.label}</span>
                  <span className={`kpi-chip ${c.chip}`}>{c.icon}</span>
                </div>
                <div className={`font-display text-2xl font-semibold tracking-[-0.03em] mt-3.5 mb-1.5 ${c.valueClass || 'text-[#3A3A3A]'}`}>
                  {c.value}
                </div>
                <p className="text-[10px] text-[#7f8a91]">{c.note}</p>
                <div className="h-1 bg-[#eef2f3] rounded mt-3 overflow-hidden">
                  <span className="block h-full bg-[#09AEB8] rounded" style={{ width: `${c.percent}%` }} />
                </div>
                <div className="flex items-center justify-between mt-2.5 text-[10px] text-[#9aa3aa]">
                  <span>{c.foot}</span>
                  <span>{c.percent}%</span>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* SAP LEDGER RECONCILIATION BREAKDOWN BAR */}
      {stats && (
        <div className="bg-[#f8fbfc] border border-[#dce8ec] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <FileSpreadsheet className="w-4 h-4 text-[#09AEB8]" />
            <span>SAP Ledger Grand Total Reconciliation:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <span className="text-slate-700">
              Customer Trade Dues: <strong className="text-slate-900">₹{stats.tradeOutstanding.toLocaleString('en-IN')}</strong>
            </span>
            <span className="text-slate-400 font-bold">•</span>
            <span className="text-amber-800">
              Advance Paid Amount: <strong>₹{stats.creditNotesAmount.toLocaleString('en-IN')}</strong>
            </span>
            <span className="text-slate-400 font-bold">•</span>
            <span className="text-purple-800">
              TDS & Internal Bills: <strong>+₹{stats.internalMutedAmount.toLocaleString('en-IN')}</strong>
            </span>
            <span className="text-slate-400 font-bold">=</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 font-bold">
              Net Excel Total: ₹{stats.totalOutstandingAmount.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      )}

      {/* UNIFIED DUES & INVOICES LEDGER TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-display font-semibold text-base text-[#3A3A3A] flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#09AEB8]" />
              Invoices & Receivables Ledger
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Full searchable ledger with all categories, multi-customer selection, Promise-to-Pay commitments, and one-click reminders.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleOpenApprovalQueue()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold hover:bg-purple-100 transition"
            >
              <ListChecks className="w-3.5 h-3.5" />
              Batch Dispatch Queue ({queuedCount})
            </button>
          </div>
        </div>

        {/* Filter Tabs and Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-semibold overflow-x-auto shadow-2xs">
            {[
              { id: 'CUSTOMER_DUES', label: 'Customer Dues', count: stats?.tradeInvoiceCount },
              { id: 'OVERDUE', label: 'Overdue', count: stats?.overdueCount },
              { id: 'UPCOMING', label: 'Upcoming', count: stats?.upcomingCount },
              { id: 'PARTIALLY_SETTLED', label: 'Partially Paid', count: stats?.partiallySettledCount },
              { id: 'SETTLED', label: 'Settled', count: stats?.settledCount },
              { id: 'CREDIT_NOTES', label: 'Advance Paid & Credits', count: stats?.creditNotesCount },
              { id: 'INTERNAL', label: 'TDS & Internal Bills', count: stats?.internalCount },
              { id: 'ALL_LEDGER', label: 'All Raw Ledger (Full Audit)', count: stats?.totalCount },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
                  filter === tab.id
                    ? 'bg-[#09AEB8] text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      filter === tab.id
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, bill no, or contact..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#09AEB8] shadow-2xs"
            />
          </div>
        </div>

        {/* Batch Selection Banner */}
        {selectedInvoiceIds.size > 0 && (
          <div className="bg-[#e8f9fa] border border-[#b8ecef] p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-[#078d96]">
                {selectedStats.count} invoice{selectedStats.count > 1 ? 's' : ''} selected
              </span>
              <span className="text-slate-600">
                across {selectedStats.uniqueCustomers} customer account(s) • Total Due:{' '}
                <strong className="text-rose-600">₹{selectedStats.totalDue.toLocaleString('en-IN')}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchSendSelectedReminders}
                disabled={sendingBatch}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#09AEB8] text-white text-xs font-bold hover:brightness-95 transition shadow-2xs disabled:opacity-50"
              >
                <Send className={`w-3.5 h-3.5 ${sendingBatch ? 'animate-pulse' : ''}`} />
                {sendingBatch ? 'Sending Reminders...' : 'Send Reminders to Selected Customers'}
              </button>

              <button
                onClick={handleBatchMarkPaid}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition shadow-2xs"
              >
                <Check className="w-3.5 h-3.5" />
                Mark Paid
              </button>

              <button
                onClick={() => setSelectedInvoiceIds(new Set())}
                className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white text-xs font-semibold"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Ledger Table */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-slate-600 text-[11px] uppercase font-bold border-b border-slate-200 tracking-wider">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allInvoices.length > 0 && selectedInvoiceIds.size === allInvoices.length}
                    onChange={handleSelectAllVisible}
                    title="Select / Deselect all in view"
                    className="w-4 h-4 rounded text-[#09AEB8] focus:ring-[#09AEB8] border-slate-300 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Customer & Contacts</th>
                <th className="py-3 px-4">Bill No & Date</th>
                <th className="py-3 px-4">Bill Amount</th>
                <th className="py-3 px-4">Paid / Adjusted</th>
                <th className="py-3 px-4 text-rose-600">Outstanding Due</th>
                <th className="py-3 px-4">Due Date & Commitment</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">Loading ledger invoices...</td>
                </tr>
              ) : allInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300" />
                      <p className="text-sm font-bold text-slate-700">No Records Found</p>
                      <p className="text-xs text-slate-500">
                        {filter === 'ALL' && !search
                          ? 'Upload your SAP Outstanding Receivable export or Customer Contact sheet to get started.'
                          : 'No invoices match the selected filter or search keyword.'}
                      </p>
                      <button
                        onClick={() => {
                          setSelectedFiles([]);
                          setUploadMsg(null);
                          setShowUploadModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#09AEB8] text-white text-xs font-bold shadow-2xs hover:brightness-95 transition mt-2"
                      >
                        <Upload className="w-4 h-4" /> Import Excel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                allInvoices.map((inv: any) => {
                  const primaryContact = inv.customer?.contacts?.find((c: any) => c.isPrimary) || inv.customer?.contacts?.[0];
                  const hasContactInfo = Boolean(primaryContact && (primaryContact.mobileNumber || primaryContact.whatsappNumber || primaryContact.emailId));
                  const commitment = inv.commitments && inv.commitments.length > 0 ? inv.commitments[0] : null;

                  const isTds =
                    inv.itemType === 'TDS_VOUCHER' ||
                    /tds\b/i.test(inv.customer?.partyName || '') ||
                    /tds\b/i.test(inv.customer?.rawLedgerName || '') ||
                    /tds\b/i.test(inv.narration || '');

                  const isInternalUtil =
                    inv.itemType === 'INTERNAL_UTILITY' ||
                    /electricity/i.test(inv.customer?.partyName || '') ||
                    /paid electricity/i.test(inv.narration || '') ||
                    /phonepe/i.test(inv.narration || '');

                  const isAdvance =
                    inv.itemType === 'ADVANCE_PAYMENT' ||
                    inv.outstandingAmount < 0 ||
                    inv.billAmount < 0 ||
                    inv.status === 'Credit Note' ||
                    (/^AD\d/.test(inv.billNo) && !isTds && !isInternalUtil);

                  const isBill = !isTds && !isInternalUtil && !isAdvance;
                  const isSelected = selectedInvoiceIds.has(inv.id);

                  return (
                    <tr key={inv.id} className={`hover:bg-slate-50/70 transition ${isSelected ? 'bg-cyan-50/30' : ''}`}>
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        {!isBill ? (
                          <span className="text-slate-300 text-xs font-mono select-none">—</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleInvoiceSelect(inv.id)}
                            className="w-4 h-4 rounded text-[#09AEB8] focus:ring-[#09AEB8] border-slate-300 cursor-pointer"
                          />
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4 font-medium text-[#3A3A3A]">
                        <div className="flex items-center gap-2.5">
                          <div className="initials-chip shrink-0">
                            {(inv.customer?.partyName || inv.customer?.rawLedgerName || '?')
                              .split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs text-slate-900">{inv.customer?.partyName || inv.customer?.rawLedgerName}</span>
                              {inv.customer?.isFlagged && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700">
                                  <ShieldAlert className="w-2.5 h-2.5" /> Flagged
                                </span>
                              )}
                              {isAdvance && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                  Advance Paid
                                </span>
                              )}
                              {isTds && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800">
                                  Tax Withholding
                                </span>
                              )}
                              {isInternalUtil && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700">
                                  Company Utility
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {hasContactInfo ? (
                                <span>
                                  {primaryContact?.personName || 'Accounts'} • {primaryContact?.mobileNumber || primaryContact?.whatsappNumber || primaryContact?.emailId}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-600" /> No direct contact
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Bill No & Date */}
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="font-semibold text-xs font-mono">{inv.billNo}</div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(inv.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </td>

                      {/* Bill Amount */}
                      <td className="py-3.5 px-4 text-slate-700 font-medium text-xs">
                        {isAdvance ? (
                          <span className="text-slate-400 font-normal">—</span>
                        ) : (
                          `₹${inv.billAmount.toLocaleString('en-IN')}`
                        )}
                      </td>

                      {/* Paid / Adjusted */}
                      <td className="py-3.5 px-4 text-emerald-700 font-medium">
                        {(() => {
                          if (isAdvance) {
                            const advVal = Math.abs(inv.outstandingAmount || inv.billAmount || 0);
                            return (
                              <>
                                <div className="font-semibold text-xs text-emerald-700">₹{advVal.toLocaleString('en-IN')}</div>
                                <span className="text-[9px] text-teal-700 font-bold block">Advance Paid Amount</span>
                              </>
                            );
                          }

                          if (isTds) {
                            return (
                              <>
                                <div className="font-semibold text-xs text-purple-700">₹{inv.billAmount.toLocaleString('en-IN')}</div>
                                <span className="text-[9px] text-purple-600 font-bold block">Tax Deducted (TDS)</span>
                              </>
                            );
                          }

                          if (isInternalUtil) {
                            return (
                              <>
                                <div className="font-semibold text-xs text-blue-700">₹{inv.billAmount.toLocaleString('en-IN')}</div>
                                <span className="text-[9px] text-blue-600 font-bold block">Paid via PhonePe</span>
                              </>
                            );
                          }

                          const isFullySettled =
                            inv.status === 'Closed' ||
                            inv.status === 'Settled' ||
                            inv.status === 'Payment Received' ||
                            (inv.outstandingAmount <= 0 && inv.billAmount > 0);
                          const paidVal =
                            inv.paidAmount !== undefined
                              ? inv.paidAmount
                              : isFullySettled
                              ? inv.billAmount
                              : Math.max(inv.adjustment || 0, Math.round(((inv.billAmount || 0) - Math.max(0, inv.outstandingAmount || 0)) * 100) / 100);

                          if (paidVal > 0) {
                            return (
                              <>
                                <div className="font-semibold text-xs">₹{paidVal.toLocaleString('en-IN')}</div>
                                {isFullySettled ? (
                                  <span className="text-[9px] text-emerald-600 font-bold block">Fully Settled</span>
                                ) : (
                                  <span className="text-[9px] text-teal-600 font-semibold block">Partially Settled</span>
                                )}
                              </>
                            );
                          }
                          return <span className="text-slate-400 text-xs">₹0</span>;
                        })()}
                      </td>

                      {/* Outstanding Due */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {isAdvance ? (
                          <div>
                            <span className="text-slate-400 font-medium text-xs">₹0</span>
                            <span className="text-[9px] text-amber-700 font-bold block">
                              Credit (-₹{Math.abs(inv.outstandingAmount).toLocaleString('en-IN')})
                            </span>
                          </div>
                        ) : isTds ? (
                          <div>
                            <span className="text-slate-400 font-medium text-xs">₹0</span>
                            <span className="text-[9px] text-purple-600 font-medium block">TDS Voucher</span>
                          </div>
                        ) : isInternalUtil ? (
                          <div>
                            <span className="text-slate-400 font-medium text-xs">₹0</span>
                            <span className="text-[9px] text-slate-500 font-medium block">Company Utility</span>
                          </div>
                        ) : (
                          <span className={inv.outstandingAmount > 0 ? 'text-rose-600 font-black text-xs' : 'text-slate-600 font-medium text-xs'}>
                            ₹{inv.outstandingAmount.toLocaleString('en-IN')}
                          </span>
                        )}
                      </td>

                      {/* Due Date & Commitment */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-slate-800">
                          {new Date(inv.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-[10px] font-semibold text-rose-600 mt-0.5">
                          {inv.daysOverdue > 0 ? `${inv.daysOverdue} days overdue` : 'Due soon'}
                        </div>

                        {commitment && (
                          <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <CalendarClock className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                            <span>
                              Promised ₹{commitment.promisedAmount.toLocaleString('en-IN')} on{' '}
                              {new Date(commitment.promisedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isAdvance ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-block">
                            Advance Paid Amount
                          </span>
                        ) : isTds ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 inline-block">
                            TDS on Sales (Tax)
                          </span>
                        ) : isInternalUtil ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 inline-block">
                            Internal Utility (Paid)
                          </span>
                        ) : (
                          <span className={`status-pill ${
                            inv.status === 'Payment Received' || inv.status === 'Settled' || inv.status === 'Closed'
                              ? 'status-paid'
                              : inv.status === 'Partially Paid' || inv.status === 'Partially Settled'
                              ? 'status-upcoming'
                              : inv.daysOverdue > 0
                              ? 'status-overdue'
                              : 'status-progress'
                          }`}>
                            {inv.status}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isAdvance ? (
                          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 inline-block">
                            Advance Paid
                          </span>
                        ) : isTds ? (
                          <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-lg border border-purple-200 inline-block">
                            TDS Withheld
                          </span>
                        ) : isInternalUtil ? (
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 inline-block">
                            Company Utility
                          </span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleQuickMarkPaid(inv.id)}
                              title="Mark Payment Received"
                              className="px-2 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 transition"
                            >
                              Mark Paid
                            </button>

                            <button
                              onClick={() => {
                                setPartialModal({
                                  isOpen: true,
                                  invoice: inv,
                                  amount: String(Math.round(inv.outstandingAmount / 2)),
                                });
                              }}
                              title="Record Partial Payment"
                              className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-50 transition"
                            >
                              Partial
                            </button>

                            <button
                              onClick={() => handleOpenRemind(inv)}
                              className="px-2.5 py-1 rounded-lg bg-[#09AEB8] text-white text-[11px] font-bold hover:brightness-95 transition flex items-center gap-1 shadow-2xs"
                              title="Send WhatsApp, SMS or Email payment reminder"
                            >
                              <Send className="w-3 h-3" /> Remind
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Partial Settlement Modal */}
      {partialModal.isOpen && partialModal.invoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Record Partial Payment</h3>
              <button
                onClick={() => setPartialModal({ isOpen: false, invoice: null, amount: '' })}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <div className="flex justify-between">
                <span>Party:</span>
                <strong className="text-slate-900">{partialModal.invoice.customer?.partyName || partialModal.invoice.customer?.rawLedgerName}</strong>
              </div>
              <div className="flex justify-between">
                <span>Bill Number:</span>
                <strong className="font-mono text-slate-900">{partialModal.invoice.billNo}</strong>
              </div>
              <div className="flex justify-between">
                <span>Total Bill Amount:</span>
                <span className="font-bold">₹{partialModal.invoice.billAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span>Current Outstanding Due:</span>
                <span className="font-bold text-rose-600">₹{partialModal.invoice.outstandingAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Amount Received (₹)
              </label>
              <input
                type="number"
                value={partialModal.amount}
                onChange={(e) => setPartialModal({ ...partialModal, amount: e.target.value })}
                placeholder="Enter amount collected..."
                className="w-full text-sm p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#09AEB8] font-bold text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPartialModal({ isOpen: false, invoice: null, amount: '' })}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPartialSettled}
                className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-2xs"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Remind Modal with Strict Contact Check */}
      {showRemindModal && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-slate-900">Send Payment Reminder</h3>
                <p className="text-[11px] text-slate-500">
                  {selectedInvoice.customer?.partyName || selectedInvoice.customer?.rawLedgerName} • Bill {selectedInvoice.billNo}
                </p>
              </div>
              <button 
                onClick={() => setShowRemindModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Strict Contact Details Verification */}
            {(() => {
              const primaryContact = selectedInvoice.customer?.contacts?.find((c: any) => c.isPrimary) || selectedInvoice.customer?.contacts?.[0];
              const hasPhone = Boolean(primaryContact?.mobileNumber || primaryContact?.whatsappNumber);
              const hasEmail = Boolean(primaryContact?.emailId);
              const hasValidContact = Boolean(primaryContact && (hasPhone || hasEmail));
              const hasRecipientForChannel = remindChannel === 'EMAIL' ? hasEmail : hasPhone;

              return (
                <div className="space-y-3">
                  {!hasValidContact ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>No contact details found for this customer. Reminders cannot be sent without a registered mobile number or email.</span>
                      </div>
                      <Link href="/customers" className="underline text-rose-900 font-bold ml-2 shrink-0">
                        Add Contact →
                      </Link>
                    </div>
                  ) : !hasRecipientForChannel ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>No {remindChannel === 'EMAIL' ? 'email address' : 'mobile number'} found for {primaryContact?.personName || 'this contact'}.</span>
                      </div>
                      <Link href="/customers" className="underline text-amber-900 font-bold ml-2 shrink-0">
                        Update Contact →
                      </Link>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-500">Registered Contact:</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {primaryContact?.personName || 'Accounts'} ({remindChannel === 'EMAIL' ? primaryContact?.emailId : (primaryContact?.mobileNumber || primaryContact?.whatsappNumber)})
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-amber-700 font-medium">
                        <span>Safe Test Routing:</span>
                        <span>Redirected to {remindChannel === 'EMAIL' ? 'jayesh@zuigo.ai' : '+918530383141'}</span>
                      </div>
                    </div>
                  )}

                  {/* Channel Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Delivery Channel
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['WHATSAPP', 'SMS', 'EMAIL'] as const).map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => handleRemindChannelChange(ch)}
                          className={`p-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                            remindChannel === ch
                              ? ch === 'WHATSAPP'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-400'
                                : ch === 'SMS'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-400'
                                : 'bg-sky-50 text-sky-800 border-sky-400'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {ch === 'WHATSAPP' && <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />}
                          {ch === 'SMS' && <Phone className="w-3.5 h-3.5 text-indigo-600" />}
                          {ch === 'EMAIL' && <Mail className="w-3.5 h-3.5 text-sky-600" />}
                          <span>{ch === 'WHATSAPP' ? 'WhatsApp' : ch === 'SMS' ? 'SMS' : 'Email'}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Language
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['English', 'Hindi', 'Marathi'].map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => handleRemindLanguageChange(lang)}
                          className={`p-2 rounded-xl text-xs font-semibold border transition ${
                            remindLanguage === lang
                              ? 'bg-[#09AEB8] text-white border-[#09AEB8]'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {lang === 'Hindi' ? 'हिंदी (Hindi)' : lang === 'Marathi' ? 'मराठी (Marathi)' : 'English'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Template Selection */}
                  {templates.filter((t) => t.channel === remindChannel).length > 0 && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Message Template
                      </label>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => handleTemplateDropdownChange(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#09AEB8] font-medium"
                      >
                        <option value="">Auto-Select Best Matching Template</option>
                        {templates
                          .filter((t) => t.channel === remindChannel)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.category} - {t.language})
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

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
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#09AEB8] font-medium"
                      />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Reminder Message Content
                      </label>
                      <span className="text-[11px] text-slate-400 font-medium">Pre-populated & editable</span>
                    </div>
                    <textarea
                      value={customRemindMessage}
                      onChange={(e) => setCustomRemindMessage(e.target.value)}
                      placeholder="Type or edit reminder message..."
                      rows={6}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#09AEB8] font-sans leading-relaxed"
                    />
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
                      disabled={!hasRecipientForChannel || sendingRemind}
                      onClick={handleSendReminder}
                      className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-2xs transition flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                        remindChannel === 'WHATSAPP'
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : remindChannel === 'SMS'
                          ? 'bg-indigo-600 hover:bg-indigo-700'
                          : 'bg-sky-600 hover:bg-sky-700'
                      }`}
                    >
                      <Send className={`w-3.5 h-3.5 ${sendingRemind ? 'animate-pulse' : ''}`} />
                      {sendingRemind ? 'Sending Reminder...' : (
                        remindChannel === 'WHATSAPP'
                          ? 'Open WhatsApp & Send Reminder'
                          : remindChannel === 'SMS'
                          ? 'Send SMS Text Reminder'
                          : 'Send Email Reminder to jayesh@zuigo.ai'
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* DEDICATED EXCEL IMPORT MODAL (Separate options for SAP Dues vs Customer Contacts vs Both) */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-[#09AEB8]">
                <FileSpreadsheet className="w-6 h-6" />
                <h3 className="font-bold text-base text-slate-900">Import Excel Data</h3>
              </div>
              <button 
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Separate Option Selector Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setUploadTab('SAP_DUES');
                  setSelectedFiles([]);
                  setUploadMsg(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 ${
                  uploadTab === 'SAP_DUES'
                    ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>SAP Dues Excel</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUploadTab('CUSTOMER_CONTACTS');
                  setSelectedFiles([]);
                  setUploadMsg(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 ${
                  uploadTab === 'CUSTOMER_CONTACTS'
                    ? 'bg-white text-sky-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Customer Contacts</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUploadTab('BOTH');
                  setSelectedFiles([]);
                  setUploadMsg(null);
                }}
                className={`flex-1 py-1.5 px-3 rounded-lg transition flex items-center justify-center gap-1.5 ${
                  uploadTab === 'BOTH'
                    ? 'bg-white text-purple-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Dual Import</span>
              </button>
            </div>

            {/* Mode-specific guidance */}
            {uploadTab === 'SAP_DUES' && (
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-indigo-800">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" /> Daily SAP Outstanding Receivable Export
                </div>
                <p className="text-[11px] text-indigo-700">
                  Upload daily SAP sales dues export. Requires columns: <strong>Ledger Code</strong>, <strong>Doc. No.</strong>, <strong>Bill Amount</strong>, <strong>Balance/Outstanding</strong>, <strong>Due Date</strong>.
                </p>
              </div>
            )}

            {uploadTab === 'CUSTOMER_CONTACTS' && (
              <div className="bg-sky-50/70 border border-sky-100 rounded-xl p-3 text-xs text-sky-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-sky-800">
                  <Users className="w-4 h-4 text-sky-600" /> Customer Contacts Master Sheet
                </div>
                <p className="text-[11px] text-sky-700">
                  Upload master contacts mapping. Expected columns: <strong>Customer Name / Raw Ledger Name</strong> or <strong>Ledger Code</strong>, <strong>Contact Person</strong>, <strong>Mobile / WhatsApp</strong>, <strong>Email ID</strong>.
                </p>
              </div>
            )}

            {uploadTab === 'BOTH' && (
              <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-3 text-xs text-purple-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-purple-800">
                  <Layers className="w-4 h-4 text-purple-600" /> Simultaneous Multi-File Import
                </div>
                <p className="text-[11px] text-purple-700">
                  Drag or select both SAP Dues export and Customer Contacts Excel together. Contacts are mapped first, dues reconciled second.
                </p>
              </div>
            )}

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
                  multiple={uploadTab === 'BOTH'}
                  accept={uploadTab === 'CUSTOMER_CONTACTS' ? '.xlsx, .xls, .csv' : '.xlsx, .xls, .csv, .html'}
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
                    <p className="text-[10px] text-slate-400 mt-1">Click to select different file(s)</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-slate-700">
                      {uploadTab === 'SAP_DUES'
                        ? 'Click to select SAP Outstanding Receivable file'
                        : uploadTab === 'CUSTOMER_CONTACTS'
                        ? 'Click to select Customer Contacts file'
                        : 'Click to select or drop both Excel files'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Supports Excel (.xlsx, .xls) and CSV (and SAP ALV HTML for Dues)
                    </p>
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
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#09AEB8] text-white hover:brightness-95 disabled:opacity-50 shadow-2xs transition flex items-center gap-1.5"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Ingesting & Reconciling...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadTab === 'SAP_DUES'
                          ? 'Import SAP Dues'
                          : uploadTab === 'CUSTOMER_CONTACTS'
                          ? 'Import Customer Contacts'
                          : `Ingest ${selectedFiles.length} File(s)`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* APPROVAL QUEUE MODAL (Semi-Automated Dispatch Mode) */}
      {showApprovalQueue && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
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
                    Review consolidated digests before dispatching. Accounts with no contacts are strictly blocked from messaging.
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

              const allInViewSelected = displayedQueueItems.length > 0 && displayedQueueItems.filter(i => i.hasContacts).every(i => selectedQueueIds.has(i.customerId));
              const selectedEligibleCount = Array.from(selectedQueueIds).filter(id => {
                const item = queuedItems.find(q => q.customerId === id);
                return item && isItemEligible(item);
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
                        className="px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 font-bold text-purple-700 hover:bg-purple-100 transition shadow-2xs flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Select Ready to Send ({eligibleItems.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleSelectAllInView(displayedQueueItems)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
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
                    </div>
                  </div>

                  {/* Filter Subtabs */}
                  <div className="px-6 py-2 border-b border-slate-100 bg-white flex items-center gap-2 shrink-0 text-xs">
                    <span className="text-slate-400 font-medium">Show:</span>
                    {[
                      { id: 'ALL', label: `All (${queuedItems.length})` },
                      { id: 'ELIGIBLE', label: `Ready to Send (${eligibleItems.length})` },
                      { id: 'MISSING_CONTACTS', label: `Missing Contacts (${missingContactsItems.length})` },
                      { id: 'SENT_TODAY', label: `Already Sent Today (${sentTodayItems.length})` },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setQueueFilter(f.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                          queueFilter === f.id
                            ? 'bg-purple-600 text-white font-bold'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Queue Items List */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {loadingQueue ? (
                      <div className="py-16 text-center text-slate-400">Loading pending digests...</div>
                    ) : displayedQueueItems.length === 0 ? (
                      <div className="py-16 text-center text-slate-400">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <p className="font-bold text-slate-700">No customers pending in this view.</p>
                      </div>
                    ) : (
                      displayedQueueItems.map((item: any) => {
                        const isSelected = selectedQueueIds.has(item.customerId);
                        const isEligible = isItemEligible(item);
                        const sentChannels = [];
                        if (item.alreadySentToday?.whatsapp) sentChannels.push('WhatsApp');
                        if (item.alreadySentToday?.sms) sentChannels.push('SMS');
                        if (item.alreadySentToday?.email) sentChannels.push('Email');

                        return (
                          <div
                            key={item.customerId}
                            onClick={() => {
                              if (item.hasContacts) handleToggleQueueSelect(item.customerId);
                            }}
                            className={`p-4 rounded-xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                              !item.hasContacts
                                ? 'bg-amber-50/40 border-amber-200 opacity-80 cursor-not-allowed'
                                : isSelected
                                ? 'bg-purple-50/60 border-purple-300 shadow-2xs'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                disabled={!item.hasContacts}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleQueueSelect(item.customerId);
                                }}
                                className={`mt-1 text-slate-400 transition ${
                                  !item.hasContacts ? 'opacity-40 cursor-not-allowed' : isSelected ? 'text-purple-600' : 'hover:text-slate-600'
                                }`}
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
                                      Missing Contacts (Cannot Remind)
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
                                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs transition"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Preview</span>
                              </button>
                            </div>
                          </div>
                        );
                      })
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
                          <strong className="text-purple-700">{selectedQueueIds.size}</strong> account(s) selected for dispatch.
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleDispatchApprovedQueue}
                      disabled={dispatchingQueue || selectedQueueIds.size === 0}
                      className="px-6 py-2.5 rounded-xl text-xs font-extrabold bg-purple-600 hover:bg-purple-700 text-white shadow-2xs transition disabled:opacity-50 flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-y-auto max-h-[calc(100vh-2rem)] animate-in fade-in zoom-in-95 duration-150">
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
              <pre className="p-4 bg-[#3A3A3A] text-slate-100 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
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
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#3A3A3A] text-white hover:bg-[#4B4F58]"
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
