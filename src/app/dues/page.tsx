'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DuesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="w-7 h-7 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-slate-500">Redirecting to Dashboard & Receivables...</span>
      </div>
    </div>
  );
}
