import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();
    
    if (!apiKey) {
      return NextResponse.json({ success: false, message: 'Ключ не указан' });
    }

    const isProbablyOpenAI = apiKey.startsWith('sk-proj-') || apiKey.startsWith('sk-ant-');
    const apiUrl = isProbablyOpenAI 
      ? 'https://api.openai.com/v1/chat/completions' 
      : 'https://api.deepseek.com/chat/completions'; 
    const model = isProbablyOpenAI ? 'gpt-4o-mini' : 'deepseek-chat';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5
      })
    });

    if (response.ok) {
      return NextResponse.json({ success: true, message: 'API ключ работает отлично!' });
    } else {
      const errText = await response.text();
      let errorMsg = `Ошибка ${response.status}`;
      if (response.status === 401) errorMsg = 'Ошибка 401: Неверный API ключ';
      else if (response.status === 402) errorMsg = 'Ошибка 402: Нулевой баланс';
      else if (response.status === 400) errorMsg = 'Ошибка 400: Неверный запрос';
      
      return NextResponse.json({ 
        success: false, 
        message: `${errorMsg}. Ответ сервера: ${errText.substring(0, 100)}` 
      });
    }

  } catch (error: any) {
    return NextResponse.json({ success: false, message: 'Ошибка соединения: ' + error.message });
  }
}
