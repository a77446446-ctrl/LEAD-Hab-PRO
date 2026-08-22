import re

file_path = "d:/Рабочий стол D/GPT Ai/Projects/MAKS-LEAD-HUB/MAKS-LEAD-HUB/src/app/(admin)/admin/settings/page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replacements for dark mode
replacements = {
    'bg-[#efefef]': 'bg-zinc-950',
    'bg-white': 'bg-zinc-900',
    'border-black': 'border-zinc-700',
    'text-black': 'text-white',
    'text-[#666]': 'text-zinc-400',
    'text-[#999]': 'text-zinc-500',
    'bg-gray-50': 'bg-zinc-950',
    'bg-gray-100': 'bg-zinc-800',
    'bg-gray-200': 'bg-zinc-700',
    'shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]': 'shadow-2xl rounded-xl',
    'shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]': 'shadow-sm rounded-lg',
    'border-2 border-black': 'border border-zinc-700 rounded-xl',
    'bg-black text-white': 'bg-zinc-800 text-white rounded-lg',
    'text-white font-black': 'text-white font-black', # Preserve
    'bg-black': 'bg-zinc-950',
    'hover:bg-gray-100': 'hover:bg-zinc-800',
    'hover:bg-[#333]': 'hover:bg-zinc-700',
    'text-[#333]': 'text-zinc-300',
    'bg-red-100 border-red-500 text-red-600': 'bg-red-900/30 border-red-800 text-red-400 rounded-lg',
    'bg-green-100 text-green-700 border-green-500': 'bg-green-900/30 text-green-400 border-green-800 rounded-lg',
    'bg-yellow-100 text-yellow-700 border-yellow-500': 'bg-yellow-900/30 text-yellow-400 border-yellow-800 rounded-lg',
    'bg-green-50 text-green-600': 'bg-green-900/30 text-green-400',
    'bg-yellow-50 text-yellow-600': 'bg-yellow-900/30 text-yellow-400',
    'bg-red-50 text-red-600': 'bg-red-900/30 text-red-400',
    'bg-accent text-black': 'bg-accent text-black rounded-lg',
    'bg-accent border-black': 'bg-accent border-accent rounded-lg',
    'bg-[#F2FF00]': 'bg-[#F2FF00] rounded-lg',
    'p-8': 'p-8 rounded-xl',
    'p-4': 'p-4 rounded-lg',
    'p-6': 'p-6 rounded-xl',
}

for old, new in replacements.items():
    content = content.replace(old, new)

# Also let's ensure some common UI elements get rounded corners if they don't have them
content = re.sub(r'className="([^"]*)neon-button([^"]*)"', r'className="\1bg-accent text-black font-black uppercase tracking-widest border border-accent hover:bg-[#F2FF00] active:scale-95 transition-all rounded-lg\2"', content)
content = re.sub(r'className="w-full bg-zinc-900(.*?)outline-none"', r'className="w-full bg-zinc-900\1outline-none rounded-lg"', content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
    
print("Settings page updated.")
