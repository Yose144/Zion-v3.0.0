'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { usePolling } from '@/hooks/usePolling';

/* ═══════════════════════════════════════════════════════════════════════════
   ZION Tree of Life v4 — Ancient Bodhi · Mount Kailash Edition
   ═══════════════════════════════════════════════════════════════════════════
   A massive ancient tree — millennia old, gnarled and wise. Its trunk
   splits into three great limbs, reaching far across the night sky.
   Below its canopy, a sacred fire burns as a circle of masters
   sit in deep meditation. Behind, holy Mount Kailash rises into
   the star-filled heavens.

   • Ancient gnarled trunk (30px wide) with bark texture & knots
   • Two secondary split trunks forming a wide, spreading canopy
   • 65+ branches including drooping/hanging ancient branches
   • 140+ leaves in dense golden-emerald canopy
   • 18+ massive roots spreading across the ground
   • Mount Kailash silhouette with snow cap (right side)
   • Sacred campfire with animated flames & stone circle
   • 8 meditating masters in a circle around the fire
   • Fire sparks rising + stardust + golden energy tendrils
   • Parallax tilt, mouse particle interaction
   • Click trunk → Genesis message overlay
   • Live block height display
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Types ────────────────────────────────────────────────────────────────

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
  hue: number; pathProgress: number;
  type: 'stardust' | 'spark' | 'tendril' | 'star' | 'seed';
  rotation?: number; rotSpeed?: number;
  wobblePhase?: number;
  brightness?: number;
}

interface LeafNode {
  x: number; y: number;
  size: number; phase: number;
  hue: number; sat: number; light: number;
  angle: number;
}

// ── SVG Paths (viewBox 0 0 800 1050) ────────────────────────────────────

// ── ANCIENT TRUNK — massive, twisted, wider ──

const TRUNK_MAIN = `
  M 400 790
  C 394 755, 370 720, 380 680
  C 390 640, 418 600, 408 560
  C 398 520, 368 480, 380 440
  C 392 400, 420 360, 410 320
  C 400 280, 378 240, 388 200
  C 398 165, 400 135, 400 108
`;

const TRUNK_LEFT_EDGE = `
  M 370 792
  C 362 755, 340 720, 350 680
  C 358 640, 384 600, 374 560
  C 366 520, 338 480, 350 440
  C 360 400, 384 360, 376 320
  C 368 280, 350 240, 358 200
  C 368 170, 378 140, 384 118
`;

const TRUNK_RIGHT_EDGE = `
  M 430 792
  C 428 755, 402 720, 410 680
  C 418 640, 448 600, 440 560
  C 432 520, 402 480, 410 440
  C 420 400, 448 360, 440 320
  C 432 280, 410 240, 418 200
  C 428 170, 424 140, 416 118
`;

// ── SPLIT TRUNKS — secondary massive limbs ──

const TRUNK_LEFT_SPLIT = `
  M 380 440
  C 356 408, 324 375, 298 340
  C 272 305, 252 270, 244 235
  C 236 200, 230 170, 236 138
`;

const TRUNK_RIGHT_SPLIT = `
  M 420 400
  C 446 368, 476 335, 504 300
  C 532 265, 550 235, 558 200
  C 566 168, 570 140, 564 110
`;

// ── ROOTS — massive ancient roots spreading across earth ──

const ROOTS = [
  // Main thick roots from base
  'M 400 790 C 362 815, 288 838, 210 855',
  'M 400 790 C 358 812, 272 830, 185 842',
  'M 400 790 C 372 820, 312 840, 248 852',
  'M 400 790 C 342 815, 260 828, 195 825',
  'M 400 790 C 438 815, 512 838, 590 855',
  'M 400 790 C 442 812, 528 830, 615 842',
  'M 400 790 C 428 820, 488 840, 552 852',
  'M 400 790 C 458 815, 540 828, 605 825',
  // Extended surface roots
  'M 210 855 C 185 860, 155 858, 128 852',
  'M 185 842 C 158 846, 128 844, 100 838',
  'M 590 855 C 615 860, 645 858, 672 852',
  'M 615 842 C 642 846, 672 844, 700 838',
  // Deep reaching roots
  'M 128 852 C 108 848, 90 852, 75 860',
  'M 100 838 C 82 835, 65 840, 52 848',
  'M 672 852 C 692 848, 710 852, 725 860',
  'M 700 838 C 718 835, 735 840, 748 848',
  // Visible surface bumps near base
  'M 248 852 C 232 856, 210 858, 192 854',
  'M 552 852 C 568 856, 590 858, 608 854',
];

// ── BRANCHES — 65+ for ancient massive canopy ──

const BRANCHES = [
  // ─ Main trunk: Left primary ─
  'M 400 400 C 360 378, 302 355, 238 335',
  'M 400 350 C 350 318, 282 285, 212 255',
  'M 400 300 C 356 268, 290 235, 228 200',
  'M 400 260 C 366 228, 318 198, 275 162',
  'M 400 220 C 370 188, 335 158, 305 122',
  'M 400 180 C 376 148, 350 122, 330 90',
  // ─ Main trunk: Right primary ─
  'M 400 400 C 440 378, 498 355, 562 335',
  'M 400 350 C 450 318, 518 285, 588 255',
  'M 400 300 C 444 268, 510 235, 572 200',
  'M 400 260 C 434 228, 482 198, 525 162',
  'M 400 220 C 430 188, 465 158, 495 122',
  'M 400 180 C 424 148, 450 122, 470 90',
  // ─ Left split trunk branches ─
  'M 298 340 C 272 325, 242 318, 210 308',
  'M 272 305 C 248 290, 218 282, 188 275',
  'M 244 235 C 220 218, 192 210, 162 200',
  'M 236 138 C 216 122, 192 112, 168 105',
  'M 210 308 C 192 296, 172 290, 152 285',
  'M 188 275 C 168 265, 148 258, 128 254',
  'M 162 200 C 142 190, 122 186, 105 182',
  'M 168 105 C 148 95, 128 90, 112 85',
  // ─ Right split trunk branches ─
  'M 504 300 C 528 288, 555 278, 582 268',
  'M 532 265 C 555 252, 582 242, 608 235',
  'M 558 200 C 582 188, 605 178, 630 170',
  'M 564 110 C 584 98, 605 90, 625 82',
  'M 582 268 C 602 258, 624 252, 644 248',
  'M 608 235 C 628 225, 650 220, 668 215',
  'M 630 170 C 650 160, 672 154, 692 150',
  'M 625 82 C 645 75, 662 72, 680 70',
  // ─ Left secondary from main branches ─
  'M 238 335 C 218 320, 192 310, 165 300',
  'M 212 255 C 190 238, 160 228, 130 218',
  'M 228 200 C 205 182, 175 172, 148 162',
  'M 275 162 C 255 142, 230 132, 205 122',
  'M 305 122 C 285 105, 260 95, 235 85',
  'M 165 300 C 148 290, 132 286, 115 282',
  'M 130 218 C 112 208, 95 204, 80 200',
  // ─ Right secondary from main branches ─
  'M 562 335 C 582 320, 608 310, 635 300',
  'M 588 255 C 610 238, 640 228, 670 218',
  'M 572 200 C 595 182, 625 172, 652 162',
  'M 525 162 C 545 142, 570 132, 595 122',
  'M 495 122 C 515 105, 540 95, 565 85',
  'M 635 300 C 652 290, 668 286, 685 282',
  'M 670 218 C 688 208, 705 204, 720 200',
  // ─ Top central (from main trunk top) ─
  'M 400 180 C 395 145, 376 110, 358 75',
  'M 400 180 C 405 145, 424 110, 442 75',
  'M 400 150 C 400 118, 400 88, 400 58',
  'M 400 130 C 386 98, 368 75, 352 48',
  'M 400 130 C 414 98, 432 75, 448 48',
  // ─ Ancient drooping branches (hanging) ─
  'M 238 335 C 235 348, 232 365, 236 380',
  'M 212 255 C 210 268, 207 282, 210 296',
  'M 562 335 C 565 348, 568 365, 564 380',
  'M 588 255 C 590 268, 593 282, 590 296',
  'M 165 300 C 160 312, 157 328, 160 342',
  'M 635 300 C 640 312, 643 328, 640 342',
  'M 152 285 C 148 298, 146 314, 148 328',
  'M 685 282 C 690 295, 692 310, 690 324',
  // ─ Extra tertiary twigs ─
  'M 115 282 C 100 275, 88 268, 78 262',
  'M 80 200 C 68 195, 58 192, 48 190',
  'M 685 282 C 700 275, 712 268, 722 262',
  'M 720 200 C 732 195, 742 192, 752 190',
  'M 112 85 C 98 80, 85 78, 75 75',
  'M 680 70 C 695 65, 708 62, 720 60',
];

// ── BARK KNOTS — characteristic ancient tree feature ──

const KNOTS = [
  { x: 392, y: 680, rx: 10, ry: 14 },
  { x: 410, y: 540, rx: 12, ry: 16 },
  { x: 384, y: 420, rx: 8, ry: 11 },
  { x: 418, y: 330, rx: 7, ry: 10 },
  { x: 315, y: 325, rx: 7, ry: 9 },
  { x: 530, y: 265, rx: 8, ry: 10 },
  { x: 260, y: 245, rx: 6, ry: 8 },
];

// ── BARK TEXTURE LINES ──

const BARK_LINES = [
  'M 390 780 C 388 740, 375 700, 380 660 C 385 620, 400 580, 395 540',
  'M 410 780 C 408 740, 398 700, 402 660 C 406 620, 420 580, 415 540',
  'M 385 540 C 380 500, 372 460, 378 420',
  'M 418 540 C 420 500, 430 460, 425 420',
  'M 375 420 C 370 390, 362 360, 368 330',
  'M 428 380 C 435 350, 445 320, 440 290',
];

// ── CANOPY LEAVES (massive ancient canopy — 140+) ──

const LEAVES: LeafNode[] = (() => {
  const leaves: LeafNode[] = [];
  const centers = [
    // Far left (left split branches)
    { cx: 78, cy: 195, rx: 28, ry: 22, count: 3 },
    { cx: 105, cy: 182, rx: 32, ry: 25, count: 4 },
    { cx: 112, cy: 85, rx: 28, ry: 20, count: 3 },
    { cx: 128, cy: 254, rx: 26, ry: 20, count: 3 },
    { cx: 148, cy: 160, rx: 30, ry: 25, count: 4 },
    { cx: 148, cy: 330, rx: 22, ry: 18, count: 3 },
    { cx: 162, cy: 105, rx: 28, ry: 20, count: 3 },
    { cx: 168, cy: 285, rx: 24, ry: 18, count: 3 },
    // Left (main branches)
    { cx: 130, cy: 218, rx: 28, ry: 22, count: 4 },
    { cx: 190, cy: 128, rx: 32, ry: 25, count: 5 },
    { cx: 205, cy: 260, rx: 28, ry: 22, count: 4 },
    { cx: 228, cy: 88, rx: 32, ry: 22, count: 5 },
    { cx: 232, cy: 195, rx: 28, ry: 22, count: 4 },
    { cx: 235, cy: 340, rx: 22, ry: 16, count: 2 },
    { cx: 252, cy: 155, rx: 28, ry: 22, count: 4 },
    { cx: 275, cy: 80, rx: 30, ry: 20, count: 4 },
    // Center-left
    { cx: 308, cy: 88, rx: 32, ry: 22, count: 5 },
    { cx: 328, cy: 128, rx: 24, ry: 18, count: 4 },
    { cx: 348, cy: 58, rx: 28, ry: 18, count: 4 },
    { cx: 358, cy: 168, rx: 22, ry: 16, count: 3 },
    // Center top (crown)
    { cx: 378, cy: 45, rx: 24, ry: 16, count: 4 },
    { cx: 400, cy: 32, rx: 28, ry: 18, count: 5 },
    { cx: 422, cy: 45, rx: 24, ry: 16, count: 4 },
    { cx: 400, cy: 85, rx: 28, ry: 18, count: 4 },
    // Center-right
    { cx: 452, cy: 58, rx: 28, ry: 18, count: 4 },
    { cx: 472, cy: 128, rx: 24, ry: 18, count: 4 },
    { cx: 492, cy: 88, rx: 32, ry: 22, count: 5 },
    { cx: 442, cy: 168, rx: 22, ry: 16, count: 3 },
    // Right (main branches)
    { cx: 525, cy: 80, rx: 30, ry: 20, count: 4 },
    { cx: 548, cy: 155, rx: 28, ry: 22, count: 4 },
    { cx: 565, cy: 340, rx: 22, ry: 16, count: 2 },
    { cx: 568, cy: 195, rx: 28, ry: 22, count: 4 },
    { cx: 572, cy: 88, rx: 32, ry: 22, count: 5 },
    { cx: 595, cy: 260, rx: 28, ry: 22, count: 4 },
    { cx: 610, cy: 128, rx: 32, ry: 25, count: 5 },
    { cx: 670, cy: 218, rx: 28, ry: 22, count: 4 },
    // Far right (right split branches)
    { cx: 638, cy: 108, rx: 28, ry: 20, count: 3 },
    { cx: 655, cy: 165, rx: 30, ry: 25, count: 4 },
    { cx: 668, cy: 280, rx: 24, ry: 18, count: 3 },
    { cx: 645, cy: 300, rx: 22, ry: 18, count: 3 },
    { cx: 692, cy: 150, rx: 28, ry: 20, count: 4 },
    { cx: 680, cy: 70, rx: 24, ry: 16, count: 3 },
    { cx: 720, cy: 60, rx: 20, ry: 14, count: 2 },
    // Drooping leaf clusters
    { cx: 236, cy: 378, rx: 18, ry: 14, count: 2 },
    { cx: 564, cy: 378, rx: 18, ry: 14, count: 2 },
    { cx: 160, cy: 340, rx: 18, ry: 14, count: 2 },
    { cx: 640, cy: 340, rx: 18, ry: 14, count: 2 },
  ];

  let idx = 0;
  for (const c of centers) {
    for (let i = 0; i < c.count; i++) {
      const angle = (i / c.count) * Math.PI * 2 + idx * 0.7;
      const r = 0.35 + Math.random() * 0.65;
      const x = c.cx + Math.cos(angle) * c.rx * r;
      const y = c.cy + Math.sin(angle) * c.ry * r;
      const isTop = y < 60;
      const isAmber = Math.random() < 0.25;
      const isEmerald = Math.random() < 0.15;
      const isGold = Math.random() < 0.1;
      leaves.push({
        x, y,
        size: 8 + Math.random() * 10 + (isTop ? 4 : 0),
        phase: Math.random() * Math.PI * 2,
        hue: isEmerald ? 135 : isGold ? 48 : isAmber ? 28 : (38 + Math.random() * 22),
        sat: isEmerald ? 55 : (65 + Math.random() * 25),
        light: isEmerald ? 28 : isGold ? 55 : (38 + Math.random() * 18),
        angle: Math.random() * 360,
      });
      idx++;
    }
  }
  return leaves;
})();

// Energy flow path — roots to crown
const ENERGY_PATH = [
  { x: 400, y: 855 }, { x: 400, y: 790 }, { x: 394, y: 720 },
  { x: 388, y: 640 }, { x: 400, y: 560 }, { x: 392, y: 480 },
  { x: 400, y: 400 }, { x: 400, y: 320 }, { x: 400, y: 240 },
  { x: 400, y: 165 }, { x: 400, y: 100 }, { x: 400, y: 38 },
];

// ── STARS (upper half — night sky) ──

const STARS = (() => {
  const stars: { x: number; y: number; r: number; b: number }[] = [];
  for (let i = 0; i < 180; i++) {
    stars.push({
      x: Math.random() * 800,
      y: Math.random() * 600,
      r: 0.3 + Math.random() * 1.2,
      b: 0.3 + Math.random() * 0.7,
    });
  }
  return stars;
})();

// ── MOUNT KAILASH — silhouette path ──

const KAILASH_MAIN = `
  M 280 580
  L 360 470
  L 430 380
  L 500 300
  L 555 230
  L 590 175
  L 620 130
  L 640 100
  L 660 130
  L 690 175
  L 720 230
  L 755 300
  L 800 400
  L 800 580
  Z
`;

const KAILASH_SNOW = `
  M 590 175
  L 620 130
  L 640 100
  L 660 130
  L 690 175
  L 672 185
  L 650 155
  L 640 142
  L 630 155
  L 608 185
  Z
`;

// Secondary ridge (left)
const KAILASH_RIDGE = `
  M 0 580
  L 60 540
  L 120 490
  L 175 450
  L 220 420
  L 265 400
  L 300 420
  L 350 480
  L 380 530
  L 380 580
  Z
`;

// ── FIRE DATA ──

const FIRE_CENTER = { x: 400, y: 920 };
const FIRE_STONES = (() => {
  const stones: { x: number; y: number; rx: number; ry: number; rot: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = 22;
    stones.push({
      x: FIRE_CENTER.x + Math.cos(a) * r,
      y: FIRE_CENTER.y + Math.sin(a) * (r * 0.45),
      rx: 4 + Math.random() * 2,
      ry: 3 + Math.random() * 1.5,
      rot: Math.random() * 30 - 15,
    });
  }
  return stones;
})();

// ── MASTERS — 8 seated meditation figures ──

const MASTERS = (() => {
  const masters: { x: number; y: number; facing: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rx = 95, ry = 42;
    masters.push({
      x: FIRE_CENTER.x + Math.cos(a) * rx,
      y: FIRE_CENTER.y + Math.sin(a) * ry,
      facing: a,
    });
  }
  return masters;
})();

// ═══════════════════════════════════════════════════════════════════════════
// ── Component ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export default function InteractiveTreeOfLife() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 400, y: 500, active: false });
  const timeRef = useRef(0);
  const frameRef = useRef<number>(0);
  const [showGenesis, setShowGenesis] = useState(false);
  const [hoveredLeaf, setHoveredLeaf] = useState<number | null>(null);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const [perfScale, setPerfScale] = useState(1);

  // Parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 40, damping: 25 });
  const springY = useSpring(mouseY, { stiffness: 40, damping: 25 });
  const rotateY = useTransform(springX, [-1, 1], [-3, 3]);
  const rotateX = useTransform(springY, [-1, 1], [2, -2]);

  usePolling(async () => {
    try {
      const res = await fetch('/api/blockchain/stats');
      const data = await res.json();
      setBlockHeight(data.block_height || data.total_blocks || null);
    } catch { /* silent */ }
  }, 15000);

  // Adaptive performance budget (mobile / reduced-motion)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mobileMq = window.matchMedia('(max-width: 768px)');
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    const applyBudget = () => {
      if (reduceMq.matches) {
        setPerfScale(0.45);
      } else if (mobileMq.matches) {
        setPerfScale(0.72);
      } else {
        setPerfScale(1);
      }
    };

    applyBudget();
    mobileMq.addEventListener('change', applyBudget);
    reduceMq.addEventListener('change', applyBudget);
    return () => {
      mobileMq.removeEventListener('change', applyBudget);
      reduceMq.removeEventListener('change', applyBudget);
    };
  }, []);

  // ── Particle spawner ──────────────────────────────────────────────

  const spawnParticle = useCallback((type: Particle['type'] = 'stardust'): Particle => {
    if (type === 'spark') {
      // Fire sparks — rise from the campfire
      const spread = (Math.random() - 0.5) * 30;
      return {
        x: FIRE_CENTER.x + spread, y: FIRE_CENTER.y - 5,
        vx: (Math.random() - 0.5) * 1.2, vy: -1.2 - Math.random() * 1.8,
        life: 0, maxLife: 80 + Math.random() * 120,
        size: 0.8 + Math.random() * 1.5, hue: 15 + Math.random() * 30,
        pathProgress: 0, type: 'spark',
        wobblePhase: Math.random() * Math.PI * 2,
        brightness: 0.6 + Math.random() * 0.4,
      };
    }
    if (type === 'star') {
      return {
        x: Math.random() * 800, y: Math.random() * 600,
        vx: 0, vy: 0,
        life: 0, maxLife: 400 + Math.random() * 600,
        size: 0.4 + Math.random() * 1.2, hue: 40 + Math.random() * 30,
        pathProgress: 0, type: 'star',
        wobblePhase: Math.random() * Math.PI * 2,
        brightness: 0.2 + Math.random() * 0.8,
      };
    }
    if (type === 'tendril') {
      const angle = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 100;
      return {
        x: 400 + Math.cos(angle) * r, y: 55 + Math.random() * 80,
        vx: Math.cos(angle) * 0.25, vy: -0.4 - Math.random() * 0.7,
        life: 0, maxLife: 200 + Math.random() * 200,
        size: 1 + Math.random() * 2, hue: 38 + Math.random() * 18,
        pathProgress: 0, type: 'tendril',
        wobblePhase: Math.random() * Math.PI * 2,
        rotation: angle,
      };
    }
    if (type === 'seed') {
      return {
        x: 150 + Math.random() * 500, y: 25 + Math.random() * 80,
        vx: (Math.random() - 0.5) * 0.3, vy: 0.15 + Math.random() * 0.25,
        life: 0, maxLife: 600 + Math.random() * 400,
        size: 2 + Math.random() * 2.5, hue: 35 + Math.random() * 22,
        pathProgress: 0, type: 'seed',
        rotation: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * 1.5,
        wobblePhase: Math.random() * Math.PI * 2,
      };
    }
    // Stardust — golden particles rising through the tree
    const startIdx = Math.floor(Math.random() * 4);
    const start = ENERGY_PATH[startIdx];
    return {
      x: start.x + (Math.random() - 0.5) * 50, y: start.y,
      vx: (Math.random() - 0.5) * 0.35, vy: -0.5 - Math.random() * 0.5,
      life: 0, maxLife: 250 + Math.random() * 200,
      size: 1.2 + Math.random() * 2.2, hue: 36 + Math.random() * 24,
      pathProgress: 0, type: 'stardust',
    };
  }, []);

  // ── Canvas rendering ──────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0;
    const resize = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * window.devicePixelRatio;
      canvas.height = h * window.devicePixelRatio;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    };
    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      if (!w || !h) { frameRef.current = requestAnimationFrame(animate); return; }
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const t = (timeRef.current += 0.016);
      const sX = w / 800, sY = h / 1050;
      const particles = particlesRef.current;

      // ── Spawn (single-pass counting + adaptive budget) ──
      let sdCount = 0;
      let spkCount = 0;
      let tCount = 0;
      let stCount = 0;
      let seCount = 0;
      for (let i = 0; i < particles.length; i++) {
        const type = particles[i].type;
        if (type === 'stardust') sdCount++;
        else if (type === 'spark') spkCount++;
        else if (type === 'tendril') tCount++;
        else if (type === 'star') stCount++;
        else if (type === 'seed') seCount++;
      }

      const maxStardust = Math.floor(70 * perfScale);
      const maxSparks = Math.floor(30 * perfScale);
      const maxTendrils = Math.floor(20 * perfScale);
      const maxStars = Math.floor(30 * perfScale);
      const maxSeeds = Math.max(2, Math.floor(5 * perfScale));

      if (sdCount < maxStardust) particles.push(spawnParticle('stardust'));
      if (spkCount < maxSparks && Math.random() < 0.08 * perfScale) particles.push(spawnParticle('spark'));
      if (tCount < maxTendrils && Math.random() < 0.03 * perfScale) particles.push(spawnParticle('tendril'));
      if (stCount < maxStars && Math.random() < 0.015 * perfScale) particles.push(spawnParticle('star'));
      if (seCount < maxSeeds && Math.random() < 0.004 * perfScale) particles.push(spawnParticle('seed'));

      // ── Fire glow on ground (canvas) ──
      const fxC = FIRE_CENTER.x * sX, fyC = FIRE_CENTER.y * sY;
      const fR = 140 * sX;
      const fireGlow = ctx.createRadialGradient(fxC, fyC, 0, fxC, fyC, fR);
      const flicker = 0.06 + Math.sin(t * 4) * 0.015 + Math.sin(t * 7.3) * 0.01;
      fireGlow.addColorStop(0, 'rgba(255,140,30,' + flicker + ')');
      fireGlow.addColorStop(0.3, 'rgba(255,100,10,' + (flicker * 0.5) + ')');
      fireGlow.addColorStop(0.6, 'rgba(200,60,0,' + (flicker * 0.2) + ')');
      fireGlow.addColorStop(1, 'rgba(200,60,0,0)');
      ctx.fillStyle = fireGlow;
      ctx.beginPath(); ctx.arc(fxC, fyC, fR, 0, Math.PI * 2); ctx.fill();

      // ── Fire light on tree trunk base ──
      const trunkGlow = ctx.createRadialGradient(400 * sX, 780 * sY, 0, 400 * sX, 780 * sY, 100 * sX);
      trunkGlow.addColorStop(0, 'rgba(255,120,20,' + (flicker * 0.4) + ')');
      trunkGlow.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = trunkGlow;
      ctx.beginPath(); ctx.arc(400 * sX, 780 * sY, 100 * sX, 0, Math.PI * 2); ctx.fill();

      // ── Update & draw particles ──
      particlesRef.current = particles.filter(p => {
        p.life++;
        if (p.life > p.maxLife) return false;
        const alpha = Math.min(1, p.life / 20) * Math.max(0, 1 - p.life / p.maxLife);

        if (p.type === 'stardust') {
          p.pathProgress += 0.003 + Math.random() * 0.002;
          const idx = Math.min(Math.floor(p.pathProgress * ENERGY_PATH.length), ENERGY_PATH.length - 1);
          const target = ENERGY_PATH[idx];
          const wind = Math.sin(t * 1.5 + p.y * 0.01) * 0.25;
          p.x += (target.x - p.x) * 0.015 + wind + p.vx;
          p.y += (target.y - p.y) * 0.015 + p.vy * 0.35;
          if (mouseRef.current.active) {
            const dx = mouseRef.current.x - p.x, dy = mouseRef.current.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 160 && dist > 1) { p.x += (dx / dist) * 0.5; p.y += (dy / dist) * 0.5; }
          }
          if (p.pathProgress > 0.65) { p.vx += (Math.random() - 0.5) * 0.5; p.vy -= 0.08; }
          const sx = p.x * sX, sy = p.y * sY, r = p.size * sX * 2.5;
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
          g.addColorStop(0, 'hsla(' + p.hue + ', 100%, 85%, ' + alpha + ')');
          g.addColorStop(0.3, 'hsla(' + p.hue + ', 95%, 70%, ' + (alpha * 0.4) + ')');
          g.addColorStop(1, 'hsla(' + p.hue + ', 80%, 50%, 0)');
          ctx.beginPath(); ctx.fillStyle = g; ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        }

        else if (p.type === 'spark') {
          // Fire sparks — orange/red, rise then fade
          if (p.wobblePhase !== undefined) p.wobblePhase += 0.05;
          p.x += Math.sin(p.wobblePhase || 0) * 0.5 + p.vx * 0.98;
          p.y += p.vy;
          p.vy *= 0.995;
          p.vx *= 0.99;
          const sx = p.x * sX, sy = p.y * sY;
          const r = p.size * sX * 2;
          const a = alpha * (p.brightness || 0.7);
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
          g.addColorStop(0, 'hsla(' + p.hue + ', 100%, 75%, ' + a + ')');
          g.addColorStop(0.4, 'hsla(' + p.hue + ', 90%, 55%, ' + (a * 0.4) + ')');
          g.addColorStop(1, 'hsla(' + p.hue + ', 80%, 40%, 0)');
          ctx.beginPath(); ctx.fillStyle = g; ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        }

        else if (p.type === 'tendril') {
          if (p.wobblePhase !== undefined) p.wobblePhase += 0.025;
          p.x += Math.sin(p.wobblePhase || 0) * 0.7;
          p.y += p.vy; p.vy -= 0.002;
          const sx = p.x * sX, sy = p.y * sY, r = p.size * sX * 2;
          const a = alpha * 0.7;
          const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
          g.addColorStop(0, 'hsla(' + p.hue + ', 100%, 88%, ' + a + ')');
          g.addColorStop(0.4, 'hsla(' + p.hue + ', 90%, 70%, ' + (a * 0.35) + ')');
          g.addColorStop(1, 'hsla(' + p.hue + ', 80%, 50%, 0)');
          ctx.beginPath(); ctx.fillStyle = g; ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        }

        else if (p.type === 'star') {
          if (p.wobblePhase !== undefined) p.wobblePhase += 0.008;
          const twinkle = (Math.sin(t * 2 + (p.wobblePhase || 0) * 8) * 0.5 + 0.5) * (p.brightness || 0.5);
          const a = alpha * twinkle;
          const sx = p.x * sX, sy = p.y * sY, r = p.size * sX * 1.2;
          ctx.beginPath();
          ctx.fillStyle = 'hsla(' + p.hue + ', 25%, 90%, ' + a + ')';
          ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
          if (p.size > 0.9 && twinkle > 0.5) {
            ctx.strokeStyle = 'hsla(' + p.hue + ', 30%, 85%, ' + (a * 0.25) + ')';
            ctx.lineWidth = 0.4; const fl = r * 2.5;
            ctx.beginPath(); ctx.moveTo(sx - fl, sy); ctx.lineTo(sx + fl, sy); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sx, sy - fl); ctx.lineTo(sx, sy + fl); ctx.stroke();
          }
        }

        else if (p.type === 'seed') {
          if (p.wobblePhase !== undefined) p.wobblePhase += 0.01;
          if (p.rotation !== undefined && p.rotSpeed !== undefined) p.rotation += p.rotSpeed;
          p.x += Math.sin(p.wobblePhase || 0) * 0.5 + p.vx;
          p.y += p.vy; p.vy += 0.0008;
          const sx = p.x * sX, sy = p.y * sY, sz = p.size * sX;
          ctx.save(); ctx.translate(sx, sy); ctx.rotate(((p.rotation || 0) * Math.PI) / 180);
          ctx.beginPath();
          ctx.moveTo(0, -sz);
          ctx.bezierCurveTo(sz * 0.7, -sz * 0.3, sz * 0.5, sz * 0.5, 0, sz);
          ctx.bezierCurveTo(-sz * 0.5, sz * 0.5, -sz * 0.7, -sz * 0.3, 0, -sz);
          const a = alpha * 0.5;
          ctx.fillStyle = 'hsla(' + p.hue + ', 80%, 58%, ' + a + ')';
          ctx.fill();
          if (perfScale > 0.7) {
            ctx.shadowColor = 'hsla(45, 100%, 70%, ' + (a * 0.4) + ')';
            ctx.shadowBlur = 5;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          ctx.restore();
        }

        return true;
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(frameRef.current); };
  }, [spawnParticle, perfScale]);

  // ── Mouse tracking ────────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    mouseX.set(nx); mouseY.set(ny);
    mouseRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 800,
      y: ((e.clientY - rect.top) / rect.height) * 1050,
      active: true,
    };
  }, [mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current.active = false;
    mouseX.set(0); mouseY.set(0);
  }, [mouseX, mouseY]);

  const heightText = blockHeight ? 'Block #' + blockHeight.toLocaleString() : '';

  return (
    <section className="relative py-10 md:py-16 px-4 overflow-hidden">
      {/* Night sky + earth gradient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ background: 'linear-gradient(to bottom, #08081a 0%, #0c0c28 25%, #12102a 45%, #181422 60%, #120e0a 80%, #0a0806 100%)' }}
      />
      {/* Subtle nebula glow layers */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute rounded-full blur-[140px] animate-pulse"
          style={{ top: '5%', left: '35%', width: '500px', height: '400px', backgroundColor: 'rgba(249,180,50,0.025)', animationDuration: '12s' }} />
        <div className="absolute rounded-full blur-[120px] animate-pulse"
          style={{ top: '15%', right: '15%', width: '400px', height: '350px', backgroundColor: 'rgba(180,150,80,0.02)', animationDuration: '15s' }} />
        <div className="absolute rounded-full blur-[80px] animate-pulse"
          style={{ bottom: '20%', left: '35%', width: '300px', height: '200px', backgroundColor: 'rgba(255,120,30,0.03)', animationDuration: '6s' }} />
      </div>

      <div className="zion-container">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-7 md:mb-10"
        >
          <p className="text-[10px] uppercase tracking-[0.6em] mb-3 font-light"
            style={{ color: 'rgba(249,217,118,0.4)' }}>
            The Eternal Network · वृक्ष जीवन
          </p>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
            Tree of{' '}
            <span className="bg-linear-to-r from-yellow-300 via-amber-400 to-yellow-200 bg-clip-text text-transparent">
              Life
            </span>
          </h2>
          <p className="text-gray-400/90 max-w-2xl mx-auto leading-relaxed text-sm md:text-base">
            An ancient tree, rooted in millennia of wisdom. Masters gather around
            the sacred fire beneath its canopy, meditating on truth as Mount Kailash
            watches in eternal silence.
          </p>
        </motion.div>

        {/* Tree container with parallax */}
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 2, ease: 'easeOut' }}
          style={{ rotateY, rotateX, perspective: 1200, '--rc': '16, 185, 129' } as React.CSSProperties}
          className="relative mx-auto max-w-4xl cursor-crosshair zion-rainbow-card p-2 md:p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)]"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Canvas overlay — fire glow, sparks, stardust */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10 pointer-events-none" />

          {/* SVG Scene */}
          <svg viewBox="0 0 800 1050" className="w-full h-full relative z-0" xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* Trunk gradients */}
              <linearGradient id="atol-trunk" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#3E2723" />
                <stop offset="25%" stopColor="#4E342E" />
                <stop offset="55%" stopColor="#5D4037" />
                <stop offset="100%" stopColor="#6D4C41" />
              </linearGradient>
              <linearGradient id="atol-trunk-glow" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#F9D976" stopOpacity="0">
                  <animate attributeName="stopOpacity" values="0;0.35;0" dur="5s" repeatCount="indefinite" />
                </stop>
                <stop offset="50%" stopColor="#F9D976" stopOpacity="0.3">
                  <animate attributeName="stopOpacity" values="0.1;0.6;0.1" dur="5s" repeatCount="indefinite" />
                  <animate attributeName="offset" values="0.2;0.7;0.2" dur="7s" repeatCount="indefinite" />
                </stop>
                <stop offset="100%" stopColor="#FFE082" stopOpacity="0">
                  <animate attributeName="stopOpacity" values="0;0.3;0" dur="5s" repeatCount="indefinite" />
                </stop>
              </linearGradient>
              <linearGradient id="atol-root" x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stopColor="#4E342E" />
                <stop offset="100%" stopColor="#3E2723" stopOpacity="0.15" />
              </linearGradient>
              <linearGradient id="atol-root-glow" x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stopColor="#F9D976" stopOpacity="0.35">
                  <animate attributeName="stopOpacity" values="0.08;0.4;0.08" dur="6s" repeatCount="indefinite" />
                </stop>
                <stop offset="100%" stopColor="#F9D976" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="atol-branch" x1="0.5" y1="1" x2="0.5" y2="0">
                <stop offset="0%" stopColor="#4E342E" />
                <stop offset="100%" stopColor="#6D4C41" stopOpacity="0.35" />
              </linearGradient>
              <radialGradient id="atol-crown" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#F9D976" stopOpacity="0.5" />
                <stop offset="40%" stopColor="#F9D976" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#F9D976" stopOpacity="0" />
              </radialGradient>
              {/* Mountain gradient */}
              <linearGradient id="atol-mountain" x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stopColor="#1a1a35" />
                <stop offset="40%" stopColor="#15152e" />
                <stop offset="100%" stopColor="#0e0e22" />
              </linearGradient>
              <linearGradient id="atol-ridge" x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stopColor="#161630" />
                <stop offset="100%" stopColor="#0d0d20" />
              </linearGradient>
              <linearGradient id="atol-snow" x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stopColor="rgba(220,220,240,0.5)" />
                <stop offset="100%" stopColor="rgba(180,180,210,0.15)" />
              </linearGradient>
              {/* Ground gradient */}
              <linearGradient id="atol-ground" x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stopColor="#1a1510" />
                <stop offset="40%" stopColor="#12100c" />
                <stop offset="100%" stopColor="#0a0906" />
              </linearGradient>
              {/* Fire gradients */}
              <radialGradient id="atol-fire-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(255,140,30,0.12)" />
                <stop offset="50%" stopColor="rgba(255,80,10,0.04)" />
                <stop offset="100%" stopColor="rgba(255,60,0,0)" />
              </radialGradient>
              <linearGradient id="atol-flame1" x1="0.5" y1="1" x2="0.5" y2="0">
                <stop offset="0%" stopColor="#FF6600" />
                <stop offset="40%" stopColor="#FF9900" />
                <stop offset="80%" stopColor="#FFCC33" />
                <stop offset="100%" stopColor="#FFEE88" />
              </linearGradient>
              <linearGradient id="atol-flame2" x1="0.5" y1="1" x2="0.5" y2="0">
                <stop offset="0%" stopColor="#CC3300" />
                <stop offset="50%" stopColor="#FF6600" />
                <stop offset="100%" stopColor="#FFAA22" />
              </linearGradient>
              {/* Filters */}
              <filter id="atol-glow">
                <feGaussianBlur stdDeviation="5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="atol-intense">
                <feGaussianBlur stdDeviation="7" result="b" />
                <feComposite in="b" in2="b" operator="arithmetic" k2="2" k3="1" result="c" />
                <feMerge><feMergeNode in="c" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="atol-leaf-glow">
                <feGaussianBlur stdDeviation="2.5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="atol-soft">
                <feGaussianBlur stdDeviation="2" />
              </filter>
              <filter id="atol-fire-blur">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* ═══════ BACKGROUND LAYERS ═══════ */}

            {/* Stars (upper sky only) */}
            {STARS.map((s, i) => (
              <circle key={'s' + i} cx={s.x} cy={s.y} r={s.r}
                fill={'rgba(255,250,220,' + (s.b * 0.35) + ')'}>
                <animate attributeName="opacity" values={(s.b * 0.15) + ';' + (s.b * 0.55) + ';' + (s.b * 0.15)}
                  dur={(3 + (i % 7)) + 's'} repeatCount="indefinite" />
              </circle>
            ))}

            {/* ── Mount Kailash ── */}
            <path d={KAILASH_RIDGE} fill="url(#atol-ridge)" opacity="0.5" />
            <path d={KAILASH_MAIN} fill="url(#atol-mountain)" opacity="0.6" />
            <path d={KAILASH_SNOW} fill="url(#atol-snow)" opacity="0.7">
              <animate attributeName="opacity" values="0.5;0.8;0.5" dur="8s" repeatCount="indefinite" />
            </path>
            {/* Mountain edge glow */}
            <path d={KAILASH_MAIN} fill="none" stroke="rgba(180,180,220,0.06)" strokeWidth="1.5" />

            {/* ── Ground ── */}
            <path d={'M 0 790 Q 200 782, 400 778 Q 600 782, 800 790 L 800 1050 L 0 1050 Z'}
              fill="url(#atol-ground)" />
            {/* Ground texture lines */}
            <path d="M 0 792 Q 200 785, 400 780 Q 600 785, 800 792" fill="none"
              stroke="rgba(60,45,30,0.15)" strokeWidth="1" />
            <path d="M 0 798 Q 250 792, 500 790 Q 700 792, 800 798" fill="none"
              stroke="rgba(50,38,25,0.1)" strokeWidth="0.8" />

            {/* ═══════ ROOTS ═══════ */}
            <g>
              {ROOTS.map((d, i) => (
                <g key={'root-' + i}>
                  <path d={d} fill="none" stroke="url(#atol-root)"
                    strokeWidth={i < 4 ? 7 - i * 0.4 : i < 8 ? 5.5 - (i - 4) * 0.3 : i < 12 ? 3 : 2.2}
                    strokeLinecap="round" opacity={0.55} />
                  <path d={d} fill="none" stroke="url(#atol-root-glow)"
                    strokeWidth={i < 8 ? 3 : 2} strokeLinecap="round"
                    strokeDasharray="10 16" opacity="0">
                    <animate attributeName="opacity" values="0;0.6;0"
                      dur={(4 + i * 0.4) + 's'} repeatCount="indefinite" begin={(i * 0.3) + 's'} />
                    <animate attributeName="stroke-dashoffset" values="26;0"
                      dur={(3.5 + i * 0.3) + 's'} repeatCount="indefinite" />
                  </path>
                </g>
              ))}
            </g>

            {/* ═══════ ANCIENT TRUNK ═══════ */}
            <g>
              {/* Bark edge shadows */}
              <path d={TRUNK_LEFT_EDGE} fill="none" stroke="#2E1B0E" strokeWidth="4" strokeLinecap="round" opacity="0.35" />
              <path d={TRUNK_RIGHT_EDGE} fill="none" stroke="#2E1B0E" strokeWidth="4" strokeLinecap="round" opacity="0.35" />
              {/* Main trunk — THICK ancient */}
              <path d={TRUNK_MAIN} fill="none" stroke="url(#atol-trunk)" strokeWidth="30"
                strokeLinecap="round" strokeLinejoin="round" />
              {/* Split trunks */}
              <path d={TRUNK_LEFT_SPLIT} fill="none" stroke="url(#atol-trunk)" strokeWidth="16"
                strokeLinecap="round" strokeLinejoin="round" />
              <path d={TRUNK_RIGHT_SPLIT} fill="none" stroke="url(#atol-trunk)" strokeWidth="14"
                strokeLinecap="round" strokeLinejoin="round" />
              {/* Golden energy core */}
              <path d={TRUNK_MAIN} fill="none" stroke="url(#atol-trunk-glow)" strokeWidth="14"
                strokeLinecap="round" filter="url(#atol-intense)" opacity="0.45" />
              <path d={TRUNK_LEFT_SPLIT} fill="none" stroke="url(#atol-trunk-glow)" strokeWidth="8"
                strokeLinecap="round" filter="url(#atol-glow)" opacity="0.3" />
              <path d={TRUNK_RIGHT_SPLIT} fill="none" stroke="url(#atol-trunk-glow)" strokeWidth="7"
                strokeLinecap="round" filter="url(#atol-glow)" opacity="0.3" />
              {/* Bark texture lines */}
              {BARK_LINES.map((d, i) => (
                <path key={'bark-' + i} d={d} fill="none" stroke="rgba(30,18,8,0.25)"
                  strokeWidth="0.8" strokeLinecap="round" />
              ))}
              {/* Knots */}
              {KNOTS.map((k, i) => (
                <g key={'knot-' + i}>
                  <ellipse cx={k.x} cy={k.y} rx={k.rx} ry={k.ry}
                    fill="rgba(30,18,8,0.4)" stroke="rgba(60,40,20,0.3)" strokeWidth="1" />
                  <ellipse cx={k.x} cy={k.y} rx={k.rx * 0.5} ry={k.ry * 0.5}
                    fill="rgba(20,12,5,0.5)" />
                </g>
              ))}
              {/* Hollow in trunk */}
              <ellipse cx="398" cy="620" rx="8" ry="18" fill="rgba(10,6,2,0.6)"
                stroke="rgba(40,25,12,0.3)" strokeWidth="1.5" />
            </g>

            {/* ═══════ BRANCHES ═══════ */}
            <g>
              {BRANCHES.map((d, i) => {
                const isPrimary = i < 12;
                const isSplit = i >= 12 && i < 28;
                const isDroop = i >= 53 && i < 61;
                const sw = isPrimary ? 3 : isSplit ? 2.2 : isDroop ? 1.2 : 1.5;
                return (
                  <g key={'br-' + i}>
                    <path d={d} fill="none" stroke="url(#atol-branch)" strokeWidth={sw}
                      strokeLinecap="round">
                      <animateTransform attributeName="transform" type="rotate"
                        values={(i % 2 ? '-0.2' : '0.2') + ' 400 400;' + (i % 2 ? '0.2' : '-0.2') + ' 400 400;' + (i % 2 ? '-0.2' : '0.2') + ' 400 400'}
                        dur={(7 + i % 6) + 's'} repeatCount="indefinite" />
                    </path>
                    {/* Golden energy vein */}
                    {!isDroop && (
                      <path d={d} fill="none" stroke="#F9D976" strokeWidth="0.5" strokeLinecap="round"
                        opacity="0" strokeDasharray="5 12">
                        <animate attributeName="opacity" values="0;0.35;0" dur={(4.5 + i * 0.15) + 's'} repeatCount="indefinite" />
                        <animate attributeName="stroke-dashoffset" values="17;0" dur={(3.5 + i * 0.12) + 's'} repeatCount="indefinite" />
                      </path>
                    )}
                  </g>
                );
              })}
            </g>

            {/* ═══════ CANOPY GLOW AURA ═══════ */}
            <ellipse cx="400" cy="180" rx="340" ry="200" fill="url(#atol-crown)" opacity="0.2" filter="url(#atol-soft)">
              <animate attributeName="opacity" values="0.12;0.25;0.12" dur="7s" repeatCount="indefinite" />
            </ellipse>

            {/* ═══════ LEAVES ═══════ */}
            <g>
              {LEAVES.map((leaf, i) => {
                const hovered = hoveredLeaf === i;
                const isGolden = leaf.hue < 60;
                return (
                  <g key={'lf-' + i}
                    onMouseEnter={() => setHoveredLeaf(i)}
                    onMouseLeave={() => setHoveredLeaf(null)}
                    className="cursor-pointer"
                  >
                    <ellipse cx={leaf.x} cy={leaf.y}
                      rx={leaf.size * 0.45} ry={leaf.size * 0.95}
                      fill={'hsla(' + leaf.hue + ', ' + leaf.sat + '%, ' + (hovered ? leaf.light + 22 : leaf.light) + '%, ' + (hovered ? 0.92 : 0.65) + ')'}
                      stroke={hovered ? 'rgba(249,217,118,0.45)' : 'rgba(249,217,118,0.06)'}
                      strokeWidth="0.4"
                      filter={hovered ? 'url(#atol-leaf-glow)' : undefined}
                      transform={'rotate(' + leaf.angle + ', ' + leaf.x + ', ' + leaf.y + ')'}
                    >
                      <animateTransform attributeName="transform" type="rotate"
                        values={(leaf.angle - 1.5) + ' ' + leaf.x + ' ' + leaf.y + ';' + (leaf.angle + 1.5) + ' ' + leaf.x + ' ' + leaf.y + ';' + (leaf.angle - 1.5) + ' ' + leaf.x + ' ' + leaf.y}
                        dur={(5 + (leaf.phase % 4)) + 's'} repeatCount="indefinite" />
                    </ellipse>
                    {isGolden && (
                      <ellipse cx={leaf.x} cy={leaf.y}
                        rx={leaf.size * 0.6} ry={leaf.size * 1.2}
                        fill="none" stroke="rgba(249,217,118,0.06)"
                        transform={'rotate(' + leaf.angle + ', ' + leaf.x + ', ' + leaf.y + ')'}
                        filter="url(#atol-soft)">
                        <animate attributeName="opacity" values="0;0.12;0"
                          dur={(3.5 + (i % 5)) + 's'} repeatCount="indefinite" />
                      </ellipse>
                    )}
                  </g>
                );
              })}
            </g>

            {/* ═══════ CROWN STAR ═══════ */}
            <circle cx="400" cy="28" r="7" fill="#F9D976" opacity="0.6" filter="url(#atol-intense)">
              <animate attributeName="opacity" values="0.35;0.9;0.35" dur="3.5s" repeatCount="indefinite" />
              <animate attributeName="r" values="5;10;5" dur="3.5s" repeatCount="indefinite" />
            </circle>

            {/* ═══════ FIRE PIT ═══════ */}
            <g>
              {/* Fire glow on ground (SVG layer) */}
              <ellipse cx={FIRE_CENTER.x} cy={FIRE_CENTER.y} rx="60" ry="25"
                fill="url(#atol-fire-glow)" opacity="0.6" />
              {/* Embers base */}
              <ellipse cx={FIRE_CENTER.x} cy={FIRE_CENTER.y + 2} rx="12" ry="4"
                fill="rgba(255,80,20,0.5)">
                <animate attributeName="opacity" values="0.3;0.6;0.4;0.5" dur="0.8s" repeatCount="indefinite" />
              </ellipse>
              {/* Stones */}
              {FIRE_STONES.map((s, i) => (
                <ellipse key={'stone-' + i} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry}
                  fill="rgba(80,70,60,0.7)" stroke="rgba(50,42,35,0.4)" strokeWidth="0.5"
                  transform={'rotate(' + s.rot + ', ' + s.x + ', ' + s.y + ')'} />
              ))}
              {/* Flames — layered animated shapes */}
              <g filter="url(#atol-fire-blur)">
                {/* Flame 1 — central, tall */}
                <path d={'M ' + FIRE_CENTER.x + ' ' + (FIRE_CENTER.y + 2) + ' Q ' + (FIRE_CENTER.x - 6) + ' ' + (FIRE_CENTER.y - 12) + ' ' + FIRE_CENTER.x + ' ' + (FIRE_CENTER.y - 28) + ' Q ' + (FIRE_CENTER.x + 6) + ' ' + (FIRE_CENTER.y - 12) + ' ' + FIRE_CENTER.x + ' ' + (FIRE_CENTER.y + 2) + ' Z'}
                  fill="url(#atol-flame1)" opacity="0.8">
                  <animateTransform attributeName="transform" type="scale"
                    values="1 1;1.05 1.12;0.95 0.88;1 1" dur="0.35s" repeatCount="indefinite"
                    additive="sum" />
                  <animate attributeName="opacity" values="0.65;0.9;0.55;0.8" dur="0.5s" repeatCount="indefinite" />
                </path>
                {/* Flame 2 — left, shorter */}
                <path d={'M ' + (FIRE_CENTER.x - 5) + ' ' + (FIRE_CENTER.y + 1) + ' Q ' + (FIRE_CENTER.x - 10) + ' ' + (FIRE_CENTER.y - 8) + ' ' + (FIRE_CENTER.x - 4) + ' ' + (FIRE_CENTER.y - 18) + ' Q ' + (FIRE_CENTER.x - 2) + ' ' + (FIRE_CENTER.y - 6) + ' ' + (FIRE_CENTER.x - 5) + ' ' + (FIRE_CENTER.y + 1) + ' Z'}
                  fill="url(#atol-flame2)" opacity="0.65">
                  <animateTransform attributeName="transform" type="scale"
                    values="1 1;0.92 1.15;1.08 0.9;1 1" dur="0.4s" repeatCount="indefinite"
                    additive="sum" />
                  <animate attributeName="opacity" values="0.5;0.75;0.45;0.65" dur="0.55s" repeatCount="indefinite" />
                </path>
                {/* Flame 3 — right, medium */}
                <path d={'M ' + (FIRE_CENTER.x + 5) + ' ' + (FIRE_CENTER.y + 1) + ' Q ' + (FIRE_CENTER.x + 10) + ' ' + (FIRE_CENTER.y - 10) + ' ' + (FIRE_CENTER.x + 3) + ' ' + (FIRE_CENTER.y - 22) + ' Q ' + (FIRE_CENTER.x + 1) + ' ' + (FIRE_CENTER.y - 8) + ' ' + (FIRE_CENTER.x + 5) + ' ' + (FIRE_CENTER.y + 1) + ' Z'}
                  fill="url(#atol-flame1)" opacity="0.7">
                  <animateTransform attributeName="transform" type="scale"
                    values="1 1;1.08 0.92;0.94 1.1;1 1" dur="0.3s" repeatCount="indefinite"
                    additive="sum" />
                  <animate attributeName="opacity" values="0.6;0.85;0.5;0.7" dur="0.45s" repeatCount="indefinite" />
                </path>
                {/* Inner bright core */}
                <ellipse cx={FIRE_CENTER.x} cy={FIRE_CENTER.y - 8} rx="3" ry="6"
                  fill="rgba(255,240,180,0.7)">
                  <animate attributeName="ry" values="5;8;4;6" dur="0.3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0.8;0.4;0.6" dur="0.4s" repeatCount="indefinite" />
                </ellipse>
              </g>
            </g>

            {/* ═══════ MEDITATING MASTERS ═══════ */}
            <g>
              {MASTERS.map((m, i) => {
                const scale = m.y > FIRE_CENTER.y ? 0.85 : 0.75;
                // Warm firelight tint — closer masters are brighter
                const dist = Math.sqrt((m.x - FIRE_CENTER.x) ** 2 + (m.y - FIRE_CENTER.y) ** 2);
                const fireLit = Math.max(0.15, 0.5 - dist * 0.003);
                return (
                  <g key={'master-' + i} transform={'translate(' + m.x + ', ' + m.y + ') scale(' + scale + ')'}>
                    {/* Subtle aura */}
                    <ellipse cx="0" cy="-8" rx="16" ry="22" fill="none"
                      stroke={'rgba(249,217,118,' + (fireLit * 0.12) + ')'} strokeWidth="0.8">
                      <animate attributeName="opacity" values="0.3;0.7;0.3" dur={(5 + i * 0.5) + 's'} repeatCount="indefinite" />
                    </ellipse>
                    {/* Legs (lotus position) */}
                    <ellipse cx="0" cy="5" rx="12" ry="4.5"
                      fill={'rgba(120,85,50,' + (0.45 + fireLit) + ')'} />
                    {/* Torso */}
                    <ellipse cx="0" cy="-8" rx="7.5" ry="12"
                      fill={'rgba(110,78,45,' + (0.45 + fireLit) + ')'} />
                    {/* Head */}
                    <circle cx="0" cy="-23" r="5.5"
                      fill={'rgba(130,95,60,' + (0.5 + fireLit) + ')'} />
                    {/* Hands in lap (mudra) */}
                    <ellipse cx="0" cy="0" rx="4.5" ry="2.5"
                      fill={'rgba(120,85,50,' + (0.35 + fireLit) + ')'} />
                  </g>
                );
              })}
            </g>

            {/* ═══════ LABELS ═══════ */}

            {/* Block height */}
            {blockHeight && (
              <text x="400" y="1005" textAnchor="middle" fill="#F9D976" fontSize="9"
                fontFamily="monospace" opacity="0.25" letterSpacing="2">
                {'⛓ ' + heightText}
                <animate attributeName="opacity" values="0.15;0.35;0.15" dur="5s" repeatCount="indefinite" />
              </text>
            )}

            {/* Trunk click zone */}
            <path d={TRUNK_MAIN} fill="none" stroke="transparent" strokeWidth="60"
              className="cursor-pointer" onClick={() => setShowGenesis(v => !v)} />

            {/* ZION text */}
            <text x="400" y="1035" textAnchor="middle" fontSize="13"
              fontFamily="monospace" letterSpacing="10" opacity="0.2" fill="#F9D976">
              Z I O N
              <animate attributeName="opacity" values="0.12;0.28;0.12" dur="7s" repeatCount="indefinite" />
            </text>
          </svg>

          {/* ═══════ GENESIS OVERLAY ═══════ */}
          {showGenesis && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-lg rounded-3xl"
              style={{ backgroundColor: 'rgba(8,8,18,0.88)' }}
              onClick={() => setShowGenesis(false)}
            >
              <div className="text-center px-8 py-10 max-w-lg">
                <div className="w-14 h-14 mx-auto mb-5 rounded-full flex items-center justify-center"
                  style={{ border: '1px solid rgba(249,217,118,0.3)', boxShadow: '0 0 30px rgba(249,217,118,0.1)' }}>
                  <span className="text-xl">🕉️</span>
                </div>
                <p className="text-[10px] uppercase tracking-[0.5em] mb-5 font-light"
                  style={{ color: 'rgba(249,217,118,0.65)' }}>
                  Genesis Block · Inscribed Forever
                </p>
                <p className="text-white/90 text-sm md:text-base leading-relaxed italic font-light">
                  &ldquo;For Sarah Issobel, Maitreya Buddha, Radha &amp; Sita, Friends, Family,
                  Freedom Humanity and all the children of this world: ZION is yours.
                  Build a better world where you reach for the stars.
                  The Golden Age begins.&rdquo;
                </p>
                <div className="mt-6 pt-4 border-t border-white/5">
                  <p className="text-gray-400 text-xs">&mdash; Yose / Zion Creator</p>
                  <p className="text-gray-600 text-[10px] mt-2">Peace &amp; One Love 4ever ☮️ · Om Namo Hiranyagarbha</p>
                </div>
                <p className="text-gray-700 text-[9px] mt-5">click anywhere to close</p>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Caption */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1 }}
          className="text-center mt-6 space-y-2"
        >
          <p className="text-[11px] tracking-wide" style={{ color: 'rgba(249,217,118,0.22)' }}>
            ✦ Click the trunk for the Genesis message · Hover the golden leaves · Watch the masters meditate
          </p>
          <div className="flex items-center justify-center gap-5 text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block animate-pulse" style={{ backgroundColor: 'rgba(249,217,118,0.4)' }} /> Stardust
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block animate-pulse" style={{ backgroundColor: 'rgba(255,120,30,0.5)' }} /> Sacred Fire
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'rgba(150,130,100,0.3)' }} /> 8 Masters
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'rgba(249,217,118,0.5)' }} /> {LEAVES.length} leaves
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
