'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

export function LegalAcceptanceCard() {
  const [version, setVersion] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [privacyRead, setPrivacyRead] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/legal/acceptance', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Не удалось проверить согласие');
        return response.json() as Promise<{ version: string; accepted: boolean }>;
      })
      .then((data) => { setVersion(data.version); setAccepted(data.accepted); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Ошибка'))
      .finally(() => setLoading(false));
  }, []);

  const accept = async () => {
    if (!offerAccepted || !privacyRead || !consentGiven || !version) return;
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/legal/acceptance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptedDocuments: ['OFFER', 'PRIVACY', 'CONSENT'], version }),
      });
      const data = await response.json() as { accepted?: boolean; error?: string };
      if (!response.ok || !data.accepted) throw new Error(data.error || 'Не удалось сохранить согласие');
      setAccepted(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ошибка'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="glass-panel flex items-center gap-2 p-4 text-sm"><Loader2 className="animate-spin" size={18} /> Проверка документов…</div>;
  if (accepted) return <div className="glass-panel flex items-center gap-3 border-black p-4"><CheckCircle2 size={22} /><div><p className="font-black uppercase">Документы приняты</p><p className="text-xs text-zinc-600">Версия {version}. Новое согласие потребуется при существенном обновлении.</p></div></div>;

  return <div className="glass-panel space-y-4 border-black p-4">
    <p className="font-black uppercase">Подтвердите документы</p>
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-6"><input type="checkbox" checked={offerAccepted} onChange={(event) => setOfferAccepted(event.target.checked)} className="mt-1 h-4 w-4" /><span>Я принимаю <Link className="underline" href="/legal/offer">публичную оферту</Link>.</span></label>
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-6"><input type="checkbox" checked={privacyRead} onChange={(event) => setPrivacyRead(event.target.checked)} className="mt-1 h-4 w-4" /><span>Я ознакомлен с <Link className="underline" href="/legal/privacy">политикой конфиденциальности</Link>.</span></label>
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-6"><input type="checkbox" checked={consentGiven} onChange={(event) => setConsentGiven(event.target.checked)} className="mt-1 h-4 w-4" /><span>Отдельно даю <Link className="underline" href="/legal/consent">согласие на обработку персональных данных</Link>.</span></label>
    {error && <p className="text-sm text-red-700">{error}</p>}
    <button type="button" disabled={!offerAccepted || !privacyRead || !consentGiven || saving} onClick={() => void accept()} className="w-full border border-black bg-black px-4 py-3 font-black uppercase text-white disabled:opacity-40">{saving ? 'Сохраняем…' : 'Подтвердить версию ' + version}</button>
  </div>;
}
