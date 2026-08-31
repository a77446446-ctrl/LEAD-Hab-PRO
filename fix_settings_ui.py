import re

with open('src/app/(admin)/admin/settings/page.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. State
c = c.replace(
    'const [parseInterval, setParseInterval] = useState<number>(300);',
    'const [parseInterval, setParseInterval] = useState<number>(300);\n  const [leadRetentionDays, setLeadRetentionDays] = useState<number>(7);'
)

# 2. Fetch
c = c.replace(
    "const interval = parseInt(settingsMap['maks_parser_interval'] || '300', 10);",
    "const interval = parseInt(settingsMap['maks_parser_interval'] || '300', 10);\n      setLeadRetentionDays(parseInt(settingsMap['lead_retention_days'] || '7', 10));"
)

# 3. Save Handler
c = c.replace(
    'const handleIntervalChange = (newInterval: number) => {',
    '''const handleRetentionDaysChange = async (days: number) => {
    setLeadRetentionDays(days);
    try {
      await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'lead_retention_days', value: String(days) }),
      });
      addLog(Срок хранения лидов изменен на  дн., 'info');
    } catch (e) {}
  };

  const handleIntervalChange = (newInterval: number) => {'''
)

# 4. UI chunk
ui_chunk = '''
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-zinc-700 bg-zinc-800 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-black/50">
                    <Trash2 className="text-zinc-400" size={16} />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-black uppercase text-white tracking-widest">Очистка базы данных</h3>
                    <p className="mt-1 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Удаление старых лидов</p>
                  </div>
                </div>
              </div>
              <div className="flex min-w-0 items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold">
                <span className="min-w-0 truncate">Срок хранения</span>
                <select
                  value={leadRetentionDays}
                  onChange={(e) => handleRetentionDaysChange(parseInt(e.target.value, 10))}
                  className="shrink-0 bg-zinc-900 border border-zinc-700 py-1.5 px-3 text-[9px] font-black text-white uppercase focus:ring-1 focus:ring-black appearance-none cursor-pointer outline-none"
                >
                  <option value="1">1 ДЕНЬ</option>
                  <option value="3">3 ДНЯ</option>
                  <option value="7">7 ДНЕЙ</option>
                  <option value="14">14 ДНЕЙ</option>
                  <option value="30">30 ДНЕЙ</option>
                  <option value="90">90 ДНЕЙ</option>
                </select>
              </div>
            </div>
            '''

c = c.replace(
    '              </div>\n            </div>\n  \n            <div className="flex gap-2 mb-4">',
    '              </div>\n            </div>\n' + ui_chunk + '  \n            <div className="flex gap-2 mb-4">'
)

with open('src/app/(admin)/admin/settings/page.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('Updated settings page!')
