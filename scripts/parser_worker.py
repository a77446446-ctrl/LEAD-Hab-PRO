import os
import json
import sys
import time
import struct
import asyncio
import threading
from playwright.sync_api import sync_playwright

# Force UTF-8 for Windows
if sys.platform == "win32":
    import _locale
    _locale._getdefaultlocale = (lambda *args: ['en_US', 'utf8'])
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

def parse_proxy_parts(proxy_str):
    """Parse proxy string into components."""
    if not proxy_str or proxy_str == 'direct':
        return None
    try:
        is_socks = "socks5" in proxy_str.lower()
        protocol = "socks5" if is_socks else "http"
        clean_str = proxy_str.replace('http://', '').replace('https://', '').replace('socks5://', '').replace('socks5h://', '')
        username = None
        password = None
        if '@' in clean_str:
            auth, server = clean_str.split('@')
            username, password = auth.split(':')
            host, port = server.split(':')
        else:
            parts = clean_str.split(':')
            if len(parts) == 4:
                host, port, username, password = parts
            elif len(parts) == 2:
                host, port = parts
            else:
                return None
        return {"protocol": protocol, "host": host, "port": int(port), "username": username, "password": password}
    except Exception:
        return None

# ============================================================
# Local SOCKS5 relay (same as auth_manager.py)
# ============================================================

async def _relay(reader, writer):
    try:
        while True:
            data = await reader.read(65536)
            if not data: break
            writer.write(data)
            await writer.drain()
    except (asyncio.CancelledError, ConnectionResetError, BrokenPipeError, OSError):
        pass
    finally:
        try: writer.close()
        except: pass

async def _handle_local_client(local_reader, local_writer, remote_host, remote_port, remote_user, remote_pass):
    try:
        greeting = await asyncio.wait_for(local_reader.read(256), timeout=10)
        if not greeting or greeting[0] != 0x05:
            local_writer.close(); return
        local_writer.write(b'\x05\x00')
        await local_writer.drain()

        request = await asyncio.wait_for(local_reader.read(512), timeout=10)
        if not request or len(request) < 4:
            local_writer.close(); return

        try:
            remote_reader, remote_writer = await asyncio.wait_for(
                asyncio.open_connection(remote_host, remote_port), timeout=15)
        except:
            local_writer.write(b'\x05\x05\x00\x01\x00\x00\x00\x00\x00\x00')
            await local_writer.drain(); local_writer.close(); return

        remote_writer.write(b'\x05\x01\x02')
        await remote_writer.drain()
        resp = await asyncio.wait_for(remote_reader.readexactly(2), timeout=10)
        if resp[0] != 0x05 or resp[1] != 0x02:
            local_writer.write(b'\x05\x05\x00\x01\x00\x00\x00\x00\x00\x00')
            await local_writer.drain(); local_writer.close(); remote_writer.close(); return

        user_bytes = remote_user.encode('utf-8')
        pass_bytes = remote_pass.encode('utf-8')
        auth_msg = bytes([0x01, len(user_bytes)]) + user_bytes + bytes([len(pass_bytes)]) + pass_bytes
        remote_writer.write(auth_msg)
        await remote_writer.drain()
        auth_resp = await asyncio.wait_for(remote_reader.readexactly(2), timeout=10)
        if auth_resp[1] != 0x00:
            local_writer.write(b'\x05\x05\x00\x01\x00\x00\x00\x00\x00\x00')
            await local_writer.drain(); local_writer.close(); remote_writer.close(); return

        remote_writer.write(request)
        await remote_writer.drain()
        connect_resp = await asyncio.wait_for(remote_reader.read(512), timeout=15)
        if not connect_resp or len(connect_resp) < 2:
            local_writer.write(b'\x05\x05\x00\x01\x00\x00\x00\x00\x00\x00')
            await local_writer.drain(); local_writer.close(); remote_writer.close(); return

        local_writer.write(connect_resp)
        await local_writer.drain()
        if connect_resp[1] != 0x00:
            local_writer.close(); remote_writer.close(); return

        await asyncio.gather(_relay(local_reader, remote_writer), _relay(remote_reader, local_writer))
    except:
        pass
    finally:
        try: local_writer.close()
        except: pass

class Socks5RelayThread:
    """Runs an async SOCKS5 relay in a background thread for use with sync_playwright."""
    def __init__(self, remote_host, remote_port, remote_user, remote_pass):
        self.remote_host = remote_host
        self.remote_port = remote_port
        self.remote_user = remote_user
        self.remote_pass = remote_pass
        self.local_port = None
        self._loop = None
        self._server = None
        self._ready = threading.Event()
        self._thread = None

    def start(self):
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        self._ready.wait(timeout=10)
        return self.local_port

    def _run(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._loop.run_until_complete(self._start_server())

    async def _start_server(self):
        rh, rp, ru, rps = self.remote_host, self.remote_port, self.remote_user, self.remote_pass
        async def on_client(r, w):
            await _handle_local_client(r, w, rh, rp, ru, rps)
        self._server = await asyncio.start_server(on_client, '127.0.0.1', 0)
        self.local_port = self._server.sockets[0].getsockname()[1]
        sys.stderr.write(f"  [RELAY] Local SOCKS5 relay on 127.0.0.1:{self.local_port} -> {rh}:{rp}\n")
        self._ready.set()
        await self._server.serve_forever()

    def stop(self):
        if self._server and self._loop:
            self._loop.call_soon_threadsafe(self._server.close)


def build_launch_args_with_proxy(proxy_str):
    """Build Playwright launch args, starting a local relay if SOCKS5+auth."""
    parts = parse_proxy_parts(proxy_str)
    relay = None
    launch_args = {"headless": True}

    if not parts:
        return launch_args, relay

    proto = parts["protocol"]
    host = parts["host"]
    port = parts["port"]
    user = parts.get("username")
    pwd = parts.get("password")
    has_auth = bool(user and pwd)

    if proto == "socks5" and has_auth:
        relay = Socks5RelayThread(host, port, user, pwd)
        local_port = relay.start()
        launch_args["proxy"] = {"server": f"socks5://127.0.0.1:{local_port}"}
    elif proto == "socks5":
        launch_args["proxy"] = {"server": f"socks5://{host}:{port}"}
    elif has_auth:
        launch_args["proxy"] = {"server": f"http://{host}:{port}", "username": user, "password": pwd}
    else:
        launch_args["proxy"] = {"server": f"http://{host}:{port}"}

    return launch_args, relay

def wait_for_app_load(page, timeout=30):
    """Wait for Max messenger SPA to finish loading (spinner gone, content visible)."""
    sys.stderr.write("Waiting for Max SPA to finish loading...\n")
    sys.stderr.flush()
    
    start = time.time()
    while time.time() - start < timeout:
        # Check if the app has loaded by looking for common loaded-state indicators
        loaded = page.evaluate("""
            () => {
                // If there's a loading spinner visible, app isn't ready
                const body = document.body;
                if (!body) return { ready: false, reason: 'no body' };
                
                const text = body.innerText || '';
                const html = body.innerHTML || '';
                
                // Check for chat-related elements (messages, chat list, etc.)
                const hasMessages = document.querySelectorAll(
                    '[class*="message"], [class*="Message"], [class*="bubble"], [class*="Bubble"], ' +
                    '[class*="chat-content"], [class*="ChatContent"], [class*="msg"]'
                ).length;
                
                // Check for any substantial text content (more than just the loading screen)
                const textLength = text.length;
                
                // Check if we can see a chat header or sidebar
                const hasHeader = document.querySelectorAll(
                    '[class*="header"], [class*="Header"], [class*="sidebar"], [class*="Sidebar"], ' +
                    '[class*="chat-list"], [class*="ChatList"]'
                ).length;
                
                return {
                    ready: hasMessages > 0 || (textLength > 200 && hasHeader > 0),
                    messages: hasMessages,
                    textLen: textLength,
                    headers: hasHeader,
                    title: document.title
                };
            }
        """)
        
        if loaded.get('ready'):
            elapsed = round(time.time() - start, 1)
            sys.stderr.write(f"App loaded in {elapsed}s (messages={loaded['messages']}, text={loaded['textLen']}, headers={loaded['headers']})\n")
            sys.stderr.flush()
            return True
        
        time.sleep(1)
    
    elapsed = round(time.time() - start, 1)
    sys.stderr.write(f"App load timeout after {elapsed}s. Last state: {loaded}\n")
    sys.stderr.flush()
    return False

def run_parser(session_id, chat_url):
    session_path = os.path.join(os.getcwd(), "sessions", f"{session_id}.json")
    if not os.path.exists(session_path):
        sys.stderr.write(f"ERROR: Session {session_id} not found\n")
        return { "title": None, "messages": [], "source_chat": chat_url }

    with open(session_path, "r", encoding='utf-8') as f:
        session_data = json.load(f)

    proxy_str = session_data.get("meta", {}).get("proxy")
    relay = None
    
    with sync_playwright() as p:
        launch_args, relay = build_launch_args_with_proxy(proxy_str)

        browser_type = p.chromium
            
        sys.stderr.write(f"Launching {browser_type.name} for session {session_id}...\n")
        
        browser = browser_type.launch(**launch_args)
        context = browser.new_context(
            storage_state=session_data.get("storage"),
            viewport={'width': 1280, 'height': 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.37 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.37"
        )
        page = context.new_page()

        # Add some stealth scripts
        page.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        """)

        try:
            sys.stderr.write(f"Attempting goto: {chat_url}\n")
            sys.stderr.flush()
            
            # Use networkidle to wait for SPA to finish loading its API calls
            page.goto(chat_url, timeout=45000, wait_until="networkidle")
            
            sys.stderr.write("Page networkidle reached, waiting for SPA render...\n")
            sys.stderr.flush()
            
            # Wait for the SPA to actually render content
            app_loaded = wait_for_app_load(page, timeout=25)
            
            if not app_loaded:
                sys.stderr.write("WARNING: App may not have fully loaded, attempting to extract anyway...\n")
                # Give it a few more seconds
                time.sleep(5)

            # Try to scroll down to trigger loading of messages
            page.mouse.wheel(0, 500)
            time.sleep(2)
            page.mouse.wheel(0, 500)
            time.sleep(1)

            # Dump page info for debugging
            page_debug = page.evaluate("""
                () => {
                    const allClasses = new Set();
                    document.querySelectorAll('*').forEach(el => {
                        el.classList.forEach(c => allClasses.add(c));
                    });
                    return {
                        title: document.title,
                        url: location.href,
                        bodyTextLen: (document.body.innerText || '').length,
                        elementCount: document.querySelectorAll('*').length,
                        classes: Array.from(allClasses).filter(c => 
                            c.toLowerCase().includes('message') || 
                            c.toLowerCase().includes('msg') || 
                            c.toLowerCase().includes('bubble') || 
                            c.toLowerCase().includes('chat') ||
                            c.toLowerCase().includes('text') ||
                            c.toLowerCase().includes('content')
                        ).slice(0, 50)
                    };
                }
            """)
            sys.stderr.write(f"Page debug: title={page_debug['title']}, url={page_debug['url']}, bodyTextLen={page_debug['bodyTextLen']}, elements={page_debug['elementCount']}\n")
            sys.stderr.write(f"Relevant CSS classes found: {page_debug['classes']}\n")
            sys.stderr.flush()

            chatTitle = page.evaluate("""
                () => {
                    const titleSelectors = [
                        '.top-info .title', '.chat-info .title', '.PeerInfo .title', 
                        '.ChatHeader .title', 'h1', '.title', '.chat-title',
                        '[class*="ChatHeader"] [class*="title"]',
                        '[class*="chat-header"] [class*="title"]',
                        '[class*="peer"] [class*="title"]'
                    ];
                    for (const sel of titleSelectors) {
                        const el = document.querySelector(sel);
                        if (el && el.innerText.trim()) return el.innerText.trim();
                    }
                    return document.title;
                }
            """)
            sys.stderr.write(f"Chat title found: {chatTitle}\n")

            messages = page.evaluate(r"""
                () => {
                    // Build a comprehensive list of selectors based on what classes we find
                    const allClasses = [];
                    document.querySelectorAll('*').forEach(el => {
                        el.classList.forEach(c => allClasses.push(c));
                    });
                    
                    // Find message-related class names dynamically
                    const msgClasses = [...new Set(allClasses)].filter(c => {
                        const lower = c.toLowerCase();
                        return (lower.includes('message') || lower.includes('bubble')) && 
                               !lower.includes('input') && !lower.includes('compose') &&
                               !lower.includes('container') && !lower.includes('list');
                    });
                    
                    let selectedSelector = 'none';
                    const selectors = [
                        '.message-date-group div[class*="Message"]',
                        '.MessageList .Message',
                        '[data-mid]', // Standard Telegram Web message ID
                        '.message .message-text',
                        '[data-text]',
                        '[role="article"] .text',
                        // More generic but useful
                        '.text-content',
                        '[class*="text-content"]',
                        '[class*="MessageText"]',
                        '[class*="messageText"]',
                    ];
                    
                    let elements = [];
                    for (const sel of selectors) {
                        try {
                            const found = document.querySelectorAll(sel);
                            const valid = Array.from(found).filter(el => {
                                const text = (el.innerText || el.textContent || "").trim();
                                return text.length > 8 && text.length < 2000;
                            });
                            if (valid.length > elements.length) {
                                elements = valid;
                                selectedSelector = sel;
                            }
                        } catch (e) {}
                    }
                    
                    // Last resort: find ALL elements with substantial text that look like messages
                    if (elements.length === 0) {
                        const allEls = document.querySelectorAll('div, p, span, article');
                        elements = Array.from(allEls).filter(el => {
                            const text = (el.innerText || el.textContent || "").trim();
                            const childCount = el.children.length;
                            const rect = el.getBoundingClientRect();
                            // Must have text, be visible, not too many children
                            return text.length > 20 && 
                                   text.length < 1500 && 
                                   childCount < 5 &&
                                   rect.height > 10 && rect.height < 500 &&
                                   rect.width > 100;
                        });
                        selectedSelector = 'generic-fallback';
                    }
                    
                    console.log('Selected selector:', selectedSelector, 'Count:', elements.length);
                    
                    // Deduplicate
                    const seen = new Set();
                    return elements
                        .map(m => {
                            let text = (m.innerText || m.textContent || "").trim();
                            const links = Array.from(m.querySelectorAll('a'))
                                .map(a => a.href)
                                .filter(h => h && h.startsWith('http'));
                            
                            // Append unique links to the text
                            const uniqueLinks = [...new Set(links)];
                            if (uniqueLinks.length > 0) {
                                text += "\n\nКонтакты (ссылки): " + uniqueLinks.join(" , ");
                            }
                            
                            return { 
                                text: text, 
                                id: m.getAttribute('data-id') || m.getAttribute('data-mid') || Math.random().toString() 
                            };
                        })
                        .filter(m => {
                            if (seen.has(m.text)) return false;
                            seen.add(m.text);
                            return m.text.length > 15;
                        })
                        .slice(-100);
                }
            """)
            
            sys.stderr.write(f"Extracted {len(messages)} potential messages\n")
            
            if not messages or len(messages) == 0:
                if not os.path.exists("debug_screenshots"): os.makedirs("debug_screenshots")
                scr_name = f"debug_{session_id}_{int(time.time())}.png"
                page.screenshot(path=os.path.join("debug_screenshots", scr_name))
                sys.stderr.write(f"Saved debug screenshot: {scr_name}\n")
                
                # Also dump HTML snippet for debugging
                body_text = page.evaluate("() => (document.body.innerText || '').substring(0, 500)")
                sys.stderr.write(f"Page body text preview: {body_text}\n")
            
            return { "title": chatTitle, "messages": messages, "source_chat": chat_url }

        except Exception as e:
            err_msg = str(e)
            sys.stderr.write(f"CRITICAL ERROR: {err_msg}\n")
            try:
                with open("last_error.txt", "w", encoding="utf-8") as f:
                    f.write(err_msg + "\n")
            except: pass
            
            try:
                if not os.path.exists("debug_screenshots"): os.makedirs("debug_screenshots")
                scr_name = f"error_{session_id}_{int(time.time())}.png"
                page.screenshot(path=os.path.join("debug_screenshots", scr_name))
                sys.stderr.write(f"Saved error screenshot: {scr_name}\n")
            except: pass
            return { "title": None, "messages": [], "source_chat": chat_url }
        finally:
            browser.close()
            if relay:
                relay.stop()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.stderr.write("Usage: python parser_worker.py <session_id> <chat_url>\n")
        sys.exit(1)
        
    sid = sys.argv[1]
    url = sys.argv[2]
    
    try:
        results = run_parser(sid, url)
        sys.stdout.write(json.dumps(results, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(f"FATAL ERROR IN MAIN: {str(e)}\n")
        sys.stdout.write(json.dumps({"title": None, "messages": [], "source_chat": url}, ensure_ascii=False) + "\n")
        sys.stdout.flush()
