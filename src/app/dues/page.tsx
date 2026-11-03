'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Receipt, 
  Search, 
  Send, 
  Calendar, 
  ShieldAlert, 
  CheckCircle, 
  MessageSquare, 
  Mail, 
  Phone, 
  Upload, 
  FileSpreadsheet, 
  FileUp, 
  RefreshCw, 
  Clock, 
  Filter, 
  Bell, 
  BellOff,
  Zap,
  Sliders,
  Check,
  X
} from 'lucide-react';
import { selectBestTemplate, populateInvoiceTemplate } from '@/lib/template-renderer';

function ManualFrequencyInput({
  initialFreq,
  initialMsgsPerDay,
  onSave,
}: {
  initialFreq: number;
  initialMsgsPerDay: number;
  onSave: (freq: number, msgs: number) => void;
}) {
  const [freq, setFreq] = useState<string>(String(initialFreq));
  const [msgs, setMsgs] = useState<string>(String(initialMsgsPerDay));
  const [isChanged, setIsChanged] = useState<boolean>(false);

  useEffect(() => {
    setFreq(String(initialFreq));
    setMsgs(String(initialMsgsPerDay));
    setIsChanged(false);
  }, [initialFreq, initialMsgsPerDay]);

  const handleCommit = () => {
    const f = Math.max(1, parseInt(freq, 10) || 1);
    const m = Math.max(1, Math.min(20, parseInt(msgs, 10) || 1));
    setFreq(String(f));
    setMsgs(String(m));
    setIsChanged(false);
    onSave(f, m);
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-2xs hover:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-500">
        <span className="text-[10px] text-slate-400 mr-1 font-medium">Every</span>
        <input
          type="number"
          min="1"
          max="365"
          value={freq}
          onChange={(e) => {
            setFreq(e.target.value);
            setIsChanged(true);
          }}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCommit();
          }}
          title="Frequency in days (e.g., 1 for daily, 2 for every 2 days, 7 for weekly)"
          className="w-8 text-xs font-bold text-slate-800 text-center bg-transparent focus:outline-none"
        />
        <span className="text-[10px] text-slate-400 ml-1 font-medium">d</span>
      </div>

      <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-2xs hover:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-500">
        <input
          type="number"
          min="1"
          max="20"
          value={msgs}
          onChange={(e) => {
            setMsgs(e.target.value);
            setIsChanged(true);
          }}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCommit();
          }}
          title="Number of reminder messages per day"
          className="w-7 text-xs font-bold text-slate-800 text-center bg-transparent focus:outline-none"
        />
        <span className="text-[10px] text-slate-400 ml-1 font-medium">msg/d</span>
      </div>

      {isChanged && (
        <button
          type="button"
          onClick={handleCommit}
          title="Apply Frequency"
          className="p-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function DuesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<any>(null);

  // Modals
  const [activeModal, setActiveModal] = useState<'REMIND' | 'UPLOAD' | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // Partial Settlement Modal
  const [partialModal, setPartialModal] = useState<{
    isOpen: boolean;
    invoice: any | null;
    amount: string;
  }>({
    isOpen: false,
    invoice: null,
    amount: '',
  });

  // Reminder History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<any | null>(null);

  // Remind form states
  const [templates, setTemplates] = useState<any[]>([]);
  const [remindChannel, setRemindChannel] = useState<'WHATSAPP' | 'SMS' | 'EMAIL'>('WHATSAPP');
  const [remindLanguage, setRemindLanguage] = useState('English');
  const [remindSubject, setRemindSubject] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customRemindMessage, setCustomRemindMessage] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDues = async () => {
    try {
      setLoading(true);
      const url = `/api/dues?filter=${filter}&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setInvoices(data.invoices || data.dues || []);
        if (data.stats) {
          setStats(data.stats);
        }
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
      console.error('Fetch dues error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDues();
  }, [filter, search]);

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
        'Abhiyadna Machine Tools',
        'HDFC Bank, A/C: 50200012345678, IFSC: HDFC0001234'
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

    setActiveModal('REMIND');
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

  const handleUpdateFrequency = async (customerId: string, frequencyDays: number, messagesPerDay: number = 1) => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          frequencyDays,
          messagesPerDay,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const msgDesc = frequencyDays === 1 
          ? `${messagesPerDay} msg${messagesPerDay > 1 ? 's' : ''}/day (Daily)`
          : `Every ${frequencyDays} days (${messagesPerDay} msg${messagesPerDay > 1 ? 's' : ''}/day)`;
        setActionMessage(`Reminder frequency updated: ${msgDesc}`);
        fetchDues();
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (e: any) {
      alert('Error updating frequency: ' + e?.message);
    }
  };

  const handleToggleChannel = async (customerId: string, channelToToggle: string, currentChannelsStr?: string) => {
    const raw = currentChannelsStr || 'WHATSAPP,SMS,EMAIL';
    let channels = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

    if (channels.includes(channelToToggle)) {
      if (channels.length === 1) {
        alert('Customer must have at least one communication channel selected.');
        return;
      }
      channels = channels.filter((c) => c !== channelToToggle);
    } else {
      channels.push(channelToToggle);
    }

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          channels: channels.join(','),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Channels updated: ${channels.join(', ')}`);
        fetchDues();
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (e: any) {
      alert('Error updating channels: ' + e?.message);
    }
  };

  const handleToggleReminderEnabled = async (customerId: string, currentEnabled: boolean) => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          reminderEnabled: !currentEnabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(!currentEnabled ? 'Reminders resumed for customer' : 'Reminders stopped for customer');
        fetchDues();
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (e: any) {
      alert('Error updating reminder status: ' + e?.message);
    }
  };

  const handleUpdateReminderMode = async (customerId: string, mode: 'FULLY_AUTOMATED' | 'SEMI_AUTOMATED') => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          reminderMode: mode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(
          mode === 'FULLY_AUTOMATED'
            ? 'Set to Automatic: Reminders will dispatch automatically on schedule'
            : 'Set to Semi-Automatic: Reminders require manual review/queue approval'
        );
        fetchDues();
        setTimeout(() => setActionMessage(null), 3500);
      }
    } catch (e: any) {
      alert('Error updating reminder mode: ' + e?.message);
    }
  };

  const handleStatusChange = async (invoiceId: string, newStatus: string) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (newStatus === 'Partially Settled') {
      setPartialModal({
        isOpen: true,
        invoice: inv,
        amount: inv ? String(Math.round(inv.outstandingAmount / 2)) : '',
      });
      return;
    }

    try {
      const res = await fetch('/api/invoices/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          status: newStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Status updated to ${newStatus}`);
        fetchDues();
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err: any) {
      alert('Error updating status: ' + err?.message);
    }
  };

  const handleConfirmPartialSettled = async () => {
    if (!partialModal.invoice || !partialModal.amount) return;
    const settledAmt = Number(partialModal.amount);
    if (isNaN(settledAmt) || settledAmt <= 0) {
      alert('Please enter a valid amount greater than 0');
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
        setActionMessage(`Recorded settled amount ₹${settledAmt.toLocaleString('en-IN')}`);
        setPartialModal({ isOpen: false, invoice: null, amount: '' });
        fetchDues();
        setTimeout(() => setActionMessage(null), 3500);
      } else {
        alert(data.error || 'Failed to update settled amount');
      }
    } catch (err: any) {
      alert('Error: ' + err?.message);
    }
  };

  const submitManualReminder = async (e: React.FormEvent) => {
    e.preventDefault();
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
      if (data.success) {
        setActionMessage(data.message);
        if (data.results?.[0]?.actionUrl) {
          window.open(data.results[0].actionUrl, '_blank');
        }
        setActiveModal(null);
        fetchDues();
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err: any) {
      alert('Error dispatching reminder: ' + err?.message);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
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
        setUploadMsg(data.message || 'Import successful!');
        fetchDues(); // Refresh dues and stats immediately!
        setTimeout(() => {
          setActiveModal(null);
          setSelectedFile(null);
          setUploadMsg(null);
          fetchDues();
        }, 1800);
      } else {
        setUploadMsg(data.error || 'Upload error');
      }
    } catch (err: any) {
      setUploadMsg('Error: ' + err?.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-emerald-600" />
            Invoices & Dues Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Separated Bill Amount, Paid / Adjusted, and Outstanding Dues. Track multiple invoices, contacts, and Promise-to-Pay commitments.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedFile(null);
            setUploadMsg(null);
            setActiveModal('UPLOAD');
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 shadow-sm transition"
        >
          <Upload className="w-4 h-4 text-indigo-600" />
          Import SAP Dues / Contacts
        </button>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-emerald-700 font-bold">✕</button>
        </div>
      )}

      {/* Filter Tabs and Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 text-xs font-semibold overflow-x-auto shadow-sm">
          {[
            { id: 'ALL', label: 'All', count: stats?.totalCount },
            { id: 'UPCOMING', label: 'Upcoming', count: stats?.upcomingCount },
            { id: 'DUE_TODAY', label: 'Due Today', count: stats?.dueTodayCount },
            { id: 'OVERDUE', label: 'Overdue', count: stats?.overdueCount },
            { id: 'FLAGGED', label: 'Flagged', count: stats?.flaggedCount },
            { id: 'PENDING', label: 'Pending', count: stats?.pendingCount },
            { id: 'PARTIALLY_SETTLED', label: 'Partially Settled', count: stats?.partiallySettledCount },
            { id: 'SETTLED', label: 'Settled', count: stats?.settledCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap flex items-center gap-1.5 ${
                filter === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    filter === tab.id
                      ? 'bg-indigo-700/90 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search party, bill no, or contact..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-semibold border-b border-slate-200 tracking-wider">
              <tr>
                <th className="py-3 px-4">Customer & Contacts</th>
                <th className="py-3 px-4">Bill No & Date</th>
                <th className="py-3 px-4">Bill Amount (₹)</th>
                <th className="py-3 px-4">Paid / Adjusted (₹)</th>
                <th className="py-3 px-4 text-rose-600">Outstanding Due (₹)</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Payment Status</th>
                <th className="py-3 px-4">Frequency</th>
                <th className="py-3 px-4">Channels</th>
                <th className="py-3 px-4">Reminder History</th>
                <th className="py-3 px-4">Reminders Status</th>
                <th className="py-3 px-4">Dispatch Mode</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">Loading invoices...</td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300" />
                      <p className="text-sm font-bold text-slate-700">No Invoices Found</p>
                      <p className="text-xs text-slate-500">
                        {filter === 'ALL' && !search 
                          ? 'Upload your SAP Outstanding Receivable export or Contact sheet to populate real customer bills.'
                          : 'No records match the selected filter criteria.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((inv: any) => {
                  const contacts = inv.customer?.contacts || [];
                  const primaryContact = contacts.find((c: any) => c.isPrimary) || contacts[0];
                  const isAdvance =
                    Boolean(inv.billNo?.startsWith('AD')) ||
                    Boolean(inv.billNo?.includes('CN')) ||
                    Boolean(inv.narration && /adv/i.test(inv.narration));
                  const schedule = inv.customer?.reminderSchedules?.[0];
                  const currentFreq = schedule?.reminder3DaysAfter ?? 3;
                  const currentMsgsPerDay = schedule?.messagesPerDay ?? 1;
                  const currentChannelsStr = schedule?.channels || 'WHATSAPP,SMS,EMAIL';
                  const activeChannels = currentChannelsStr.split(',').map((s: string) => s.trim().toUpperCase());
                  const logs = inv.customer?.reminderLogs || [];
                  const isAuto = inv.customer?.reminderMode === 'FULLY_AUTOMATED' || !inv.customer?.reminderMode;
                  const isEnabled = inv.customer?.reminderEnabled !== false;
                  const isExcludedAccount = inv.actionType === 'No Action' || inv.isExcluded || inv.customer?.status === 'EXCLUDED';

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                      {/* Customer & Contacts */}
                      <td className="py-3.5 px-4 font-medium text-slate-900 max-w-xs">
                        <div>
                          <span className="font-bold">{inv.customer.partyName || inv.customer.rawLedgerName}</span>
                          {!isEnabled && (
                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              <BellOff className="w-3 h-3 text-slate-400" /> Reminders Stopped
                            </span>
                          )}
                          {inv.customer.isFlagged && (
                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                              <ShieldAlert className="w-3 h-3" /> Flagged (≥5 Notices)
                            </span>
                          )}
                        </div>
                        {contacts.length > 0 ? (
                          <div className="text-[11px] text-slate-500 mt-1 space-y-0.5">
                            <div>
                              <span className="font-semibold text-slate-700">{primaryContact?.personName || 'Contact'}:</span>{' '}
                              {primaryContact?.mobileNumber || primaryContact?.whatsappNumber || 'No phone'}
                            </div>
                            {primaryContact?.emailId && (
                              <div className="text-slate-400 truncate">{primaryContact.emailId}</div>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 mt-0.5">No contacts on file</div>
                        )}
                      </td>

                      {/* Bill No & Date */}
                      <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                        <div className="font-mono text-xs font-bold text-indigo-700">{inv.billNo}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(inv.billDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        {isAdvance && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200 mt-1">
                            Advance Receipt (Cr)
                          </span>
                        )}
                      </td>

                      {/* Bill Amount */}
                      <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                        <div>₹{inv.billAmount.toLocaleString('en-IN')}</div>
                        {isAdvance && (
                          <div className="text-[10px] text-slate-400 font-medium">Credit Voucher</div>
                        )}
                      </td>

                      {/* Paid / Adjusted */}
                      <td className="py-3.5 px-4 font-semibold text-emerald-700 whitespace-nowrap">
                        {inv.adjustment > 0 ? (
                          <>
                            <div>₹{inv.adjustment.toLocaleString('en-IN')}</div>
                            {isAdvance && (
                              <div className="text-[10px] text-emerald-600 font-bold">Advance Collected</div>
                            )}
                          </>
                        ) : isAdvance ? (
                          <>
                            <div>₹{inv.billAmount.toLocaleString('en-IN')}</div>
                            <div className="text-[10px] text-emerald-600 font-bold">Advance Collected</div>
                          </>
                        ) : (
                          '₹0'
                        )}
                      </td>

                      {/* Outstanding Due (Distinct & Highlighted) */}
                      <td className="py-3.5 px-4 font-black text-slate-900 whitespace-nowrap">
                        <div className={`text-sm ${inv.outstandingAmount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          ₹{inv.outstandingAmount.toLocaleString('en-IN')}
                        </div>
                        {isAdvance && (
                          <div className="text-[10px] text-emerald-700 font-bold">No Dues (Prepaid)</div>
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-xs font-semibold text-slate-800">
                          {new Date(inv.dueDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] mt-0.5 font-medium">
                          {inv.daysOverdue > 0 ? (
                            <span className="text-rose-600 font-bold">{inv.daysOverdue} days overdue</span>
                          ) : inv.daysOverdue === 0 ? (
                            <span className="text-amber-600 font-bold">Due today</span>
                          ) : (
                            <span className="text-slate-400">Due in {Math.abs(inv.daysOverdue)} days</span>
                          )}
                        </div>
                      </td>

                      {/* Payment Status Dropdown - Only 3 Options */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isAdvance ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200 inline-block">
                            Advance Received (Cr)
                          </span>
                        ) : (
                          <select
                            value={
                              inv.status === 'Settled' || inv.status === 'Payment Received' || inv.status === 'Closed'
                                ? 'Settled'
                                : inv.status === 'Partially Settled' || inv.status === 'Partially Paid'
                                ? 'Partially Settled'
                                : 'Pending'
                            }
                            onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                            className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border focus:outline-none transition ${
                              inv.status === 'Settled' || inv.status === 'Payment Received' || inv.status === 'Closed'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : inv.status === 'Partially Settled' || inv.status === 'Partially Paid'
                                ? 'bg-amber-50 border-amber-300 text-amber-800'
                                : 'bg-rose-50 border-rose-300 text-rose-800'
                            }`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Partially Settled">Partially Settled</option>
                            <option value="Settled">Settled</option>
                          </select>
                        )}
                      </td>

                      {/* Frequency (with Messages per day) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isAdvance || isExcludedAccount ? (
                          <span className="text-[11px] text-slate-400 italic">—</span>
                        ) : (
                          <ManualFrequencyInput
                            initialFreq={currentFreq}
                            initialMsgsPerDay={currentMsgsPerDay}
                            onSave={(f, m) => handleUpdateFrequency(inv.customer.id, f, m)}
                          />
                        )}
                      </td>

                      {/* Channels of Messaging */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isAdvance || isExcludedAccount ? (
                          <span className="text-[11px] text-slate-400 italic">—</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleChannel(inv.customer.id, 'WHATSAPP', currentChannelsStr)}
                              title="Toggle WhatsApp messaging"
                              className={`p-1.5 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 ${
                                activeChannels.includes('WHATSAPP')
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-sm'
                                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <Phone className="w-3 h-3" />
                              <span>WA</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleChannel(inv.customer.id, 'SMS', currentChannelsStr)}
                              title="Toggle SMS messaging"
                              className={`p-1.5 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 ${
                                activeChannels.includes('SMS')
                                  ? 'bg-indigo-50 text-indigo-800 border-indigo-300 shadow-sm'
                                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <Send className="w-3 h-3" />
                              <span>SMS</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleChannel(inv.customer.id, 'EMAIL', currentChannelsStr)}
                              title="Toggle Email messaging"
                              className={`p-1.5 rounded-lg text-[10px] font-bold border transition flex items-center gap-1 ${
                                activeChannels.includes('EMAIL')
                                  ? 'bg-sky-50 text-sky-800 border-sky-300 shadow-sm'
                                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <Mail className="w-3 h-3" />
                              <span>Mail</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Reminder History */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryCustomer(inv.customer);
                            setHistoryModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition"
                        >
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{logs.length} Sent</span>
                        </button>
                      </td>

                      {/* Reminders Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isAdvance || isExcludedAccount ? (
                          <span className="text-[11px] text-slate-400 italic">—</span>
                        ) : isEnabled ? (
                          <button
                            onClick={() => handleToggleReminderEnabled(inv.customer.id, true)}
                            title="Stop sending reminders to this customer"
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition inline-flex items-center gap-1"
                          >
                            <BellOff className="w-3 h-3" />
                            <span>Stop</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleReminderEnabled(inv.customer.id, false)}
                            title="Resume sending reminders"
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition inline-flex items-center gap-1"
                          >
                            <Bell className="w-3 h-3" />
                            <span>Resume</span>
                          </button>
                        )}
                      </td>

                      {/* Dispatch Mode */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isAdvance || isExcludedAccount ? (
                          <span className="text-[11px] text-slate-400 italic">—</span>
                        ) : (
                          <div className="inline-flex rounded-xl p-0.5 bg-slate-100 border border-slate-200 shadow-inner">
                            <button
                              type="button"
                              onClick={() => handleUpdateReminderMode(inv.customer.id, 'FULLY_AUTOMATED')}
                              title="Automatic: Dispatches reminders automatically on schedule without manual review"
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition flex items-center gap-1 ${
                                isAuto
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <Zap className="w-3 h-3" />
                              <span>Automatic</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateReminderMode(inv.customer.id, 'SEMI_AUTOMATED')}
                              title="Semi-Automatic: Queues reminders for review before sending"
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition flex items-center gap-1 ${
                                !isAuto
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <Sliders className="w-3 h-3" />
                              <span>Semi-Auto</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {isAdvance ? (
                          <span className="text-xs font-semibold text-slate-500 italic bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 inline-block">
                            Advance on File
                          </span>
                        ) : isExcludedAccount ? (
                          <span className="text-[11px] font-semibold text-slate-400 italic bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 inline-block">
                            Internal / Tax (No Reminders)
                          </span>
                        ) : (
                          <button
                            onClick={() => handleOpenRemind(inv)}
                            title="Send reminder via WhatsApp, SMS, or Email"
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition inline-flex items-center gap-1 shadow-sm"
                          >
                            <Send className="w-3 h-3" /> Remind
                          </button>
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

      {/* MODAL: PARTIALLY SETTLED AMOUNT */}
      {partialModal.isOpen && partialModal.invoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Enter Settled Amount</h3>
              <button
                onClick={() => setPartialModal({ isOpen: false, invoice: null, amount: '' })}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 text-xs text-slate-700 space-y-1">
              <div>Party: <strong>{partialModal.invoice.customer.partyName || partialModal.invoice.customer.rawLedgerName}</strong></div>
              <div>Bill No: <span className="font-mono font-bold text-indigo-600">{partialModal.invoice.billNo}</span></div>
              <div>Bill Amount: <strong>₹{partialModal.invoice.billAmount.toLocaleString('en-IN')}</strong></div>
              <div>Current Outstanding: <strong className="text-rose-600">₹{partialModal.invoice.outstandingAmount.toLocaleString('en-IN')}</strong></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Settled Amount (₹)</label>
              <input
                type="number"
                min="1"
                max={partialModal.invoice.billAmount}
                value={partialModal.amount}
                onChange={(e) => setPartialModal({ ...partialModal, amount: e.target.value })}
                placeholder="Enter amount settled..."
                className="w-full text-sm font-bold p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
              <p className="text-[11px] text-slate-400 mt-1">Remaining due balance will be synced in DB automatically.</p>
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
                className="px-5 py-2 text-xs font-bold bg-amber-600 text-white rounded-xl hover:bg-amber-700 shadow-md transition"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL REMINDER WITH PRE-WRITTEN TEMPLATES */}
      {activeModal === 'REMIND' && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-600">
                <Send className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">Dispatch Reminder</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 text-xs text-slate-700 space-y-1">
              <div>Party: <strong>{selectedInvoice.customer.partyName || selectedInvoice.customer.rawLedgerName}</strong></div>
              <div>Bill No: <span className="font-mono font-bold text-indigo-600">{selectedInvoice.billNo}</span></div>
              <div>Outstanding Amount: <strong className="text-rose-600">₹{selectedInvoice.outstandingAmount.toLocaleString('en-IN')}</strong></div>
              <div>Due Date: {new Date(selectedInvoice.dueDate).toLocaleDateString('en-IN')} ({selectedInvoice.daysOverdue} days overdue)</div>
            </div>

            <form onSubmit={submitManualReminder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Channel Selection
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

              {/* Language Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Reminder Language
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'English', label: 'English' },
                    { id: 'Hindi', label: 'हिन्दी' },
                    { id: 'Marathi', label: 'मराठी' },
                  ].map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => handleRemindLanguageChange(l.id)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                        remindLanguage === l.id
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-800 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {l.label}
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
                    Message Copy
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

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-700 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-500">Intended Customer:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {remindChannel === 'EMAIL'
                      ? selectedInvoice.customer?.contacts?.[0]?.emailId || 'Registered Contact Email'
                      : selectedInvoice.customer?.contacts?.[0]?.mobileNumber || 'Registered Contact Phone'}
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
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
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
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: UPLOAD SAP DUES / CONTACTS */}
      {activeModal === 'UPLOAD' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-600">
                <FileSpreadsheet className="w-6 h-6" />
                <h3 className="font-bold text-base text-slate-900">Import SAP Dues / Contacts</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Upload your daily SAP Outstanding Receivable export (ALV HTML, .xls, .xlsx, .csv) or Customer Contact sheet. Structure is automatically detected by headers.
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-2xl p-8 text-center cursor-pointer transition bg-slate-50/50"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv, .html"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <FileUp className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                {selectedFile ? (
                  <div>
                    <p className="text-xs font-bold text-slate-900">{selectedFile.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-slate-700">Click to choose file or drag & drop</p>
                    <p className="text-[11px] text-slate-400 mt-1">Supports SAP ALV (.xls), Excel (.xlsx), and CSV files</p>
                  </div>
                )}
              </div>

              {uploadMsg && (
                <div className={`p-3 rounded-xl text-xs font-medium ${
                  uploadMsg.includes('successful') || uploadMsg.includes('processed')
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {uploadMsg}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
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
                      <span>Diffing & Ingesting...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Ingest & Reconcile</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: REMINDER HISTORY MODAL */}
      {historyModalOpen && historyCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Reminder History
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {historyCustomer.partyName || historyCustomer.rawLedgerName} {historyCustomer.ledgerCode ? `(Ledger: ${historyCustomer.ledgerCode})` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {(!historyCustomer.reminderLogs || historyCustomer.reminderLogs.length === 0) ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  No reminder dispatches recorded for this customer yet.
                </div>
              ) : (
                historyCustomer.reminderLogs.map((log: any) => {
                  const channelBadge =
                    log.channel === 'WHATSAPP' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Phone className="w-3 h-3 text-emerald-600" /> WhatsApp
                      </span>
                    ) : log.channel === 'SMS' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                        <Send className="w-3 h-3 text-indigo-600" /> SMS Text
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                        <Mail className="w-3 h-3 text-sky-600" /> Email
                      </span>
                    );

                  return (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-2 hover:border-slate-300 transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          {channelBadge}
                          <span className="text-[11px] font-mono text-slate-500">{log.recipient}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            log.status === 'SENT' || log.status === 'DELIVERED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {log.status}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {new Date(log.dispatchedAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      {log.subject && (
                        <div className="text-xs font-bold text-slate-800">
                          Subject: {log.subject}
                        </div>
                      )}

                      <p className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed font-sans">
                        {log.messageContent}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
