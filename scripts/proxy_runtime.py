"""Безопасная настройка HTTP/SOCKS5-прокси для Playwright."""

import asyncio
import socket
import struct
import threading
from contextlib import suppress
from urllib.parse import unquote, urlsplit

import socks


def parse_proxy_url(proxy_url):
    if not proxy_url or proxy_url == "direct":
        return None
    parsed = urlsplit(proxy_url)
    protocol = parsed.scheme.lower()
    if protocol not in {"http", "https", "socks5", "socks5h"}:
        raise ValueError("Неподдерживаемый протокол прокси")
    if not parsed.hostname or parsed.port is None:
        raise ValueError("Для прокси обязательны хост и порт")
    return {
        "protocol": "socks5" if protocol in {"socks5", "socks5h"} else "http",
        "host": parsed.hostname,
        "port": parsed.port,
        "username": unquote(parsed.username) if parsed.username else None,
        "password": unquote(parsed.password) if parsed.password else None,
    }


async def _pipe(reader, writer):
    try:
        while True:
            data = await reader.read(65536)
            if not data:
                return
            writer.write(data)
            await writer.drain()
    except (asyncio.CancelledError, ConnectionResetError, BrokenPipeError, OSError):
        return


async def _read_destination(reader, address_type):
    if address_type == 1:
        host = socket.inet_ntop(socket.AF_INET, await reader.readexactly(4))
    elif address_type == 3:
        size = (await reader.readexactly(1))[0]
        host = (await reader.readexactly(size)).decode("idna")
    elif address_type == 4:
        host = socket.inet_ntop(socket.AF_INET6, await reader.readexactly(16))
    else:
        raise ValueError("SOCKS5 передал неподдерживаемый тип адреса")
    port = struct.unpack("!H", await reader.readexactly(2))[0]
    return host, port


def _connect_upstream(config, destination_host, destination_port):
    connection = socks.create_connection(
        (destination_host, destination_port),
        timeout=20,
        proxy_type=socks.SOCKS5,
        proxy_addr=config["host"],
        proxy_port=config["port"],
        proxy_rdns=True,
        proxy_username=config.get("username"),
        proxy_password=config.get("password"),
    )
    connection.setblocking(False)
    return connection


async def _handle_client(local_reader, local_writer, config):
    remote_writer = None
    negotiation_completed = False
    try:
        greeting = await asyncio.wait_for(local_reader.readexactly(2), timeout=10)
        methods = await asyncio.wait_for(local_reader.readexactly(greeting[1]), timeout=10)
        if greeting[0] != 5 or 0 not in methods:
            local_writer.write(b"\x05\xff")
            await local_writer.drain()
            return
        local_writer.write(b"\x05\x00")
        await local_writer.drain()
        negotiation_completed = True

        header = await asyncio.wait_for(local_reader.readexactly(4), timeout=10)
        if header[0] != 5 or header[1] != 1:
            local_writer.write(b"\x05\x07\x00\x01\x00\x00\x00\x00\x00\x00")
            await local_writer.drain()
            return
        destination_host, destination_port = await _read_destination(local_reader, header[3])

        remote_socket = await asyncio.wait_for(
            asyncio.to_thread(_connect_upstream, config, destination_host, destination_port),
            timeout=25,
        )
        remote_reader, remote_writer = await asyncio.open_connection(sock=remote_socket)
        local_writer.write(b"\x05\x00\x00\x01\x00\x00\x00\x00\x00\x00")
        await local_writer.drain()

        tasks = {
            asyncio.create_task(_pipe(local_reader, remote_writer)),
            asyncio.create_task(_pipe(remote_reader, local_writer)),
        }
        _, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in pending:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    except Exception:
        if negotiation_completed:
            with suppress(Exception):
                local_writer.write(b"\x05\x01\x00\x01\x00\x00\x00\x00\x00\x00")
                await local_writer.drain()
    finally:
        local_writer.close()
        with suppress(Exception):
            await local_writer.wait_closed()
        if remote_writer:
            remote_writer.close()
            with suppress(Exception):
                await remote_writer.wait_closed()


class Socks5RelayThread:
    def __init__(self, config):
        self.config = config
        self.local_port = None
        self._loop = None
        self._server = None
        self._ready = threading.Event()
        self._thread = None
        self._start_error = None

    def start(self):
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        if not self._ready.wait(timeout=10):
            raise ConnectionError("Не удалось запустить локальный SOCKS5 relay")
        if self._start_error:
            raise ConnectionError("Не удалось открыть локальный SOCKS5 relay") from self._start_error
        if not self.local_port:
            raise ConnectionError("Локальный SOCKS5 relay не назначил порт")
        return self.local_port

    def _run(self):
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._serve())
        finally:
            self._loop.close()

    async def _serve(self):
        async def on_client(reader, writer):
            await _handle_client(reader, writer, self.config)

        try:
            self._server = await asyncio.start_server(on_client, "127.0.0.1", 0)
            self.local_port = self._server.sockets[0].getsockname()[1]
        except Exception as error:
            self._start_error = error
            self._ready.set()
            return
        self._ready.set()
        with suppress(asyncio.CancelledError):
            await self._server.serve_forever()

    def stop(self):
        if self._server and self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(self._server.close)


def build_playwright_proxy(proxy_url):
    config = parse_proxy_url(proxy_url)
    if not config:
        return None, None
    server = f"{config['protocol']}://{config['host']}:{config['port']}"
    proxy = {"server": server}
    username = config.get("username")
    password = config.get("password")
    if username and password:
        proxy.update({"username": username, "password": password})
    return proxy, None
