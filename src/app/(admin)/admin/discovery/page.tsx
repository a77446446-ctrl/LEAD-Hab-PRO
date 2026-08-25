'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Pause, Play, Plus, Search, X } from 'lucide-react';

type Chat = {
  id: string; url: string; name: string | null; provider: string; status: string;
  active: boolean; score: number; discoveryCount: number; lastDiscoveredAt: string;
  lastCheckedAt: string | null; lastError: string | null;
};
type Run = { id: string; status: string; queries: number; candidates: number; activated: number; error: string | null; startedAt: string };

export default function DiscoveryPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/discovery/chats', { cache: 'no-store' });
      if (!response.ok) throw new Error('Не удалось загрузить источники');
      const data = await response.json() as { chats: Chat[]; runs: Run[] };
      setChats(data.chats); setRuns(data.runs); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка загрузки'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async () => {
    setRunning(true); setError('');
    try {
      const response = await fetch('/api/admin/discovery/run', { method: 'POST' });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.message || data.error || 'Поиск завершился с ошибкой');
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка поиска'); }
    finally { setRunning(false); }
  };

  const add = async () => {
    if (!url.trim()) return;
    const response = await fetch('/api/admin/discovery/chats', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setError(data.error || 'Не удалось добавить чат'); return; }
    setUrl(''); await load();
  };

  const setStatus = async (id: string, status: 'ACTIVE' | 'PENDING' | 'REJECTED') => {
    const response = await fetch('/api/admin/discovery/chats', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }),
    });
    if (!response.ok) { setError('Не удалось изменить статус'); return; }
    await load();
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div><h1 className="text-2xl font-black uppercase sm:text-3xl">Детектив</h1><p className="mt-2 text-sm text-zinc-400">Поиск и контроль новых источников MAX</p></div>
        <button onClick={() => void run()} disabled={running} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-black uppercase text-black disabled:opacity-50">
          {running ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />} Запустить поиск
        </button>
      </div>
      {error && <div className="rounded-xl border border-red-700 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="mb-4 font-black uppercase">Добавить MAX-чат вручную</h2>
        <div className="flex flex-col gap-3 sm:flex-row"><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://max.ru/..." className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-accent" /><button onClick={() => void add()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-700 px-5 font-bold hover:border-accent"><Plus size={18} /> Добавить</button></div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-5 font-black uppercase">Источники: {chats.length}</div>
        {loading ? <div className="p-8 text-zinc-400">Загрузка…</div> : chats.length === 0 ? <div className="p-8 text-zinc-400">Источники пока не найдены</div> : <div className="divide-y divide-zinc-800">{chats.map((chat) => (
          <div key={chat.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-bold">{chat.name || 'MAX-чат'}</span><span className="rounded bg-zinc-800 px-2 py-1 text-[10px] font-black">{chat.provider}</span><span className="text-xs text-accent">оценка {chat.score}</span></div><a href={chat.url} target="_blank" rel="noreferrer" className="mt-2 block truncate text-sm text-zinc-400 hover:text-white">{chat.url}</a><p className="mt-2 text-xs text-zinc-500">Найден {chat.discoveryCount} раз · {new Date(chat.lastDiscoveredAt).toLocaleString('ru-RU')}</p>{chat.lastError && <p className="mt-2 text-xs text-red-300">{chat.lastError}</p>}</div>
            <div className="flex items-center gap-2"><button title="Активировать" onClick={() => void setStatus(chat.id, 'ACTIVE')} className="rounded-lg border border-zinc-700 p-2 hover:border-green-500"><Check size={17} /></button><button title="На проверку" onClick={() => void setStatus(chat.id, 'PENDING')} className="rounded-lg border border-zinc-700 p-2 hover:border-yellow-500">{chat.active ? <Pause size={17} /> : <Play size={17} />}</button><button title="Отклонить" onClick={() => void setStatus(chat.id, 'REJECTED')} className="rounded-lg border border-zinc-700 p-2 hover:border-red-500"><X size={17} /></button></div>
          </div>
        ))}</div>}
      </section>
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="mb-4 font-black uppercase">Последние запуски</h2><div className="space-y-2">{runs.slice(0, 10).map((item) => <div key={item.id} className="flex flex-wrap justify-between gap-3 rounded-xl bg-zinc-950 p-3 text-sm"><span>{new Date(item.startedAt).toLocaleString('ru-RU')} · {item.status}</span><span className="text-zinc-400">запросов {item.queries}, найдено {item.candidates}, активировано {item.activated}</span></div>)}</div></section>
    </div>
  );
}
