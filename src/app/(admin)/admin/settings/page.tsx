'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  Bot, 
  Globe, 
  Plus, 
  Trash2, 
  Save, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Zap,
  Key,
  MessageSquare,
  HelpCircle,
  Info,
  User as UserIcon,
  ShieldCheck,
  RotateCw,
  Activity,
  Loader2,
  Lock,
  ChevronDown,
  Hash,
  UserCircle,
  Eye,
  EyeOff,
  Server,
  Unlock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Setting {
  key: string;
  value: string;
}

interface MaksSession {
  id: string;
  name: string;
  active: boolean;
  status?: 'AUTHORIZING' | 'ACTIVE' | 'COOLDOWN' | 'AUTH_REQUIRED' | 'PROXY_ERROR' | 'DISABLED';
  lastUsed?: string | null;
  lastSuccessAt?: string | null;
  cooldownUntil?: string | null;
  consecutiveFailures?: number;
  totalRuns?: number;
  totalErrors?: number;
  lastError?: string | null;
  proxy?: string;
}

const SESSION_STATUS_LABELS: Record<string, string> = {
  AUTHORIZING: 'ОЖИДАЕТ QR',
  ACTIVE: 'ГОТОВ',
  COOLDOWN: 'ПАУЗА',
  AUTH_REQUIRED: 'НУЖЕН ВХОД',
  PROXY_ERROR: 'ОШИБКА ПРОКСИ',
  DISABLED: 'ВЫКЛЮЧЕН',
};

interface Chat {
  name: string;
  url: string;
  parseAll?: boolean;
  count?: number;
  lastParsedAt?: string | null;
}

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const [syncing, setSyncing] = useState(false);
  const [autoParseEnabled, setAutoParseEnabled] = useState(false);
  const [parseInterval, setParseInterval] = useState<number>(300);
  const [currentParsingChat, setCurrentParsingChat] = useState<string | null>(null);
  const [nextRunSeconds, setNextRunSeconds] = useState<number | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [newChat, setNewChat] = useState('');
  const [parsingChats, setParsingChats] = useState<Chat[]>([]);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showHelp, setShowHelp] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [sessions, setSessions] = useState<MaksSession[]>([]);
  const [logs, setLogs] = useState<{ time: string, msg: string, type: 'info' | 'success' | 'error' }[]>([]);
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState<string | null>(null);
  const [authQR, setAuthQR] = useState('');
  const [authStep, setAuthStep] = useState<'idle' | 'qr' | 'code'>('idle');

  // AI Verification State
  const [verifyingAi, setVerifyingAi] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [aiErrorMsg, setAiErrorMsg] = useState('');

  const handleVerifyAiKey = async () => {
    const key = settings['maks_ai_api_key'];
    if (!key) return;
    setVerifyingAi(true);
    setAiStatus('idle');
    try {
      const res = await fetch('/api/admin/settings/verify-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key })
      });
      const data = await res.json();
      if (data.success) {
        setAiStatus('success');
      } else {
        setAiStatus('error');
        setAiErrorMsg(data.message);
      }
    } catch (e: any) {
      setAiStatus('error');
      setAiErrorMsg(e.message);
    } finally {
      setVerifyingAi(false);
    }
  };

  // Proxy state (Split)
  const [proxyProtocol, setProxyProtocol] = useState<'http://' | 'socks5://'>('http://');
  const [proxyIP, setProxyIP] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [proxyUser, setProxyUser] = useState('');
  const [proxyPass, setProxyPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [proxyStatus, setProxyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [canBypass, setCanBypass] = useState(false);
  const [proxyLoaded, setProxyLoaded] = useState(false);

  // Unsaved changes protection
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // For legacy browsers
    };

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (link && link.href && !link.href.includes('/admin/settings') && !link.target) {
        e.preventDefault();
        e.stopPropagation();
        setShowUnsavedModal(link.href);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleLinkClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [hasUnsavedChanges]);

  // Load proxy from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedProtocol = localStorage.getItem('maks_proxyProtocol');
      if (savedProtocol === 'http://' || savedProtocol === 'socks5://') setProxyProtocol(savedProtocol as any);
      setProxyIP(localStorage.getItem('maks_proxyIP') || '');
      setProxyPort(localStorage.getItem('maks_proxyPort') || '');
      setProxyUser(localStorage.getItem('maks_proxyUser') || '');
      // Пароль прокси не должен сохраняться в браузере.
      localStorage.removeItem('maks_proxyPass');
      setProxyPass('');
      setProxyLoaded(true);
    }
  }, []);

  // Save proxy to localStorage on change
  useEffect(() => {
    if (typeof window !== 'undefined' && proxyLoaded) {
      localStorage.setItem('maks_proxyProtocol', proxyProtocol);
      localStorage.setItem('maks_proxyIP', proxyIP);
      localStorage.setItem('maks_proxyPort', proxyPort);
      localStorage.setItem('maks_proxyUser', proxyUser);
    }
    // Reset proxy status if user edits proxy fields
    setProxyStatus('idle');
    setCanBypass(false);
  }, [proxyProtocol, proxyIP, proxyPort, proxyUser, proxyPass, proxyLoaded]);

  useEffect(() => {
    fetchSettings();
    fetchSessions();
    setLogs([{ time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), msg: 'Система готова к работе', type: 'info' }]);
    
    // Auto-refresh stats every 10 seconds (only if no unsaved changes)
    const interval = setInterval(() => {
      fetchSettings(true);
      fetchSessions(true);
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchSettings = async (silent = false) => {
    try {
      const res = await fetch('/api/admin/settings');
      const data: Setting[] = await res.json();
      const settingsMap: Record<string, string> = {};
      data.forEach(s => settingsMap[s.key] = s.value);
      
      // If we are auto-refreshing and user has unsaved changes, DON'T update local state 
      // except maybe we want to update the counts. For safety, just skip if hasUnsavedChanges.
      if (silent) {
          // If silent, we only update the counts on parsingChats to not interrupt typing
          setParsingChats(prev => {
              try {
                  const dbChats = JSON.parse(settingsMap['maks_parsing_chats'] || '[]');
                  return prev.map(c => {
                      const dbC = dbChats.find((dc:any) => dc.url === c.url);
                      if (dbC) return { ...c, count: dbC.count, lastParsedAt: dbC.lastParsedAt };
                      return c;
                  });
              } catch(e) { return prev; }
          });
          return;
      }

      setSettings(settingsMap);
      if (settingsMap['maks_parsing_chats']) {
        try { 
            let chats = JSON.parse(settingsMap['maks_parsing_chats']); 
            let changed = false;
            chats = chats.map((c: any) => {
                let url = typeof c === 'string' ? c : c.url;
                if (url.includes('max.ru') && !url.includes('web.max.ru')) {
                    url = url.replace('max.ru', 'web.max.ru');
                    changed = true;
                }
                let name = typeof c === 'string' ? 'Новый чат' : c.name;
                if (name && (name.includes('Быстрое') || name.includes('приложение'))) {
                    const parts = url.split('/');
                    const slug = parts[parts.length-1] || parts[parts.length-2] || 'Чат';
                    name = slug.replace(/_/g, ' ').replace(/-/g, ' ').split(' ').map((w:string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    changed = true;
                }
                if (typeof c === 'string') return { name, url, parseAll: true, count: 0, lastParsedAt: null };
                return {
                  name,
                  url,
                  parseAll: typeof c.parseAll === 'boolean' ? c.parseAll : true,
                  count: typeof c.count === 'number' ? c.count : 0,
                  lastParsedAt: c.lastParsedAt || null,
                };
            });
            setParsingChats(chats);
            
            // Auto-save fixed chats to DB
            if (changed) {
                fetch('/api/admin/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'maks_parsing_chats', value: JSON.stringify(chats) }),
                });
            }
        } catch (e) { setParsingChats([]); }
      }
      setAutoParseEnabled(settingsMap['maks_parser_auto'] === 'true');
      const interval = parseInt(settingsMap['maks_parser_interval'] || '300', 10);
      setParseInterval(Math.max(interval, 60));

      const lastRunStr = settingsMap['maks_parser_last_run'];
      if (lastRunStr) {
          const lastRun = parseInt(lastRunStr, 10);
          const elapsed = (Date.now() - lastRun) / 1000;
          let remaining = Math.max(interval, 60) - elapsed;
          if (remaining < 0) remaining = 0;
          setNextRunSeconds(Math.floor(remaining));
      }
    } catch (error) { console.error('Failed to fetch settings:', error); }
    finally { if (!silent) setLoading(false); }
  };

  const fetchSessions = async (silent = false) => {
    try {
      const res = await fetch('/api/admin/auth/sessions');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (error) { console.error('Failed to fetch sessions:', error); }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus('idle');
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'maks_main_channel', value: settings['maks_main_channel'] || '' }),
      });
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'maks_ai_api_key', value: settings['maks_ai_api_key'] || '' }),
      });
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'maks_ai_enabled', value: settings['maks_ai_enabled'] || 'false' }),
      });
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'maks_spam_keywords', value: settings['maks_spam_keywords'] || '' }),
      });
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'maks_parsing_chats', value: JSON.stringify(parsingChats) }),
      });
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'maks_parser_auto', value: autoParseEnabled ? 'true' : 'false' }),
      });
      setStatus('success');
      setHasUnsavedChanges(false);
      setTimeout(() => setStatus('idle'), 3000);
      // 2. Sync accounts from files to DB
      await fetch('/api/admin/auth/sessions');
      
      addLog('Настройки и аккаунты сохранены', 'success');
    } catch (error) { 
      setStatus('error'); 
      addLog('Ошибка сохранения', 'error');
    } finally { setSaving(false); }
  };

  const startAuthFlow = async (mode: 'proxy' | 'direct' = 'proxy', fullProxy?: string) => {
    setAuthorizing(true);
    setProxyStatus('idle');
    setAuthQR('');
    setAuthStep('qr');
    addLog(mode === 'direct' ? 'Запуск авторизации (VPN)...' : 'Запуск авторизации (Proxy)...', 'info');

    try {
      const proxyStr = mode === 'direct' ? 'direct' : fullProxy;
      const res = await fetch('/api/admin/auth/qr-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxy: proxyStr })
      });
      const data = await res.json();
      if (data.success) {
        // Start monitoring for new sessions
        const interval = setInterval(async () => {
            const sRes = await fetch('/api/admin/auth/sessions');
            const sData = await sRes.json();
            if (sData.sessions?.length > sessions.length) {
                setSessions(sData.sessions);
                addLog('Аккаунт успешно добавлен!', 'success');
                setAuthStep('idle');
                clearInterval(interval);
            }
        }, 5000);
      } else {
        throw new Error('Скрипт авторизации не запущен');
      }
    } catch (error) {
      addLog('Ошибка авторизации', 'error');
      setAuthStep('idle');
    } finally {
      setAuthorizing(false);
    }
  };

  const handleStartQR = async () => {
    if (canBypass) {
        await startAuthFlow('direct');
        return;
    }
    
    if (!proxyIP || !proxyPort) {
      alert('Укажите IP и Порт прокси');
      return;
    }

    let fullProxy = `${proxyProtocol}${proxyIP}:${proxyPort}`;
    if (proxyUser && proxyPass) {
      fullProxy = `${proxyProtocol}${proxyUser}:${proxyPass}@${proxyIP}:${proxyPort}`;
    }

    setProxyStatus('checking');
    addLog(`Проверка прокси ${proxyIP}...`, 'info');
    
    try {
      const check = await fetch('/api/admin/auth/proxy-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proxy: fullProxy })
      });
      const checkResult = await check.json();
      if (!checkResult.valid) {
        addLog(`Ошибка прокси: ${checkResult.error}`, 'error');
        setProxyStatus('invalid');
        return;
      }
      addLog('Прокси валиден', 'success');
      setProxyStatus('valid');
      await startAuthFlow('proxy', fullProxy);
    } catch (e) {
      addLog('Ошибка связи при проверке', 'error');
      setProxyStatus('invalid');
    }
  };


  const saveAutoParseSettings = async (enabled: boolean, interval?: number) => {
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'maks_parser_auto', value: enabled ? 'true' : 'false' }),
      });
      if (interval !== undefined) {
        await fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'maks_parser_interval', value: String(interval) }),
        });
      }
    } catch (e) {
      console.error('Failed to save parser settings:', e);
    }
  };

  const handleAutoParseToggle = (enabled: boolean) => {
    setAutoParseEnabled(enabled);
    saveAutoParseSettings(enabled, parseInterval);
    addLog(enabled ? 'Авто-парсинг включен' : 'Авто-парсинг отключен', 'info');
  };

  const handleIntervalChange = (newInterval: number) => {
    setParseInterval(newInterval);
    if (autoParseEnabled) {
      saveAutoParseSettings(true, newInterval);
      addLog(`Интервал парсинга: ${newInterval / 60} мин.`, 'info');
    }
  };

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLogs(prev => [{ time, msg, type }, ...prev].slice(0, 50));
  };

  const handleSync = async () => {
    setSyncing(true);
    setCurrentParsingChat('*');
    addLog('Запуск парсинга...', 'info');
    try {
      const res = await fetch('/api/admin/parser/sync', { method: 'POST' });
      if (!res.ok) {
        addLog(`Ошибка сервера: ${res.status} ${res.statusText}`, 'error');
        setSyncing(false);
        setCurrentParsingChat(null);
        return;
      }
      const data = await res.json();
      if (data.success) {
        if (data.logs && data.logs.length > 0) {
          setLogs(prev => {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            // Clone the array before reversing to avoid React Strict Mode double-reverse bug
            const newLogs = [...data.logs].reverse().map((msg: string) => ({ time, msg, type: 'info' as const }));
            return [...newLogs, ...prev].slice(0, 50);
          });
        }
        setTimeout(() => addLog(`Готово. Лидов: ${data.leadsCount}`, 'success'), 100);
      } else {
        addLog(`Ошибка: ${data.message || 'Неизвестная ошибка'}`, 'error');
      }
    } catch (error) { 
      addLog(`Ошибка парсинга: ${error instanceof Error ? error.message : String(error)}`, 'error'); 
    }
    finally { 
      setSyncing(false);
      setCurrentParsingChat(null);
    }
  };

  useEffect(() => {
    if (!autoParseEnabled || syncing || sessions.length === 0) {
      // Do not clear nextRunSeconds completely if we are just syncing, but for UI it's fine
      if (!syncing) setNextRunSeconds(null);
      return;
    }

    const countdown = setInterval(() => {
      setNextRunSeconds(prev => {
        if (prev === null) return parseInterval;
        if (prev <= 1) return parseInterval; // visual reset
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [autoParseEnabled, sessions.length, syncing, parseInterval]);

  const addChat = async () => {
    if (!newChat) return;
    
    let finalUrl = newChat;
    if (finalUrl.includes('max.ru') && !finalUrl.includes('web.max.ru')) {
        finalUrl = finalUrl.replace('max.ru', 'web.max.ru');
    }
    if (!finalUrl.startsWith('http')) {
        finalUrl = 'https://' + finalUrl;
    }

    if (parsingChats.some(c => c.url === finalUrl)) {
        setNewChat('');
        return;
    }
    
    // Smart name extraction from URL
    let chatName = 'Новый чат';
    try {
      const urlParts = finalUrl.split('/');
      const slug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
      if (slug) {
        chatName = slug
          .replace(/_/g, ' ')
          .replace(/-/g, ' ')
          .split(' ')
          .map((word:string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    } catch (e) {
      chatName = 'Новый чат';
    }

    setParsingChats([...parsingChats, { name: chatName, url: finalUrl, parseAll: true }]);
    setNewChat('');
    setHasUnsavedChanges(true);
    addLog(`Добавлен чат: ${chatName}`, 'success');
  };

  const toggleChatMode = (url: string) => {
    setParsingChats(parsingChats.map(c => 
      c.url === url ? { ...c, parseAll: !c.parseAll } : c
    ));
    setHasUnsavedChanges(true);
    addLog('Режим чата изменен', 'info');
  };

  const editChatName = (url: string) => {
    const chat = parsingChats.find(c => c.url === url);
    if (!chat) return;
    const newName = prompt('Введите новое название чата:', chat.name);
    if (newName && newName !== chat.name) {
      setParsingChats(parsingChats.map(c => 
        c.url === url ? { ...c, name: newName } : c
      ));
      setHasUnsavedChanges(true);
      addLog(`Чат переименован: ${newName}`, 'info');
    }
  };

  const removeChat = (url: string) => {
    setParsingChats(parsingChats.filter(c => c.url !== url));
    setHasUnsavedChanges(true);
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Удалить этот аккаунт?')) return;
    try {
      const response = await fetch(`/api/admin/auth/sessions?id=${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Удаление отклонено сервером');
      setSessions((current) => current.filter((session) => session.id !== id));
      addLog('Аккаунт удален', 'info');
    } catch (error) { addLog('Ошибка удаления', 'error'); }
  };

  const handleToggleSession = async (session: MaksSession) => {
    try {
      const response = await fetch('/api/admin/auth/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: session.id, active: !session.active }),
      });
      if (!response.ok) throw new Error('Изменение отклонено сервером');
      await fetchSessions(true);
      addLog(session.active ? 'Аккаунт поставлен на паузу' : 'Аккаунт включен', 'info');
    } catch { addLog('Не удалось изменить состояние аккаунта', 'error'); }
  };

  const inputClasses = "w-full bg-zinc-900 border border-zinc-700 py-3.5 pl-11 pr-4 text-[10px] font-black uppercase tracking-widest focus:ring-1 focus:ring-black transition-all text-white placeholder:text-zinc-500 outline-none";

  if (!mounted) return null;
  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-accent" size={32} /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-6 font-sans">
      {/* HEADER */}
      <div className="flex items-center justify-between py-6 border-b border-zinc-700">
        <div className="flex items-center gap-4">
          <div className="bg-accent border border-zinc-700 p-2.5 text-black rounded-lg">
            <SettingsIcon size={20} />
          </div>
          <h1 className="text-sm font-black tracking-widest text-white uppercase leading-none">НАСТРОЙКИ МАКС</h1>
          
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 border border-zinc-700 text-accent text-[9px] font-black uppercase tracking-widest transition-all hover:bg-zinc-700 ml-4">
            <div className="flex items-center gap-1.5">
              {saving ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
              <span>СОХРАНИТЬ</span>
            </div>
          </button>
        </div>
        
        <button onClick={() => setShowHelp(!showHelp)} className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-700 text-white text-[9px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all">
          <div className="flex items-center gap-1.5">
            <HelpCircle size={14} /> <span>ИНСТРУКЦИЯ</span>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 rounded-xl items-stretch">
        {/* ACCOUNTS CARD */}
        <div className="bg-zinc-900 border border-zinc-700 p-8 rounded-xl flex flex-col h-full">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 border border-zinc-700 bg-zinc-950 flex items-center justify-center text-white"><UserIcon size={14} /></div>
            <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-400">Аккаунты</h3>
          </div>

          <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl mb-6 space-y-5">
             <div className="flex items-center justify-between">
                <label className="text-[8px] font-black text-zinc-400 uppercase tracking-[0.2em]">Режим подключения</label>
                <div className="flex bg-zinc-900 p-1 border border-zinc-700">
                   <button 
                      onClick={() => {
                        setCanBypass(false);
                        setProxyStatus('idle');
                      }} // Reset status when switching
                      className={cn(
                        "px-4 py-1.5 text-[9px] font-black uppercase transition-all border border-transparent",
                        !canBypass ? "bg-zinc-800 text-white rounded-lg border-zinc-700" : "text-zinc-400 hover:text-white"
                      )}
                      type="button"
                   >
                      Proxy
                   </button>
                   <button 
                      onClick={() => {
                        setCanBypass(true);
                        setProxyStatus('idle');
                        setProxyIP('');
                        setProxyPort('');
                      }}
                      className={cn(
                        "px-4 py-1.5 text-[9px] font-black uppercase transition-all border border-transparent",
                        canBypass ? "bg-zinc-800 text-white rounded-lg border-zinc-700" : "text-zinc-400 hover:text-white"
                      )}
                      type="button"
                   >
                      VPN (Локально)
                   </button>
                </div>
             </div>

             {!canBypass ? (
               <>
                 <div className="flex items-center justify-between">
                    <label className="text-[8px] font-black text-zinc-400 uppercase tracking-[0.2em]">Тип прокси</label>
                    <div className="relative">
                       <select 
                          value={proxyProtocol}
                          onChange={(e) => setProxyProtocol(e.target.value as any)}
                          className="bg-zinc-900 border border-zinc-700 py-1.5 px-3 text-[9px] font-black text-white uppercase focus:ring-1 focus:ring-black appearance-none cursor-pointer outline-none"
                       >
                          <option value="http://">HTTP</option>
                          <option value="socks5://">SOCKS5</option>
                       </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                       <Server className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={12} />
                       <input value={proxyIP} onChange={(e) => setProxyIP(e.target.value)} placeholder="IP Адрес" className={inputClasses} />
                    </div>
                    <div className="relative">
                       <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={12} />
                       <input value={proxyPort} onChange={(e) => setProxyPort(e.target.value)} placeholder="Порт" className={inputClasses} />
                    </div>
                    <div className="relative">
                       <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={12} />
                       <input value={proxyUser} onChange={(e) => setProxyUser(e.target.value)} placeholder="Логин" className={inputClasses} />
                    </div>
                    <div className="relative">
                       <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={12} />
                       <input type={showPass ? 'text' : 'password'} value={proxyPass} onChange={(e) => setProxyPass(e.target.value)} placeholder="Пароль" className={cn(inputClasses, "pr-10")} />
                       <button onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors">
                          {showPass ? <EyeOff size={12} /> : <Eye size={12} />}
                       </button>
                    </div>
                 </div>
               </>
             ) : (
               <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-lg flex gap-3 items-center">
                  <div className="text-accent"><ShieldCheck size={20} /></div>
                  <div className="text-[9px] text-white font-black uppercase leading-relaxed">
                    Режим VPN: Убедитесь, что VPN включен на вашем устройстве. Прокси не будут использоваться.
                  </div>
               </div>
             )}

             <div className="space-y-3">
               <button 
                  onClick={canBypass ? () => startAuthFlow('direct') : handleStartQR} 
                  disabled={authorizing || proxyStatus === 'checking' || (!canBypass && (!proxyIP || !proxyPort))} 
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-4 text-xs font-black uppercase tracking-widest transition-all border border-zinc-700",
                    (!canBypass && (!proxyIP || !proxyPort)) ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : 
                    proxyStatus === 'valid' ? "bg-green-500 text-white" : 
                    proxyStatus === 'invalid' ? "bg-red-500 text-white" : 
                    "bg-accent text-black hover:bg-[#F2FF00] rounded-lg"
                  )}
               >
                  {proxyStatus === 'checking' || authorizing ? <Loader2 className="animate-spin" size={12}/> : 
                   proxyStatus === 'valid' ? <CheckCircle2 size={12} /> :
                   proxyStatus === 'invalid' ? <AlertCircle size={12} /> :
                   <Plus size={12} />}
                  <span>{
                    proxyStatus === 'checking' ? 'ПРОВЕРКА...' : 
                    authorizing ? 'ОЖИДАНИЕ...' : 
                    proxyStatus === 'valid' ? 'РАБОТАЕТ. ЗАПУСК...' :
                    proxyStatus === 'invalid' ? 'ОШИБКА. ПОВТОРИТЬ?' :
                    'ДОБАВИТЬ АККАУНТ'
                  }</span>
               </button>

               <AnimatePresence>
                 {!canBypass && proxyStatus === 'invalid' && (
                   <motion.button
                     initial={{ opacity: 0, y: -10 }}
                     animate={{ opacity: 1, y: 0 }}
                     onClick={() => {
                        let fullProxy = `${proxyProtocol}${proxyIP}:${proxyPort}`;
                        if (proxyUser && proxyPass) {
                          fullProxy = `${proxyProtocol}${proxyUser}:${proxyPass}@${proxyIP}:${proxyPort}`;
                        }
                        startAuthFlow('proxy', fullProxy);
                     }}
                     className="w-full flex items-center justify-center gap-2 py-3 bg-red-100 border border-red-500 text-red-600 text-[8px] font-black uppercase tracking-widest hover:bg-red-200 transition-all"
                   >
                     <Unlock size={12} />
                     <span>Всё равно добавить (Пропустить проверку)</span>
                   </motion.button>
                 )}
               </AnimatePresence>
             </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar min-h-[150px] max-h-[250px]">
            {sessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-700 p-4 rounded-lg group">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-8 h-8 bg-zinc-950 flex items-center justify-center text-white"><UserIcon size={14} /></div>
                    <div className={cn("absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-700", session.active ? "bg-green-500" : "bg-red-500")} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[10px] font-black text-white uppercase tracking-tight leading-none">{session.name}</h4>
                    <p className="text-[7px] text-zinc-400 font-bold uppercase mt-1 truncate max-w-[190px]">{session.proxy || 'Прямое подключение'}</p>
                    <p className={cn("text-[7px] font-black uppercase mt-1", session.status === 'ACTIVE' ? 'text-green-400' : session.status === 'COOLDOWN' ? 'text-amber-400' : 'text-red-400')}>
                      {SESSION_STATUS_LABELS[session.status || 'DISABLED'] || session.status}
                      {session.consecutiveFailures ? ` · ошибок подряд: ${session.consecutiveFailures}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleSession(session)}
                    disabled={session.status === 'AUTHORIZING' || session.status === 'AUTH_REQUIRED'}
                    title={session.active ? 'Поставить на паузу' : 'Включить аккаунт'}
                    className="text-zinc-500 hover:text-amber-400 disabled:opacity-30 transition-colors p-1.5"
                  >
                    <Activity size={12} />
                  </button>
                  <button onClick={() => handleDeleteSession(session.id)} title="Удалить аккаунт" className="text-zinc-500 hover:text-red-500 transition-colors p-1.5"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 pt-6 border-t border-zinc-700 space-y-2">
            <label className="text-[8px] font-black text-zinc-400 uppercase tracking-[0.3em] block ml-1">Основной канал</label>
            <div className="relative">
              <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={12} />
              <input 
                type="text" 
                value={settings['maks_main_channel'] || ''}
                onChange={(e) => {
                  setSettings({ ...settings, maks_main_channel: e.target.value });
                  setHasUnsavedChanges(true);
                }}
                placeholder="maks_lead_source" 
                className={inputClasses}
              />
            </div>
            <div className="flex items-center justify-between mt-6 mb-2">
              <label className="text-[8px] font-black text-white uppercase tracking-[0.3em] ml-1">Использовать ИИ (DeepSeek) для анализа</label>
              <button 
                onClick={() => {
                  setSettings({ ...settings, maks_ai_enabled: settings['maks_ai_enabled'] === 'true' ? 'false' : 'true' });
                  setHasUnsavedChanges(true);
                }}
                className={cn(
                  "w-10 h-5 rounded-full flex items-center transition-colors px-1",
                  settings['maks_ai_enabled'] === 'true' ? "bg-accent" : "bg-zinc-700"
                )}
              >
                <div className={cn(
                  "w-3.5 h-3.5 rounded-full bg-black transition-transform",
                  settings['maks_ai_enabled'] === 'true' ? "translate-x-5" : "translate-x-0"
                )} />
              </button>
            </div>
            {settings['maks_ai_enabled'] === 'true' && (
              <>
                <label className="text-[8px] font-black text-zinc-400 uppercase tracking-[0.3em] block ml-1 mt-4">API Ключ ИИ (DeepSeek / GPT)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={12} />
                    <input 
                      type="password" 
                      value={settings['maks_ai_api_key'] || ''}
                      onChange={(e) => {
                        setSettings({ ...settings, maks_ai_api_key: e.target.value });
                        setHasUnsavedChanges(true);
                        setAiStatus('idle');
                      }}
                      placeholder="sk-..." 
                      className={cn(
                        inputClasses,
                        aiStatus === 'success' ? "border-green-500 focus:ring-green-500" :
                        aiStatus === 'error' ? "border-red-500 focus:ring-red-500" :
                        ""
                      )}
                    />
                  </div>
                  <button
                    onClick={handleVerifyAiKey}
                    disabled={verifyingAi || !settings['maks_ai_api_key']}
                    className={cn(
                      "px-4 text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 border border-zinc-700",
                      verifyingAi ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" :
                      aiStatus === 'success' ? "bg-green-100 text-green-700 hover:bg-green-200 border-green-500" :
                      aiStatus === 'error' ? "bg-red-100 text-red-700 hover:bg-red-200 border-red-500" :
                      "bg-zinc-900 text-white hover:bg-zinc-800"
                    )}
                  >
                    {verifyingAi ? <Loader2 className="animate-spin" size={14} /> : 
                     aiStatus === 'success' ? <CheckCircle2 size={14} /> : 
                     aiStatus === 'error' ? <AlertCircle size={14} /> : 
                     <Zap size={14} />}
                    <span>{verifyingAi ? 'Проверка...' : 'Проверить'}</span>
                  </button>
                </div>
                {aiStatus === 'error' && (
                  <p className="text-[10px] text-red-500 mt-2 px-1">{aiErrorMsg}</p>
                )}
                {aiStatus === 'success' && (
                  <p className="text-[10px] text-green-500 mt-2 px-1">Ключ работает отлично. Баланс активен!</p>
                )}
              </>
            )}

            <div className="mt-6 pt-6 border-t border-zinc-700 space-y-2">
              <label className="text-[8px] font-black text-zinc-400 uppercase tracking-[0.3em] block ml-1">Антиспам / Стоп-слова</label>
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={12} />
                <textarea 
                  value={settings['maks_spam_keywords'] || ''}
                  onChange={(e) => {
                    setSettings({ ...settings, maks_spam_keywords: e.target.value });
                    setHasUnsavedChanges(true);
                  }}
                  placeholder="накрутка, эскорт, ищу работу..." 
                  className={cn(inputClasses, "min-h-[80px] py-3 resize-y")}
                />
              </div>
              <p className="text-[9px] text-zinc-500 ml-1 leading-relaxed font-bold">
                <span className="text-accent">Как заполнять:</span> Вводите слова или фразы <strong className="text-white">через запятую</strong>. Регистр букв не важен. <br/>
                Например: <code className="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded">ищу работу, предлагаю услуги, качественно и недорого</code><br/>
                Лиды, содержащие эти слова, будут автоматически улетать в СПАМ.
              </p>
            </div>

          </div>
        </div>

        {/* PARSING CARD */}
        <div className="bg-zinc-900 border border-zinc-700 p-8 rounded-xl flex flex-col h-full">
          <div className="flex flex-col gap-4 rounded-lg mb-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border border-zinc-700 bg-zinc-950 flex items-center justify-center text-white"><Bot size={14} /></div>
                <div>
                  <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-zinc-400">Очередь чатов</h3>
                  <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Статус парсера</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleAutoParseToggle(!autoParseEnabled)}
                className={cn(
                  'px-4 py-2 border border-zinc-700 text-[9px] font-black uppercase transition-all',
                  autoParseEnabled ? 'bg-accent text-black' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                )}
              >
                {autoParseEnabled ? 'АВТО ВКЛ' : 'АВТО ВЫКЛ'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold">
              <span>{syncing ? 'РАБОТАЕТ СЕЙЧАС' : autoParseEnabled ? `В ОЧЕРЕДИ ${nextRunSeconds !== null ? `${Math.floor(nextRunSeconds/60)}:${String(nextRunSeconds % 60).padStart(2,'0')}` : ''}` : 'РУЧНОЙ РЕЖИМ'}</span>
              <select
                value={parseInterval}
                onChange={(e) => handleIntervalChange(parseInt(e.target.value, 10))}
                disabled={!autoParseEnabled}
                className="bg-zinc-900 border border-zinc-700 py-1.5 px-3 text-[9px] font-black text-white uppercase focus:ring-1 focus:ring-black appearance-none cursor-pointer outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="60">1 МИН</option>
                <option value="180">3 МИН</option>
                <option value="300">5 МИН</option>
                <option value="600">10 МИН</option>
                <option value="900">15 МИН</option>
                <option value="1800">30 МИН</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
              <input 
                type="text" 
                value={newChat}
                onChange={(e) => setNewChat(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addChat()}
                placeholder="max.ru/..." 
                className={inputClasses}
              />
            </div>
            <button onClick={addChat} className="bg-zinc-800 text-white rounded-lg px-4 border border-zinc-700 hover:bg-zinc-700 transition-all"><Plus size={16}/></button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar min-h-[150px] max-h-[300px] mb-6">
            {parsingChats.map((chat) => (
              <div key={chat.url} className="bg-zinc-900 border border-zinc-700 p-3.5 flex items-center justify-between group">
                <div className="flex flex-col gap-0.5 cursor-pointer" onClick={() => editChatName(chat.url)}>
                <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full border border-zinc-700",
                          currentParsingChat === chat.url ? "bg-amber-500" : sessions.length > 0 ? "bg-green-500" : "bg-gray-400"
                        )} />
                        {currentParsingChat === chat.url && <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping border border-zinc-700" />}
                      </div>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-tight transition-colors text-white hover:text-accent"
                      )}>
                        {chat.name} <span className="text-zinc-400 ml-1">[{chat.count || 0}]</span>
                      </span>
                      {chat.parseAll && <span className={cn("text-[6px] font-black px-1.5 py-0.5 uppercase border", sessions.length > 0 ? "bg-green-900/30 text-green-400 border-green-800 rounded-lg" : "bg-zinc-800 text-zinc-500 border-zinc-700")}>ВСЁ</span>}
                      {!chat.parseAll && <span className={cn("text-[6px] font-black px-1.5 py-0.5 uppercase border", sessions.length > 0 ? "bg-yellow-900/30 text-yellow-400 border-yellow-800 rounded-lg" : "bg-zinc-800 text-zinc-500 border-zinc-700")}>ЦЕЛЕВЫЕ</span>}
                    </div>
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-[0.2em]">{chat.url}</span>
                  {chat.lastParsedAt && (
                    <span className="text-[8px] text-zinc-400 uppercase tracking-[0.2em] mt-1 block font-bold">Последний парсинг: {new Date(chat.lastParsedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => toggleChatMode(chat.url)} 
                    className={cn(
                      "p-2.5 transition-all border border-zinc-700",
                      chat.parseAll 
                        ? "bg-green-900/30 text-green-400 hover:bg-green-100" 
                        : "bg-yellow-900/30 text-yellow-400 hover:bg-yellow-100"
                    )}
                    title={chat.parseAll ? "Парсинг всего контента" : "Парсинг по категориям"}
                  >
                    <Activity size={14}/>
                  </button>
                  {chat.count !== undefined && (
                    <span className="text-[8px] text-zinc-500 uppercase tracking-[0.15em] ml-2 font-black">{chat.count} лидов</span>
                  )}
                  <button onClick={() => removeChat(chat.url)} className="text-zinc-500 hover:text-red-500 transition-colors p-2"><Trash2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-[9px] text-zinc-400 uppercase tracking-widest mb-6 space-y-1.5 bg-zinc-950 p-3 border border-zinc-700">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 border border-zinc-700"></div>
              <span className="font-black">— Парсятся абсолютно все сообщения</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 border border-zinc-700"></div>
              <span className="font-black">— Парсятся только подходящие под категории</span>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-zinc-700">
            <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-700 space-y-2">
              <div className="flex items-center justify-between text-[7px] font-black uppercase tracking-[0.2em] text-zinc-400">
                <span className="flex items-center gap-1.5"><Activity size={8} /> Лог событий</span>
                <span className="flex items-center gap-1">
                  {syncing && <Loader2 className="animate-spin" size={6} />}
                  {syncing ? 'ПАРСИНГ' : 'ГОТОВ'}
                </span>
              </div>
              <div className="space-y-1 max-h-[60px] overflow-y-auto text-[7px] font-mono text-zinc-300 leading-tight custom-scrollbar uppercase font-bold">
                {logs.map((log, i) => (
                  <div key={i} className={cn("flex gap-2", log.type === 'success' ? "text-green-600" : log.type === 'error' ? "text-red-600" : "")}>
                    <span>[{log.time}]</span>
                    <span>{log.msg}</span>
                  </div>
                ))}
              </div>
            </div>

            {!autoParseEnabled && (
              <button 
                onClick={handleSync}
                disabled={syncing || sessions.length === 0}
                className={cn(
                  "neon-button w-full flex items-center justify-center gap-3",
                  sessions.length === 0 ? "opacity-50 cursor-not-allowed hover:bg-accent" : ""
                )}
              >
                <div className="flex items-center justify-center gap-3 w-full">
                  {syncing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                  <span className="leading-none text-sm font-black uppercase">ЗАПУСТИТЬ ПАРСИНГ</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); }
      `}</style>

      {/* Unsaved Changes Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 bg-zinc-950/80 z-50 flex items-center justify-center p-4 rounded-lg">
          <div className="bg-zinc-900 border-2 border-zinc-700 p-8 rounded-xl max-w-sm w-full text-center space-y-6 shadow-2xl rounded-xl">
            <div className="w-16 h-16 border-2 border-zinc-700 bg-accent flex items-center justify-center mx-auto text-black mb-4">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-lg font-black text-white uppercase tracking-widest">Несохраненные изменения</h2>
            <p className="text-sm font-bold text-zinc-400">Вы внесли изменения в настройки, но не сохранили их. Если вы уйдете сейчас, изменения будут потеряны.</p>
            <div className="space-y-3 pt-4">
              <button 
                onClick={async () => {
                  await handleSave();
                  window.location.href = showUnsavedModal;
                }} 
                className="bg-accent text-black font-black uppercase tracking-widest border border-accent hover:bg-[#F2FF00] active:scale-95 transition-all rounded-lg w-full text-xs py-3"
              >
                Сохранить и выйти
              </button>
              <button 
                onClick={() => window.location.href = showUnsavedModal} 
                className="w-full py-3 bg-red-100 border border-red-500 text-red-600 font-black uppercase tracking-widest text-xs hover:bg-red-200 transition-colors"
              >
                Выйти без сохранения
              </button>
              <button 
                onClick={() => setShowUnsavedModal(null)} 
                className="w-full py-3 bg-zinc-800 border border-zinc-700 text-zinc-400 font-black uppercase tracking-widest text-xs hover:bg-zinc-700 hover:text-white transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-zinc-950/80 z-50 flex items-center justify-center p-4 rounded-lg">
          <div className="bg-zinc-900 border-2 border-zinc-700 p-8 rounded-xl max-w-lg w-full shadow-2xl rounded-xl">
            <h2 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <HelpCircle className="text-white" /> Инструкция
            </h2>
            <div className="space-y-4 text-xs text-zinc-400 leading-relaxed font-bold">
              <p>Настройки платформы Макс позволяют управлять парсингом лидов:</p>
              <ul className="list-disc pl-4 space-y-3 mt-4">
                <li><strong className="text-white">Аккаунты:</strong> добавьте прокси и авторизуйте аккаунт мессенджера <span className="text-accent bg-zinc-950 px-1 border border-zinc-700">Max</span> по QR-коду.</li>
                <li><strong className="text-white">Очередь чатов:</strong> добавьте ссылки на чаты (вида web.max.ru/...).</li>
                <li><strong className="text-white">Режим парсинга:</strong> кнопка <Activity className="inline-block" size={10}/> напротив чата позволяет выбрать:
                  <div className="mt-2 pl-2 space-y-1">
                    <div className="text-green-600 font-black border border-green-600 bg-green-50 px-2 py-1 inline-block mt-1">«Зеленый статус» — собираются абсолютно все сообщения.</div>
                    <div className="text-yellow-600 font-black border border-yellow-600 bg-yellow-50 px-2 py-1 inline-block mt-1">«Желтый статус» — только целевые (подходящие под категории).</div>
                  </div>
                </li>
              </ul>
            </div>
            <button onClick={() => setShowHelp(false)} className="mt-8 w-full py-3 bg-zinc-950 hover:bg-zinc-700 text-white font-black uppercase tracking-widest text-xs transition-colors border border-zinc-700">
              Понятно, закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
