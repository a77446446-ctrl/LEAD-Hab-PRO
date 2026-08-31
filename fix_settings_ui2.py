with open('src/app/(admin)/admin/settings/page.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

ui_chunk = '''
              <div className="flex min-w-0 items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold mt-2 pt-3 border-t border-zinc-700">
                <span className="min-w-0 truncate">Ручная очистка базы</span>
                <button
                  onClick={async () => {
                    if(!confirm('Запустить очистку прямо сейчас?')) return;
                    try {
                      const res = await fetch('/api/admin/system/cleanup', { method: 'POST' });
                      const data = await res.json();
                      if (data.success) {
                        addLog(Очистка завершена. Скрыто: , Удалено: , Очищено: , 'success');
                      }
                    } catch(e) {}
                  }}
                  className="bg-black text-white px-3 py-1.5 rounded hover:bg-zinc-800 transition-colors"
                >
                  ЗАПУСТИТЬ
                </button>
              </div>
'''

c = c.replace('</select>\n              </div>\n            </div>', '</select>\n              </div>\n' + ui_chunk + '            </div>')

with open('src/app/(admin)/admin/settings/page.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
