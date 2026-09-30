"""Google Play listing images, from the real app and its sample trip.

  npx serve -l 5180 .
  python scripts/store-shots.py <out-dir>

Writes 1080x1920 phone screenshots (Play wants no side longer than twice the
other) and a 1024x500 feature graphic. Everyone in the sample trip is invented.
"""
import base64
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5180'
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else 'store-shots')
OUT.mkdir(parents=True, exist_ok=True)
UA = 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36'

with sync_playwright() as p:
    b = p.chromium.launch(channel='chrome')
    # 360x640 CSS pixels at 3x = 1080x1920.
    ctx = b.new_context(viewport={'width': 360, 'height': 640}, device_scale_factor=3, user_agent=UA, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.goto(BASE)
    page.get_by_role('button', name='Continue on this device').click()
    page.get_by_label('Your name').fill('Aarav')
    page.get_by_role('button', name='Get started').click()
    page.get_by_role('button', name='Explore a sample trip').click()
    expect(page.get_by_role('heading', name='Goa trip')).to_be_visible()
    page.wait_for_timeout(4200)  # let the "Sample trip added" toast go
    page.screenshot(path=str(OUT / '1-group.png'))

    page.get_by_role('button', name='Add expense').click()
    page.get_by_label('Amount in rupees').fill('1860')
    page.get_by_placeholder('What was it?').fill('Dinner at Britto\'s')
    page.wait_for_timeout(700)
    page.screenshot(path=str(OUT / '2-add-expense.png'))
    page.get_by_role('button', name='Close').click()
    page.wait_for_timeout(500)

    page.get_by_role('button', name='Settle up').click()
    page.wait_for_timeout(800)
    page.screenshot(path=str(OUT / '3-settle.png'))
    page.keyboard.press('Escape')
    page.wait_for_timeout(500)

    page.locator('.ex-row', has_text='Hotel, two nights').click()
    page.wait_for_timeout(900)
    page.screenshot(path=str(OUT / '4-proof.png'))
    page.keyboard.press('Escape')
    page.wait_for_timeout(500)

    page.goto(BASE + '/#/')
    page.wait_for_timeout(1000)
    page.screenshot(path=str(OUT / '5-groups.png'))
    ctx.close()

    # Feature graphic, 1024x500: the mark, the promise, two real screens.
    img = lambda n: 'data:image/png;base64,' + base64.b64encode((OUT / n).read_bytes()).decode()
    mark = ('<svg width="44" height="44" viewBox="0 0 512 512" fill="#ff6f61">'
            '<path d="M230 98h108a34 34 0 0 1 0 68H217c-32 0-57 25-57 57v80c-27-14-43-45-43-80 0-70 51-125 113-125Z"/>'
            '<path d="M340 218v64c0 39-32 70-71 70H164a34 34 0 0 0 0 68h115c64 0 110-45 110-111 0-40-19-74-49-91Z"/>'
            '<path d="m189 273 29-29 21 21 50-53h34l-84 98-21-1-29-36Z"/></svg>')
    art = f'''<html><head>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet">
<style>
body {{ margin: 0; width: 1024px; height: 500px; background: #090807; font-family: Inter, sans-serif; color: #f5f3ef; overflow: hidden; position: relative; }}
.glow {{ position: absolute; right: -80px; top: -160px; width: 640px; height: 640px; border-radius: 50%;
  background: radial-gradient(closest-side, rgba(255,111,97,0.17), rgba(255,111,97,0)); }}
.copy {{ position: absolute; left: 64px; top: 128px; width: 480px; }}
.wm {{ display: flex; align-items: center; gap: 14px; font: 700 32px "Space Grotesk", Inter, sans-serif; letter-spacing: -0.02em; }}
h1 {{ margin: 38px 0 0; font-size: 58px; line-height: 1.02; font-weight: 700; letter-spacing: -0.045em; }}
h1 em {{ font-style: normal; color: #ff6f61; }}
p {{ margin: 16px 0 0; font-size: 21px; color: #c4bfb6; }}
.phone {{ position: absolute; width: 196px; border-radius: 26px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 30px 70px -24px rgba(0,0,0,0.9); }}
.phone img {{ display: block; width: 100%; }}
.a {{ left: 590px; top: 70px; transform: rotate(-4deg); }}
.b {{ left: 790px; top: 40px; }}
</style></head><body><div class="glow"></div>
<div class="copy"><div class="wm">{mark}Settld</div>
<h1>Split. Prove. <em>Settle.</em></h1>
<p>Shared expenses with the receipts kept.</p></div>
<div class="phone a"><img src="{img('4-proof.png')}"></div>
<div class="phone b"><img src="{img('1-group.png')}"></div>
</body></html>'''
    pg = b.new_page(viewport={'width': 1024, 'height': 500})
    pg.set_content(art)
    pg.wait_for_timeout(1500)
    pg.screenshot(path=str(OUT / 'feature-graphic.png'))
    b.close()
print('written:', sorted(x.name for x in OUT.iterdir()))
