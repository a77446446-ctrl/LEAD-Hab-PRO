'use client';

import { useEffect, useState } from 'react';
import { Check, CreditCard, Loader2, Wallet } from 'lucide-react';

type CategoryPlan = { id: string; name: string; subscriptionPrice: number; days: number };

export function PaymentCenter() {
  const [plans, setPlans] = useState<CategoryPlan[]>([]);
  const [presets, setPresets] = useState<number[]>([]);
  const [amount, setAmount] = useState(500);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/payments/plans', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Не удалось загрузить тарифы');
        return response.json() as Promise<{ categories: CategoryPlan[]; topupPresets: number[] }>;
      })
      .then((data) => { 
        setPlans(data.categories.map(c => ({ ...c, subscriptionPrice: c.subscriptionPrice / 100 }))); 
        setPresets(data.topupPresets); 
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Ошибка тарифов'));
  }, []);

  const pay = async (payload: { kind: 'TOPUP' | 'SUBSCRIPTION'; amount?: number; categoryId?: string }, key: string) => {
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Укажите email для электронного чека'); return; }
    setBusy(key); setError('');
    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, receiptEmail: email, clientRequestId: crypto.randomUUID() }),
      });
      const data = await response.json() as { confirmationUrl?: string | null; error?: string };
      if (!response.ok || !data.confirmationUrl) throw new Error(data.error || 'ЮKassa не вернула ссылку оплаты');
      window.location.assign(data.confirmationUrl);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка оплаты'); setBusy(''); }
  };

  return <div className="space-y-8">
    <div><h2 className="text-2xl font-black uppercase">Баланс и PRO</h2><p className="mt-2 text-sm font-bold uppercase text-[#666]">Безопасная оплата на странице ЮKassa</p></div>
    {error && <div className="border border-red-700 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    <label className="block space-y-2"><span className="text-sm font-black uppercase">Email для чека</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.ru" className="w-full border border-black bg-white px-4 py-3 outline-none focus:shadow-[3px_3px_0_0_#000]" /></label>

    <section className="glass-panel border-black p-6">
      <div className="mb-5 flex items-center gap-3"><Wallet /><h3 className="text-xl font-black uppercase">Пополнить баланс</h3></div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{presets.map((value) => <button key={value} onClick={() => setAmount(value)} className={`border border-black p-3 font-black ${amount === value ? 'bg-accent' : 'bg-white'}`}>{value} ₽</button>)}</div>
      <div className="flex gap-3"><input type="number" min={100} max={100000} value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="min-w-0 flex-1 border border-black px-4 py-3" /><button disabled={Boolean(busy)} onClick={() => void pay({ kind: 'TOPUP', amount: Math.round(amount * 100) }, 'topup')} className="neon-button flex min-w-40 items-center justify-center gap-2">{busy === 'topup' ? <Loader2 className="animate-spin" /> : <CreditCard />} Оплатить</button></div>
    </section>

    <section className="space-y-5"><h3 className="text-xl font-black uppercase">PRO по категориям</h3>{plans.length === 0 ? <p className="text-sm text-zinc-600">Активные PRO-тарифы пока не настроены администратором.</p> : plans.map((plan) => <div key={plan.id} className="glass-panel border-black p-6"><div className="flex items-start justify-between gap-4"><div><h4 className="text-lg font-black uppercase">{plan.name} PRO</h4><p className="mt-1 text-3xl font-black">{plan.subscriptionPrice} ₽ <span className="text-sm text-zinc-600">/ {plan.days} дней</span></p></div><div className="border border-black bg-accent p-3"><Check /></div></div><p className="my-5 text-sm font-bold">Доступ к лидам категории без отдельной оплаты на срок подписки.</p><button disabled={Boolean(busy)} onClick={() => void pay({ kind: 'SUBSCRIPTION', categoryId: plan.id }, plan.id)} className="neon-button flex w-full items-center justify-center gap-2">{busy === plan.id ? <Loader2 className="animate-spin" /> : <CreditCard />} Активировать PRO</button></div>)}</section>
    <p className="text-xs leading-5 text-zinc-500">Нажимая «Оплатить», вы переходите на защищённую страницу ЮKassa. Зачисление выполняется только после серверного подтверждения платежа.</p>
  </div>;
}
