import sys
import urllib.request
import socket

# Ensure UTF-8 output to avoid charmap codec errors on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

def check_proxy(proxy_str):
    """Lightweight proxy check using urllib - no browser needed."""
    if not proxy_str:
        return True

    try:
        # Parse proxy string
        protocol = "http"
        if "socks5" in proxy_str.lower():
            protocol = "socks5"

        clean_str = proxy_str.replace('http://', '').replace('https://', '').replace('socks5://', '').replace('socks5h://', '')

        if '@' in clean_str:
            auth, server = clean_str.split('@')
            proxy_url = f"http://{auth}@{server}"
        else:
            parts = clean_str.split(':')
            if len(parts) == 4:
                ip, port, user, password = parts
                proxy_url = f"http://{user}:{password}@{ip}:{port}"
            elif len(parts) == 2:
                proxy_url = f"http://{clean_str}"
            else:
                print(f"DEBUG: Cannot parse proxy format: {proxy_str}")
                return False

        if protocol == "socks5":
            # For SOCKS5, try a simple socket connection to verify the proxy is reachable
            if '@' in clean_str:
                _, server = clean_str.split('@')
            else:
                parts = clean_str.split(':')
                server = f"{parts[0]}:{parts[1]}"
            
            host, port_str = server.rsplit(':', 1)
            port = int(port_str)
            
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(15)
            try:
                sock.connect((host, port))
                # SOCKS5 handshake: version=5, 2 auth methods: no-auth=0, user/pass=2
                sock.send(b'\x05\x02\x00\x02')
                resp = sock.recv(2)
                if len(resp) >= 2 and resp[0] == 0x05:
                    print(f"DEBUG: SOCKS5 proxy {host}:{port} is reachable and responds (Auth method selected: {resp[1]})")
                    return True
                else:
                    print(f"DEBUG: Not a valid SOCKS5 response from {host}:{port}")
                    return False
            finally:
                sock.close()
        else:
            # For HTTP proxy, try to fetch a simple URL through it
            proxy_handler = urllib.request.ProxyHandler({
                'http': proxy_url,
                'https': proxy_url,
            })
            opener = urllib.request.build_opener(proxy_handler)
            req = urllib.request.Request('http://httpbin.org/ip', method='GET')
            req.add_header('User-Agent', 'Mozilla/5.0')
            response = opener.open(req, timeout=20)
            if response.status < 400:
                data = response.read().decode('utf-8', errors='replace')
                print(f"DEBUG: HTTP proxy works, response: {data.strip()[:200]}")
                return True
            return False

    except Exception as e:
        print(f"DEBUG: Check error: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("ERROR: No proxy string provided")
        sys.exit(1)

    pstr = sys.argv[1]
    try:
        if check_proxy(pstr):
            print("RESULT: VALID")
            sys.exit(0)
        else:
            print("RESULT: INVALID")
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
