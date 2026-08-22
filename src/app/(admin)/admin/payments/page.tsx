'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, ArrowUpRight, ArrowDownLeft, RefreshCw, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  type: 'TOPUP' | 'BUY' | 'REFUND';
  amount: string;
  createdAt: string;
  user: {
    name: string;
    maxId: string;
  }
}

export default function PaymentsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/admin/payments');
      const data = await res.json();
      setTransactions(data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter flex items-center gap-3 text-white">
            <CreditCard className="text-white" size={32} />
            ПЛАТЕЖИ
          </h1>
          <p className="text-zinc-400 font-bold mt-1 text-sm">История транзакций и финансы</p>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-black hover:bg-zinc-800 transition-colors text-white shadow-sm">
          <Filter size={16} />
          Фильтры
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-lg"
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-700 text-[10px] text-zinc-400 uppercase font-black tracking-widest bg-zinc-800/50">
              <th className="px-6 py-4">Тип</th>
              <th className="px-6 py-4">Сумма</th>
              <th className="px-6 py-4">Пользователь</th>
              <th className="px-6 py-4">Дата и время</th>
              <th className="px-6 py-4 text-right">Статус</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-zinc-800 hover:bg-zinc-800 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 flex items-center justify-center border rounded-md",
                      t.type === 'TOPUP' ? "bg-green-900/30 text-green-400 border-green-800" : 
                      t.type === 'BUY' ? "bg-accent/10 text-accent border-accent/50" : "bg-red-900/30 text-red-400 border-red-800"
                    )}>
                      {t.type === 'TOPUP' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div>
                      <div className="font-black text-white">
                        {t.type === 'TOPUP' ? 'Пополнение' : t.type === 'BUY' ? 'Покупка лида' : 'Возврат'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className={cn(
                  "px-6 py-4 font-black text-lg",
                  t.type === 'TOPUP' ? "text-green-400" : "text-white"
                )}>
                  {t.type === 'TOPUP' ? '+' : '-'}{t.amount} ₽
                </td>
                <td className="px-6 py-4">
                  <div className="font-black text-white">{t.user.name}</div>
                  <div className="text-[10px] text-zinc-500 font-bold">ID: {t.user.maxId}</div>
                </td>
                <td className="px-6 py-4 text-zinc-400 font-bold">
                  {new Date(t.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-green-900/30 text-green-400 border border-green-800">
                    Успешно
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {transactions.length === 0 && (
          <div className="py-20 text-center text-zinc-500 font-black uppercase">
            Транзакции не найдены
          </div>
        )}
      </motion.div>
    </div>
  );
}
