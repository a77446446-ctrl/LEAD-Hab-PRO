'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/store/useUser';
import type { User } from '@/types';
function startDestination(initData?: string): string {
  const startParam = initData ? new URLSearchParams(initData).get('start_param') : null;
  const fallbackParam = typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get('WebAppStartParam');
  const payload = startParam || fallbackParam || '';
  const match = /^(lead|purchase)_([0-9a-f]{8}-[0-9a-f-]{27,36})$/i.exec(payload);
  if (!match) return '/dashboard';
  const leadId = encodeURIComponent(match[2]);
  return match[1] === 'purchase' ? `/my-leads?lead=${leadId}` : `/dashboard?lead=${leadId}`;
}

export default function LoginPage() {
  const router = useRouter();
  const setUser = useUser((state) => state.setUser);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    window.WebApp?.ready?.();
    window.WebApp?.expand?.();

    fetch('/api/profile', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<User>;
      })
      .then((profile) => {
        if (!profile) return;
        setUser(profile);
        router.replace(startDestination(window.WebApp?.initData));
      })
      .finally(() => setCheckingSession(false));
  }, [router, setUser]);

  const authenticate = async () => {
    setError('');
    const initData = window.WebApp?.initData;
    if (!initData) {
      setError('Откройте приложение кнопкой из официального бота MAX.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/max', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      });
      const data = await response.json() as { user?: User; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error || 'Не удалось войти через MAX');
      setUser(data.user);
      router.replace(startDestination(initData));
      router.refresh();
    } catch (authenticationError) {
      setError(authenticationError instanceof Error ? authenticationError.message : 'Не удалось войти через MAX');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col items-center justify-between p-6 overflow-hidden relative font-sans">
      <div className="pt-10 flex items-center justify-center">
        <div className="flex items-center">
          <div className="bg-black text-white px-3 py-1.5 text-[32px] font-black tracking-tighter leading-none">ПО</div>
          <div className="bg-accent text-black px-3 py-1.5 text-[32px] font-black tracking-tighter leading-none">ДЕЛАМ</div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-sm flex items-center justify-center my-6">
        <img
          src="/hero-illustration.jpg"
          alt="Мастера сервиса ПО ДЕЛАМ"
          className="w-full h-auto object-contain mix-blend-multiply"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
        />
      </div>

      <div className="w-full max-w-sm space-y-4 pb-6 relative z-10">
        <div className="bg-white border-2 border-black p-6 space-y-4">
          <h1 className="text-black font-black text-lg uppercase tracking-tight leading-tight">Ваш агрегатор заказов</h1>
          <p className="text-[#555] text-sm font-medium leading-relaxed">
            Получайте свежие заявки на ремонт, строительство и бытовые услуги. Профиль создаётся автоматически по вашему цифровому ID MAX.
          </p>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 border-2 border-red-600 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={authenticate}
          disabled={loading || checkingSession}
          className="w-full bg-accent text-black border-2 border-black py-4 text-sm font-black uppercase tracking-widest hover:bg-[#F2FF00] disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {(loading || checkingSession) && <Loader2 size={18} className="animate-spin" />}
          {checkingSession ? 'Проверяем сессию' : loading ? 'Входим через MAX' : 'Начать работу'}
        </button>
      </div>
    </div>
  );
}
