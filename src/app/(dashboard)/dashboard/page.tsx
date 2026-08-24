'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { LeadCard } from '@/components/cards/LeadCard';
import { useUser } from '@/store/useUser';
import { Search, Filter, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
interface CategoryPreference {
  id: string;
  name: string;
  notifyEnabled: boolean;
}

export default function DashboardPage() {
  const { user, setBalance, setNotifyEnabled } = useUser();
  const searchParams = useSearchParams();
  const focusedLeadId = searchParams.get('lead');
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeCity, setActiveCity] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryPreferences, setCategoryPreferences] = useState<CategoryPreference[]>([]);

  const fetchLeads = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const leadQuery = focusedLeadId ? `&leadId=${encodeURIComponent(focusedLeadId)}` : '';
      const response = await fetch(`/api/leads?status=NEW&take=200${leadQuery}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setLeads(data);
      } else {
        console.error('API returned non-array:', data);
      }
    } catch (error) {
      console.error('Failed to fetch leads', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [focusedLeadId]);

  useEffect(() => {
    fetchLeads();
    fetch('/api/preferences/categories', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : [])
      .then((data) => setCategoryPreferences(Array.isArray(data) ? data : []))
      .catch(() => setCategoryPreferences([]));

    const intervalId = setInterval(() => fetchLeads(false), 15_000);
    return () => clearInterval(intervalId);
  }, [fetchLeads]);

  const toggleCategoryNotifications = async (category: CategoryPreference) => {
    const enabled = !category.notifyEnabled;
    const response = await fetch('/api/preferences/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: category.id, enabled }),
    });
    const data = await response.json() as { error?: string; code?: string; botUrl?: string };
    if (!response.ok) {
      if (data.code === 'BOT_NOT_STARTED' && data.botUrl) window.WebApp?.openMaxLink?.(data.botUrl);
      alert(data.error || 'Не удалось изменить подписку');
      return;
    }
    setCategoryPreferences((items) => items.map((item) => item.id === category.id ? { ...item, notifyEnabled: enabled } : item));
    if (enabled) setNotifyEnabled(true);
  };

  const [modal, setModal] = useState<{show: boolean, type: 'balance' | 'sub' | 'success' | null, msg: string}>({show: false, type: null, msg: ''});

  const handleBuyLead = async (leadId: string) => {
    if (!user) return;
    try {
      const res = await fetch('/api/buy-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId })
      });
      const data = await res.json();
      if (data.error) {
        if (data.code === 'INSUFFICIENT_BALANCE') {
          setModal({ show: true, type: 'balance', msg: 'Недостаточно средств. Пополните кошелек, чтобы забрать этот лид.' });
        } else if (data.code === 'SUBSCRIPTION_REQUIRED') {
          setModal({ show: true, type: 'sub', msg: 'Этот лид доступен только по подписке. Оформите PRO-доступ к категории.' });
        } else {
          setModal({ show: true, type: null, msg: data.error });
        }
        return;
      }
      if (typeof data.newBalance === 'number') setBalance(data.newBalance);
      setModal({ show: true, type: 'success', msg: 'Контакт успешно забран! Он теперь находится в разделе "Мои лиды".' });
      setLeads((currentLeads) => currentLeads.filter((lead) => lead.id !== leadId));
    } catch (err) {
      console.error(err);
      setModal({ show: true, type: null, msg: 'Произошла ошибка при покупке' });
    }
  };

  // Extract unique categories and cities from available leads
  const availableCategories = Array.from(new Set(leads.map(l => l.category?.name))).filter(Boolean);
  const availableCities = Array.from(new Set(leads.map(l => l.city))).filter(Boolean).sort();

  const filteredLeads = leads.filter(l => {
    const matchesCat = activeCategory === 'all' || l.category?.name === activeCategory;
    const matchesCity = activeCity === 'all' || l.city === activeCity;
    const matchesSearch = l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          l.rawText.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          l.city.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesCity && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#999]" size={18} />
          <input 
            type="text" 
            placeholder="Поиск заказов..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-black py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-colors placeholder:text-[#999] text-black"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Categories */}
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setActiveCategory('all')}
                className={`whitespace-nowrap px-4 py-2 text-xs font-black uppercase border border-black transition-all ${
                  activeCategory === 'all' 
                  ? 'bg-black text-white' 
                  : 'bg-white text-black hover:bg-gray-100'
                }`}
              >
                Все
              </button>
              {availableCategories.map((catName: string) => (
                <button
                  key={catName}
                  onClick={() => setActiveCategory(catName)}
                  className={`whitespace-nowrap px-4 py-2 text-xs font-black uppercase border border-black transition-all ${
                    activeCategory === catName 
                    ? 'bg-black text-white' 
                    : 'bg-white text-black hover:bg-gray-100'
                  }`}
                >
                  {catName}
                </button>
              ))}
            </div>
          </div>
          
          {/* Cities Dropdown */}
          <div className="w-full sm:w-48 shrink-0">
            <select 
              value={activeCity}
              onChange={(e) => setActiveCity(e.target.value)}
              className="w-full bg-white border border-black px-3 py-2 text-xs font-black uppercase focus:outline-none focus:ring-1 focus:ring-black appearance-none cursor-pointer"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'black\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1em' }}
            >
              <option value="all">ВСЕ ГОРОДА</option>
              {availableCities.map((city: string) => (
                <option key={city} value={city}>{city.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {categoryPreferences.length > 0 && (
        <div className="bg-white border border-black p-4 space-y-3">
          <div>
            <div className="text-xs font-black uppercase">Новые лиды в MAX</div>
            <div className="text-[11px] text-[#666] font-medium">Выберите категории, по которым бот будет присылать тизеры.</div>
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
      {/* Leads List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-sm font-black text-black/50 uppercase tracking-widest">Свежие лиды</h2>
          <button onClick={() => fetchLeads(true)} className="text-black text-xs font-black flex items-center gap-1 hover:text-black/70 transition-colors">
            <Filter size={14} />
            Обновить
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-accent" size={32} /></div>
        ) : filteredLeads.length > 0 ? (
          filteredLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onBuy={handleBuyLead} highlighted={lead.id === focusedLeadId} />
          ))
        ) : (
          <div className="text-center py-20 text-white/20">
            Нет активных заказов
          </div>
        )}
        
        {/* Modal Window */}
        {modal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
            <div className="bg-white border-[3px] border-black p-6 w-full max-w-sm relative shadow-[8px_8px_0_0_#000]">
              <button 
                onClick={() => setModal({show: false, type: null, msg: ''})}
                className="absolute top-2 right-2 text-black font-black text-xl hover:text-accent"
              >
                ✕
              </button>
              
              <h3 className="text-xl font-black uppercase mb-4 mt-2">
                {modal.type === 'balance' ? 'Ошибка оплаты' : modal.type === 'sub' ? 'Нужна подписка' : modal.type === 'success' ? 'Успешно!' : 'Внимание'}
              </h3>
              
              <p className="text-sm font-medium mb-6 leading-relaxed">
                {modal.msg}
              </p>
              
              <button 
                onClick={() => setModal({show: false, type: null, msg: ''})}
                className={`w-full py-3 font-black text-sm uppercase tracking-wider border-2 border-black shadow-[4px_4px_0_0_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all ${
                  modal.type === 'success' ? 'bg-green-400 text-black' : 'bg-accent text-black'
                }`}
              >
                ПОНЯТНО
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
