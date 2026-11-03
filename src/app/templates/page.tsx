'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Smartphone, Mail, Save, Sparkles, Check, Globe } from 'lucide-react';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<'WHATSAPP' | 'SMS' | 'EMAIL'>('EMAIL');
  const [selectedLanguage, setSelectedLanguage] = useState<'ALL' | 'English' | 'Hindi' | 'Marathi'>('ALL');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [bodyText, setBodyText] = useState('');
  const [subjectText, setSubjectText] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const variables = [
    { label: 'Customer Name', tag: '{{customer_name}}' },
    { label: 'Contact Person', tag: '{{contact_person}}' },
    { label: 'Due Amount', tag: '{{due_amount}}' },
    { label: 'Due Date', tag: '{{due_date}}' },
    { label: 'Days Overdue', tag: '{{days_overdue}}' },
    { label: 'Company Name', tag: '{{company_name}}' },
    { label: 'Bank Details', tag: '{{company_bank_details}}' },
    { label: 'Remaining Due', tag: '{{remaining_balance}}' },
    { label: 'Next Installment', tag: '{{next_installment_date}}' },
  ];

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.success && Array.isArray(data.templates)) {
        setTemplates(data.templates);
        // Find matching template
        const match = data.templates.find(
          (t: any) =>
            t.channel === selectedChannel &&
            (selectedLanguage === 'ALL' || t.language === selectedLanguage)
        ) || data.templates.find((t: any) => t.channel === selectedChannel);

        if (match) {
          setSelectedTemplate(match);
          setBodyText(match.templateBody);
          setSubjectText(match.subject || '');
          setTemplateName(match.name);
        }
      }
    } catch (e) {
      console.error('Error fetching templates:', e);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleChannelSwitch = (channel: 'WHATSAPP' | 'SMS' | 'EMAIL') => {
    setSelectedChannel(channel);
    const match =
      templates.find(
        (t) =>
          t.channel === channel &&
          (selectedLanguage === 'ALL' || t.language === selectedLanguage)
      ) || templates.find((t) => t.channel === channel);

    if (match) {
      setSelectedTemplate(match);
      setBodyText(match.templateBody);
      setSubjectText(match.subject || '');
      setTemplateName(match.name);
    }
  };

  const handleLanguageSwitch = (lang: 'ALL' | 'English' | 'Hindi' | 'Marathi') => {
    setSelectedLanguage(lang);
    const match =
      templates.find(
        (t) =>
          t.channel === selectedChannel &&
          (lang === 'ALL' || t.language === lang)
      ) || templates.find((t) => t.channel === selectedChannel);

    if (match) {
      setSelectedTemplate(match);
      setBodyText(match.templateBody);
      setSubjectText(match.subject || '');
      setTemplateName(match.name);
    }
  };

  const handleSelectTemplate = (t: any) => {
    setSelectedTemplate(t);
    setBodyText(t.templateBody);
    setSubjectText(t.subject || '');
    setTemplateName(t.name);
  };

  const insertVariable = (tag: string) => {
    setBodyText((prev) => prev + ' ' + tag);
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;
    try {
      setSaving(true);
      const res = await fetch('/api/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTemplate.id,
          name: templateName,
          subject: subjectText || undefined,
          templateBody: bodyText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg(`Template "${templateName}" saved successfully!`);
        fetchTemplates();
        setTimeout(() => setSaveMsg(null), 3500);
      }
    } catch (e: any) {
      alert('Error: ' + e?.message);
    } finally {
      setSaving(false);
    }
  };

  // Live preview mockup data with multilingual values
  const renderPreview = (text: string) => {
    return (text || '')
      .replace(/\{\{\s*customer_name\s*\}\}/g, 'PARASON MACHINERY PVT LTD')
      .replace(/\{\{\s*contact_person\s*\}\}/g, 'Mr. Amit Sharma')
      .replace(/\{\{\s*due_amount\s*\}\}/g, '49,317')
      .replace(/\{\{\s*remaining_balance\s*\}\}/g, '49,317')
      .replace(/\{\{\s*due_date\s*\}\}/g, '15-Nov-2026')
      .replace(/\{\{\s*days_overdue\s*\}\}/g, '7')
      .replace(/\{\{\s*company_name\s*\}\}/g, 'Abhiyadna Machine Tools')
      .replace(/\{\{\s*company_bank_details\s*\}\}/g, 'HDFC Bank, A/C: 50200012345678, IFSC: HDFC0001234')
      .replace(/\{\{\s*next_installment_date\s*\}\}/g, '30-Nov-2026')
      .replace(/\{\{\s*last_payment_amount\s*\}\}/g, '25,000');
  };

  const filteredTemplates = templates.filter((t) => {
    if (t.channel !== selectedChannel) return false;
    if (selectedLanguage !== 'ALL' && t.language !== selectedLanguage) return false;
    return true;
  });

  const getLanguageBadgeColor = (lang: string) => {
    switch (lang) {
      case 'Hindi':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Marathi':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      default:
        return 'bg-sky-100 text-sky-800 border-sky-300';
    }
  };

  return (
    <main className="p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-amber-500" />
            Message Template Designer
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pre-written editable templates in English, Hindi, and Marathi for Mail, Text SMS, and WhatsApp.
          </p>
        </div>

        {/* Channel Switcher */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold shadow-xs">
          <button
            onClick={() => handleChannelSwitch('EMAIL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              selectedChannel === 'EMAIL' ? 'bg-sky-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Mail className="w-3.5 h-3.5" /> Mail (Email)
          </button>
          <button
            onClick={() => handleChannelSwitch('SMS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              selectedChannel === 'SMS' ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Text SMS
          </button>
          <button
            onClick={() => handleChannelSwitch('WHATSAPP')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              selectedChannel === 'WHATSAPP' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
          </button>
        </div>
      </div>

      {/* Language Filter Bar */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2 rounded-xl">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-slate-500 ml-2" />
          <span className="text-xs font-bold text-slate-700">Language:</span>
          <div className="flex items-center gap-1">
            {(['ALL', 'English', 'Hindi', 'Marathi'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => handleLanguageSwitch(lang)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  selectedLanguage === lang
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                {lang === 'ALL' ? 'All Languages' : lang === 'Hindi' ? 'हिंदी (Hindi)' : lang === 'Marathi' ? 'मराठी (Marathi)' : 'English'}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-slate-500 font-medium mr-2">
          {filteredTemplates.length} template(s) available
        </div>
      </div>

      {saveMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{saveMsg}</span>
        </div>
      )}

      {/* Editor & Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Preset Templates List */}
        <div className="lg:col-span-4 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {selectedChannel} Templates ({selectedLanguage === 'ALL' ? 'All' : selectedLanguage})
          </h3>
          <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1">
            {filteredTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectTemplate(t)}
                className={`w-full text-left p-3 rounded-xl border text-xs transition ${
                  selectedTemplate?.id === t.id
                    ? 'border-indigo-600 bg-indigo-50/50 font-bold text-indigo-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getLanguageBadgeColor(t.language)}`}>
                    {t.language}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {t.category}
                  </span>
                </div>
                <div className="truncate font-semibold text-slate-900">{t.name}</div>
                {t.subject && (
                  <div className="text-[10px] text-slate-500 truncate mt-1">
                    Sub: {t.subject}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Center Column: Template Body Editor */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">Template Name</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="w-full text-xs font-bold text-slate-900 p-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 mt-4 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm transition"
            >
              <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>

          {selectedChannel === 'EMAIL' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Subject Line</label>
              <input
                type="text"
                value={subjectText}
                onChange={(e) => setSubjectText(e.target.value)}
                placeholder="e.g. Payment Reminder for {{customer_name}}"
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          )}

          {/* Insertable Dynamic Tag Pills */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-500" /> Click to Insert Placeholder Variable:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {variables.map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => insertVariable(v.tag)}
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-slate-700 transition"
                >
                  +{v.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Template Content ({selectedTemplate?.language || 'English'})
            </label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={12}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
            />
          </div>

          {selectedChannel === 'SMS' && (
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Supports Unicode (Hindi / Marathi) SMS segments</span>
              <span>
                Length: {bodyText.length} chars ({Math.max(1, Math.ceil(bodyText.length / 70))} segment)
              </span>
            </div>
          )}
        </div>

        {/* Right Column: Live Mobile / Delivery Simulation Preview */}
        <div className="lg:col-span-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Live Mockup Preview
            </h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getLanguageBadgeColor(selectedTemplate?.language || 'English')}`}>
              {selectedTemplate?.language || 'English'}
            </span>
          </div>

          <div className="bg-slate-100 p-4 rounded-3xl border border-slate-200 shadow-inner min-h-[500px] flex flex-col justify-start">
            {selectedChannel === 'WHATSAPP' && (
              <div className="bg-[#e5ddd5] p-3 rounded-2xl shadow-sm border border-slate-300 flex-1 flex flex-col justify-end space-y-2">
                <div className="text-[10px] text-center text-slate-500 uppercase font-semibold">Today</div>
                <div className="bg-white p-3.5 rounded-2xl rounded-tr-none shadow-sm text-xs leading-relaxed max-w-[95%] self-end border border-emerald-100">
                  <div className="whitespace-pre-line text-slate-800">
                    {renderPreview(bodyText)}
                  </div>
                  <div className="text-[10px] text-slate-400 text-right mt-1 flex items-center justify-end gap-1">
                    <span>10:30 AM</span>
                    <span className="text-sky-500 font-bold">✓✓</span>
                  </div>
                </div>
              </div>
            )}

            {selectedChannel === 'SMS' && (
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col justify-end">
                <div className="bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-none text-xs leading-relaxed max-w-[90%] self-end">
                  <div className="whitespace-pre-line">
                    {renderPreview(bodyText)}
                  </div>
                  <div className="text-[9px] text-indigo-200 text-right mt-1">Delivered • SMS</div>
                </div>
              </div>
            )}

            {selectedChannel === 'EMAIL' && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex-1 text-xs space-y-3 overflow-y-auto max-h-[520px]">
                <div className="border-b border-slate-100 pb-2">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Subject:</div>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{renderPreview(subjectText || 'Payment Reminder')}</div>
                </div>
                <div className="text-slate-700 leading-relaxed text-xs whitespace-pre-line font-sans">
                  {renderPreview(bodyText)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
