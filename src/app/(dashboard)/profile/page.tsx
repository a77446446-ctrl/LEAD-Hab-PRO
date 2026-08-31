'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/store/useUser';


import { Settings, LogOut, Award, History, TrendingUp } from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, setNotifyEnabled } = useUser();
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [categoryPreferences, setCategoryPreferences] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/preferences/categories', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setCategoryPreferences(Array.isArray(data) ? data : []))
      .catch(() => setCategoryPreferences([]));
  }, []);

  if (!user) return null;

  const toggleCategoryNotifications = async (category: any) => {
    const enabled = !category.notifyEnabled;
    const response = await fetch('/api/preferences/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: category.id, enabled }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (data.code === 'BOT_NOT_STARTED' && data.botUrl) window.WebApp?.openMaxLink?.(data.botUrl);
      alert(data.error || 'Не удалось изменить подписку');
      return;
    }
    setCategoryPreferences((items) => items.map((item) => item.id === category.id ? { ...item, notifyEnabled: enabled } : item));
    if (enabled) setNotifyEnabled(true);
  };

  const changeNotifications = async (enabled: boolean) => {
    setSavingNotifications(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyEnabled: enabled }),
      });
      const data = await response.json() as { notify_enabled?: boolean; error?: string; code?: string; botUrl?: string };
      if (!response.ok) {
        if (data.code === 'BOT_NOT_STARTED' && data.botUrl) window.WebApp?.openMaxLink?.(data.botUrl);
        throw new Error(data.error || 'Не удалось изменить уведомления');
      }
      setNotifyEnabled(Boolean(data.notify_enabled));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Не удалось изменить уведомления');
    } finally {
      setSavingNotifications(false);
    }
  };

  const stats = [
    { label: 'Куплено лидов', value: '0', icon: History },
    { label: 'Рейтинг', value: '0.0', icon: Award },
    { label: 'Доход (ориент.)', value: '0₽', icon: TrendingUp },
  ];

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 border border-black bg-accent flex items-center justify-center text-black text-3xl font-black">
          {user.name.charAt(0)}
        </div>
        <div>
          <h2 className="text-2xl font-black text-black uppercase">{user.name}</h2>
          <p className="text-[#666] text-sm font-bold">ID: {user.max_id}</p>
          <div className="mt-1 bg-black text-white border border-black px-2 py-0.5 text-[10px] font-black inline-block uppercase">
            {user.role}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="glass-panel p-3 text-center border-black">
            <div className="flex justify-center mb-2">
              <stat.icon size={16} className="text-black" />
            </div>
            <div className="text-lg font-black text-black">{stat.value}</div>
            <div className="text-[9px] text-[#666] uppercase font-bold">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Category Subscriptions */}
      {categoryPreferences.length > 0 && (
        <div className="bg-white border border-black p-4 space-y-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <div>
            <div className="text-xs font-black uppercase">Мои категории</div>
            <div className="text-[11px] text-[#666] font-medium">Выберите, по каким лидам получать уведомления от бота.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {categoryPreferences.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleCategoryNotifications(category)}
                className={`px-3 py-2 text-[10px] font-black uppercase border border-black transition-colors ${category.notifyEnabled ? 'bg-accent text-black' : 'bg-white text-black hover:bg-gray-100'}`}
              >
                {category.notifyEnabled ? '🔔 ' : '🔕 '}{category.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu */}
      <div className="space-y-2">
        <div className="w-full flex items-center justify-between p-4 glass-panel transition-colors border-black">
          <div className="flex items-center gap-3 font-bold text-black uppercase text-sm">
            <div className="border border-black bg-white text-black p-2"><Settings size={18} /></div>
            Уведомления
          </div>
          <div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={user.notify_enabled}
                disabled={savingNotifications}
                onChange={(event) => changeNotifications(event.target.checked)}
              />
              <div className="w-11 h-6 bg-[#ddd] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent border border-black"></div>
            </label>
          </div>
        </div>

        {user.role === 'admin' && (
        <Link 
          href="/admin/settings"
          className="w-full flex items-center justify-between p-4 glass-panel hover:bg-gray-100 transition-colors border-black"
        >
          <div className="flex items-center gap-3 font-bold text-black uppercase text-sm">
            <div className="border border-black bg-white text-black p-2"><Settings size={18} /></div>
            Настройки
          </div>
          <div className="text-black font-black">→</div>
        </Link>
        )}

        
        <button 
          onClick={async () => {
            try {
              await fetch('/api/auth/logout', { method: 'POST' });
            } finally {
              logout();
              window.location.assign('/login');
            }
          }}
          className="w-full flex items-center justify-between p-4 glass-panel border-black hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-3 font-bold text-red-600 uppercase text-sm">
            <div className="border border-black bg-white text-red-600 p-2"><LogOut size={18} /></div>
            Выйти из аккаунта
          </div>
        </button>
      </div>



      <div className="text-center text-[10px] text-[#999] uppercase font-bold tracking-widest pt-10">
        ПО ДЕЛАМ v1.0.0
      </div>
    </div>
  );
}
