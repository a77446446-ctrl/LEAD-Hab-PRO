'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users as UsersIcon, Search, UserCheck, Shield, MoreHorizontal, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  maxId: string;
  name: string;
  role: string;
  balance: string;
  rating: number;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.maxId.includes(search)
  );

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
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 text-white">
            <UsersIcon className="text-white" size={32} />
            ПОЛЬЗОВАТЕЛИ
          </h1>
          <p className="text-zinc-400 text-sm font-bold mt-1">Управление доступом и балансами</p>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="Поиск по имени или ID..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 bg-zinc-900 border border-zinc-700 py-3.5 pl-12 pr-4 text-xs font-black focus:outline-none focus:border-accent transition-all text-white placeholder:text-zinc-500 rounded-xl shadow-sm"
          />
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-lg"
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-700 text-[9px] text-zinc-400 uppercase font-black tracking-[0.2em] bg-zinc-800/50">
              <th className="px-8 py-5">Пользователь</th>
              <th className="px-8 py-5">Роль</th>
              <th className="px-8 py-5">Баланс</th>
              <th className="px-8 py-5">Рейтинг</th>
              <th className="px-8 py-5">Регистрация</th>
              <th className="px-8 py-5 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b border-zinc-800 hover:bg-zinc-800 transition-colors group">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-accent/10 flex items-center justify-center text-accent font-black text-sm border border-accent/30 rounded-lg group-hover:bg-accent/20 transition-colors">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-black text-white group-hover:text-accent transition-colors">{user.name}</div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1 font-bold">ID: {user.maxId}</div>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 text-[9px] font-black uppercase tracking-wider border rounded",
                    user.role === 'ADMIN' ? "bg-accent/10 text-accent border-accent/50" : "bg-zinc-800 text-zinc-400 border-zinc-700"
                  )}>
                    {user.role === 'ADMIN' ? <Shield size={10} /> : <UserCheck size={10} />}
                    {user.role}
                  </div>
                </td>
                <td className="px-8 py-5 font-black text-white">{user.balance} ₽</td>
                <td className="px-8 py-5">
                  <div className="flex items-center gap-1.5 font-black text-zinc-200">
                    <span className="text-accent drop-shadow-[0_0_5px_rgba(228,255,0,0.5)]">★</span>
                    {user.rating.toFixed(1)}
                  </div>
                </td>
                <td className="px-8 py-5 text-[11px] text-zinc-400 font-bold uppercase">
                  {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                </td>
                <td className="px-8 py-5 text-right">
                  <button className="p-2.5 hover:bg-zinc-700 transition-all text-zinc-500 hover:text-white border border-transparent hover:border-zinc-600 bg-zinc-800 rounded-lg">
                    <MoreHorizontal size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div className="py-20 text-center text-zinc-500 font-black uppercase">
            Пользователи не найдены
          </div>
        )}
      </motion.div>
    </div>
  );
}
