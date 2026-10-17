#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Serve the atlas and map /pdf/<book-id> to the original textbooks with Range support."""
import json
import os
import re
import sys
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.dirname(ROOT)

with open(os.path.join(ROOT, 'corpus', 'books.json'), encoding='utf-8-sig') as handle:
    BOOKS = {book['id']: book for book in json.load(handle)['books']}


class AtlasHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith('/pdf/'):
            self.serve_pdf(path[len('/pdf/'):])
            return
        super().do_GET()

    def do_HEAD(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith('/pdf/'):
            self.serve_pdf(path[len('/pdf/'):], head_only=True)
            return
        super().do_HEAD()

    def serve_pdf(self, book_id, head_only=False):
        book = BOOKS.get(book_id)
        if not book:
            self.send_error(404, 'Unknown book id')
            return
        path = os.path.join(SOURCE_DIR, book['file'])
        if not os.path.isfile(path):
            self.send_error(404, 'PDF not found')
            return
        size = os.path.getsize(path)
        range_header = self.headers.get('Range')
        start = 0
        end = size - 1
        status = 200
        if range_header:
            match = re.match(r'bytes=(\d*)-(\d*)', range_header)
            if match:
                if match.group(1):
                    start = int(match.group(1))
                if match.group(2):
                    end = min(int(match.group(2)), size - 1)
                status = 206
        length = max(0, end - start + 1)
        self.send_response(status)
        self.send_header('Content-Type', 'application/pdf')
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(length))
        if status == 206:
            self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.end_headers()
        if head_only:
            return
        with open(path, 'rb') as handle:
            handle.seek(start)
            remaining = length
            while remaining > 0:
                chunk = handle.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break
                remaining -= len(chunk)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    server = ThreadingHTTPServer(('127.0.0.1', port), AtlasHandler)
    print('Serving %s at http://127.0.0.1:%d/app/index.html' % (ROOT, port))
    print('Press Ctrl+C to stop.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
