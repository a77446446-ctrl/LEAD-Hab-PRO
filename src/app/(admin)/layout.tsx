'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Database, 
  Tags, 
  Users, 
  CreditCard, 
  Settings,
  Search,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';

const adminNav = [
  { icon: LayoutDashboard, label: 'Обзор', href: '/admin' },
  { icon: Database, label: 'Лиды', href: '/admin/leads' },
  { icon: Tags, label: 'Категории', href: '/admin/categories' },
  { icon: Users, label: 'Пользователи', href: '/admin/users' },
  { icon: CreditCard, label: 'Платежи', href: '/admin/payments' },
  { icon: Search, label: 'Детектив', href: '/admin/discovery' },
  { icon: Settings, label: 'Настройки МАКС', href: '/admin/settings' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-900 p-6 flex flex-col gap-8 rounded-tr-2xl rounded-br-2xl">
        <div>
          <div className="flex items-center">
            <div className="bg-white text-black px-2 py-1 text-xl font-black tracking-tighter leading-none rounded-l-lg">ADMIN</div>
            <div className="bg-accent text-black px-2 py-1 text-xl font-black tracking-tighter leading-none rounded-r-lg">PANEL</div>
          </div>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-2">Control Center</p>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {adminNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm font-black uppercase transition-all border border-transparent rounded-xl",
                  isActive ? "bg-accent border-accent text-black shadow-[0_0_15px_rgba(228,255,0,0.3)]" : "text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-800"
                )}
              >
                <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link 
          href="/dashboard"
          className="flex items-center gap-3 px-4 py-3 text-sm font-black text-zinc-400 uppercase hover:text-white hover:border hover:border-zinc-700 hover:bg-zinc-800 border border-transparent transition-all rounded-xl"
        >
          <ArrowLeft size={18} />
          В приложение
        </Link>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
