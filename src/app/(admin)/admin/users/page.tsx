'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw, Search, Shield, UserCheck, Users as UsersIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  maxId: string;
  name: string;
  role: string;
  balance: number;
  rating: number;
  createdAt: string;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru-RU');
}

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role.toUpperCase() === 'ADMIN';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[9px] font-bold uppercase tracking-wider',
        isAdmin
          ? 'border-accent/50 bg-accent/10 text-accent'
          : 'border-zinc-700 bg-zinc-800 text-zinc-400',
      )}
    >
      {isAdmin ? <Shield size={10} /> : <UserCheck size={10} />}
      {isAdmin ? 'Администратор' : 'Пользователь'}
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/users', { cache: 'no-store' });
      const data: unknown = await response.json();

      if (!response.ok) {
        const message = typeof data === 'object' && data !== null && 'error' in data
          ? String(data.error)
          : 'Не удалось загрузить пользователей';
        throw new Error(message);
      }

      if (!Array.isArray(data)) {
        throw new Error('Сервер вернул некорректный список пользователей');
      }

      setUsers(data as User[]);
    } catch (reason) {
      setUsers([]);
      setError(reason instanceof Error ? reason.message : 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ru-RU');
    if (!query) return users;

    return users.filter((user) => (
      user.name.toLocaleLowerCase('ru-RU').includes(query) || user.maxId.includes(query)
    ));
  }, [search, users]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-0 pb-20 font-sans sm:px-6">
      <div className="flex flex-col gap-4 border-b border-zinc-700 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="bg-accent border border-zinc-700 p-2.5 text-black rounded-lg">
            <UsersIcon size={20} />
          </div>
          <h1 className="text-xs sm:text-sm font-bold tracking-widest text-white uppercase leading-none">ПОЛЬЗОВАТЕЛИ</h1>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input
            type="search"
            placeholder="Поиск по имени или ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-3.5 pl-12 pr-4 text-xs font-bold text-white shadow-sm transition-all placeholder:text-zinc-500 focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="flex flex-col gap-4 rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-bold uppercase">Не удалось открыть пользователей</p>
              <p className="mt-1 text-sm text-red-300">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchUsers()}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-700 px-4 text-xs font-bold uppercase hover:bg-red-900/50"
          >
            <RefreshCw size={16} /> Повторить
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <RefreshCw className="animate-spin text-accent" size={32} />
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="space-y-3 md:hidden max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
            {filteredUsers.map((user) => (
              <article key={user.id} className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 shadow-lg">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-xs sm:text-sm font-bold text-accent">
                    {user.name.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-white">{user.name}</div>
                    <div className="mt-1 truncate text-[10px] font-bold uppercase tracking-wider text-zinc-500">ID: {user.maxId}</div>
                  </div>
                  <RoleBadge role={user.role} />
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-800 pt-4 text-center">
                  <div><dt className="text-[9px] font-bold uppercase text-zinc-500">Баланс</dt><dd className="mt-1 text-xs sm:text-sm font-bold text-white">{user.balance} ₽</dd></div>
                  <div><dt className="text-[9px] font-bold uppercase text-zinc-500">Рейтинг</dt><dd className="mt-1 text-xs sm:text-sm font-bold text-white"><span className="text-accent">★</span> {user.rating.toFixed(1)}</dd></div>
                  <div><dt className="text-[9px] font-bold uppercase text-zinc-500">Регистрация</dt><dd className="mt-1 text-xs font-bold text-zinc-300">{formatDate(user.createdAt)}</dd></div>
                </dl>
              </article>
            ))}
          </div>

          <div className="hidden md:flex flex-col rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden shadow-lg mt-6">
            <div className="flex items-center gap-3 p-4 sm:p-6 border-b border-zinc-800 shrink-0">
               <div className="w-8 h-8 border border-zinc-700 bg-zinc-950 flex items-center justify-center text-zinc-400">
                  <UsersIcon size={14} />
               </div>
               <h3 className="font-bold text-[10px] uppercase tracking-[0.2em] text-zinc-400">СПИСОК ПОЛЬЗОВАТЕЛЕЙ</h3>
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-[400px] p-0 custom-scrollbar relative">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead className="sticky top-0 bg-zinc-900/95 backdrop-blur z-10 shadow-sm">
                  <tr className="border-b border-zinc-800 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                    <th className="px-8 py-5">Пользователь</th><th className="px-6 py-5">Роль</th><th className="px-6 py-5">Баланс</th><th className="px-6 py-5">Рейтинг</th><th className="px-8 py-5">Регистрация</th>
                  </tr>
                </thead>
                <tbody className="text-sm bg-transparent">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="group border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/50">
                      <td className="px-8 py-5"><div className="font-bold text-white group-hover:text-accent">{user.name}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">ID: {user.maxId}</div></td>
                      <td className="px-6 py-5"><RoleBadge role={user.role} /></td>
                      <td className="px-6 py-5 font-bold text-white">{user.balance} ₽</td>
                      <td className="px-6 py-5 font-bold text-zinc-200"><span className="text-accent">★</span> {user.rating.toFixed(1)}</td>
                      <td className="px-8 py-5 text-[11px] font-bold uppercase text-zinc-400">{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredUsers.length === 0 && !error && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 py-16 text-center font-bold uppercase text-zinc-500">Пользователи не найдены</div>
          )}
        </motion.div>
      )}
    </div>
  );
}
