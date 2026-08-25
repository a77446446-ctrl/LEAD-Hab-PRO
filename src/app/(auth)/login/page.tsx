'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
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
async function destinationAfterLegal(user: User, destination: string): Promise<string> {
  if (user.role === 'admin') return destination;
  const response = await fetch('/api/legal/acceptance', { cache: 'no-store' });
  if (!response.ok) throw new Error('Не удалось проверить документы');
  const acceptance = await response.json() as { accepted?: boolean };
  return acceptance.accepted ? destination : `/consent?next=${encodeURIComponent(destination)}`;
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
      .then(async (profile) => {
        if (!profile) return;
        const destination = startDestination(window.WebApp?.initData);
        const target = await destinationAfterLegal(profile, destination);
        setUser(profile);
        router.replace(target);
      })
      .catch(() => setError('Не удалось проверить текущую сессию'))
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
      const destination = startDestination(initData);
      const target = await destinationAfterLegal(data.user, destination);
      setUser(data.user);
      router.replace(target);
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
        <a
          href="/api/auth/max-link"
          className="flex w-full items-center justify-center gap-2 border-2 border-black bg-white py-3 text-xs font-black uppercase tracking-wider text-black transition-colors hover:bg-zinc-100"
        >
          <ExternalLink size={16} /> Открыть приложение в MAX Web
        </a>
        <p className="text-center text-xs font-medium leading-relaxed text-zinc-600">MAX пока не предоставляет OAuth-вход с возвратом на отдельный сайт. В браузере приложение открывается через веб-версию MAX.</p>
      </div>
    </div>
  );
}
