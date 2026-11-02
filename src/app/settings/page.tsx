'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  ShieldAlert,
  Check,
  RefreshCw,
  Smartphone,
  Mail,
  MessageSquare,
  Building,
  Palette,
  CreditCard,
  Plus,
  X,
  Layers,
} from 'lucide-react';

export default function SettingsPage() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [schedule, setSchedule] = useState({
    reminder1DaysBefore: 3,
    reminder2DaysAfter: 0,
    reminder3DaysAfter: 3,
    reminder4DaysAfter: 7,
    reminder5DaysAfter: 15,
    maxRemindersBeforeFlag: 5,
    channels: 'WHATSAPP,SMS,EMAIL',
  });

  // Tenant / White-Label State
  const [tenant, setTenant] = useState<any>({
    companyName: 'Abhiyadna Machine Tools',
    brandColor: '#4f46e5',
    bankName: 'HDFC Bank',
    bankAccountNo: '50200012345678',
    bankIfscCode: 'HDFC0001234',
    bankUpiId: 'abmato@hdfcbank',
  });
  const [allTenants, setAllTenants] = useState<any[]>([]);
  const [showNewTenantModal, setShowNewTenantModal] = useState(false);
  const [creatingTenant, setCreatingTenant] = useState(false);
  const [newTenantForm, setNewTenantForm] = useState({
    slug: '',
    companyName: '',
    brandColor: '#2563eb',
    bankName: '',
    bankAccountNo: '',
    bankIfscCode: '',
    bankUpiId: '',
  });

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        if (data.tenant) setTenant(data.tenant);
        if (data.allTenants) setAllTenants(data.allTenants);
        if (data.integrations) setIntegrations(data.integrations);
        if (data.schedule) {
          setSchedule({
            reminder1DaysBefore: data.schedule.reminder1DaysBefore,
            reminder2DaysAfter: data.schedule.reminder2DaysAfter,
            reminder3DaysAfter: data.schedule.reminder3DaysAfter,
            reminder4DaysAfter: data.schedule.reminder4DaysAfter,
            reminder5DaysAfter: data.schedule.reminder5DaysAfter,
            maxRemindersBeforeFlag: data.schedule.maxRemindersBeforeFlag,
            channels: data.schedule.channels,
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant,
          integrations,
          schedule,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg('Settings, branding, and automated cadences saved successfully!');
        setTimeout(() => setSaveMsg(null), 3000);
      }
    } catch (e: any) {
      alert('Error: ' + e?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantForm.slug || !newTenantForm.companyName) {
      alert('Slug and Company Name are required');
      return;
    }

    try {
      setCreatingTenant(true);
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newTenant: newTenantForm,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg(`New organization "${newTenantForm.companyName}" registered successfully!`);
        setShowNewTenantModal(false);
        setNewTenantForm({
          slug: '',
          companyName: '',
          brandColor: '#2563eb',
          bankName: '',
          bankAccountNo: '',
          bankIfscCode: '',
          bankUpiId: '',
        });
        fetchSettings();
        setTimeout(() => setSaveMsg(null), 3500);
      }
    } catch (err: any) {
      alert('Error creating organization: ' + err?.message);
    } finally {
      setCreatingTenant(false);
    }
  };

  return (
    <main className="p-8 max-w-5xl mx-auto w-full space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-700" />
            Platform & Multi-Tenant Settings
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            White-label company branding, bank details, automated cadence rules, and communication gateway credentials.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-sm transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>

      {saveMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{saveMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* SECTION 1: MULTI-TENANT WHITE-LABELING & BANK DETAILS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">Organization & White-Label Branding</h3>
                <p className="text-[11px] text-slate-500">
                  Shipped per client. Injects company name and bank transfer details into all reminder templates.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowNewTenantModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" /> Onboard New Organization
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Company Display Name *</label>
              <input
                type="text"
                required
                value={tenant.companyName || ''}
                onChange={(e) => setTenant({ ...tenant, companyName: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Appears in header and reminder copy</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Brand Theme Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={tenant.brandColor || '#4f46e5'}
                  onChange={(e) => setTenant({ ...tenant, brandColor: e.target.value })}
                  className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={tenant.brandColor || '#4f46e5'}
                  onChange={(e) => setTenant({ ...tenant, brandColor: e.target.value })}
                  className="w-28 text-xs font-mono px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                />
                <span className="text-[11px] text-slate-400">Primary UI & badge color</span>
              </div>
            </div>
          </div>

          {/* Company Bank Account Details for Dynamic Injection */}
          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              Company Bank & UPI Details (Injected into {'{company_bank_details}'} in templates)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={tenant.bankName || ''}
                  onChange={(e) => setTenant({ ...tenant, bankName: e.target.value })}
                  placeholder="e.g. HDFC Bank"
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Account Number</label>
                <input
                  type="text"
                  value={tenant.bankAccountNo || ''}
                  onChange={(e) => setTenant({ ...tenant, bankAccountNo: e.target.value })}
                  placeholder="e.g. 50200012345678"
                  className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">IFSC Code</label>
                <input
                  type="text"
                  value={tenant.bankIfscCode || ''}
                  onChange={(e) => setTenant({ ...tenant, bankIfscCode: e.target.value })}
                  placeholder="e.g. HDFC0001234"
                  className="w-full text-xs font-mono uppercase px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">UPI ID (VPA)</label>
                <input
                  type="text"
                  value={tenant.bankUpiId || ''}
                  onChange={(e) => setTenant({ ...tenant, bankUpiId: e.target.value })}
                  placeholder="e.g. abmato@hdfcbank"
                  className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: AUTOMATED REMINDER CADENCE & DEFAULTER RULES */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">Automated Cadence & Defaulter Trigger Rules</h3>
              <p className="text-[11px] text-slate-500">Relative to Invoice Due Date (T)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <label className="block font-bold text-slate-700 mb-1">Reminder 1 (Gentle)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={schedule.reminder1DaysBefore}
                  onChange={(e) => setSchedule({ ...schedule, reminder1DaysBefore: Number(e.target.value) })}
                  className="w-16 p-1.5 rounded border border-slate-300 font-bold text-center"
                />
                <span className="text-[11px] text-slate-500">days before</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <label className="block font-bold text-slate-700 mb-1">Reminder 2 (Prompt)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={schedule.reminder2DaysAfter}
                  disabled
                  className="w-16 p-1.5 rounded border border-slate-200 bg-slate-100 font-bold text-center text-slate-500"
                />
                <span className="text-[11px] text-slate-500">on due date</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <label className="block font-bold text-slate-700 mb-1">Reminder 3 (Overdue)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={schedule.reminder3DaysAfter}
                  onChange={(e) => setSchedule({ ...schedule, reminder3DaysAfter: Number(e.target.value) })}
                  className="w-16 p-1.5 rounded border border-slate-300 font-bold text-center"
                />
                <span className="text-[11px] text-slate-500">days overdue</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <label className="block font-bold text-slate-700 mb-1">Reminder 4 (Firm)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={schedule.reminder4DaysAfter}
                  onChange={(e) => setSchedule({ ...schedule, reminder4DaysAfter: Number(e.target.value) })}
                  className="w-16 p-1.5 rounded border border-slate-300 font-bold text-center"
                />
                <span className="text-[11px] text-slate-500">days overdue</span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <label className="block font-bold text-slate-700 mb-1">Reminder 5 (Urgent)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={schedule.reminder5DaysAfter}
                  onChange={(e) => setSchedule({ ...schedule, reminder5DaysAfter: Number(e.target.value) })}
                  className="w-16 p-1.5 rounded border border-slate-300 font-bold text-center"
                />
                <span className="text-[11px] text-slate-500">days overdue</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-900">
            <div>
              <span className="font-bold">Automatic Defaulter Flagging Threshold:</span> Customer is automatically flagged after{' '}
              <strong className="underline">{schedule.maxRemindersBeforeFlag} consecutive reminder attempts</strong> without payment.
            </div>
          </div>
        </div>

        {/* SECTION 3: GATEWAY & INTEGRATION CREDENTIALS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">Channel Gateways & Direct Test Routing</h3>
                <p className="text-[11px] text-slate-500">Configure Sandbox Test Destinations or Production Gateways</p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900">
            <div className="font-bold">🧪 Active Test Routing Targets:</div>
            <div className="mt-1 flex flex-wrap gap-4 font-mono text-[11px]">
              <span>WhatsApp: <strong className="text-emerald-700">+918530383141</strong></span>
              <span>SMS: <strong className="text-indigo-700">+918530383141</strong></span>
              <span>Email: <strong className="text-sky-700">jayesh@zuigo.ai</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* WhatsApp */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <MessageSquare className="w-4 h-4 text-emerald-600" /> WhatsApp Business
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                  Active
                </span>
              </div>
              <div className="text-xs space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Provider</label>
                  <select className="w-full text-xs p-2 rounded border border-slate-300 bg-white">
                    <option value="SIMULATOR">Built-in Sandbox Simulator (wa.me)</option>
                    <option value="AISENSY">AiSensy API</option>
                    <option value="GUPSHUP">Gupshup Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">API Key / Secret</label>
                  <input type="password" value="••••••••••••••••••••" readOnly className="w-full text-xs p-2 rounded border border-slate-300 bg-slate-100 font-mono" />
                </div>
              </div>
            </div>

            {/* SMS */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <Smartphone className="w-4 h-4 text-indigo-600" /> SMS DLT Gateway
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-indigo-100 text-indigo-800">
                  Active
                </span>
              </div>
              <div className="text-xs space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Provider</label>
                  <select className="w-full text-xs p-2 rounded border border-slate-300 bg-white">
                    <option value="SIMULATOR">Built-in Sandbox Simulator (sms:)</option>
                    <option value="FAST2SMS">Fast2SMS Indian DLT</option>
                    <option value="MSG91">MSG91 Flow</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">DLT Sender Header</label>
                  <input type="text" placeholder="ABMATO" className="w-full text-xs p-2 rounded border border-slate-300 font-mono uppercase" />
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <Mail className="w-4 h-4 text-sky-600" /> Email SMTP
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-sky-100 text-sky-800">
                  Active
                </span>
              </div>
              <div className="text-xs space-y-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Provider</label>
                  <select className="w-full text-xs p-2 rounded border border-slate-300 bg-white">
                    <option value="SIMULATOR">Built-in Sandbox Simulator (mailto:)</option>
                    <option value="SMTP">Custom SMTP (Gmail/cPanel)</option>
                    <option value="RESEND">Resend API</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600">Sender Email</label>
                  <input type="text" placeholder="jayesh@zuigo.ai" className="w-full text-xs p-2 rounded border border-slate-300 font-mono" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Onboard New Tenant Modal */}
      {showNewTenantModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-600" />
                  Onboard New Client Organization
                </h3>
                <p className="text-xs text-slate-500">
                  Deploy a dedicated, white-labeled tenant workspace with isolated ledger codes and bank details.
                </p>
              </div>
              <button
                onClick={() => setShowNewTenantModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewTenant} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Organization Slug *</label>
                  <input
                    type="text"
                    required
                    value={newTenantForm.slug}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, slug: e.target.value })}
                    placeholder="e.g. xyz-corp"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Unique URL identifier</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company Display Name *</label>
                  <input
                    type="text"
                    required
                    value={newTenantForm.companyName}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, companyName: e.target.value })}
                    placeholder="e.g. XYZ Enterprises Ltd"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Brand Theme Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newTenantForm.brandColor}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, brandColor: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={newTenantForm.brandColor}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, brandColor: e.target.value })}
                    className="w-28 text-xs font-mono px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={newTenantForm.bankName}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, bankName: e.target.value })}
                    placeholder="e.g. ICICI Bank"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={newTenantForm.bankAccountNo}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, bankAccountNo: e.target.value })}
                    placeholder="e.g. 100200300400"
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewTenantModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTenant}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50 shadow-sm"
                >
                  {creatingTenant ? 'Registering Organization...' : 'Create & Register Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
