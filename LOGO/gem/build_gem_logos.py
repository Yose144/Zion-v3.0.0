#!/usr/bin/env python3
"""
ZION Z-Tree Logo Generator - GEM Collection
Combines the majestic Tree of Life (logo.jpeg) with the iconic Matrix 'Z' (Z.gif).
Generates production-grade SVGs, PNGs (1024x1024, 1200x600, 1200x630), favicons, and ICO.
"""

import math
import random
import os
import subprocess
from PIL import Image

def create_z_tree_svg(
    width=1024,
    height=1024,
    style="cosmic", # "cosmic", "matrix", "gold_emerald", "transparent", "light"
    include_bg=True,
    include_ring=True,
    include_wordmark=False
):
    cx = width / 2.0
    cy = height / 2.0 if not include_wordmark else height * 0.38
    scale = width / 512.0

    # Color Palettes
    if style == "matrix":
        bg_colors = ("#010e06", "#021a0d", "#000502")
        leaf_palette = ["#00ff66", "#10b981", "#059669", "#047857", "#34d399", "#a3e635", "#022c22", "#064e3b", "#22c55e", "#4ade80", "#2dd4bf"]
        accent_leaf = "#38bdf8"
        trunk_gradient = ("#a3e635", "#10b981", "#059669", "#022c22")
        ring_color = "#10b981"
        glow_color = "#10b981"
        fruit_colors = ["#00ff88", "#38bdf8", "#facc15", "#4ade80"]
    elif style == "gold_emerald":
        bg_colors = ("#0b0e0a", "#131c11", "#030603")
        leaf_palette = ["#10b981", "#059669", "#fbbf24", "#f59e0b", "#34d399", "#86efac", "#d97706", "#047857", "#22c55e"]
        accent_leaf = "#fde047"
        trunk_gradient = ("#fef08a", "#fbbf24", "#d97706", "#78350f")
        ring_color = "#fbbf24"
        glow_color = "#f59e0b"
        fruit_colors = ["#fde047", "#34d399", "#f43f5e", "#fbbf24"]
    elif style == "light":
        bg_colors = ("#ffffff", "#f8fafc", "#f1f5f9")
        leaf_palette = ["#059669", "#047857", "#065f46", "#0f5132", "#10b981", "#15803d", "#166534"]
        accent_leaf = "#d97706"
        trunk_gradient = ("#064e3b", "#022c22", "#0f172a", "#020617")
        ring_color = "#047857"
        glow_color = "#10b981"
        fruit_colors = ["#d97706", "#059669", "#2563eb", "#7c3aed"]
    else: # "cosmic"
        bg_colors = ("#080a1c", "#040612", "#010206")
        leaf_palette = ["#10b981", "#059669", "#22c55e", "#34d399", "#fbbf24", "#f59e0b", "#a855f7", "#06b6d4", "#86efac"]
        accent_leaf = "#67e8f9"
        trunk_gradient = ("#fef08a", "#fbbf24", "#d97706", "#78350f")
        ring_color = "#fbbf24"
        glow_color = "#a855f7"
        fruit_colors = ["#fbbf24", "#38bdf8", "#e879f9", "#4ade80"]

    svg = []
    svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">')
    
    # Definitions
    svg.append('<defs>')
    
    # Background gradient
    svg.append(f'''
    <radialGradient id="bgGrad" cx="50%" cy="42%" r="65%">
        <stop offset="0%" stop-color="{bg_colors[0]}"/>
        <stop offset="60%" stop-color="{bg_colors[1]}"/>
        <stop offset="100%" stop-color="{bg_colors[2]}"/>
    </radialGradient>
    <radialGradient id="canopyGlow" cx="50%" cy="32%" r="48%">
        <stop offset="0%" stop-color="{glow_color}" stop-opacity="0.45"/>
        <stop offset="50%" stop-color="{glow_color}" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="{glow_color}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="trunkGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="{ring_color}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="{ring_color}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="trunkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="{trunk_gradient[0]}"/>
        <stop offset="35%" stop-color="{trunk_gradient[1]}"/>
        <stop offset="75%" stop-color="{trunk_gradient[2]}"/>
        <stop offset="100%" stop-color="{trunk_gradient[3]}"/>
    </linearGradient>
    <linearGradient id="veinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
        <stop offset="50%" stop-color="{ring_color}" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="{glow_color}" stop-opacity="0.4"/>
    </linearGradient>
    <filter id="glowFilter" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="7" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="5"/>
    </filter>
    ''')
    svg.append('</defs>')

    s = scale

    # Background
    if include_bg and style != "transparent":
        rx = 96 * s if not include_wordmark else 0
        svg.append(f'<rect width="{width}" height="{height}" rx="{rx}" fill="url(#bgGrad)"/>')
        
        # Cosmic aura / nebula behind tree canopy
        svg.append(f'<circle cx="{cx}" cy="{cy - 30 * s}" r="{220 * s}" fill="url(#canopyGlow)"/>')

        # Matrix rain / starfield effect
        rng_stars = random.Random(1337)
        if style == "matrix":
            # Matrix digital rain lines
            for _ in range(45):
                sx = rng_stars.uniform(15, width - 15)
                sy1 = rng_stars.uniform(15, height - 80)
                sy2 = sy1 + rng_stars.uniform(40, 140)
                op = rng_stars.uniform(0.12, 0.40)
                svg.append(f'<line x1="{sx:.1f}" y1="{sy1:.1f}" x2="{sx:.1f}" y2="{sy2:.1f}" stroke="#00ff88" stroke-width="{rng_stars.uniform(1, 2.5):.1f}" opacity="{op:.2f}" stroke-dasharray="2,5"/>')
        else:
            # Cosmic stars
            for _ in range(75):
                sx = rng_stars.uniform(15, width - 15)
                sy = rng_stars.uniform(15, height - 15)
                sr = rng_stars.uniform(0.8, 2.4) * s
                sop = rng_stars.uniform(0.25, 0.88)
                scol = rng_stars.choice(["#ffffff", "#fef08a", "#a7f3d0", "#bae6fd", "#e9d5ff"])
                svg.append(f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="{sr:.1f}" fill="{scol}" opacity="{sop:.2f}"/>')

    # Sacred Geometry Ring
    if include_ring and style != "transparent":
        r_outer = 230 * s
        r_inner = 220 * s
        svg.append(f'<circle cx="{cx}" cy="{cy}" r="{r_outer}" fill="none" stroke="{ring_color}" stroke-width="{2 * s}" opacity="0.45"/>')
        svg.append(f'<circle cx="{cx}" cy="{cy}" r="{r_inner}" fill="none" stroke="{ring_color}" stroke-width="{1 * s}" stroke-dasharray="{6*s},{6*s}" opacity="0.35"/>')
        
        # 12 Sacred Ticks
        for i in range(12):
            ang = math.radians(i * 30)
            x1 = cx + math.cos(ang) * (r_inner - 6 * s)
            y1 = cy + math.sin(ang) * (r_inner - 6 * s)
            x2 = cx + math.cos(ang) * (r_outer + 6 * s)
            y2 = cy + math.sin(ang) * (r_outer + 6 * s)
            svg.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{ring_color}" stroke-width="{1.5 * s}" opacity="0.65"/>')
            
            if i % 3 == 0:
                dot_x = cx + math.cos(ang) * (r_outer + 12 * s)
                dot_y = cy + math.sin(ang) * (r_outer + 12 * s)
                svg.append(f'<circle cx="{dot_x:.1f}" cy="{dot_y:.1f}" r="{3.5 * s}" fill="{ring_color}" opacity="0.85"/>')

    # ---- ROOTS ----
    # Grounding roots extending from bottom bar of 'Z'
    root_base_y = cy + 95 * s
    root_paths = [
        # Main center taproots
        f"M {cx - 20*s} {root_base_y} Q {cx - 40*s} {root_base_y + 45*s} {cx - 70*s} {root_base_y + 85*s} Q {cx - 100*s} {root_base_y + 110*s} {cx - 140*s} {root_base_y + 120*s}",
        f"M {cx} {root_base_y} Q {cx - 10*s} {root_base_y + 50*s} {cx} {root_base_y + 95*s} Q {cx + 10*s} {root_base_y + 125*s} {cx - 15*s} {root_base_y + 145*s}",
        f"M {cx + 20*s} {root_base_y} Q {cx + 40*s} {root_base_y + 45*s} {cx + 70*s} {root_base_y + 85*s} Q {cx + 100*s} {root_base_y + 110*s} {cx + 140*s} {root_base_y + 120*s}",
        # Side roots extending bottom bar of Z
        f"M {cx - 90*s} {root_base_y} Q {cx - 120*s} {root_base_y + 25*s} {cx - 150*s} {root_base_y + 55*s} Q {cx - 175*s} {root_base_y + 80*s} {cx - 195*s} {root_base_y + 90*s}",
        f"M {cx + 90*s} {root_base_y} Q {cx + 120*s} {root_base_y + 25*s} {cx + 150*s} {root_base_y + 55*s} Q {cx + 175*s} {root_base_y + 80*s} {cx + 195*s} {root_base_y + 90*s}",
        # Secondary root tendrils
        f"M {cx - 60*s} {root_base_y + 35*s} Q {cx - 85*s} {root_base_y + 65*s} {cx - 110*s} {root_base_y + 100*s}",
        f"M {cx + 60*s} {root_base_y + 35*s} Q {cx + 85*s} {root_base_y + 65*s} {cx + 110*s} {root_base_y + 100*s}",
        f"M {cx - 130*s} {root_base_y + 40*s} Q {cx - 150*s} {root_base_y + 70*s} {cx - 165*s} {root_base_y + 110*s}",
        f"M {cx + 130*s} {root_base_y + 40*s} Q {cx + 150*s} {root_base_y + 70*s} {cx + 165*s} {root_base_y + 110*s}",
    ]
    
    root_widths = [12*s, 10*s, 12*s, 14*s, 14*s, 6*s, 6*s, 4*s, 4*s]
    for r_path, r_w in zip(root_paths, root_widths):
        svg.append(f'<path d="{r_path}" fill="none" stroke="url(#trunkGrad)" stroke-width="{r_w:.1f}" stroke-linecap="round" stroke-linejoin="round"/>')
        svg.append(f'<path d="{r_path}" fill="none" stroke="url(#veinGrad)" stroke-width="{max(1.5*s, r_w*0.25):.1f}" stroke-linecap="round" opacity="0.75"/>')

    # ---- MAIN 'Z' TRUNK & SCAFFOLD BRANCHES ----
    z_path_d = f"""
    M {cx - 120*s} {cy - 95*s}
    C {cx - 50*s} {cy - 100*s}, {cx + 50*s} {cy - 98*s}, {cx + 135*s} {cy - 90*s}
    C {cx + 145*s} {cy - 85*s}, {cx + 140*s} {cy - 65*s}, {cx + 115*s} {cy - 60*s}
    L {cx - 35*s} {cy + 55*s}
    C {cx - 50*s} {cy + 70*s}, {cx - 80*s} {cy + 85*s}, {cx + 125*s} {cy + 88*s}
    C {cx + 140*s} {cy + 92*s}, {cx + 140*s} {cy + 110*s}, {cx + 120*s} {cy + 110*s}
    L {cx - 130*s} {cy + 110*s}
    C {cx - 150*s} {cy + 108*s}, {cx - 150*s} {cy + 88*s}, {cx - 125*s} {cy + 82*s}
    L {cx + 20*s} {cy - 30*s}
    C {cx + 35*s} {cy - 42*s}, {cx + 15*s} {cy - 68*s}, {cx - 120*s} {cy - 68*s}
    C {cx - 140*s} {cy - 70*s}, {cx - 140*s} {cy - 92*s}, {cx - 120*s} {cy - 95*s}
    Z
    """
    svg.append(f'<path d="{z_path_d}" fill="url(#trunkGrad)" filter="url(#glowFilter)"/>')

    # Energy Veins running inside Z trunk
    vein_1 = f"M {cx - 110*s} {cy - 82*s} L {cx + 105*s} {cy - 78*s} Q {cx + 80*s} {cy - 40*s} {cx - 20*s} {cy + 35*s} Q {cx - 60*s} {cy + 75*s} {cx + 105*s} {cy + 98*s}"
    vein_2 = f"M {cx - 80*s} {cy - 76*s} L {cx + 70*s} {cy - 72*s} Q {cx + 45*s} {cy - 35*s} {cx - 45*s} {cy + 40*s} L {cx + 70*s} {cy + 102*s}"
    svg.append(f'<path d="{vein_1}" fill="none" stroke="url(#veinGrad)" stroke-width="{3.2*s:.1f}" stroke-linecap="round" opacity="0.9"/>')
    svg.append(f'<path d="{vein_2}" fill="none" stroke="url(#veinGrad)" stroke-width="{1.8*s:.1f}" stroke-linecap="round" opacity="0.7"/>')

    # Scaffold Branches extending from top of 'Z' into canopy
    branches = [
        (f"M {cx - 80*s} {cy - 90*s} Q {cx - 130*s} {cy - 125*s} {cx - 175*s} {cy - 150*s}", 11*s),
        (f"M {cx - 130*s} {cy - 125*s} Q {cx - 160*s} {cy - 175*s} {cx - 180*s} {cy - 210*s}", 7*s),
        (f"M {cx - 150*s} {cy - 138*s} Q {cx - 195*s} {cy - 150*s} {cx - 225*s} {cy - 165*s}", 6*s),
        (f"M {cx - 20*s} {cy - 92*s} Q {cx - 45*s} {cy - 145*s} {cx - 70*s} {cy - 200*s}", 10*s),
        (f"M {cx - 45*s} {cy - 145*s} Q {cx - 95*s} {cy - 175*s} {cx - 125*s} {cy - 220*s}", 6*s),
        (f"M {cx + 35*s} {cy - 92*s} Q {cx + 25*s} {cy - 155*s} {cx} {cy - 225*s}", 11*s),
        (f"M {cx + 25*s} {cy - 155*s} Q {cx + 55*s} {cy - 195*s} {cx + 70*s} {cy - 240*s}", 7*s),
        (f"M {cx + 90*s} {cy - 88*s} Q {cx + 145*s} {cy - 125*s} {cx + 190*s} {cy - 150*s}", 11*s),
        (f"M {cx + 145*s} {cy - 125*s} Q {cx + 175*s} {cy - 175*s} {cx + 195*s} {cy - 210*s}", 7*s),
        (f"M {cx + 165*s} {cy - 138*s} Q {cx + 205*s} {cy - 150*s} {cx + 230*s} {cy - 165*s}", 6*s),
    ]

    for b_path, b_w in branches:
        svg.append(f'<path d="{b_path}" fill="none" stroke="url(#trunkGrad)" stroke-width="{b_w:.1f}" stroke-linecap="round"/>')
        svg.append(f'<path d="{b_path}" fill="none" stroke="url(#veinGrad)" stroke-width="{max(1.2*s, b_w*0.22):.1f}" stroke-linecap="round" opacity="0.8"/>')

    # ---- UMBRELLA CANOPY (Dense Faceted Triangular Leaves) ----
    rng_leaves = random.Random(777)
    canopy_center_x = cx
    canopy_center_y = cy - 120 * s
    
    leaf_elements = []
    rings = 7
    
    for r_idx in range(rings):
        r_ratio = (r_idx + 1) / float(rings)
        rx_val = 30 * s + r_ratio * 215 * s
        ry_val = 20 * s + r_ratio * 135 * s
        
        leaf_size = (26 * s - r_ratio * 7 * s) if r_idx < 5 else (16 * s)
        leaf_width = leaf_size * 0.68
        
        num_leaves_in_ring = int(14 + r_idx * 18)
        
        for i in range(num_leaves_in_ring):
            ang_deg = -118 + (236.0 * i / float(num_leaves_in_ring - 1)) if num_leaves_in_ring > 1 else 0
            ang_rad = math.radians(ang_deg - 90)
            
            jitter_x = rng_leaves.uniform(-10 * s, 10 * s)
            jitter_y = rng_leaves.uniform(-8 * s, 8 * s)
            
            lx = canopy_center_x + math.cos(ang_rad) * rx_val + jitter_x
            ly = canopy_center_y + math.sin(ang_rad) * ry_val + jitter_y
            
            if ly > cy - 35 * s:
                continue
                
            leaf_angle_deg = math.degrees(math.atan2(ly - canopy_center_y, lx - canopy_center_x)) + 90
            leaf_angle_deg += rng_leaves.uniform(-18, 18)
            
            col_rand = rng_leaves.random()
            if col_rand < 0.09:
                col = accent_leaf
            else:
                col = rng_leaves.choice(leaf_palette)
                
            tip_dist = leaf_size * 0.85
            base_dist = leaf_size * 0.38
            
            rad_rot = math.radians(leaf_angle_deg - 90)
            perp_rot = rad_rot + math.pi / 2
            
            tip_x = lx + math.cos(rad_rot) * tip_dist
            tip_y = ly + math.sin(rad_rot) * tip_dist
            
            b1_x = lx - math.cos(rad_rot) * base_dist + math.cos(perp_rot) * (leaf_width * 0.5)
            b1_y = ly - math.sin(rad_rot) * base_dist + math.sin(perp_rot) * (leaf_width * 0.5)
            
            b2_x = lx - math.cos(rad_rot) * base_dist - math.cos(perp_rot) * (leaf_width * 0.5)
            b2_y = ly - math.sin(rad_rot) * base_dist - math.sin(perp_rot) * (leaf_width * 0.5)
            
            poly_pts = f"{tip_x:.1f},{tip_y:.1f} {b1_x:.1f},{b1_y:.1f} {b2_x:.1f},{b2_y:.1f}"
            op = 0.85 if r_idx > 1 else 0.95
            
            leaf_elements.append((r_idx, f'<polygon points="{poly_pts}" fill="{col}" opacity="{op:.2f}"/>'))

    leaf_elements.sort(key=lambda item: item[0])
    for _, l_svg in leaf_elements:
        svg.append(f'  {l_svg}')

    # ---- GLOWING ORBS / FRUIT OF LIFE ----
    rng_fruits = random.Random(999)
    fruit_positions = [
        (cx - 160*s, cy - 140*s, 8.5*s),
        (cx - 110*s, cy - 190*s, 10.5*s),
        (cx - 50*s, cy - 220*s, 9.5*s),
        (cx, cy - 235*s, 13*s),
        (cx + 50*s, cy - 220*s, 9.5*s),
        (cx + 110*s, cy - 190*s, 10.5*s),
        (cx + 160*s, cy - 140*s, 8.5*s),
        (cx - 190*s, cy - 160*s, 7.5*s),
        (cx + 190*s, cy - 160*s, 7.5*s),
        (cx - 75*s, cy - 150*s, 9*s),
        (cx + 75*s, cy - 150*s, 9*s),
        (cx - 130*s, cy - 180*s, 8*s),
        (cx + 130*s, cy - 180*s, 8*s),
    ]

    for fx, fy, fr in fruit_positions:
        fcol = rng_fruits.choice(fruit_colors)
        svg.append(f'<circle cx="{fx:.1f}" cy="{fy:.1f}" r="{fr*2.4:.1f}" fill="{fcol}" opacity="0.4" filter="url(#softGlow)"/>')
        svg.append(f'<circle cx="{fx:.1f}" cy="{fy:.1f}" r="{fr:.1f}" fill="{fcol}"/>')
        svg.append(f'<circle cx="{fx - fr*0.25:.1f}" cy="{fy - fr*0.25:.1f}" r="{fr*0.35:.1f}" fill="#ffffff" opacity="0.95"/>')

    # ---- OPTIONAL WORDMARK (ZION TERRA NOVA) ----
    if include_wordmark:
        text_y = height - 65 * s
        tag_y = height - 30 * s
        text_col = ring_color if style != "light" else "#0f172a"
        tag_col = glow_color if style != "light" else "#047857"
        
        svg.append(f'<text x="{cx:.1f}" y="{text_y:.1f}" text-anchor="middle" font-family="\'Inter\', \'Helvetica Neue\', Arial, sans-serif" font-size="{44*s:.1f}" font-weight="900" letter-spacing="{8*s:.1f}" fill="{text_col}">ZION</text>')
        svg.append(f'<text x="{cx:.1f}" y="{tag_y:.1f}" text-anchor="middle" font-family="\'Inter\', \'Helvetica Neue\', Arial, sans-serif" font-size="{16*s:.1f}" font-weight="600" letter-spacing="{6*s:.1f}" fill="{tag_col}">TERRA NOVA</text>')

    svg.append('</svg>')
    return "\n".join(svg)

def build_all():
    out_dir = "/Users/yeshuae/Projects/2.9.6/LOGO/gem"
    os.makedirs(out_dir, exist_ok=True)

    configs = [
        ("icon-cosmic", "cosmic", True, True, False, 1024, 1024),
        ("icon-matrix-green", "matrix", True, True, False, 1024, 1024),
        ("icon-gold-green", "gold_emerald", True, True, False, 1024, 1024),
        ("icon-transparent", "cosmic", False, False, False, 1024, 1024),
        ("icon-light", "light", True, True, False, 1024, 1024),
        ("favicon", "cosmic", True, True, False, 512, 512),
        ("wordmark-dark", "cosmic", True, True, True, 1200, 600),
        ("wordmark-light", "light", True, True, True, 1200, 600),
        ("banner-header", "matrix", True, True, True, 1200, 630),
    ]

    for name, style, bg, ring, wm, w, h in configs:
        svg_code = create_z_tree_svg(width=w, height=h, style=style, include_bg=bg, include_ring=ring, include_wordmark=wm)
        svg_path = os.path.join(out_dir, f"{name}.svg")
        png_path = os.path.join(out_dir, f"{name}.png")
        
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(svg_code)
            
        subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h), "-o", png_path, svg_path], check=True)
        print(f"Generated {name}.svg and {name}.png ({w}x{h})")

    # Favicon sizes
    for sz in (16, 32, 48, 64, 128, 256):
        f_png = os.path.join(out_dir, f"favicon-{sz}.png")
        subprocess.run(["rsvg-convert", "-w", str(sz), "-h", str(sz), "-o", f_png, os.path.join(out_dir, "favicon.svg")], check=True)

    # Multi-resolution ICO
    imgs = [Image.open(os.path.join(out_dir, f"favicon-{s}.png")).convert("RGBA") for s in (16, 32, 48)]
    imgs[0].save(os.path.join(out_dir, "favicon.ico"), format="ICO", sizes=[(16,16),(32,32),(48,48)], append_images=imgs[1:])
    print("Generated favicon.ico with multi-resolution sizes")

if __name__ == "__main__":
    build_all()
