'use client';

import React, { useEffect, useState } from 'react';
import { 
  TrendingUp, 
  Users as UsersIcon, 
  Database, 
  CreditCard,
  Zap,
  Loader2
} from 'lucide-react';

import { LeadIngestMock } from '@/components/ui/LeadIngestMock';

export default function AdminDashboardPage() {
  const [statsData, setStatsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      setStatsData(data);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchStats(true);
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { label: 'Доход сегодня', value: loading ? '...' : `${statsData?.revenueToday || 0}₽`, trend: '', icon: CreditCard, color: '#E6F000' },
    { label: 'Новые лиды', value: loading ? '...' : `${statsData?.newLeads || 0}`, trend: '', icon: Database, color: '#00F0FF' },
    { label: 'Активные мастера', value: loading ? '...' : `${statsData?.activeMasters || 0}`, trend: '', icon: UsersIcon, color: '#FF00E5' },
    { label: 'PRO Подписки', value: loading ? '...' : `${statsData?.activeSubscriptions || 0}`, trend: '', icon: Zap, color: '#FF8A00' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-0 pb-20 font-sans sm:px-6">
      <div className="flex flex-col gap-4 border-b border-zinc-700 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="bg-accent border border-zinc-700 p-2.5 text-black rounded-lg">
            <TrendingUp size={20} />
          </div>
          <h1 className="text-sm font-black tracking-widest text-white uppercase leading-none">ОБЗОР СИСТЕМЫ</h1>
        </div>
        <div className="flex bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-xs font-black text-white uppercase shadow-sm">
          {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-lg p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div 
                className="w-12 h-12 border border-zinc-700 rounded-lg flex items-center justify-center bg-zinc-950"
                style={{ color: stat.color === '#E6F000' || stat.color === '#E4FF00' ? '#E4FF00' : stat.color }}
              >
                <stat.icon size={24} />
              </div>
              <div className="text-green-400 text-[10px] font-black border border-green-800 rounded bg-green-900/30 px-2 py-1 uppercase tracking-wider hidden">
                {stat.trend}
              </div>
            </div>
            <div>
              <div className="text-3xl font-black tracking-tighter text-white">{stat.value}</div>
              <div className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-1">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900 p-6 text-center text-base font-black uppercase tracking-widest text-zinc-600 shadow-lg sm:h-80 sm:text-xl xl:col-span-2">
          График доходности
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-700 shadow-lg xl:col-span-1">
          <LeadIngestMock />
        </div>
      </div>
    </div>
  );
}
