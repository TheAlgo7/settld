"""README screenshots and hero banner, from the live app.

  python scripts/readme-shots.py            # against production
  BASE=http://localhost:5173 python scripts/readme-shots.py

Needs Python with Playwright and Chrome. Uses local mode (no sign-in) and the
built-in sample trip, whose people and places are invented, in a throwaway
browser. Writes docs/readme/*.png. docs/ and scripts/ are in .vercelignore.
"""
import base64, os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE', 'https://settld-ruddy.vercel.app')
OUT = Path('docs/readme')
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

    # Hero: the mark, the promise, and three real screens.
    img = lambda n: 'data:image/png;base64,' + base64.b64encode((OUT / n).read_bytes()).decode()
    icon = 'data:image/png;base64,' + base64.b64encode(Path('icons/icon-192.png').read_bytes()).decode()
    hero = f'''<html><head>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500&display=block" rel="stylesheet">
<style>
body {{ margin: 0; width: 1600px; height: 820px; background: #0A0A0C; font-family: Inter; color: #F4F2EE; overflow: hidden; position: relative; }}
.glow {{ position: absolute; right: -160px; top: -200px; width: 1000px; height: 1000px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255,111,97,0.18), rgba(255,111,97,0)); }}
.copy {{ position: absolute; left: 110px; top: 196px; width: 660px; }}
.wm {{ display: flex; align-items: center; gap: 16px; font-family: 'Space Grotesk'; font-size: 42px; font-weight: 700; letter-spacing: -0.02em; }}
.wm img {{ width: 60px; height: 60px; border-radius: 16px; }}
h1 {{ margin: 60px 0 0; font-family: 'Space Grotesk'; font-size: 74px; line-height: 1.02; font-weight: 700; letter-spacing: -0.035em; }}
h1 em {{ font-style: normal; color: #FF6F61; }}
p {{ margin: 28px 0 0; font-size: 25px; line-height: 1.45; color: #ADA9A2; max-width: 30ch; }}
.phone {{ position: absolute; width: 300px; border-radius: 38px; overflow: hidden; border: 1px solid rgba(255,255,255,0.10);
  box-shadow: 0 40px 90px -30px rgba(0,0,0,0.9); background: #000; }}
.phone img {{ display: block; width: 100%; }}
.a {{ left: 800px; top: 120px; transform: rotate(-4deg); }}
.b {{ left: 1040px; top: 70px; z-index: 2; }}
.c {{ left: 1280px; top: 140px; transform: rotate(4deg); }}
</style></head><body><div class="glow"></div>
<div class="copy"><div class="wm"><img src="{icon}">Settld</div>
<h1>Split. Prove. <em>Settle.</em></h1>
<p>Shared expenses with the receipt, the payment proof and every edit kept together.</p></div>
<div class="phone a"><img src="{img('expense.png')}"></div>
<div class="phone b"><img src="{img('group.png')}"></div>
<div class="phone c"><img src="{img('settle.png')}"></div>
</body></html>'''
    pg = b.new_page(viewport={'width': 1600, 'height': 820})
    pg.set_content(hero, wait_until='networkidle')
    pg.evaluate('document.fonts.ready')
    pg.wait_for_timeout(800)
    pg.screenshot(path=str(OUT / 'hero.png'))
    b.close()
print('written:', sorted(x.name for x in OUT.iterdir()))
