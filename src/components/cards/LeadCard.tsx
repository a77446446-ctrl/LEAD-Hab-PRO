import React, { useState } from 'react';
import { MapPin, Zap, Clock } from 'lucide-react';

interface LeadCardProps {
  lead: any;
  onBuy?: (id: string) => void;
  isPurchased?: boolean;
  highlighted?: boolean;
}

export const LeadCard = ({ lead, onBuy, isPurchased, highlighted }: LeadCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const isInfo = lead.category?.slug === 'info' || lead.category?.name?.toLowerCase().includes('инфо');

  // Mask contacts if it's not purchased yet, regardless of price
  const shouldMask = !isPurchased && !isInfo;

  const renderTextWithLinks = (text: string, truncateAt?: number) => {
    if (!text) return null;
    const combinedRegex = /(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*|@[a-zA-Z0-9_]+|(?:\+?7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\b\d{10}\b)/g;
    
    let currentLength = 0;
    const parts = text.split(combinedRegex);
    const result: React.ReactNode[] = [];
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      
      let nodeToAdd: React.ReactNode = part;
      let charsToAdd = part.length;
      
      if (part.match(/(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*|@[a-zA-Z0-9_]+)/)) {
        charsToAdd = 16; 
        const isMapLink = /(yandex\.(ru|com)\/maps|maps\.yandex\.(ru|com)|2gis\.(ru|com)|go\.2gis\.com|maps\.google|goo\.gl\/maps)/i.test(part);
        
        if (shouldMask && !isMapLink) {
          nodeToAdd = <span key={i} className="bg-black text-white px-1.5 py-0.5 rounded text-xs font-bold whitespace-nowrap mx-1">Контакт скрыт 🔐</span>;
        } else {
          let href = part;
          if (part.startsWith('@')) href = `https://t.me/${part.substring(1)}`;
          else if (!part.startsWith('http')) href = `https://${part}`;
          
          let linkText = part;
          let linkClass = "px-1.5 py-0.5 rounded text-xs font-bold border border-black transition-all mx-1 inline-block whitespace-nowrap ";

          if (isMapLink) {
             if (part.includes('yandex')) linkText = '🗺️ Яндекс.Карты';
             else if (part.includes('2gis')) linkText = '🗺️ 2GIS';
             else if (part.includes('google') || part.includes('goo.gl')) linkText = '🗺️ Google Карты';
             else linkText = '🗺️ Карта';
             
             linkClass += "bg-white text-black shadow-[2px_2px_0_0_#000] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none";
          } else {
             linkClass += "bg-accent text-black hover:bg-black hover:text-white";
          }
          
          nodeToAdd = <a key={i} href={href} target="_blank" rel="noopener noreferrer" className={linkClass} onClick={(e) => e.stopPropagation()}>{linkText}</a>;
        }
      } else if (part.match(/(?:\+?7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|\b\d{10}\b/)) {
        charsToAdd = 16;
        if (shouldMask) {
          nodeToAdd = <span key={i} className="bg-accent text-black px-1.5 py-0.5 rounded text-xs font-bold border border-black whitespace-nowrap mx-1">Контакт скрыт 🔐</span>;
        } else {
          const cleanPhone = part.replace(/[^\d+]/g, '');
          nodeToAdd = <a key={i} href={`tel:${cleanPhone}`} className="bg-accent text-black px-1.5 py-0.5 rounded text-xs font-bold border border-black hover:bg-black hover:text-accent transition-colors mx-1" onClick={(e) => e.stopPropagation()}>{part}</a>;
        }
      } else {
        if (truncateAt && currentLength + charsToAdd > truncateAt) {
           nodeToAdd = part.substring(0, truncateAt - currentLength) + '...';
           result.push(<React.Fragment key={i}>{nodeToAdd}</React.Fragment>);
           break;
        }
      }
      
      result.push(<React.Fragment key={i}>{nodeToAdd}</React.Fragment>);
      currentLength += charsToAdd;
      
      if (truncateAt && currentLength >= truncateAt) {
         if (i < parts.length - 1 && typeof nodeToAdd !== 'string') result.push(<React.Fragment key={i + '_dots'}>...</React.Fragment>);
         break;
      }
    }
    
    return result;
  };

  return (
    <div id={`lead-${lead.id}`} className={`bg-white border-2 border-black p-4 md:p-5 flex flex-col h-full relative shadow-[4px_4px_0_0_#000] ${highlighted ? 'ring-4 ring-accent ring-offset-2' : ''}`}>
      <div className="flex-grow z-10 relative">
        {/* Background Watermark Image */}
        {lead.category?.imageUrl && (
          <div className="absolute bottom-0 right-2 w-40 h-40 opacity-[0.15] mix-blend-multiply pointer-events-none flex items-end justify-end z-[-1]">
            <img src={lead.category.imageUrl} alt="" className="max-w-full max-h-full object-contain grayscale" />
          </div>
        )}

        {/* Header (Category & Time) */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[9px] uppercase tracking-widest font-black px-2 py-0.5 border border-black w-fit ${
              isInfo ? 'bg-purple-500 text-white' : 'bg-black text-accent'
            }`}>
              {isInfo ? 'СИСТЕМА' : (lead.category?.name || 'Лид')}
            </span>
            {isPurchased && (
              <span className="text-[9px] uppercase tracking-widest font-black px-2 py-0.5 border border-black w-fit bg-green-500 text-black">
                ПОЛУЧЕНО
              </span>
            )}
          </div>
          <div className="flex items-center text-[#999] text-xs font-bold gap-1 ml-2 shrink-0">
            <Clock size={12} />
            {lead.createdAt ? new Date(lead.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '--:--'}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-black font-black text-sm uppercase leading-tight mb-4 tracking-tight">
          {lead.title}
        </h3>

        {/* Text Body */}
        <p className="text-[#333] text-[13px] leading-relaxed mb-6 font-medium whitespace-pre-wrap break-words">
          {expanded ? renderTextWithLinks(lead.rawText) : renderTextWithLinks(lead.rawText, 150)}
        </p>

        {(lead.rawText?.length || 0) > 150 && (
          <button 
            onClick={() => setExpanded(!expanded)}
            style={{ textShadow: '1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000, 0px 1px 0 #000, 0px -1px 0 #000, 1px 0px 0 #000, -1px 0px 0 #000' }}
            className="text-accent text-[9px] font-black uppercase tracking-widest hover:text-[#F2FF00] mb-4 border-b border-black pb-0.5"
          >
            {expanded ? 'Скрыть' : 'Подробнее...'}
          </button>
        )}
      </div>
      
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-[#ddd] relative">
        <div className="flex items-center gap-1.5 text-[#666] text-xs font-bold uppercase z-10 relative">
          <MapPin size={14} className={isInfo ? "text-purple-500" : "text-black"} />
          {lead.city}
        </div>
        {!isInfo && (
          <div className="text-[11px] font-black uppercase bg-white text-black px-2 py-1 border border-black shadow-[2px_2px_0_0_#F2FF00] z-10 relative">
            {lead.category?.paymentMode === 'SUBSCRIPTION' || lead.category?.paymentMode === 'PRO' 
              ? 'ПО ПОДПИСКЕ' 
              : (lead.price / 100) > 0 ? `${(lead.price / 100)} ₽` : 'БЕСПЛАТНО'}
          </div>
        )}
      </div>

      {onBuy && !isPurchased && !isInfo && (
        <button 
          onClick={() => onBuy(lead.id)}
          className="w-full mt-5 py-4 bg-accent text-black font-black text-sm border border-black hover:bg-[#F2FF00] active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-tighter"
        >
          Забрать контакт
        </button>
      )}

      {isPurchased && !isInfo && lead.status !== 'ARCHIVED' && (
        <div className="flex justify-center mt-5">
          <button 
            onClick={async () => {
              if (confirm('Удалить лид в архив?')) {
                 try {
                   await fetch('/api/archive-lead', { method: 'POST', body: JSON.stringify({ leadId: lead.id }) });
                   window.location.reload();
                 } catch (e) {}
              }
            }}
            className="w-[160px] py-2 font-black text-[10px] border border-black shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-3 uppercase tracking-tighter bg-white text-black hover:bg-gray-100"
          >
            <span className="text-red-500 text-sm leading-none font-bold">✕</span> В АРХИВ
          </button>
        </div>
      )}
    </div>
  );
};
