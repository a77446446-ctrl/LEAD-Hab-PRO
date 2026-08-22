'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Define the global callback for Max auth
    (window as any).onMaxAuth = (user: any) => {
      console.log('Max User Auth:', user);
      localStorage.setItem('user', JSON.stringify(user));
      router.push('/dashboard');
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col items-center justify-between p-6 overflow-hidden relative font-sans">
      
      {/* Top Logo */}
      <div className="pt-10 flex items-center justify-center">
        <div className="flex items-center">
          <div className="bg-black text-white px-3 py-1.5 text-[32px] font-black tracking-tighter leading-none">ПО</div>
          <div className="bg-accent text-black px-3 py-1.5 text-[32px] font-black tracking-tighter leading-none">ДЕЛАМ</div>
        </div>
      </div>

      {/* Middle Illustration */}
      <div className="flex-1 w-full max-w-sm flex items-center justify-center my-6">
        <img 
          src="/hero-illustration.jpg" 
          alt="Workers Illustration" 
          className="w-full h-auto object-contain mix-blend-multiply"
          onError={(e) => {
             // Fallback if image doesn't exist
             e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      {/* Bottom Content Area */}
      <div className="w-full max-w-sm space-y-4 pb-6 relative z-10">
        
        {/* Text Box */}
        <div className="bg-white border-2 border-black p-6 space-y-4">
          <h1 className="text-black font-black text-lg uppercase tracking-tight leading-tight">
            ВАШ АГРЕГАТОР ЗАКАЗОВ
          </h1>
          <p className="text-[#555] text-sm font-medium leading-relaxed">
            Получайте свежие заявки на ремонт, электрику, сантехнику, строительство и другие услуги прямо в Макс или Telegram. Быстро, удобно и без лишних посредников.
          </p>
        </div>

        {/* Max Login Widget / Action Button */}
        <div className="relative" id="max-login-container">
          <button 
            onClick={() => {
              (window as any).onMaxAuth({
                id: 12345678,
                first_name: "Пользователь",
                username: "user_max",
                hash: "fake_hash"
              });
            }}
            className="w-full bg-accent text-black border-2 border-black py-4 text-sm font-black uppercase tracking-widest hover:bg-[#F2FF00] active:scale-[0.98] transition-all"
          >
            [ НАЧАТЬ РАБОТУ ]
          </button>
        </div>
        
        {/* Local Dev Bypass */}
        {mounted && window.location.hostname === 'localhost' && (
          <button 
            onClick={() => {
              (window as any).onMaxAuth({
                id: 12345678,
                first_name: "Admin",
                username: "admin_dev",
                hash: "fake_hash"
              });
            }}
            className="w-full mt-2 py-2 bg-black/5 border border-dashed border-black/20 text-[#666] text-[8px] font-black uppercase tracking-widest hover:border-black hover:text-black transition-all"
          >
            [ DEV MODE: Вход без проверки ]
          </button>
        )}
      </div>
    </div>
  );
}
