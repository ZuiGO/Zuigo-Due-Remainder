'use client';

/**
 * Lightweight UI language support (English / Hindi / Marathi) for the operator
 * interface. Covers the daily-loop surface: navigation, page titles, headline
 * actions, and KPI labels. Customer-facing message content is translated
 * separately per customer preference (see digest-engine).
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

export type UiLang = 'en' | 'hi' | 'mr';

const STORAGE_KEY = 'zuigo_ui_lang';

const DICT: Record<string, { en: string; hi: string; mr: string }> = {
  // Navigation
  'nav.dashboard': { en: 'Dashboard', hi: 'डैशबोर्ड', mr: 'डॅशबोर्ड' },
  'nav.customers': { en: 'Customer Contacts', hi: 'ग्राहक संपर्क', mr: 'ग्राहक संपर्क' },
  'nav.templates': { en: 'Message Templates', hi: 'संदेश टेम्पलेट', mr: 'संदेश टेम्पलेट' },
  'nav.history': { en: 'Reminder History', hi: 'रिमाइंडर इतिहास', mr: 'स्मरणपत्र इतिहास' },
  'nav.settings': { en: 'Settings', hi: 'सेटिंग्स', mr: 'सेटिंग्ज' },
  'nav.workspace': { en: 'Workspace', hi: 'वर्कस्पेस', mr: 'वर्कस्पेस' },

  // Page titles (header bar)
  'title.dashboard': { en: 'Dashboard & Receivables Overview', hi: 'डैशबोर्ड और बकाया अवलोकन', mr: 'डॅशबोर्ड आणि थकबाकी आढावा' },
  'title.customers': { en: 'Customer Contacts Directory', hi: 'ग्राहक संपर्क निर्देशिका', mr: 'ग्राहक संपर्क यादी' },
  'title.templates': { en: 'Message Templates', hi: 'संदेश टेम्पलेट', mr: 'संदेश टेम्पलेट' },
  'title.history': { en: 'Reminder History & Audit Logs', hi: 'रिमाइंडर इतिहास और ऑडिट लॉग', mr: 'स्मरणपत्र इतिहास आणि ऑडिट नोंदी' },
  'title.settings': { en: 'Settings', hi: 'सेटिंग्स', mr: 'सेटिंग्ज' },
  'breadcrumb.app': { en: 'Payment Follow-up Automation', hi: 'भुगतान फॉलो-अप ऑटोमेशन', mr: 'पेमेंट फॉलो-अप ऑटोमेशन' },

  // Headline actions
  'action.refresh': { en: 'Refresh Data', hi: 'डेटा रीफ्रेश करें', mr: 'डेटा रिफ्रेश करा' },
  'action.uploadExcel': { en: 'Upload Excel Files', hi: 'एक्सेल फ़ाइल अपलोड करें', mr: 'एक्सेल फाईल अपलोड करा' },
  'action.sendReminders': { en: 'Send Reminders', hi: 'रिमाइंडर भेजें', mr: 'स्मरणपत्र पाठवा' },

  // KPI cards
  'kpi.totalBill': { en: 'Total Bill Amount', hi: 'कुल बिल राशि', mr: 'एकूण बिल रक्कम' },
  'kpi.totalOutstanding': { en: 'Total Outstanding', hi: 'कुल बकाया', mr: 'एकूण थकबाकी' },
  'kpi.paidAdjusted': { en: 'Paid / Adjusted', hi: 'भुगतान / समायोजित', mr: 'भरलेले / समायोजित' },
  'kpi.actionableOverdue': { en: 'Actionable Overdue', hi: 'कार्रवाई योग्य बकाया', mr: 'कारवाईयोग्य थकीत' },

  // Daily diff section
  'diff.title': { en: 'What Changed Since Yesterday', hi: 'कल से क्या बदला', mr: 'कालपासून काय बदलले' },
  'diff.badge': { en: 'Daily Excel Comparison', hi: 'दैनिक एक्सेल तुलना', mr: 'दैनंदिन एक्सेल तुलना' },

  // Send Reminders modal
  'queue.title': { en: 'Send Reminders', hi: 'रिमाइंडर भेजें', mr: 'स्मरणपत्र पाठवा' },
  'queue.subtitle': { en: 'Review before sending', hi: 'भेजने से पहले जाँचें', mr: 'पाठवण्यापूर्वी तपासा' },
  'queue.help': {
    en: 'Check the list below, then press Approve & Send. Customers without phone or email are automatically held back.',
    hi: 'नीचे की सूची जाँचें, फिर "स्वीकृत करें और भेजें" दबाएँ। बिना फ़ोन/ईमेल वाले ग्राहक अपने आप रोक दिए जाते हैं।',
    mr: 'खालील यादी तपासा आणि "मंजूर करून पाठवा" दाबा. फोन/ईमेल नसलेले ग्राहक आपोआप थांबवले जातात.',
  },

  // Getting started checklist
  'start.title': { en: 'Getting Started — 3 Easy Steps', hi: 'शुरुआत करें — 3 आसान चरण', mr: 'सुरुवात करा — ३ सोप्या पायऱ्या' },
  'start.step1': { en: 'Upload your Customer Contacts Excel', hi: 'ग्राहक संपर्क एक्सेल अपलोड करें', mr: 'ग्राहक संपर्क एक्सेल अपलोड करा' },
  'start.step2': { en: "Upload today's Outstanding Receivable export from SAP", hi: 'SAP से आज की बकाया (Outstanding) फ़ाइल अपलोड करें', mr: 'SAP मधून आजची थकबाकी (Outstanding) फाईल अपलोड करा' },
  'start.step3': { en: 'Open Send Reminders, review, and approve', hi: '"रिमाइंडर भेजें" खोलें, जाँचें और स्वीकृत करें', mr: '"स्मरणपत्र पाठवा" उघडा, तपासा आणि मंजूर करा' },
  'start.cta': { en: 'Upload your first file', hi: 'पहली फ़ाइल अपलोड करें', mr: 'पहिली फाईल अपलोड करा' },
};

interface LangContextValue {
  lang: UiLang;
  setLang: (l: UiLang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => DICT[key]?.en ?? key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<UiLang>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as UiLang | null;
      if (saved === 'en' || saved === 'hi' || saved === 'mr') setLangState(saved);
    } catch {}
  }, []);

  const setLang = (l: UiLang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
  };

  const t = (key: string) => DICT[key]?.[lang] ?? DICT[key]?.en ?? key;

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useUiLang() {
  return useContext(LangContext);
}
