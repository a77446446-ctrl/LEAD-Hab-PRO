'use client';

import React from 'react';
import { Check, Zap } from 'lucide-react';

const PLANS = [
  {
    id: 'electric-pro',
    name: 'Электрик PRO',
    price: 300,
    features: ['Безлимитные лиды', 'Уведомления первыми', 'Приоритетная поддержка'],
    color: '#E6F000'
  },
  {
    id: 'repair-pro',
    name: 'Ремонт техники PRO',
    price: 500,
    features: ['Все заказы категории', 'AI анализ сложности', 'Статистика цен'],
    color: '#00F0FF'
  },
  {
    id: 'all-inclusive',
    name: 'MAX HUB Pass',
    price: 2500,
    features: ['Доступ ко ВСЕМ категориям', 'Скидка на топ-лиды 50%', 'Личный менеджер'],
    color: '#FF00E5'
  }
];

export default function SubscriptionsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-black">Подписки</h2>
        <p className="text-[#666] text-sm font-bold uppercase">Получайте заказы бесплатно с PRO аккаунтом</p>
      </div>

      <div className="space-y-6">
        {PLANS.map((plan) => (
          <div key={plan.id} className="glass-panel p-6 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold mb-1 text-black uppercase">{plan.name}</h3>
                <div className="text-3xl font-black text-black">
                  {plan.price} ₽ <span className="text-sm font-bold text-[#666]">/ мес</span>
                </div>
              </div>
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center border border-black"
                style={{ backgroundColor: `${plan.color}20`, color: plan.color === '#E6F000' || plan.color === '#E4FF00' ? '#000' : plan.color }}
              >
                <Zap fill="currentColor" />
              </div>
            </div>

            <ul className="space-y-3 mb-8">
              {plan.features.map((feat, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-[#333] font-bold">
                  <div className="bg-black/5 border border-black/10 p-1 rounded-full">
                    <Check size={12} className="text-black" />
                  </div>
                  {feat}
                </li>
              ))}
            </ul>

            <button className="neon-button w-full">
              Активировать PRO
            </button>
            
            {/* Ambient background */}
            <div 
              className="absolute -right-10 -bottom-10 w-40 h-40 blur-3xl opacity-10 rounded-full"
              style={{ backgroundColor: plan.color }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
