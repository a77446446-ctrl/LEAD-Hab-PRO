import asyncio
import os
import json
import sys
import struct
import traceback

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Error: playwright module not found.")
    input("Press Enter to exit...")
    sys.exit(1)


def parse_proxy_parts(proxy_str):
    """Parse proxy string into components: protocol, host, port, username, password."""
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

        return {
            "protocol": protocol,
            "host": host,
            "port": int(port),
            "username": username,
            "password": password,
        }
    except Exception:
        return None


# ============================================================
# Local SOCKS5 relay: accepts connections WITHOUT auth,
# forwards them through the REMOTE SOCKS5 proxy WITH auth.
# This is needed because Playwright does NOT support
# SOCKS5 proxy authentication.
# ============================================================

async def _relay(reader, writer):
    """Pipe data from reader to writer until EOF."""
    try:
        while True:
            data = await reader.read(65536)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except (asyncio.CancelledError, ConnectionResetError, BrokenPipeError, OSError):
        pass
    finally:
        try:
            writer.close()
        except Exception:
            pass


async def _handle_local_client(local_reader, local_writer, remote_host, remote_port, remote_user, remote_pass):
    """Handle one incoming local SOCKS5 connection and relay it through the remote authenticated proxy."""
    try:
        # === Step 1: Local SOCKS5 handshake (no auth required) ===
        greeting = await asyncio.wait_for(local_reader.read(256), timeout=10)
        if not greeting or greeting[0] != 0x05:
            local_writer.close()
            return
        # Respond: version 5, no auth required
        local_writer.write(b'\x05\x00')
        await local_writer.drain()

        # === Step 2: Read CONNECT request from local client ===
        request = await asyncio.wait_for(local_reader.read(512), timeout=10)
        if not request or len(request) < 4:
            local_writer.close()
            return

        # === Step 3: Connect to remote SOCKS5 proxy ===
        try:
            remote_reader, remote_writer = await asyncio.wait_for(
                asyncio.open_connection(remote_host, remote_port), timeout=15
            )
        except Exception as e:
            # Send failure response to local client
            local_writer.write(b'\x05\x05\x00\x01\x00\x00\x00\x00\x00\x00')
            await local_writer.drain()
            local_writer.close()
            return

        # === Step 4: Remote SOCKS5 handshake WITH auth ===
        # Announce: version 5, 1 method, username/password (0x02)
        remote_writer.write(b'\x05\x01\x02')
        await remote_writer.drain()

        resp = await asyncio.wait_for(remote_reader.readexactly(2), timeout=10)
        if resp[0] != 0x05 or resp[1] != 0x02:
            local_writer.write(b'\x05\x05\x00\x01\x00\x00\x00\x00\x00\x00')
            await local_writer.drain()
            local_writer.close()
            remote_writer.close()
            return

        # Send username/password
        user_bytes = remote_user.encode('utf-8')
        pass_bytes = remote_pass.encode('utf-8')
        auth_msg = bytes([0x01, len(user_bytes)]) + user_bytes + bytes([len(pass_bytes)]) + pass_bytes
        remote_writer.write(auth_msg)
        await remote_writer.drain()

        auth_resp = await asyncio.wait_for(remote_reader.readexactly(2), timeout=10)
        if auth_resp[1] != 0x00:
            print(f"  [RELAY] Remote SOCKS5 auth FAILED")
            local_writer.write(b'\x05\x05\x00\x01\x00\x00\x00\x00\x00\x00')
            await local_writer.drain()
            local_writer.close()
            remote_writer.close()
            return

        # === Step 5: Forward the CONNECT request to remote ===
        remote_writer.write(request)
        await remote_writer.drain()

        # Read remote response
        connect_resp = await asyncio.wait_for(remote_reader.read(512), timeout=15)
        if not connect_resp or len(connect_resp) < 2:
            local_writer.write(b'\x05\x05\x00\x01\x00\x00\x00\x00\x00\x00')
            await local_writer.drain()
            local_writer.close()
            remote_writer.close()
            return

        # Forward response to local client
        local_writer.write(connect_resp)
        await local_writer.drain()

        if connect_resp[1] != 0x00:
            local_writer.close()
            remote_writer.close()
            return

        # === Step 6: Relay data both ways ===
        await asyncio.gather(
            _relay(local_reader, remote_writer),
            _relay(remote_reader, local_writer),
        )

    except Exception:
        pass
    finally:
        try:
            local_writer.close()
        except Exception:
            pass


async def start_local_socks5_relay(remote_host, remote_port, remote_user, remote_pass):
    """Start a local SOCKS5 proxy (no auth) that forwards through authenticated remote SOCKS5."""

    async def on_client(reader, writer):
        await _handle_local_client(reader, writer, remote_host, remote_port, remote_user, remote_pass)

    server = await asyncio.start_server(on_client, '127.0.0.1', 0)
    local_port = server.sockets[0].getsockname()[1]
    print(f"  [RELAY] Local SOCKS5 relay started on 127.0.0.1:{local_port} -> {remote_host}:{remote_port}")
    return server, local_port


# ============================================================
# Main logic
# ============================================================

async def run(session_id=None, proxy_str=None):
    print("--- MAKS AUTH MANAGER (RELIABLE) START ---")

    proxy_parts = parse_proxy_parts(proxy_str)
    relay_server = None

    async with async_playwright() as p:
        browser_type = p.chromium
        launch_args = {"headless": False}

        if proxy_parts:
            proto = proxy_parts["protocol"]
            host = proxy_parts["host"]
            port = proxy_parts["port"]
            user = proxy_parts.get("username")
            pwd = proxy_parts.get("password")
            has_auth = bool(user and pwd)

            print(f"Proxy: {proto}://{host}:{port}, user={user or 'N/A'}, auth={has_auth}")

            if proto == "socks5" and has_auth:
                # SOCKS5 with auth: use local relay bridge
                relay_server, local_port = await start_local_socks5_relay(host, port, user, pwd)
                launch_args["proxy"] = {"server": f"socks5://127.0.0.1:{local_port}"}
            elif proto == "socks5" and not has_auth:
                # SOCKS5 without auth: direct
                launch_args["proxy"] = {"server": f"socks5://{host}:{port}"}
            elif has_auth:
                # HTTP with auth
                launch_args["proxy"] = {
                    "server": f"http://{host}:{port}",
                    "username": user,
                    "password": pwd,
                }
            else:
                # HTTP without auth
                launch_args["proxy"] = {"server": f"http://{host}:{port}"}

        print(f"Launching {browser_type.name}...")
        browser = await browser_type.launch(**launch_args)
        context = await browser.new_context(ignore_https_errors=True, viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        print("Opening https://web.max.ru...")
        # Retry logic for flaky proxy connections
        last_err = None
        for attempt in range(3):
            try:
                await page.goto("https://web.max.ru", timeout=60000, wait_until="domcontentloaded")
                print("Page loaded successfully!")
                last_err = None
                break
            except Exception as e:
                last_err = e
                print(f"Attempt {attempt+1}/3 failed: {e}")
                if attempt < 2:
                    print("Retrying in 3 seconds...")
                    await asyncio.sleep(3)
        if last_err:
            raise last_err
        
        print("Waiting for login... SCAN QR NOW!")
        
        # Robust Success Detection
        try:
            # We wait for EITHER a selector OR a URL change OR just manual confirmation
            # Added more generic selectors based on common MAX Web elements
            success_selectors = [
                ".chat-item", 
                ".main-container", 
                "input[placeholder*='Найти']", 
                "input[placeholder*='Поиск']",
                ".search-input",
                "canvas", 
                ".left-column",
                "nav",
                "[role='navigation']"
            ]
            
            # Loop to check for login status
            logged_in = False
            for _ in range(300): # 5 minutes total
                # 1. Check if URL changed away from root
                current_url = page.url.lower()
                if "login" not in current_url and "auth" not in current_url and len(current_url) > 20 and current_url.strip('/') != "https://web.max.ru":
                    logged_in = True
                    break
                    
                # 2. Check for common auth keys in localStorage
                try:
                    has_auth = await page.evaluate("() => Object.keys(localStorage).some(k => k.includes('token') || k.includes('auth') || k.includes('user') || k.includes('session'))")
                    if has_auth:
                        logged_in = True
                        break
                except:
                    pass

                # 3. Check for UI elements
                try:
                    if any(await page.query_selector(s) for s in success_selectors):
                        logged_in = True
                        break
                except:
                    pass
                    
                await asyncio.sleep(1)
            
            if not logged_in:
                print("Timeout: Login not automatically detected after 5 minutes.")
                print("If you are logged in, we will force save the session anyway.")
            else:
                print("\n!!! LOGIN DETECTED !!!")
                await asyncio.sleep(5) # Let it settle
                
            # Prevent duplicates: Check if we already have a session with this proxy
            import time
            project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            session_dir = os.path.join(project_root, "sessions")
            if not os.path.exists(session_dir): os.makedirs(session_dir)

            final_session_id = session_id
            if not final_session_id:
                final_session_id = f"session_{int(time.time())}"
                
            # Scan existing sessions to see if this proxy is already used
            for existing_file in os.listdir(session_dir):
                if existing_file.endswith('.json'):
                    try:
                        with open(os.path.join(session_dir, existing_file), 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            if data.get('meta', {}).get('proxy') == proxy_str:
                                final_session_id = existing_file.replace('.json', '')
                                print(f"Found existing session for this proxy: {final_session_id}. Updating it.")
                                break
                    except: continue

            storage = await context.storage_state()
            session_data = {
                "storage": storage,
                "meta": {
                    "name": f"Аккаунт {final_session_id}",
                    "id": final_session_id,
                    "proxy": proxy_str,
                    "browser": browser_type.name,
                    "timestamp": str(int(time.time()))
                }
            }
            
            file_path = os.path.join(session_dir, f"{final_session_id}.json")
            with open(file_path, "w", encoding='utf-8') as f:
                json.dump(session_data, f, ensure_ascii=False, indent=2)
            
            print(f"SUCCESS: Session saved to {file_path}")
            print("You can now close the browser window, or it will close automatically in a moment.")
            await asyncio.sleep(3)

        except Exception as e:
            traceback.print_exc()
            input("Error occurred. Press Enter to close...")
        finally:
            await browser.close()
            if relay_server:
                relay_server.close()
                await relay_server.wait_closed()
                print("  [RELAY] Local relay stopped.")

if __name__ == "__main__":
    sid = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != 'None' else None
    pstr = sys.argv[2] if len(sys.argv) > 2 else None
    asyncio.run(run(sid, pstr))
