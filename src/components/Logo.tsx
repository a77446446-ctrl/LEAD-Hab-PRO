import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Logo({ className, size = 'lg' }: LogoProps) {
  const sizes = {
    sm: 'text-sm px-2 py-1',
    md: 'text-xl px-2.5 py-1',
    lg: 'text-[32px] px-3 py-1.5',
    xl: 'text-5xl px-4 py-2',
  };

  const tailSizes = {
    sm: 'w-[0.4em] h-[0.4em] -bottom-[0.1em] -right-[0.15em]',
    md: 'w-[0.4em] h-[0.4em] -bottom-[0.1em] -right-[0.15em]',
    lg: 'w-[0.4em] h-[0.4em] -bottom-[0.1em] -right-[0.15em]',
    xl: 'w-[0.4em] h-[0.4em] -bottom-[0.1em] -right-[0.15em]',
  };

  return (
    <div className={cn("flex items-center select-none", className)}>
      <div className={cn(
        "bg-[#111] text-white font-black tracking-tighter leading-none rounded-l-lg flex items-center z-10",
        sizes[size]
      )}>
        П
        <span className="relative inline-block leading-none">
          О
          {/* SVG tail to make the "О" look like a chat bubble */}
          <svg 
            className={cn("absolute text-white pointer-events-none drop-shadow-sm", tailSizes[size])} 
            viewBox="0 0 10 10" 
            fill="currentColor"
          >
            <path d="M0,0 L10,0 L5,10 Z" transform="rotate(-15 5 5)" />
          </svg>
        </span>
      </div>
      <div className={cn(
        "bg-accent text-black font-black tracking-tighter leading-none rounded-r-lg -ml-[1px]",
        sizes[size]
      )}>
        ДЕЛАМ
      </div>
    </div>
  );
}
