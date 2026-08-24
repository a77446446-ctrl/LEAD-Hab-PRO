"""Интерактивная QR-авторизация MAX с атомарным сохранением storage_state."""

import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path

from playwright.async_api import async_playwright

from proxy_runtime import build_playwright_proxy

SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,80}$")


async def login_detected(page):
    return await page.evaluate("""
      () => {
        const text = (document.body?.innerText || '').toLowerCase();
        const login = /qr[- ]?код|войти|авторизац|сканируйте/.test(text.slice(0, 2000));
        const app = document.querySelectorAll(
          '[class*="ChatList"], [class*="chat-list"], [class*="Sidebar"], nav, input[placeholder*="Поиск"], input[placeholder*="Найти"]'
        ).length > 0;
        return app && !login;
      }
    """)


async def run(session_id):
    if not SESSION_ID_RE.fullmatch(session_id):
        raise ValueError("Некорректный идентификатор сессии")
    proxy_url = os.environ.get("PARSER_PROXY_URL") or "direct"
    session_dir = Path(os.environ.get("PARSER_SESSIONS_DIR") or Path.cwd() / "sessions").resolve()
    session_dir.mkdir(parents=True, exist_ok=True)
    target = (session_dir / f"{session_id}.json").resolve()
    if target.parent != session_dir:
        raise ValueError("Некорректный путь сессии")

    proxy, relay = build_playwright_proxy(proxy_url)
    browser = None
    try:
        async with async_playwright() as playwright:
            launch_options = {"headless": os.environ.get("PARSER_AUTH_HEADLESS", "false").lower() == "true"}
            if proxy:
                launch_options["proxy"] = proxy
            browser = await playwright.chromium.launch(**launch_options)
            context = await browser.new_context(viewport={"width": 1280, "height": 800}, locale="ru-RU", timezone_id="Europe/Moscow")
            page = await context.new_page()
            last_error = None
            for attempt in range(3):
                try:
                    await page.goto("https://web.max.ru", timeout=60_000, wait_until="domcontentloaded")
                    last_error = None
                    break
                except Exception as error:
                    last_error = error
                    if attempt < 2:
                        await asyncio.sleep(3)
            if last_error:
                raise last_error

            print("Откройте MAX на телефоне и отсканируйте QR-код.", flush=True)
            deadline = time.monotonic() + 300
            authorized = False
            while time.monotonic() < deadline:
                if await login_detected(page):
                    authorized = True
                    break
                await asyncio.sleep(1)
            if not authorized:
                raise TimeoutError("Авторизация не подтверждена за 5 минут")

            await asyncio.sleep(4)
            document = {
                "storage": await context.storage_state(),
                "meta": {
                    "name": os.environ.get("MAX_ACCOUNT_NAME") or f"Аккаунт {session_id[:8]}",
                    "id": session_id,
                    "formatVersion": 2,
                    "createdAt": int(time.time()),
                },
            }
            temporary = target.with_suffix(".json.tmp")
            with temporary.open("w", encoding="utf-8") as handle:
                json.dump(document, handle, ensure_ascii=False, separators=(",", ":"))
            os.replace(temporary, target)
            if os.name != "nt":
                os.chmod(target, 0o600)
            print("SUCCESS: сессия MAX сохранена", flush=True)
    finally:
        if browser:
            await browser.close()
        if relay:
            relay.stop()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Ожидался session_id", file=sys.stderr)
        sys.exit(2)
    try:
        asyncio.run(run(sys.argv[1]))
    except Exception as error:
        print(f"Ошибка авторизации: {str(error)[:500]}", file=sys.stderr)
        sys.exit(1)