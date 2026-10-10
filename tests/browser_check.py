import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.getenv('LAB_URL','http://127.0.0.1:4173')
OUT=Path('artifacts'); OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=swiftshader','--enable-webgl'])
    page=browser.new_page(viewport={'width':1440,'height':1000}, device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'/?debug=1')
    page.wait_for_function('window.impactLab && document.getElementById("loading").hidden')
    page.screenshot(path=str(OUT/'desktop-before.png'))
    page.select_option('#speed','1')
    page.click('#fire')
    page.wait_for_function('impactLab.selected.hits.length===1 && impactLab.selected.hits[0].progress===1')
    page.screenshot(path=str(OUT/'desktop-after.png'))
    for view in ['front','side','back']:
        page.click('[data-view='+view+']');page.wait_for_timeout(150)
        page.screenshot(path=str(OUT/f'desktop-{view}.png'))
    print(json.dumps({'errors':errors,'stats':page.evaluate('({hits:impactLab.selected.hits, faces:impactLab.selected.activeFaceCount, particles:impactLab.particles.items.length, render:impactLab.renderer.info.render})')},ensure_ascii=False))
    browser.close()
