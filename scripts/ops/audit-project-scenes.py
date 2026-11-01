#!/usr/bin/env python3
"""Browser acceptance matrix for the twelve shared project scenes (production or local)."""
import argparse
import json
import os
from pathlib import Path
import re
import sys
import time
from playwright.sync_api import sync_playwright

SCENES = ['genesis-garden', 'dharma-temple', 'te-piko-ora', 'golden-republic-bohemia', 'bodhi-lanka', 'ekam', 'nova-amerika', 'uluru', 'maria-del-camino', 'boa-esperanca', 'kailash', 'amenti']
# MATRIX has no Earth marker and the universe shell has no scene audit hook yet; both are
# reachable in Nirvana only and are useful for beauty shots during the render programme.
NIRVANA_ONLY = ['matrix']


def average_hash(path, size=16):
    """Perceptual fingerprint: 16x16 greyscale, one bit per pixel versus the mean."""
    from PIL import Image
    image = Image.open(path).convert('L').resize((size, size))
    pixels = list(image.getdata())
    mean = sum(pixels) / len(pixels)
    return ''.join('1' if value >= mean else '0' for value in pixels)


def hash_distance(a, b):
    if not a or not b or len(a) != len(b):
        return None
    return sum(1 for x, y in zip(a, b) if x != y) * 100 / len(a)


def local_chromium(explicit):
    """Prefer a locally installed browser so audits never download playwright builds."""
    if explicit:
        return explicit
    if sys.platform == 'darwin':
        for name in ('Google Chrome', 'Chromium', 'Brave Browser', 'Microsoft Edge'):
            candidate = f'/Applications/{name}.app/Contents/MacOS/{name}'
            if Path(candidate).exists():
                return candidate
    return str(sorted((Path.home() / '.cache/ms-playwright').glob('chromium-*/chrome-linux64/chrome'))[-1])



def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--nirvana-url', default='http://localhost:3040')
    parser.add_argument('--web-url', default='http://localhost:3041')
    parser.add_argument('--output', default='.artifacts/3d-tuning/final')
    parser.add_argument('--app', choices=['all', 'nirvana', 'web'], default='all')
    parser.add_argument('--only', default='')
    parser.add_argument('--release', default='working-tree')
    parser.add_argument('--sample-seconds', type=float, default=10)
    parser.add_argument('--mount-timeout', type=int, default=60000, help='Milliseconds to wait for the scene to mount (software rendering can be slow)')
    parser.add_argument('--gpu', choices=['sw', 'nvidia', 'amd', 'metal'], default='metal' if sys.platform == 'darwin' else 'sw', help='Renderer: metal = local Apple GPU via ANGLE (macOS), sw = SwiftShader, nvidia/amd = local hardware via ANGLE')
    parser.add_argument('--chromium', default='')
    parser.add_argument('--startup-only', action='store_true', help='Check rendered scene and loaded scripts/styles without the interaction matrix')
    parser.add_argument('--shots-only', action='store_true', help='Capture hero screenshots + render metrics only (art review, no interaction matrix)')
    parser.add_argument('--resume', action='store_true', help='Keep passed rows for this release and rerun incomplete or failed rows')
    parser.add_argument('--strict-budget', action='store_true', help='Fail scenes above 600 draw calls, 450k triangles or below 30 fps')
    parser.add_argument('--scorecard', default='', help='Write a markdown scorecard to this path')
    parser.add_argument('--visual-baseline', default='', help='Directory of reference screenshots to compare against')
    parser.add_argument('--visual-gate', type=float, default=0, help='Fail when the perceptual difference of the hero shot exceeds this percentage')
    parser.add_argument('--budget-file', default='', help='Committed budget JSON (draw calls / triangles per scene) to compare against')
    parser.add_argument('--write-budget', default='', help='Write the measured budget JSON to this path')
    parser.add_argument('--budget-tolerance', type=float, default=15, help='Allowed growth of draw calls and triangles in percent')
    args = parser.parse_args()
    output = Path(args.output).resolve(); output.mkdir(parents=True, exist_ok=True)
    selected = args.only.split(',') if args.only else SCENES + NIRVANA_ONLY
    if any(scene not in SCENES + NIRVANA_ONLY for scene in selected): parser.error('unknown scene')
    chromium = local_chromium(args.chromium)
    apps = ['nirvana', 'web'] if args.app == 'all' else [args.app]
    budget = {}
    if args.budget_file and Path(args.budget_file).exists():
        budget = json.loads(Path(args.budget_file).read_text()).get('scenes', {})
    results = []
    if args.resume and (output/'results.json').exists():
        previous = json.loads((output/'results.json').read_text())
        if previous.get('release') == args.release:
            results = previous.get('results', [])
    with sync_playwright() as p:
        gpu_args = {
            'sw': ['--enable-unsafe-swiftshader'],
            'nvidia': ['--enable-gpu', '--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan'],
            'amd': ['--enable-gpu', '--use-gl=angle', '--use-angle=gl-egl'],
            'metal': ['--enable-gpu', '--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'],
        }[args.gpu]
        browser = p.chromium.launch(executable_path=chromium, headless=True, args=['--no-sandbox', *gpu_args])
        for app in apps:
            for scene in selected:
                if scene in NIRVANA_ONLY and app != 'nirvana': continue
                if any(row.get('app') == app and row.get('scene') == scene and row.get('status') == 'pass' for row in results): continue
                row = {'app': app, 'scene': scene, 'release': args.release, 'renderer': args.gpu, 'errors': []}
                context = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
                if os.environ.get('ZION_RENDER_AUDIT') == '1':
                    # The presentations are gated by an access pass; a local production build can
                    # opt in to audits by setting ZION_RENDER_AUDIT=1 on the server and here.
                    context.set_extra_http_headers({'x-render-audit': '1'})
                page = context.new_page(); page.set_default_timeout(60000)
                page.on('pageerror', lambda e, row=row: row['errors'].append(str(e)))
                page.on('console', lambda m, row=row: row['errors'].append(m.text) if re.search(r'Shader Error|synchronously unmount|React is not defined|Error creating WebGL', m.text) else None)
                try:
                    base = args.nirvana_url if app == 'nirvana' else args.web_url
                    path = '/present/'+scene if app == 'nirvana' else '/terranova/'+('genesis' if scene == 'genesis-garden' else scene)
                    query = '?sceneAudit=1' + ('&labels=0' if args.shots_only else '')
                    response = page.goto(base.rstrip('/')+path+query, wait_until='domcontentloaded', timeout=90000)
                    assert response and response.status == 200, f'HTTP {response.status if response else None}'
                    if app == 'web':
                        # Website previews render only while they are on screen (frameloop is
                        # gated by an IntersectionObserver), so scroll before waiting for frames.
                        page.wait_for_function("document.querySelectorAll('canvas').length >= 2", timeout=args.mount_timeout)
                        # The site also mounts a global background canvas; the project preview is
                        # the last one on the page, so scroll that one into view.
                        page.evaluate("(() => { const all = document.querySelectorAll('canvas'); const last = all[all.length - 1]; last?.scrollIntoView({ block: 'center' }); })()")
                        page.wait_for_timeout(600)
                    page.wait_for_function('window.__projectScene?.frames >= 4 && window.__projectScene.invalidVertices >= 0', timeout=args.mount_timeout)
                    canvas = page.locator('canvas').first if app == 'nirvana' else page.locator('canvas').last
                    canvas.scroll_into_view_if_needed()
                    if args.shots_only:
                        # Art-review capture: stable frame (no auto-rotate), three compositions.
                        page.emulate_media(reduced_motion='reduce')
                        page.wait_for_function('window.__projectScene.reducedMotion')
                        page.wait_for_timeout(600)
                        row['render'] = page.evaluate('window.__projectScene')
                        assert row['render']['invalidVertices'] == 0, 'non-finite geometry'
                        for label, size in (('hero-1920', {'width': 1920, 'height': 1080}),
                                            ('desktop-1440', {'width': 1440, 'height': 900}),
                                            ('mobile-390', {'width': 390, 'height': 844})):
                            page.set_viewport_size(size)
                            page.wait_for_timeout(700)
                            shot = output/f'{app}-{scene}-{label}.png'
                            page.screenshot(path=str(shot), timeout=90000, animations='disabled')
                            print(f'{app}/{scene}: {label}', flush=True)
                            if args.visual_baseline and label == 'desktop-1440':
                                reference = Path(args.visual_baseline) / shot.name
                                if reference.exists():
                                    delta = hash_distance(average_hash(shot), average_hash(reference))
                                    row['visual_delta'] = round(delta, 2) if delta is not None else None
                                    if args.visual_gate and delta is not None and delta > args.visual_gate:
                                        raise AssertionError(f'visual delta {delta:.1f}% > {args.visual_gate}%')
                                else:
                                    row['visual_delta'] = 'new'
                        row['metrics'] = {
                            'fps': row['render']['fps'],
                            'calls': row['render']['calls'],
                            'triangles': row['render']['triangles'],
                            'geometries': row['render']['geometries'],
                            'textures': row['render']['textures'],
                        }
                        reference = budget.get(f"{app}/{scene}")
                        if reference:
                            limit = 1 + args.budget_tolerance / 100
                            calls_limit = int(reference['calls'] * limit)
                            tris_limit = int(reference['triangles'] * limit)
                            row['budget_reference'] = reference
                            assert row['metrics']['calls'] <= calls_limit, (
                                f"draw calls {row['metrics']['calls']} exceed the committed budget {reference['calls']}"
                            )
                            assert row['metrics']['triangles'] <= tris_limit, (
                                f"triangles {row['metrics']['triangles']} exceed the committed budget {reference['triangles']}"
                            )
                        if args.strict_budget:
                            assert row['metrics']['calls'] <= 600, f"draw calls {row['metrics']['calls']} > 600"
                            assert row['metrics']['triangles'] <= 450_000, f"triangles {row['metrics']['triangles']} > 450k"
                            assert row['metrics']['fps'] >= 30, f"fps {row['metrics']['fps']:.1f} < 30"
                        assert not row['errors'], 'browser runtime errors'
                        row['status'] = 'pass'
                        continue
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
                    row['initial'] = page.evaluate('window.__projectScene')
                    assert row['initial']['invalidVertices'] == 0, 'non-finite geometry'
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
                    # Warm baseline: both viewports and both languages have rendered, so every
                    # geometry and texture that is merely lazily uploaded to the GPU is already
                    # counted. Anything created from here on is churn in the live renderer.
                    row['before'] = page.evaluate('window.__projectScene')
                    before_objects = set()
                    if page.evaluate("typeof window.__projectSceneObjects === 'function'"):
                        before_objects = {item['uuid'] for item in page.evaluate('window.__projectSceneObjects()')}
                    # Exercise texture replacement repeatedly in the same live renderer.
                    for _ in range(2): language(True); language(False)
                    row['after_language_cycles'] = page.evaluate('window.__projectScene')
                    if before_objects:
                        after_objects = {item['uuid'] for item in page.evaluate('window.__projectSceneObjects()')}
                        # Re-creating an object and releasing the old one is fine; a growing
                        # scene graph (or GPU resource count above) is a leak.
                        row['recreated_geometries'] = len(after_objects - before_objects)
                        row['scene_geometries'] = [len(before_objects), len(after_objects)]
                        assert len(after_objects) <= len(before_objects) + 2, 'scene graph grew after language cycles'
                    # GPU counters also count lazily uploaded resources: objects that existed
                    # but were culled become visible while the camera rotates. The scene graph
                    # assertion above is the exact leak gate; these stay as a proportional guard.
                    geometry_allowance = max(8, round(row['before']['geometries'] * 0.1))
                    texture_allowance = max(4, round(row['before']['textures'] * 0.2))
                    assert row['after_language_cycles']['geometries'] <= row['before']['geometries'] + geometry_allowance, 'geometry count grew after language cycles'
                    assert row['after_language_cycles']['textures'] <= row['before']['textures'] + texture_allowance, 'texture count grew after language cycles'
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

    if args.write_budget:
        scenes = {}
        for row in results:
            metrics = row.get('metrics')
            if not metrics:
                continue
            scenes[f"{row['app']}/{row['scene']}"] = {
                'calls': metrics['calls'],
                'triangles': metrics['triangles'],
                'textures': metrics['textures'],
            }
        payload = {
            'note': 'Draw-call and triangle budget per scene. Generated by audit-project-scenes.py --write-budget.',
            'renderer': args.gpu,
            'release': args.release,
            'scenes': scenes,
        }
        Path(args.write_budget).write_text(json.dumps(payload, indent=2) + '\n')
        print(f'budget: {args.write_budget}', flush=True)

    if args.scorecard:
        rows = [row for row in results if row.get('metrics')]
        rows.sort(key=lambda item: -item['metrics']['calls'])
        lines = [
            f"# Scene scorecard — {args.release}",
            '',
            f"Renderer: {args.gpu}. Captured with reduced motion, 1440x900.",
            '',
            '| App | Scene | Draw calls | Triangles | Textures | FPS | Status |',
            '| --- | --- | --- | --- | --- | --- | --- |',
        ]
        for row in rows:
            m = row['metrics']
            lines.append(
                f"| {row['app']} | {row['scene']} | {m['calls']} | {m['triangles']} | {m['textures']} | {m['fps']:.1f} | {row['status']} |"
            )
        Path(args.scorecard).write_text('\n'.join(lines) + '\n')
        print(f'scorecard: {args.scorecard}', flush=True)

    return 1 if any(row['status']=='fail' for row in results) else 0

if __name__ == '__main__': raise SystemExit(main())
