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
  CreditCard,
  Plus,
  X,
  Send,
  Zap,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function SettingsPage() {
  const [schedule, setSchedule] = useState({
    reminder1DaysBefore: 3,
    reminder2DaysAfter: 0,
    reminder3DaysAfter: 3,
    reminder4DaysAfter: 7,
    reminder5DaysAfter: 15,
    maxRemindersBeforeFlag: 5,
    channels: 'WHATSAPP,SMS,EMAIL',
    autoReminderEnabled: true,
  });

  // Tenant / White-Label State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const isAdmin = currentUser?.role === 'ADMIN';

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

  // Gateway Configurations
  const [waConfig, setWaConfig] = useState({
    providerName: 'META_CLOUD_API',
    isSandbox: true,
    accessToken: '',
    phoneNumberId: '',
    wabaId: '',
    accountSid: '',
    authToken: '',
    fromNumber: '+14155238886',
    apiKey: '',
  });

  const [smsConfig, setSmsConfig] = useState({
    providerName: 'FAST2SMS',
    isSandbox: true,
    apiKey: '',
    senderId: 'ABMATO',
    accountSid: '',
    authToken: '',
    fromNumber: '+1234567890',
  });

  const [emailConfig, setEmailConfig] = useState({
    providerName: 'SMTP',
    isSandbox: true,
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    fromEmail: '',
    fromName: 'Accounts Department',
    apiKey: '',
  });

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [testTesting, setTestTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ channel: string; msg: string; success: boolean } | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        if (data.tenant) setTenant(data.tenant);
        if (data.allTenants) setAllTenants(data.allTenants);
        if (data.schedule) {
          setSchedule({
            reminder1DaysBefore: data.schedule.reminder1DaysBefore ?? 3,
            reminder2DaysAfter: data.schedule.reminder2DaysAfter ?? 0,
            reminder3DaysAfter: data.schedule.reminder3DaysAfter ?? 3,
            reminder4DaysAfter: data.schedule.reminder4DaysAfter ?? 7,
            reminder5DaysAfter: data.schedule.reminder5DaysAfter ?? 15,
            maxRemindersBeforeFlag: data.schedule.maxRemindersBeforeFlag ?? 5,
            channels: data.schedule.channels || 'WHATSAPP,SMS,EMAIL',
            autoReminderEnabled: data.schedule.autoReminderEnabled ?? true,
          });
        }

        if (data.integrations && data.integrations.length > 0) {
          data.integrations.forEach((item: any) => {
            let parsed: any = {};
            try {
              parsed = JSON.parse(item.configJson || '{}');
            } catch {
              parsed = {};
            }

            if (item.providerType === 'WHATSAPP') {
              setWaConfig({
                providerName: item.providerName || 'META_CLOUD_API',
                isSandbox: item.isSandbox ?? true,
                ...parsed,
              });
            } else if (item.providerType === 'SMS') {
              setSmsConfig({
                providerName: item.providerName || 'FAST2SMS',
                isSandbox: item.isSandbox ?? true,
                ...parsed,
              });
            } else if (item.providerType === 'EMAIL') {
              setEmailConfig({
                providerName: item.providerName || 'SMTP',
                isSandbox: item.isSandbox ?? true,
                ...parsed,
              });
            }
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch((err) => console.error('Failed to load user session:', err));

    fetchSettings();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);

      const integrationsPayload = [
        {
          providerType: 'WHATSAPP',
          providerName: waConfig.providerName,
          isSandbox: waConfig.isSandbox,
          configJson: JSON.stringify(waConfig),
        },
        {
          providerType: 'SMS',
          providerName: smsConfig.providerName,
          isSandbox: smsConfig.isSandbox,
          configJson: JSON.stringify(smsConfig),
        },
        {
          providerType: 'EMAIL',
          providerName: emailConfig.providerName,
          isSandbox: emailConfig.isSandbox,
          configJson: JSON.stringify(emailConfig),
        },
      ];

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant,
          integrations: integrationsPayload,
          schedule,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg('All platform settings, gateways, and automated cadences saved successfully!');
        setTimeout(() => setSaveMsg(null), 3500);
      }
    } catch (e: any) {
      alert('Error saving settings: ' + e?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestGateway = async (channel: 'WHATSAPP' | 'SMS' | 'EMAIL') => {
    try {
      setTestTesting(channel);
      setTestResult(null);

      const payload = {
        channel,
        provider:
          channel === 'WHATSAPP'
            ? waConfig.providerName
            : channel === 'SMS'
            ? smsConfig.providerName
            : emailConfig.providerName,
        isSandbox:
          channel === 'WHATSAPP'
            ? waConfig.isSandbox
            : channel === 'SMS'
            ? smsConfig.isSandbox
            : emailConfig.isSandbox,
        config:
          channel === 'WHATSAPP'
            ? waConfig
            : channel === 'SMS'
            ? smsConfig
            : emailConfig,
      };

      const res = await fetch('/api/settings/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setTestResult({
          channel,
          msg: `${data.message} (Recipient: ${data.effectiveRecipient})`,
          success: true,
        });
      } else {
        setTestResult({
          channel,
          msg: data.error || 'Connection failed',
          success: false,
        });
      }
    } catch (err: any) {
      setTestResult({
        channel,
        msg: err.message || 'Error executing gateway test',
        success: false,
      });
    } finally {
      setTestTesting(null);
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
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-700" />
            Platform, Gateway & Autonomous Agent Settings
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure white-label company branding, bank details, autonomous reminder agent, and multi-channel gateways.
          </p>
        </div>

        <button
          onClick={() => handleSave()}
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

      {testResult && (
        <div
          className={`p-3 border rounded-xl text-xs font-semibold flex items-center gap-2 ${
            testResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{testResult.msg}</span>
        </div>
      )}

      <form onSubmit={(e) => handleSave(e)} className="space-y-8">
        {/* SECTION 1: AUTONOMOUS AGENT EXECUTION */}
        <div className="bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-white p-6 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-indigo-100/70 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">Autonomous Follow-up Agent</h3>
                <p className="text-[11px] text-slate-500">
                  Controls whether the agent starts following up immediately upon daily Excel import
                </p>
              </div>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-indigo-100 text-indigo-800">
              Default: Autonomous
            </span>
          </div>

          <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-indigo-200/60 shadow-xs">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-900">
                Trigger Autonomous Reminders on Excel Upload
              </span>
              <p className="text-[11px] text-slate-500 max-w-xl">
                When enabled, uploading a daily SAP dues export automatically identifies due/overdue accounts and dispatches consolidated digests via WhatsApp, SMS, and Email to all eligible contacts without manual intervention.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={schedule.autoReminderEnabled}
                onChange={(e) =>
                  setSchedule({ ...schedule, autoReminderEnabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        {/* SECTION 2: MULTI-TENANT WHITE-LABELING & BANK DETAILS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">Organization & White-Label Branding</h3>
                <p className="text-[11px] text-slate-500">
                  {isAdmin
                    ? 'Administrator Access: Configure white-labeling, bank accounts, and onboard client organizations.'
                    : `Active Organization: ${tenant.companyName}. Multi-tenant settings are restricted to Administrators.`}
                </p>
              </div>
            </div>

            {isAdmin ? (
              <button
                type="button"
                onClick={() => setShowNewTenantModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" /> Onboard New Organization
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">
                Tenant: {tenant.companyName} (Admin Managed)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Company Display Name *</label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                value={tenant.companyName || ''}
                onChange={(e) => setTenant({ ...tenant, companyName: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Appears in header and reminder copy</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Brand Theme Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  disabled={!isAdmin}
                  value={tenant.brandColor || '#4f46e5'}
                  onChange={(e) => setTenant({ ...tenant, brandColor: e.target.value })}
                  className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={tenant.brandColor || '#4f46e5'}
                  onChange={(e) => setTenant({ ...tenant, brandColor: e.target.value })}
                  className="w-28 text-xs font-mono px-3 py-2 rounded-xl border border-slate-300 font-semibold disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
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
                  disabled={!isAdmin}
                  value={tenant.bankName || ''}
                  onChange={(e) => setTenant({ ...tenant, bankName: e.target.value })}
                  placeholder="e.g. HDFC Bank"
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Account Number</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={tenant.bankAccountNo || ''}
                  onChange={(e) => setTenant({ ...tenant, bankAccountNo: e.target.value })}
                  placeholder="e.g. 50200012345678"
                  className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">IFSC Code</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={tenant.bankIfscCode || ''}
                  onChange={(e) => setTenant({ ...tenant, bankIfscCode: e.target.value })}
                  placeholder="e.g. HDFC0001234"
                  className="w-full text-xs font-mono uppercase px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">UPI ID (VPA)</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={tenant.bankUpiId || ''}
                  onChange={(e) => setTenant({ ...tenant, bankUpiId: e.target.value })}
                  placeholder="e.g. abmato@hdfcbank"
                  className="w-full text-xs font-mono px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: AUTOMATED REMINDER CADENCE & DEFAULTER RULES */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">Cadence Timeline & Defaulter Trigger Rules</h3>
              <p className="text-[11px] text-slate-500">Intervals calculated relative to Invoice Due Date (T)</p>
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
              <span className="font-bold">Automatic Defaulter Flagging:</span> Automatically flags customer as{' '}
              <strong className="underline">FLAGGED</strong> after{' '}
              <strong>{schedule.maxRemindersBeforeFlag} consecutive reminder attempts</strong> without receipt of payment.
            </div>
          </div>
        </div>

        {/* SECTION 4: GATEWAY INTEGRATIONS & PROVIDERS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">Messaging Platforms & Gateways</h3>
                <p className="text-[11px] text-slate-500">
                  Configure real production API credentials or direct test sandbox routing
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900">
            <div className="font-bold">🧪 Gateway Channels & Status:</div>
            <div className="mt-1 flex flex-wrap gap-4 font-mono text-[11px]">
              <span>WhatsApp: <strong className="text-emerald-700">{waConfig.providerName}</strong> ({waConfig.isSandbox ? 'Sandbox' : 'Production'})</span>
              <span>SMS: <strong className="text-indigo-700">{smsConfig.providerName}</strong> ({smsConfig.isSandbox ? 'Sandbox' : 'Production'})</span>
              <span>Email: <strong className="text-sky-700">{emailConfig.providerName}</strong> ({emailConfig.isSandbox ? 'Sandbox' : 'Production'})</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* WHATSAPP */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-4 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <MessageSquare className="w-4 h-4 text-emerald-600" /> WhatsApp
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                  {waConfig.isSandbox ? 'Sandbox' : 'Production'}
                </span>
              </div>

              <div className="text-xs space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Provider</label>
                  <select
                    value={waConfig.providerName}
                    onChange={(e) => setWaConfig({ ...waConfig, providerName: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="META_CLOUD_API">Meta WhatsApp Cloud API</option>
                    <option value="TWILIO">Twilio WhatsApp API</option>
                    <option value="AISENSY">AiSensy API</option>
                    <option value="GUPSHUP">Gupshup Enterprise</option>
                    <option value="SIMULATOR">Sandbox Simulator (wa.me)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-slate-600 font-semibold">Sandbox Test Mode</span>
                  <input
                    type="checkbox"
                    checked={waConfig.isSandbox}
                    onChange={(e) => setWaConfig({ ...waConfig, isSandbox: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                </div>

                {waConfig.providerName === 'META_CLOUD_API' && (
                  <>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-semibold">Access Token</label>
                      <input
                        type="password"
                        value={waConfig.accessToken || ''}
                        onChange={(e) => setWaConfig({ ...waConfig, accessToken: e.target.value })}
                        placeholder="EAAB..."
                        className="w-full text-xs p-2 rounded border border-slate-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-semibold">Phone Number ID</label>
                      <input
                        type="text"
                        value={waConfig.phoneNumberId || ''}
                        onChange={(e) => setWaConfig({ ...waConfig, phoneNumberId: e.target.value })}
                        placeholder="1049284..."
                        className="w-full text-xs p-2 rounded border border-slate-300 bg-white font-mono"
                      />
                    </div>
                  </>
                )}

                {waConfig.providerName === 'TWILIO' && (
                  <>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-semibold">Account SID</label>
                      <input
                        type="text"
                        value={waConfig.accountSid || ''}
                        onChange={(e) => setWaConfig({ ...waConfig, accountSid: e.target.value })}
                        placeholder="AC..."
                        className="w-full text-xs p-2 rounded border border-slate-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-semibold">Auth Token</label>
                      <input
                        type="password"
                        value={waConfig.authToken || ''}
                        onChange={(e) => setWaConfig({ ...waConfig, authToken: e.target.value })}
                        placeholder="••••"
                        className="w-full text-xs p-2 rounded border border-slate-300 bg-white font-mono"
                      />
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => handleTestGateway('WHATSAPP')}
                  disabled={testTesting === 'WHATSAPP'}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  {testTesting === 'WHATSAPP' ? 'Testing WhatsApp...' : 'Test WhatsApp'}
                </button>
              </div>
            </div>

            {/* SMS */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-4 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <Smartphone className="w-4 h-4 text-indigo-600" /> SMS DLT
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-indigo-100 text-indigo-800">
                  {smsConfig.isSandbox ? 'Sandbox' : 'Production'}
                </span>
              </div>

              <div className="text-xs space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Provider</label>
                  <select
                    value={smsConfig.providerName}
                    onChange={(e) => setSmsConfig({ ...smsConfig, providerName: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="FAST2SMS">Fast2SMS (Indian DLT)</option>
                    <option value="TWILIO">Twilio SMS</option>
                    <option value="MSG91">MSG91 Flow API</option>
                    <option value="SIMULATOR">Sandbox Simulator (sms:)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-slate-600 font-semibold">Sandbox Test Mode</span>
                  <input
                    type="checkbox"
                    checked={smsConfig.isSandbox}
                    onChange={(e) => setSmsConfig({ ...smsConfig, isSandbox: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </div>

                {smsConfig.providerName === 'FAST2SMS' && (
                  <>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-semibold">Fast2SMS API Key</label>
                      <input
                        type="password"
                        value={smsConfig.apiKey || ''}
                        onChange={(e) => setSmsConfig({ ...smsConfig, apiKey: e.target.value })}
                        placeholder="••••••••••••••••"
                        className="w-full text-xs p-2 rounded border border-slate-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-semibold">Sender ID</label>
                      <input
                        type="text"
                        value={smsConfig.senderId || ''}
                        onChange={(e) => setSmsConfig({ ...smsConfig, senderId: e.target.value })}
                        placeholder="ABMATO"
                        className="w-full text-xs p-2 rounded border border-slate-300 bg-white font-mono uppercase"
                      />
                    </div>
                  </>
                )}

                {smsConfig.providerName === 'TWILIO' && (
                  <>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-semibold">Account SID</label>
                      <input
                        type="text"
                        value={smsConfig.accountSid || ''}
                        onChange={(e) => setSmsConfig({ ...smsConfig, accountSid: e.target.value })}
                        placeholder="AC..."
                        className="w-full text-xs p-2 rounded border border-slate-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-semibold">From Number</label>
                      <input
                        type="text"
                        value={smsConfig.fromNumber || ''}
                        onChange={(e) => setSmsConfig({ ...smsConfig, fromNumber: e.target.value })}
                        placeholder="+1234567890"
                        className="w-full text-xs p-2 rounded border border-slate-300 bg-white font-mono"
                      />
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => handleTestGateway('SMS')}
                  disabled={testTesting === 'SMS'}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  {testTesting === 'SMS' ? 'Testing SMS...' : 'Test SMS Gateway'}
                </button>
              </div>
            </div>

            {/* EMAIL */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-4 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <Mail className="w-4 h-4 text-sky-600" /> Email SMTP
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-sky-100 text-sky-800">
                  {emailConfig.isSandbox ? 'Sandbox' : 'Production'}
                </span>
              </div>

              <div className="text-xs space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Provider</label>
                  <select
                    value={emailConfig.providerName}
                    onChange={(e) => setEmailConfig({ ...emailConfig, providerName: e.target.value })}
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="SMTP">SMTP (Gmail / cPanel / Postfix)</option>
                    <option value="RESEND">Resend API</option>
                    <option value="SIMULATOR">Sandbox Simulator (mailto:)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-[11px] text-slate-600 font-semibold">Sandbox Test Mode</span>
                  <input
                    type="checkbox"
                    checked={emailConfig.isSandbox}
                    onChange={(e) => setEmailConfig({ ...emailConfig, isSandbox: e.target.checked })}
                    className="w-4 h-4 text-sky-600 rounded"
                  />
                </div>

                {emailConfig.providerName === 'SMTP' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold">SMTP Host</label>
                        <input
                          type="text"
                          value={emailConfig.host || ''}
                          onChange={(e) => setEmailConfig({ ...emailConfig, host: e.target.value })}
                          placeholder="smtp.gmail.com"
                          className="w-full text-xs p-2 rounded border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-semibold">Port</label>
                        <input
                          type="number"
                          value={emailConfig.port || 587}
                          onChange={(e) => setEmailConfig({ ...emailConfig, port: Number(e.target.value) })}
                          className="w-full text-xs p-2 rounded border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-semibold">User / Email</label>
                      <input
                        type="text"
                        value={emailConfig.user || ''}
                        onChange={(e) => setEmailConfig({ ...emailConfig, user: e.target.value })}
                        placeholder="billing@company.com"
                        className="w-full text-xs p-2 rounded border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 font-semibold">App Password</label>
                      <input
                        type="password"
                        value={emailConfig.pass || ''}
                        onChange={(e) => setEmailConfig({ ...emailConfig, pass: e.target.value })}
                        placeholder="••••••••••••••••"
                        className="w-full text-xs p-2 rounded border border-slate-300 bg-white font-mono"
                      />
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => handleTestGateway('EMAIL')}
                  disabled={testTesting === 'EMAIL'}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-sky-600 text-white font-bold text-xs hover:bg-sky-700 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  {testTesting === 'EMAIL' ? 'Testing Email...' : 'Test Email SMTP'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Onboard New Tenant Modal (Strictly Admin only) */}
      {isAdmin && showNewTenantModal && (
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

            <form onSubmit={handleCreateNewTenant} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tenant Organization Slug *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. acme-machinery"
                  value={newTenantForm.slug}
                  onChange={(e) => setNewTenantForm({ ...newTenantForm, slug: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Used as isolated database partition key</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Company Display Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Machinery Solutions Pvt Ltd"
                  value={newTenantForm.companyName}
                  onChange={(e) => setNewTenantForm({ ...newTenantForm, companyName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g. ICICI Bank"
                    value={newTenantForm.bankName}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, bankName: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account No</label>
                  <input
                    type="text"
                    placeholder="e.g. 000105001234"
                    value={newTenantForm.bankAccountNo}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, bankAccountNo: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    placeholder="e.g. ICIC0000001"
                    value={newTenantForm.bankIfscCode}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, bankIfscCode: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">UPI ID (VPA)</label>
                  <input
                    type="text"
                    placeholder="e.g. acme@icici"
                    value={newTenantForm.bankUpiId}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, bankUpiId: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewTenantModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTenant}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition disabled:opacity-50"
                >
                  {creatingTenant ? 'Provisioning...' : 'Provision Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
