'use client';

import React, { useState, useEffect } from 'react';
import { BottomNav } from '@/components/ui/BottomNav';
import { useUser } from '@/store/useUser';
import { Wallet, ArrowUp } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useUser();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#efefef] text-black pb-24 relative">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-black px-6 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <div className="bg-black text-white px-2 py-1 text-xl font-black tracking-tighter leading-none">ПО</div>
          <div className="bg-accent text-black px-2 py-1 text-xl font-black tracking-tighter leading-none">ДЕЛАМ</div>
        </div>
        
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <Wallet size={16} className="text-black" />
          <span className="text-sm font-black">{user?.balance} ₽</span>
        </div>
      </header>

      <main className="px-6 py-6 max-w-2xl mx-auto">
        {children}
      </main>

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-4 z-40 bg-accent text-black p-3 border border-black shadow-[4px_4px_0_0_#000] hover:bg-[#F2FF00] hover:-translate-y-1 transition-all"
        >
          <ArrowUp size={24} className="stroke-[3]" />
        </button>
      )}

      <BottomNav />
    </div>
  );
}
