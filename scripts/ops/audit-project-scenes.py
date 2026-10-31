#!/usr/bin/env python3
"""Browser acceptance matrix for the twelve shared project scenes (production or local)."""
import argparse
import json
from pathlib import Path
import re
import time
from playwright.sync_api import sync_playwright

SCENES = ['genesis-garden', 'dharma-temple', 'te-piko-ora', 'golden-republic-bohemia', 'bodhi-lanka', 'ekam', 'nova-amerika', 'uluru', 'maria-del-camino', 'boa-esperanca', 'kailash', 'amenti']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--nirvana-url', default='http://localhost:3040')
    parser.add_argument('--web-url', default='http://localhost:3041')
    parser.add_argument('--output', default='.artifacts/3d-tuning/final')
    parser.add_argument('--app', choices=['all', 'nirvana', 'web'], default='all')
    parser.add_argument('--only', default='')
    parser.add_argument('--release', default='working-tree')
    parser.add_argument('--sample-seconds', type=float, default=10)
    parser.add_argument('--chromium', default='')
    parser.add_argument('--startup-only', action='store_true', help='Check rendered scene and loaded scripts/styles without the interaction matrix')
    parser.add_argument('--resume', action='store_true', help='Keep passed rows for this release and rerun incomplete or failed rows')
    args = parser.parse_args()
    output = Path(args.output).resolve(); output.mkdir(parents=True, exist_ok=True)
    selected = args.only.split(',') if args.only else SCENES
    if any(scene not in SCENES for scene in selected): parser.error('unknown scene')
    chromium = args.chromium or str(sorted((Path.home()/'.cache/ms-playwright').glob('chromium-*/chrome-linux64/chrome'))[-1])
    apps = ['nirvana', 'web'] if args.app == 'all' else [args.app]
    results = []
    if args.resume and (output/'results.json').exists():
        previous = json.loads((output/'results.json').read_text())
        if previous.get('release') == args.release:
            results = previous.get('results', [])
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chromium, headless=True, args=['--no-sandbox', '--enable-unsafe-swiftshader'])
        for app in apps:
            for scene in selected:
                if any(row.get('app') == app and row.get('scene') == scene and row.get('status') == 'pass' for row in results): continue
                row = {'app': app, 'scene': scene, 'release': args.release, 'errors': []}
                context = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
                page = context.new_page(); page.set_default_timeout(60000)
                page.on('pageerror', lambda e, row=row: row['errors'].append(str(e)))
                page.on('console', lambda m, row=row: row['errors'].append(m.text) if re.search(r'Shader Error|synchronously unmount|React is not defined|Error creating WebGL', m.text) else None)
                try:
                    base = args.nirvana_url if app == 'nirvana' else args.web_url
                    path = '/present/'+scene if app == 'nirvana' else '/terranova/'+('genesis' if scene == 'genesis-garden' else scene)
                    response = page.goto(base.rstrip('/')+path+'?sceneAudit=1', wait_until='domcontentloaded', timeout=90000)
                    assert response and response.status == 200, f'HTTP {response.status if response else None}'
                    page.wait_for_function('window.__projectScene?.frames >= 4 && window.__projectScene.invalidVertices >= 0')
                    canvas = page.locator('canvas').first if app == 'nirvana' else page.locator('canvas').last
                    canvas.scroll_into_view_if_needed()
                    if args.startup_only:
                        row['render'] = page.evaluate('window.__projectScene')
                        assert row['render']['invalidVertices'] == 0, 'non-finite geometry'
                        assets = page.evaluate("performance.getEntriesByType('resource').filter(r => /\\.(js|css)(\\?|$)/.test(r.name)).map(r => r.name)")
                        assert assets, 'no scripts/styles loaded'
                        for asset in assets:
                            loaded = context.request.get(asset)
                            assert loaded.ok, f'asset HTTP {loaded.status}: {asset}'
                        row['assets_checked'] = len(assets)
                        assert not row['errors'], 'browser runtime errors'
                        row['status'] = 'pass'
                        continue
                    sample = args.sample_seconds if app == 'nirvana' else min(args.sample_seconds, 2)
                    row['raf_fps'] = page.evaluate('''seconds => new Promise(resolve => {
                      let frames=0,start=performance.now();function f(t){frames++;if(t-start<seconds*1000)requestAnimationFrame(f);else resolve(frames*1000/(t-start));}requestAnimationFrame(f);
                    })''', sample)
                    row['before'] = page.evaluate('window.__projectScene')
                    assert row['before']['invalidVertices'] == 0, 'non-finite geometry'
                    def screenshot(label):
                        canvas.scroll_into_view_if_needed(); page.screenshot(path=str(output/f'{app}-{scene}-{label}.png'), timeout=90000, animations='disabled')
                        print(f'{app}/{scene}: {label}',flush=True)
                    screenshot('cs-desktop')
                    page.set_viewport_size({'width':390,'height':844}); page.wait_for_timeout(350); screenshot('cs-mobile')
                    page.set_viewport_size({'width':1440,'height':900})
                    def language(english):
                        if app == 'nirvana': page.get_by_role('button',name='Switch to English' if english else 'Přepnout do češtiny',exact=True).click()
                        else: page.get_by_title('Přepnout do angličtiny' if english else 'Switch to Czech',exact=True).click()
                        frame = page.evaluate('window.__projectScene.frames')
                        page.wait_for_function('n => window.__projectScene.frames >= n+2',arg=frame)
                    language(True); screenshot('en-desktop')
                    if app == 'web': assert page.locator('html').get_attribute('lang') == 'en'
                    else: assert page.get_by_role('button',name='Přepnout do češtiny',exact=True).count() == 1
                    page.set_viewport_size({'width':390,'height':844}); page.wait_for_timeout(350); screenshot('en-mobile')
                    page.set_viewport_size({'width':1440,'height':900}); language(False)
                    # Exercise texture replacement repeatedly in the same live renderer.
                    for _ in range(2): language(True); language(False)
                    row['after_language_cycles'] = page.evaluate('window.__projectScene')
                    assert row['after_language_cycles']['geometries'] <= row['before']['geometries'] + 2, 'geometry count grew after language cycles'
                    assert row['after_language_cycles']['textures'] <= row['before']['textures'] + 2, 'texture count grew after language cycles'
                    canvas.scroll_into_view_if_needed(); box=canvas.bounding_box(); assert box and box['width'] > 0
                    x,y=box['x']+box['width']*.55,box['y']+box['height']*.55
                    camera_before=page.evaluate('window.__projectScene.camera')
                    page.mouse.move(x,y);page.mouse.wheel(0,180);page.mouse.down();page.mouse.move(x+65,y+20,steps=5);page.mouse.up();page.wait_for_timeout(700)
                    row['controls_moved'] = page.evaluate('window.__projectScene.camera') != camera_before
                    assert row['controls_moved'], 'camera controls did not move'
                    page.emulate_media(reduced_motion='reduce')
                    page.wait_for_function('window.__projectScene.reducedMotion && window.__projectScene.autoRotate === false')
                    row['reduced_motion'] = True
                    # Remount in the same browser and ensure resources remain bounded.
                    page.reload(wait_until='domcontentloaded');page.wait_for_function('window.__projectScene?.frames >= 4')
                    row['remount'] = page.evaluate('window.__projectScene')
                    assert row['remount']['invalidVertices'] == 0
                    assert not row['errors'], 'browser runtime errors'
                    row['status'] = 'pass'
                except Exception as e:
                    row['status']='fail';row['failure']=str(e)
                    try: page.screenshot(path=str(output/f'{app}-{scene}-failure.png'),timeout=10000)
                    except Exception: pass
                finally:
                    context.close()
                    results = [previous for previous in results if (previous.get('app'), previous.get('scene')) != (app, scene)]
                    results.append(row)
                    (output/'results.json').write_text(json.dumps({'release':args.release,'results':results},indent=2))
                    print(json.dumps(row),flush=True)
        browser.close()
    return 1 if any(row['status']=='fail' for row in results) else 0

if __name__ == '__main__': raise SystemExit(main())
