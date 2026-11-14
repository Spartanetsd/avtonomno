"""Необов'язковий браузерний smoke-тест PWA (Chromium + Playwright).

Установити: python -m pip install playwright && python -m playwright install chromium
Запуск: python browser_smoke.py

Перевіряє: GitHub Pages-підшлях, мобільні екрани, збереження стану,
Service Worker, перевантаження без мережі. Не заміняє тестування на iPhone.
"""
from __future__ import annotations

import os
from pathlib import Path
import socket
import subprocess
import sys
import time


def main() -> None:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise SystemExit('Потрібен Playwright: python -m pip install playwright') from exc

    root = Path(__file__).resolve().parent
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    url = f'http://localhost:{port}/avtonomno/'
    env = {**os.environ, 'PORT': str(port)}
    proc = subprocess.Popen(['node', 'serve.mjs', '--base', '/avtonomno/'], cwd=root, env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        time.sleep(0.5)
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={'width': 390, 'height': 844})
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(url, wait_until='domcontentloaded', timeout=15000)
            page.locator('.needs .need').first.wait_for(timeout=10000)
            assert page.locator('.needs .need').count() == 6
            page.goto(url + '#/state')
            page.get_by_text('Чи безпечно зараз виходити надвір?').wait_for()
            page.locator('[data-act="st-tri"][data-f="outsideSafe"][data-v="0"]').click()
            page.reload()
            assert page.locator('[data-act="st-tri"][data-f="outsideSafe"][data-v="0"]').get_attribute('aria-pressed') == 'true'
            page.goto(url + '#/setup/2')
            page.get_by_text('Що доступно?').wait_for()
            assert page.locator('[data-act="su-equip"][data-v="station"]').count() == 1
            # Чекаємо на завершення початкового кешування Service Worker.
            page.wait_for_function("async () => { const r = await navigator.serviceWorker.ready; return !!r.active && !!navigator.serviceWorker.controller }", timeout=30000)
            page.wait_for_timeout(500)
            context.set_offline(True)
            page.reload(wait_until='domcontentloaded', timeout=15000)
            page.get_by_text('Що доступно?').wait_for()
            assert not errors, f'Помилки JavaScript: {errors}'
            browser.close()
        print('OK: мобільні екрани, стан, GitHub Pages path, PWA офлайн-перезавантаження')
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=4)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == '__main__':
    main()
