'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, CreditCard, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  type: 'TOPUP' | 'BUY' | 'REFUND';
  amount: string;
  createdAt: string;
  user: {
    name: string;
    maxId: string;
  };
}

function transactionLabel(type: Transaction['type']) {
  if (type === 'TOPUP') return 'Пополнение';
  if (type === 'BUY') return 'Покупка лида';
  return 'Возврат';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU');
}

function TransactionIcon({ type }: { type: Transaction['type'] }) {
  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border',
        type === 'TOPUP'
          ? 'border-green-800 bg-green-900/30 text-green-400'
          : type === 'BUY'
            ? 'border-accent/50 bg-accent/10 text-accent'
            : 'border-red-800 bg-red-900/30 text-red-400',
      )}
    >
      {type === 'TOPUP' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
    </div>
  );
}

export default function PaymentsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/payments', { cache: 'no-store' });
      const data: unknown = await response.json();

      if (!response.ok) {
        const message = typeof data === 'object' && data !== null && 'error' in data
          ? String(data.error)
          : 'Не удалось загрузить платежи';
        throw new Error(message);
      }

      if (!Array.isArray(data)) {
        throw new Error('Сервер вернул некорректный список платежей');
      }

      setTransactions(data as Transaction[]);
    } catch (reason) {
      setTransactions([]);
      setError(reason instanceof Error ? reason.message : 'Не удалось загрузить платежи');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-black tracking-tighter text-white sm:text-3xl">
            <CreditCard className="shrink-0 text-white" size={30} />
            ПЛАТЕЖИ
          </h1>
          <p className="mt-1 text-sm font-bold text-zinc-400">История транзакций и финансы</p>
        </div>
        <button
          type="button"
          onClick={() => void fetchTransactions()}
          disabled={loading}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 text-xs font-black uppercase text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50"
        >
          <RefreshCw className={loading ? 'animate-spin' : ''} size={16} /> Обновить
        </button>
      </div>

      {error && (
        <div className="flex flex-col gap-4 rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 shrink-0" size={20} />
            <div><p className="font-black uppercase">Не удалось открыть платежи</p><p className="mt-1 text-sm text-red-300">{error}</p></div>
          </div>
          <button type="button" onClick={() => void fetchTransactions()} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-700 px-4 text-xs font-black uppercase hover:bg-red-900/50">
            <RefreshCw size={16} /> Повторить
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center"><RefreshCw className="animate-spin text-accent" size={32} /></div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="space-y-3 md:hidden">
            {transactions.map((transaction) => (
              <article key={transaction.id} className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <TransactionIcon type={transaction.type} />
                  <div className="min-w-0 flex-1"><div className="font-black text-white">{transactionLabel(transaction.type)}</div><div className="mt-1 truncate text-[10px] font-bold text-zinc-500">{formatDate(transaction.createdAt)}</div></div>
                  <div className={cn('text-lg font-black', transaction.type === 'TOPUP' ? 'text-green-400' : 'text-white')}>
                    {transaction.type === 'TOPUP' ? '+' : '-'}{transaction.amount} ₽
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-4">
                  <div className="min-w-0"><div className="truncate text-sm font-black text-white">{transaction.user.name}</div><div className="mt-1 truncate text-[10px] font-bold text-zinc-500">ID: {transaction.user.maxId}</div></div>
                  <span className="rounded border border-green-800 bg-green-900/30 px-2 py-1 text-[9px] font-black uppercase text-green-400">Успешно</span>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-lg md:block">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead><tr className="border-b border-zinc-700 bg-zinc-800/50 text-[10px] font-black uppercase tracking-widest text-zinc-400"><th className="px-6 py-4">Тип</th><th className="px-6 py-4">Сумма</th><th className="px-6 py-4">Пользователь</th><th className="px-6 py-4">Дата и время</th><th className="px-6 py-4 text-right">Статус</th></tr></thead>
              <tbody className="text-sm">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-zinc-800 transition-colors hover:bg-zinc-800">
                    <td className="px-6 py-4"><div className="flex items-center gap-3"><TransactionIcon type={transaction.type} /><div className="font-black text-white">{transactionLabel(transaction.type)}</div></div></td>
                    <td className={cn('px-6 py-4 text-lg font-black', transaction.type === 'TOPUP' ? 'text-green-400' : 'text-white')}>{transaction.type === 'TOPUP' ? '+' : '-'}{transaction.amount} ₽</td>
                    <td className="px-6 py-4"><div className="font-black text-white">{transaction.user.name}</div><div className="text-[10px] font-bold text-zinc-500">ID: {transaction.user.maxId}</div></td>
                    <td className="px-6 py-4 font-bold text-zinc-400">{formatDate(transaction.createdAt)}</td>
                    <td className="px-6 py-4 text-right"><span className="rounded border border-green-800 bg-green-900/30 px-2 py-1 text-[10px] font-black uppercase text-green-400">Успешно</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {transactions.length === 0 && !error && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 py-16 text-center font-black uppercase text-zinc-500">Транзакции не найдены</div>
          )}
        </motion.div>
      )}
    </div>
  );
}
