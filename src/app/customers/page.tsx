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
        setNotification(`Customer ${!currentFlag ? 'flagged as Defaulter' : 'unflagged and restored to Good Standing'}`);
        fetchCustomers();
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (e: any) {
      alert('Error updating customer status: ' + e?.message);
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
    c => !c.contacts || c.contacts.length === 0 || !c.contacts.some((ct: any) => ct.mobileNumber || ct.emailId)
  );

  const flaggedList = customers.filter(c => c.isFlagged);

  const filtered = customers.filter((c) => {
    // 1. Tab filter
    if (tab === 'MISSING_CONTACTS') {
      const hasValidContact = c.contacts && c.contacts.some((ct: any) => ct.mobileNumber || ct.emailId);
      if (hasValidContact) return false;
    } else if (tab === 'FLAGGED') {
      if (!c.isFlagged) return false;
    }

    // 2. Search filter
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
            Customer Directory & Contact Master
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic relational index joined via <span className="font-mono font-semibold text-slate-700">Ledger Code</span>. Manages contact persons, multi-channel endpoints, and defaulter status.
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
                Automated WhatsApp, SMS, and Email digest reminders cannot reach these customers until phone or email details are provided.
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
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-6">Company / Ledger</th>
                <th className="py-3 px-6">Contact Directory</th>
                <th className="py-3 px-6">Invoices / Total Due</th>
                <th className="py-3 px-6">Reminders</th>
                <th className="py-3 px-6">Standing</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">Loading customers...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    {tab === 'MISSING_CONTACTS' ? '🎉 Great news! All customers have registered contact details.' : 'No customers found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const hasValidContact = c.contacts && c.contacts.some((ct: any) => ct.mobileNumber || ct.emailId);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-4 px-6 font-medium text-slate-900">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          {c.partyName || c.rawLedgerName.replace(/\[.*?\]/g, '').trim()}
                          {!hasValidContact && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              No Contacts
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>Ledger: {c.ledgerCode}</span>
                          <span>•</span>
                          <span>Branch: {c.branchCode}</span>
                          {c.station && <span>• Station: {c.station}</span>}
                        </div>
                      </td>

                      <td className="py-4 px-6 text-xs text-slate-700">
                        {c.contacts && c.contacts.length > 0 ? (
                          <div className="space-y-1.5">
                            {c.contacts.map((ct: any) => (
                              <div key={ct.id} className="flex items-start justify-between gap-2 text-slate-600 bg-slate-50/80 p-1.5 rounded-lg border border-slate-100">
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-800">{ct.personName}</span>
                                    {ct.isPrimary && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                        Primary
                                      </span>
                                    )}
                                    {ct.designation && (
                                      <span className="text-[10px] text-slate-400">({ct.designation})</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono mt-0.5">
                                    {ct.mobileNumber && (
                                      <span className="flex items-center gap-1">
                                        <Phone className="w-3 h-3 text-slate-400" /> {ct.mobileNumber}
                                      </span>
                                    )}
                                    {ct.emailId && (
                                      <span className="flex items-center gap-1">
                                        <Mail className="w-3 h-3 text-slate-400" /> {ct.emailId}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button
                                  onClick={() => openAddContactModal(c, ct)}
                                  className="text-[10px] text-slate-400 hover:text-indigo-600 font-medium px-1.5 py-0.5 rounded hover:bg-white"
                                >
                                  Edit
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => openAddContactModal(c)}
                              className="text-[11px] text-indigo-600 font-semibold hover:underline flex items-center gap-1 mt-1"
                            >
                              <Plus className="w-3 h-3" /> Add Another Contact
                            </button>
                          </div>
                        ) : (
                          <div>
                            <span className="text-amber-600 text-xs font-semibold italic flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> No contact phone or email
                            </span>
                            <button
                              onClick={() => openAddContactModal(c)}
                              className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition"
                            >
                              <Plus className="w-3 h-3" /> Add Contact Details
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-6 text-xs text-slate-700">
                        <div className="font-extrabold text-sm text-slate-900">
                          ₹{(c.totalOutstanding || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {c.invoices?.length || 0} invoice(s)
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="text-xs font-bold text-slate-800">
                          {c.consecutiveRemindersCount} / 5
                        </div>
                        {c.consecutiveRemindersCount >= 5 && (
                          <div className="text-[10px] text-rose-600 font-semibold">Exceeded threshold</div>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        {c.isFlagged ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                            <ShieldAlert className="w-3.5 h-3.5" /> Flagged Defaulter
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Good Standing
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          onClick={() => openAddContactModal(c)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                        >
                          + Contact
                        </button>
                        <button
                          onClick={() => handleToggleFlag(c.id, c.isFlagged)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            c.isFlagged
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                          }`}
                        >
                          {c.isFlagged ? 'Restore / Unflag' : 'Flag Defaulter'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
