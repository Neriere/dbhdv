import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';

interface ToastData {
  id: number;
  message: string;
  subtext?: string;
}

export const GlobalToast: React.FC = () => {
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    let timer: any = null;

    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; subtext?: string }>;
      if (!customEvent.detail?.message) return;

      if (timer) clearTimeout(timer);
      setToast({
        id: Date.now(),
        message: customEvent.detail.message,
        subtext: customEvent.detail.subtext,
      });

      timer = setTimeout(() => {
        setToast(null);
      }, 2400);
    };

    window.addEventListener('dofus_toast', handleToast);
    return () => {
      window.removeEventListener('dofus_toast', handleToast);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed bottom-12 right-6 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="bg-slate-900/95 border border-amber-500/40 shadow-2xl shadow-amber-500/10 rounded-xl px-4 py-2.5 flex items-center gap-3 backdrop-blur-md max-w-sm pointer-events-auto">
        <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30">
          <Check className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-white truncate leading-tight">
            {toast.message}
          </p>
          {toast.subtext && (
            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
              {toast.subtext}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
