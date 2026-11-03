'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  ShieldAlert,
  Phone,
  Mail,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Plus,
  Edit2,
  X,
  MessageSquare,
  Globe,
  UserCheck,
  Bell,
  BellOff,
  Clock,
  Send,
  Zap,
  Sliders,
  Calendar,
  Check,
} from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'ALL' | 'MISSING_CONTACTS' | 'FLAGGED'>('ALL');
  const [notification, setNotification] = useState<string | null>(null);

  // Contact Modal State
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    personName: '',
    designation: '',
    mobileNumber: '',
    whatsappNumber: '',
    emailId: '',
    preferredLanguage: 'English',
    isPrimary: true,
  });

  // Reminder History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<any | null>(null);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/customers');
      const data = await res.json();
      if (data.success) {
        setCustomers(data.customers);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleToggleFlag = async (customerId: string, currentFlag: boolean) => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          isFlagged: !currentFlag,
          flagReason: !currentFlag ? 'Manually flagged by credit manager' : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification(`Customer ${!currentFlag ? 'flagged as Defaulter' : 'restored to Good Standing'}`);
        fetchCustomers();
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (e: any) {
      alert('Error updating customer status: ' + e?.message);
    }
  };

  const handleUpdateFrequency = async (customerId: string, frequencyDays: number) => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          frequencyDays,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification(`Reminder frequency updated to every ${frequencyDays === 1 ? 'day' : `${frequencyDays} days`}`);
        fetchCustomers();
        setTimeout(() => setNotification(null), 3000);
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
        setNotification(`Channels updated: ${channels.join(', ')}`);
        fetchCustomers();
        setTimeout(() => setNotification(null), 3000);
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
        setNotification(!currentEnabled ? 'Reminders resumed for customer' : 'Reminders stopped for customer');
        fetchCustomers();
        setTimeout(() => setNotification(null), 3000);
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
        setNotification(
          mode === 'FULLY_AUTOMATED'
            ? 'Set to Automatic: Reminders will dispatch automatically on schedule'
            : 'Set to Semi-Automatic: Reminders require manual review/queue approval'
        );
        fetchCustomers();
        setTimeout(() => setNotification(null), 3500);
      }
    } catch (e: any) {
      alert('Error updating reminder mode: ' + e?.message);
    }
  };

  const openAddContactModal = (customer: any, existingContact?: any) => {
    setSelectedCustomer(customer);
    if (existingContact) {
      setEditingContactId(existingContact.id);
      setContactForm({
        personName: existingContact.personName || '',
        designation: existingContact.designation || '',
        mobileNumber: existingContact.mobileNumber || '',
        whatsappNumber: existingContact.whatsappNumber || '',
        emailId: existingContact.emailId || '',
        preferredLanguage: customer.preferredLanguage || 'English',
        isPrimary: existingContact.isPrimary ?? true,
      });
    } else {
      setEditingContactId(null);
      setContactForm({
        personName: '',
        designation: 'Accounts Manager',
        mobileNumber: '',
        whatsappNumber: '',
        emailId: '',
        preferredLanguage: customer.preferredLanguage || 'English',
        isPrimary: !customer.contacts || customer.contacts.length === 0,
      });
    }
    setContactModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    if (!contactForm.mobileNumber && !contactForm.emailId) {
      alert('Please provide at least a mobile number or an email ID.');
      return;
    }

    try {
      setSavingContact(true);
      const res = await fetch('/api/customers/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          contactId: editingContactId || undefined,
          ...contactForm,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNotification(`Contact for ${selectedCustomer.partyName || selectedCustomer.rawLedgerName} saved successfully!`);
        setContactModalOpen(false);
        fetchCustomers();
        setTimeout(() => setNotification(null), 3500);
      } else {
        alert(data.error || 'Failed to save contact');
      }
    } catch (err: any) {
      alert('Error saving contact: ' + err?.message);
    } finally {
      setSavingContact(false);
    }
  };

  const missingContactsList = customers.filter(
    (c) => !c.contacts || c.contacts.length === 0 || !c.contacts.some((ct: any) => ct.mobileNumber || ct.emailId)
  );

  const flaggedList = customers.filter((c) => c.isFlagged);

  const filtered = customers.filter((c) => {
    if (tab === 'MISSING_CONTACTS') {
      const hasValidContact = c.contacts && c.contacts.some((ct: any) => ct.mobileNumber || ct.emailId);
      if (hasValidContact) return false;
    } else if (tab === 'FLAGGED') {
      if (!c.isFlagged) return false;
    }

    const term = search.toLowerCase();
    return (
      c.rawLedgerName.toLowerCase().includes(term) ||
      (c.partyName && c.partyName.toLowerCase().includes(term)) ||
      (c.ledgerCode && c.ledgerCode.includes(term)) ||
      c.contacts?.some((ct: any) =>
        (ct.personName && ct.personName.toLowerCase().includes(term)) ||
        (ct.mobileNumber && ct.mobileNumber.includes(term)) ||
        (ct.emailId && ct.emailId.toLowerCase().includes(term))
      )
    );
  });

  return (
    <main className="p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-600" />
            Customer Directory & Reminder Automation
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure reminder frequency, channels, stop/resume status, view audit history, and choose between Automatic vs. Semi-Automatic dispatch per customer.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, person, or phone..."
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
          />
        </div>
      </div>

      {/* Missing Contacts Warning Banner */}
      {missingContactsList.length > 0 && tab !== 'MISSING_CONTACTS' && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold">
                {missingContactsList.length} Customer{missingContactsList.length > 1 ? 's have' : ' has'} Missing Contact Details
              </div>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Automated WhatsApp, SMS, and Email reminders cannot reach these customers until phone or email details are provided.
              </p>
            </div>
          </div>
          <button
            onClick={() => setTab('MISSING_CONTACTS')}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shrink-0 transition shadow-sm"
          >
            Review & Add Contacts
          </button>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="p-3 bg-sky-50 border border-sky-200 text-sky-900 text-xs font-semibold rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-600" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-sky-700 font-bold">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setTab('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            tab === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Customers
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${tab === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {customers.length}
          </span>
        </button>

        <button
          onClick={() => setTab('MISSING_CONTACTS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            tab === 'MISSING_CONTACTS'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-amber-800 hover:bg-amber-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Missing Contacts
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${tab === 'MISSING_CONTACTS' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900 font-bold'}`}>
            {missingContactsList.length}
          </span>
        </button>

        <button
          onClick={() => setTab('FLAGGED')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            tab === 'FLAGGED'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Flagged Defaulters
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${tab === 'FLAGGED' ? 'bg-rose-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {flaggedList.length}
          </span>
        </button>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-semibold border-b border-slate-200 tracking-wider">
              <tr>
                <th className="py-3 px-4">Company / Ledger</th>
                <th className="py-3 px-4">Contact Directory</th>
                <th className="py-3 px-4">Outstanding Due</th>
                <th className="py-3 px-4">Frequency</th>
                <th className="py-3 px-4">Channels</th>
                <th className="py-3 px-4">Reminder History</th>
                <th className="py-3 px-4">Reminders Status</th>
                <th className="py-3 px-4 text-right">Dispatch Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">Loading customers...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    {tab === 'MISSING_CONTACTS' ? '🎉 Great news! All customers have registered contact details.' : 'No customers found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const hasValidContact = c.contacts && c.contacts.some((ct: any) => ct.mobileNumber || ct.emailId);
                  const schedule = c.reminderSchedules?.[0];
                  const currentFreq = schedule?.reminder3DaysAfter || 3;
                  const currentChannelsStr = schedule?.channels || 'WHATSAPP,SMS,EMAIL';
                  const activeChannels = currentChannelsStr.split(',').map((s: string) => s.trim().toUpperCase());
                  const logs = c.reminderLogs || [];
                  const isAuto = c.reminderMode === 'FULLY_AUTOMATED';
                  const isEnabled = c.reminderEnabled !== false;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition">
                      {/* 1. Company / Ledger */}
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{c.partyName || c.rawLedgerName.replace(/\[.*?\]/g, '').trim()}</span>
                          {!hasValidContact && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              No Contacts
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>Ledger: {c.ledgerCode}</span>
                          <span>•</span>
                          <span>Branch: {c.branchCode}</span>
                          {c.station && <span>• {c.station}</span>}
                        </div>
                      </td>

                      {/* 2. Contact Directory */}
                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        {c.contacts && c.contacts.length > 0 ? (
                          <div className="space-y-1">
                            {c.contacts.slice(0, 2).map((ct: any) => (
                              <div key={ct.id} className="flex items-center justify-between gap-1.5 text-slate-600 bg-slate-50/80 px-2 py-1 rounded-lg border border-slate-100">
                                <div>
                                  <div className="flex items-center gap-1">
                                    <span className="font-bold text-slate-800 text-[11px]">{ct.personName}</span>
                                    {ct.isPrimary && (
                                      <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                        Primary
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                    {ct.mobileNumber && <span>{ct.mobileNumber}</span>}
                                    {ct.emailId && <span>{ct.emailId}</span>}
                                  </div>
                                </div>
                                <button
                                  onClick={() => openAddContactModal(c, ct)}
                                  className="text-[9px] text-slate-400 hover:text-indigo-600 font-medium px-1 rounded hover:bg-white"
                                >
                                  Edit
                                </button>
                              </div>
                            ))}
                            {c.contacts.length > 2 && (
                              <span className="text-[10px] text-slate-400">+{c.contacts.length - 2} more contacts</span>
                            )}
                            <button
                              onClick={() => openAddContactModal(c)}
                              className="text-[10px] text-indigo-600 font-semibold hover:underline flex items-center gap-0.5 mt-0.5"
                            >
                              <Plus className="w-2.5 h-2.5" /> Add Contact
                            </button>
                          </div>
                        ) : (
                          <div>
                            <span className="text-amber-600 text-[11px] font-semibold italic flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> No phone/email
                            </span>
                            <button
                              onClick={() => openAddContactModal(c)}
                              className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition"
                            >
                              <Plus className="w-2.5 h-2.5" /> Add Contact
                            </button>
                          </div>
                        )}
                      </td>

                      {/* 3. Outstanding Due */}
                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        <div className="font-extrabold text-sm text-slate-900">
                          ₹{(c.totalOutstanding || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {c.invoices?.length || 0} invoice(s)
                        </div>
                      </td>

                      {/* 4. Configure Frequency */}
                      <td className="py-3.5 px-4">
                        <select
                          value={currentFreq}
                          onChange={(e) => handleUpdateFrequency(c.id, Number(e.target.value))}
                          className="text-xs font-semibold py-1.5 px-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
                        >
                          <option value={1}>Daily</option>
                          <option value={3}>Every 3 Days</option>
                          <option value={7}>Weekly (7d)</option>
                          <option value={15}>Every 15 Days</option>
                          <option value={30}>Monthly (30d)</option>
                        </select>
                      </td>

                      {/* 5. Select Channels of Messaging */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleChannel(c.id, 'WHATSAPP', currentChannelsStr)}
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
                            onClick={() => handleToggleChannel(c.id, 'SMS', currentChannelsStr)}
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
                            onClick={() => handleToggleChannel(c.id, 'EMAIL', currentChannelsStr)}
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
                      </td>

                      {/* 6. History of Reminders Sent */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => {
                            setHistoryCustomer(c);
                            setHistoryModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition"
                        >
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{logs.length} Sent</span>
                        </button>
                      </td>

                      {/* 7. Stop / Resume Reminders Option */}
                      <td className="py-3.5 px-4">
                        {isEnabled ? (
                          <button
                            onClick={() => handleToggleReminderEnabled(c.id, true)}
                            title="Stop sending reminders to this customer"
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition inline-flex items-center gap-1"
                          >
                            <BellOff className="w-3 h-3" />
                            <span>Stop</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleReminderEnabled(c.id, false)}
                            title="Resume sending reminders"
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition inline-flex items-center gap-1"
                          >
                            <Bell className="w-3 h-3" />
                            <span>Resume</span>
                          </button>
                        )}
                      </td>

                      {/* 8. Last of row: Automatic vs. Semi-Automatic */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex rounded-xl p-0.5 bg-slate-100 border border-slate-200 shadow-inner">
                          <button
                            type="button"
                            onClick={() => handleUpdateReminderMode(c.id, 'FULLY_AUTOMATED')}
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
                            onClick={() => handleUpdateReminderMode(c.id, 'SEMI_AUTOMATED')}
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reminder History Modal */}
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
                    {historyCustomer.partyName || historyCustomer.rawLedgerName} (Ledger: {historyCustomer.ledgerCode})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
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

            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
              <button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      {contactModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingContactId ? 'Edit Contact Person' : 'Add Contact Person'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedCustomer.partyName || selectedCustomer.rawLedgerName} (Ledger: {selectedCustomer.ledgerCode})
                </p>
              </div>
              <button
                onClick={() => setContactModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person Name *</label>
                  <input
                    type="text"
                    required
                    value={contactForm.personName}
                    onChange={(e) => setContactForm({ ...contactForm, personName: e.target.value })}
                    placeholder="e.g. Anil Sharma"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Designation / Department</label>
                  <input
                    type="text"
                    value={contactForm.designation}
                    onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })}
                    placeholder="e.g. Accounts Manager"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number (WhatsApp/SMS)</label>
                  <input
                    type="tel"
                    value={contactForm.mobileNumber}
                    onChange={(e) => setContactForm({ ...contactForm, mobileNumber: e.target.value })}
                    placeholder="e.g. 9822011223"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Clean +91 format applied automatically</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email ID</label>
                  <input
                    type="email"
                    value={contactForm.emailId}
                    onChange={(e) => setContactForm({ ...contactForm, emailId: e.target.value })}
                    placeholder="e.g. finance@customer.com"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Language for Reminders</label>
                <select
                  value={contactForm.preferredLanguage}
                  onChange={(e) => setContactForm({ ...contactForm, preferredLanguage: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="Marathi">Marathi (मराठी)</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={contactForm.isPrimary}
                    onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Set as Primary Contact for Automated Reminders
                  </span>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setContactModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingContact}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 transition disabled:opacity-50 shadow-sm"
                >
                  {savingContact ? 'Saving...' : 'Save Contact Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
