"""README screenshots, from the live app.

  python scripts/readme-shots.py            # against production
  BASE=http://localhost:5173 python scripts/readme-shots.py

Needs Python with Playwright and Chrome. Uses local mode (no sign-in) and the
built-in sample trip, whose people and places are invented, in a throwaway
browser. Writes docs/readme/src/assets/*.png; the README Kit
(Work/Playbooks/README Kit/render.py) draws docs/readme/*.webp from them. docs/ and scripts/ are in .vercelignore.
"""
import base64, os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'https://settld-ruddy.vercel.app')
OUT = Path('docs/readme/src/assets')
OUT.mkdir(parents=True, exist_ok=True)
UA = 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36'

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    ctx = b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=2, user_agent=UA,
                        is_mobile=True, has_touch=True, service_workers='block')
    page = ctx.new_page()
    shot = lambda name, wait=900: (page.wait_for_timeout(wait), page.screenshot(path=str(OUT / f'{name}.png')))
    close_sheet = lambda: (page.keyboard.press('Escape'), page.wait_for_timeout(600))

    page.goto(BASE, wait_until='networkidle')
    shot('welcome', 1200)
    page.get_by_role('button', name='Continue on this device').click()
    page.wait_for_timeout(700)
    page.locator('#w-name').fill('Asha')
    page.get_by_role('button', name='Get started').click()
    page.wait_for_timeout(800)
    page.get_by_role('button', name='Explore a sample trip').click()
    page.get_by_role('heading', name='Goa trip').wait_for()
    shot('group', 3500)  # let the "Sample trip added" toast go
    group = page.url

    page.get_by_role('button', name='Settle up').click()
    shot('settle', 1000)
    close_sheet()
    page.locator('.ex-row', has_text='Hotel, two nights').click()
    shot('expense', 1200)
    close_sheet()

    for route in ['friends', 'activity']:
        page.goto(f'{BASE}/#/{route}'); shot(route, 1200)

    page.goto(f'{BASE}/#/settings'); page.wait_for_timeout(1000)
    page.locator('#st-theme [data-t="light"]').click()
    page.goto(group); shot('light', 1500)
    ctx.close()

    b.close()
print('written:', sorted(x.name for x in OUT.iterdir()))
