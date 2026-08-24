"""Ограниченная проверка прокси без вывода реквизитов."""

import base64
import os
import socket
import ssl
import struct
import sys
import urllib.request

from proxy_runtime import parse_proxy_url


def recv_exact(sock, size):
    data = b""
    while len(data) < size:
        chunk = sock.recv(size - len(data))
        if not chunk:
            raise ConnectionError("Прокси закрыл соединение")
        data += chunk
    return data


def check_socks5(config):
    with socket.create_connection((config["host"], config["port"]), timeout=10) as sock:
        if config.get("username") and config.get("password"):
            sock.sendall(b"\x05\x01\x02")
            if recv_exact(sock, 2) != b"\x05\x02":
                raise PermissionError("SOCKS5 не принял метод авторизации")
            username = config["username"].encode()
            password = config["password"].encode()
            sock.sendall(bytes([1, len(username)]) + username + bytes([len(password)]) + password)
            if recv_exact(sock, 2)[1] != 0:
                raise PermissionError("SOCKS5 отклонил реквизиты")
        else:
            sock.sendall(b"\x05\x01\x00")
            if recv_exact(sock, 2) != b"\x05\x00":
                raise PermissionError("SOCKS5 требует авторизацию")
        host = b"web.max.ru"
        sock.sendall(b"\x05\x01\x00\x03" + bytes([len(host)]) + host + struct.pack("!H", 443))
        header = recv_exact(sock, 4)
        if header[1] != 0:
            raise ConnectionError("SOCKS5 не открыл соединение до MAX")


def check_http(proxy_url):
    request = urllib.request.Request("https://web.max.ru", headers={"User-Agent": "MAKS-Lead-Hub-Proxy-Check/1.0"})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({"http": proxy_url, "https": proxy_url}))
    with opener.open(request, timeout=15) as response:
        if response.status >= 500:
            raise ConnectionError("MAX недоступен через прокси")


def main():
    proxy_url = os.environ.get("TEST_PROXY_URL")
    if not proxy_url:
        print("Прокси не задан", file=sys.stderr)
        return 2
    config = parse_proxy_url(proxy_url)
    if config["protocol"] == "socks5":
        check_socks5(config)
    else:
        check_http(proxy_url)
    print("RESULT: VALID")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(f"Проверка не пройдена: {type(error).__name__}", file=sys.stderr)
        sys.exit(1)