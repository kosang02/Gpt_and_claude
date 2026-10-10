"""Run against npm start. Requires Python Playwright with Chromium and WebKit."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.getenv('LAB_URL','http://127.0.0.1:4173').rstrip('/')
OUT=Path('artifacts');OUT.mkdir(exist_ok=True)
with sync_playwright() as pw:
    browser=pw.chromium.launch(args=['--no-sandbox','--use-angle=swiftshader','--enable-webgl'])
    page=browser.new_page(viewport={'width':1180,'height':820})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'/?debug=1');page.wait_for_function('window.impactLab')
    page.evaluate('impactLab.renderer.setPixelRatio(.6); impactLab.setPaused(true)')
    def run(js):return page.evaluate(js)
    def advance(seconds=2):run(f'impactLab.setPaused(true); for(let i=0;i<{int(seconds*60)};i++)impactLab.tick(1/60)')
    def input_value(id,value):page.eval_on_selector('#'+id,'(el,v)=>{el.value=v;el.dispatchEvent(new Event("input",{bubbles:true}));}',str(value))
    # Real button starts flight, swept collision creates a finite-thickness aperture.
    page.click('#fire');advance()
    assert run('impactLab.selected.hits.length')==1
    assert run('impactLab.selected.hits[0].hole')
    assert run('impactLab.selected.mesh.geometry.boundingBox.min.z')<-.5
    # Ray passes through the actual hole. No phantom plane collision remains.
    page.click('#fire');advance()
    assert run('impactLab.selected.hits.length')==1
    print('PASS actual aperture / no phantom collision',flush=True)
    input_value('aimX',52);page.click('#fire');advance()
    assert run('impactLab.selected.hits.length')==2
    assert run('impactLab.selected.mesh.geometry.boundingBox.min.z')<-.5
    before=run('JSON.stringify(impactLab.selected.serialize())')
    page.click('#save');page.click('#repair');assert run('impactLab.selected.hits.length')==0
    page.click('#load');assert run('JSON.stringify(impactLab.selected.serialize())')==before
    # Corrupt local save must not mutate an existing scene.
    run('localStorage.setItem("impact-lab-scene-v2", "{}")');page.click('#load')
    assert run('JSON.stringify(impactLab.selected.serialize())')==before
    print('PASS accumulated damage / save restore / corrupted save',flush=True)
    page.click('#reset');page.click('[data-ammo=ball]');input_value('power',25);page.click('#fire');advance()
    assert not run('impactLab.selected.hits[0].hole')
    assert run('impactLab.selected.mesh.geometry.boundingBox.min.z')<-.35
    page.click('#section');assert run('impactLab.selected.sectionX')==0
    page.click('[data-view=side]');page.screenshot(path=str(OUT/'section.png'))
    page.click('#fire');assert not run('impactLab.section');advance()
    print('PASS low energy dent / section / firing restores complete plate',flush=True)
    page.click('#reset');page.click('[data-ammo=ap]');input_value('power',72);input_value('tilt',72);page.click('#fire');advance()
    assert run('impactLab.selected.hits[0].ricochet')
    assert run('impactLab.history[0].kind')=='ricochet'
    print('PASS glancing collision ricochet',flush=True)
    page.click('#reset');input_value('power',100);page.click('#addPlate')
    run('impactLab.select(1)');page.click('#fire');advance(3)
    assert run('impactLab.plates.every(p=>p.hits.length===1)')
    assert run('impactLab.plates[0].hits[0].hole')
    print('PASS sequential collision with two plates',flush=True)
    page.click('#reset');page.click('[data-ammo=jet]');page.click('#fire');advance(.51)
    assert run('impactLab.selected.hits[0].type')=='jet'
    assert run('impactLab.particles.items.some(p=>p.kind==="beam")')
    count=run('impactLab.selected.hits[0].progress');page.click('#step')
    assert run('impactLab.paused') and run('impactLab.selected.hits[0].progress')>count
    page.click('#wire');assert run('impactLab.selected.material.wireframe')
    print('PASS jet effect / frame stepping / wireframe',flush=True)
    page.click('#addPlate');page.click('[data-tool=translate]');assert run('impactLab.transform.object === impactLab.selected.group')
    page.click('[data-tool=rotate]');assert run('impactLab.transform.mode')=='rotate'
    page.click('#deletePlate');assert run('impactLab.plates.length')==1
    assert errors==[],errors
    print('CHROMIUM PASS; no JavaScript errors',flush=True);browser.close()
    # WebKit is an engine check with iPhone dimensions/touch, not physical iOS Safari.
    browser=pw.webkit.launch()
    context=browser.new_context(**pw.devices['iPhone 13'])
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'/?debug=1');page.wait_for_function('window.impactLab')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(OUT/'webkit-mobile-before.png'))
    page.select_option('#speed','1');page.tap('#fire')
    page.wait_for_function('impactLab.selected.hits.length===1 && impactLab.selected.hits[0].progress===1',timeout=60000)
    page.tap('#pause');page.screenshot(path=str(OUT/'webkit-mobile-after.png'))
    page.tap('[data-view=back]');page.screenshot(path=str(OUT/'webkit-mobile-back.png'))
    page.tap('#section');assert page.evaluate('impactLab.section')
    page.tap('#wire');assert page.evaluate('impactLab.selected.material.wireframe')
    # Aim by touching a visible piece of the plate; screen position derived from real geometry.
    page.tap('#section');page.tap('[data-view=front]')
    target=page.evaluate('''() => {const a=impactLab,p=a.selected;const v=p.group.position.clone();v.x+=1;v.y+=.6;v.project(a.camera);const r=a.renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};}''')
    page.touchscreen.tap(target['x'],target['y']);assert page.evaluate('impactLab.aimX')>10
    assert errors==[],errors
    print('WEBKIT MOBILE PASS; WebGL / touch aim / impact / views / section; no overflow or JavaScript errors',flush=True)
    browser.close()
