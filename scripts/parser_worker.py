"""Изолированный worker чтения одного MAX-чата через один аккаунт."""

import hashlib
import json
import os
import random
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

from proxy_runtime import build_playwright_proxy

SESSION_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
MAX_SESSION_BYTES = 10 * 1024 * 1024
DEBUG_ARTIFACTS = os.environ.get("PARSER_DEBUG_ARTIFACTS", "false").lower() == "true"


def result(chat_url, status, title=None, messages=None, error=None):
    payload = {
        "title": title,
        "messages": messages or [],
        "source_chat": chat_url,
        "status": status,
    }
    if error:
        payload["error"] = str(error).replace("\r", " ").replace("\n", " ")[:500]
    return payload


def session_path(session_id):
    if not SESSION_ID_RE.fullmatch(session_id):
        raise ValueError("Некорректный идентификатор сессии")
    directory = Path(os.environ.get("PARSER_SESSIONS_DIR") or Path.cwd() / "sessions").resolve()
    target = (directory / f"{session_id}.json").resolve()
    if target.parent != directory:
        raise ValueError("Некорректный путь сессии")
    return target


def load_session(session_id):
    target = session_path(session_id)
    size = target.stat().st_size
    if size <= 0 or size > MAX_SESSION_BYTES:
        raise ValueError("Некорректный размер файла сессии")
    with target.open("r", encoding="utf-8") as handle:
        document = json.load(handle)
    storage = document.get("storage") if isinstance(document, dict) and "storage" in document else document
    meta = document.get("meta", {}) if isinstance(document, dict) else {}
    return target, storage, meta


def save_session(target, context, meta):
    temporary = target.with_suffix(".json.tmp")
    document = {"storage": context.storage_state(), "meta": meta}
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(document, handle, ensure_ascii=False, separators=(",", ":"))
    os.replace(temporary, target)
    if os.name != "nt":
        os.chmod(target, 0o600)


def stable_viewport(session_id):
    digest = hashlib.sha256(session_id.encode("utf-8")).digest()
    variants = [(1280, 800), (1366, 768), (1440, 900), (1536, 864)]
    width, height = variants[digest[0] % len(variants)]
    return {"width": width, "height": height}


def app_is_ready(page):
    return page.evaluate("""
        () => {
          const text = (document.body?.innerText || '').toLowerCase();
          const messages = document.querySelectorAll('[data-mid], [role="article"], [class*="Message"], [class*="message"]').length;
          const shell = document.querySelectorAll('[class*="ChatList"], [class*="chat-list"], [class*="Sidebar"], nav').length;
          const login = /qr[- ]?код|войти|авторизац|сканируйте/.test(text.slice(0, 2000));
          return { ready: messages > 0 || (shell > 0 && !login), login, messages, shell };
        }
    """)


def wait_for_app(page, seconds=30, check_messages=True):
    deadline = time.monotonic() + seconds
    state = {"ready": False, "login": False}
    # Wait until the shell (sidebar) loads
    while time.monotonic() < deadline:
        state = app_is_ready(page)
        if state.get("shell") > 0 or state.get("login") or state.get("messages") > 0:
            break
        page.wait_for_timeout(750)
        
    if state.get("login") and not state.get("messages") and not state.get("shell"):
        return state

    if not check_messages:
        return state

    # Now wait specifically for messages to appear (since proxy can be slow)
    message_deadline = time.monotonic() + 15  # Wait up to 15 seconds for chat history
    while time.monotonic() < message_deadline:
        state = app_is_ready(page)
        if state.get("messages") > 0:
            break
        page.wait_for_timeout(1000)

    # Force a final wait just in case DOM is still rendering
    page.wait_for_timeout(2000)
    return state

def human_scroll(page):
    rng = random.SystemRandom()
    page.mouse.move(rng.randint(150, 700), rng.randint(120, 500), steps=rng.randint(4, 9))
    page.wait_for_timeout(rng.randint(450, 1000))
    for _ in range(rng.randint(2, 4)):
        page.mouse.wheel(0, rng.randint(160, 420))
        page.wait_for_timeout(rng.randint(650, 1600))


def extract_messages(page):
    return page.evaluate(r"""
      () => {
        const selectors = [
          '[data-mid]', '[role="article"]', '.MessageList .Message',
          '[class*="MessageText"]', '[class*="messageText"]',
          '.text-content', '[class*="text-content"]'
        ];
        let elements = [];
        for (const selector of selectors) {
          try {
            const candidates = Array.from(document.querySelectorAll(selector)).filter((node) => {
              const text = (node.innerText || node.textContent || '').trim();
              const box = node.getBoundingClientRect();
              return text.length > 8 && text.length < 2500 && box.width > 80 && box.height > 8;
            });
            if (candidates.length > elements.length) elements = candidates;
          } catch {}
        }
        if (elements.length === 0) {
          elements = Array.from(document.querySelectorAll('article, div[data-id]')).filter((node) => {
            const text = (node.innerText || node.textContent || '').trim();
            const box = node.getBoundingClientRect();
            return text.length > 20 && text.length < 2000 && box.width > 100 && box.height > 10;
          });
        }
        const seen = new Set();
        return elements.map((node) => {
          let text = (node.innerText || node.textContent || '').trim();
          const links = [...new Set(Array.from(node.querySelectorAll('a[href]'))
            .map((link) => link.href).filter((href) => /^https?:\/\//i.test(href)))];
          if (links.length) text += '\n\nКонтакты (ссылки): ' + links.join(' , ');
          return { text, id: node.getAttribute('data-mid') || node.getAttribute('data-id') || undefined };
        }).filter((item) => {
          if (item.text.length <= 15 || seen.has(item.text)) return false;
          seen.add(item.text);
          return true;
        }).slice(-100);
      }
    """)


def extract_title(page):
    return page.evaluate("""
      () => {
        const selectors = [
          '.top-info .title', '.chat-info .title', '.ChatHeader .title',
          '[class*="ChatHeader"] [class*="title"]', '[class*="chat-header"] [class*="title"]', 'h1'
        ];
        for (const selector of selectors) {
          const node = document.querySelector(selector);
          const text = (node?.innerText || '').trim();
          if (text) return text.slice(0, 200);
        }
        return (document.title || '').slice(0, 200) || null;
      }
    """)


def classify_exception(error, has_proxy):
    message = str(error)
    upper = message.upper()
    if has_proxy and any(marker in upper for marker in [
        "ERR_PROXY", "ERR_TUNNEL", "SOCKS", "PROXY CONNECTION", "ECONNREFUSED"
    ]):
        return "PROXY_ERROR"
    if "429" in message or "TOO MANY REQUESTS" in upper:
        return "RATE_LIMITED"
    if isinstance(error, PlaywrightTimeoutError):
        return "TIMEOUT"
    return "ERROR"


def run_parser(session_id, chat_url):
    target, storage, meta = load_session(session_id)
    proxy_url = os.environ.get("PARSER_PROXY_URL") or meta.get("proxy") or "direct"
    relay = None
    browser = None
    context = None
    try:
        proxy, relay = build_playwright_proxy(proxy_url)
        with sync_playwright() as playwright:
            launch_options = {"headless": True}
            if proxy:
                launch_options["proxy"] = proxy
            browser = playwright.chromium.launch(**launch_options)
            context = browser.new_context(
                storage_state=storage,
                viewport=stable_viewport(session_id),
                locale="ru-RU",
                timezone_id="Europe/Moscow",
            )
            page = context.new_page()

            # Auto-normalize URL if user pasted a profile link (e.g. max.ru/username)
            if "#" not in chat_url:
                username = chat_url.rstrip("/").split("/")[-1]
                if not username.startswith("+"):
                    if username.lstrip("-").isdigit():
                        chat_url = f"https://web.max.ru/a/#{username}"
                    else:
                        chat_url = f"https://web.max.ru/a/#@{username}"

            # 1. Load the base SPA first. We must use the exact lowercase path "/a/".
            base_url = "https://web.max.ru/a/"
            response = page.goto(base_url, timeout=45_000, wait_until="domcontentloaded")
            if response and response.status == 429:
                return result(chat_url, "RATE_LIMITED", error="Превышен лимит запросов MAX (429)")

            # Wait for the app shell to load
            state = wait_for_app(page, seconds=20, check_messages=False)
            if state.get("login") and not state.get("shell"):
                return result(chat_url, "AUTH_REQUIRED", error="Сессия MAX требует повторного входа")

            # 2. Trigger the internal SPA router.
            # To avoid "Execution context was destroyed", the new URL MUST have the exact same protocol, host, and path.
            # We extract only the hash from the user's chat_url and append it to our strict base_url.
            hash_part = chat_url.split("#", 1)[1] if "#" in chat_url else ""
            safe_target_url = base_url + ("#" + hash_part if hash_part else "")
            
            # This is guaranteed to be a hash-only navigation, so it won't reload the page.
            page.evaluate(f"window.location.href = '{safe_target_url}';")

            # Wait specifically for messages in the new chat
            state = wait_for_app(page, seconds=15, check_messages=True)
            
            if state.get("login") and not state.get("ready"):
                return result(chat_url, "AUTH_REQUIRED", error="Сессия MAX требует повторного входа")

            page.wait_for_timeout(random.SystemRandom().randint(600, 1400))
            human_scroll(page)
            title = extract_title(page)
            messages = extract_messages(page)
            save_session(target, context, {**meta, "proxy": None, "formatVersion": 2})

            if not messages:
                directory = Path.cwd() / "debug_screenshots"
                directory.mkdir(exist_ok=True)
                page.screenshot(path=str(directory / f"empty_{session_id}_{int(time.time())}.png"))
            return result(chat_url, "OK" if messages else "EMPTY", title=title, messages=messages)
    except FileNotFoundError:
        return result(chat_url, "AUTH_REQUIRED", error="Файл сессии не найден")
    except Exception as error:
        status = classify_exception(error, proxy_url != "direct")
        if DEBUG_ARTIFACTS and context:
            try:
                directory = Path.cwd() / "debug_screenshots"
                directory.mkdir(exist_ok=True)
                context.pages[0].screenshot(path=str(directory / f"error_{session_id}_{int(time.time())}.png"))
            except Exception:
                pass
        return result(chat_url, status, error=error)
    finally:
        if context:
            try:
                context.close()
            except Exception:
                pass
        if browser:
            try:
                browser.close()
            except Exception:
                pass
        if relay:
            relay.stop()


def main():
    if len(sys.argv) != 3:
        payload = result("", "ERROR", error="Ожидались session_id и chat_url")
    else:
        payload = run_parser(sys.argv[1], sys.argv[2])
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()