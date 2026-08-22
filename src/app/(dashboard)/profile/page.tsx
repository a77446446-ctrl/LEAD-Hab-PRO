'use client';

import React from 'react';
import Link from 'next/link';
import { useUser } from '@/store/useUser';

import { Settings, LogOut, Award, History, TrendingUp } from 'lucide-react';

export default function ProfilePage() {
  const { user, logout } = useUser();

  if (!user) return null;

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

      {/* Menu */}
      <div className="space-y-2">
        <div className="w-full flex items-center justify-between p-4 glass-panel transition-colors border-black">
          <div className="flex items-center gap-3 font-bold text-black uppercase text-sm">
            <div className="border border-black bg-white text-black p-2"><Settings size={18} /></div>
            Уведомления
          </div>
          <div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked={user.notify_enabled} />
              <div className="w-11 h-6 bg-[#ddd] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent border border-black"></div>
            </label>
          </div>
        </div>

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

        
        <button 
          onClick={logout}
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
