import http.server
class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        l = int(self.headers.get("Content-Length", 0))
        d = self.rfile.read(l)
        with open("/tmp/rig-debug.txt", "wb") as f:
            f.write(d)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"OK")
    def log_message(self, *a):
        pass
http.server.HTTPServer(("0.0.0.0", 8080), H).serve_forever()
