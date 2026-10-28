# -*- coding: utf-8 -*-
"""本地静态服务器：运行应用并打开浏览器。

用法：python tools/serve.py [端口]
默认端口 8787。应用需要 HTTP 协议才能加载本地 JSON 数据（file:// 会被浏览器拦截）。
"""
import http.server
import os
import socket
import socketserver
import sys
import threading
import webbrowser

sys.dont_write_bytecode = True

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(
        http.server.SimpleHTTPRequestHandler.extensions_map,
        **{
            ".webmanifest": "application/manifest+json",
            ".json": "application/json; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".svg": "image/svg+xml",
        },
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Service-Worker-Allowed", "/")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stdout.write("%s - %s\n" % (self.address_string(), fmt % args))


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


def make_server():
    """优先监听所有网卡（手机可访问），个别端口被系统占用时自动换端口。"""
    socketserver.TCPServer.allow_reuse_address = True
    ports = [PORT]
    if len(sys.argv) <= 2:
        ports += [8899, 8000, 8088, 5173]
    last_err = None
    for p in ports:
        try:
            return socketserver.ThreadingTCPServer(("0.0.0.0", p), Handler), p, True
        except OSError as exc:
            last_err = exc
    try:
        return socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Handler), PORT, False
    except OSError as exc:
        raise SystemExit("无法启动服务器：%s" % (last_err or exc))


def main():
    httpd, port, lan = make_server()
    url = "http://127.0.0.1:%d/" % port
    print("=" * 52)
    print("  知脉 · 知识点诊断")
    print("  本机访问： %s" % url)
    if lan:
        print("  手机访问： http://%s:%d/（同一 Wi-Fi）" % (lan_ip(), port))
    else:
        print("  手机访问： 当前端口只允许本机访问，可改用其他端口重试")
    print("  按 Ctrl+C 停止")
    print("=" * 52)
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")


if __name__ == "__main__":
    main()
