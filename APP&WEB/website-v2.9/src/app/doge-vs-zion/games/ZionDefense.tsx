'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Volume2, VolumeX, RefreshCw, Play, Pause, ChevronRight,
  Lock, Check, Coins, Heart, Zap, Star, Trophy, X,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import {
  TOWERS, ENEMIES, LEVELS, DAMAGE_COLORS, DAMAGE_LABELS,
  CELL_SIZE, CANVAS_PADDING,
  getTowerStats, getUpgradeCost, canUpgrade, getSellValue, isOnPath,
  loadSave, saveSave,
  type TowerType, type TowerDef, type EnemyType, type LevelDef, type WaveDef,
  type SaveData, type TowerUpgradePath,
} from '../gameData';

// ─── Sound Manager ────────────────────────────────────────────────────────────

class SoundManager {
  ctx: AudioContext | null = null;
  enabled = true;

  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { /* noop */ }
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  beep(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.05) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  shoot() { this.beep(800 + Math.random() * 100, 0.04, 'square', 0.02); }
  hit() { this.beep(400, 0.03, 'sawtooth', 0.02); }
  kill() { this.beep(600, 0.08, 'sine', 0.04); }
  place() { this.beep(523, 0.1, 'sine', 0.05); setTimeout(() => this.beep(659, 0.1, 'sine', 0.05), 50); }
  upgrade() { this.beep(659, 0.08, 'sine', 0.05); setTimeout(() => this.beep(784, 0.08, 'sine', 0.05), 60); setTimeout(() => this.beep(1047, 0.1, 'sine', 0.05), 120); }
  waveStart() { this.beep(200, 0.2, 'sawtooth', 0.06); setTimeout(() => this.beep(300, 0.2, 'sawtooth', 0.06), 100); }
  nodeHit() { this.beep(150, 0.3, 'sawtooth', 0.08); }
  victory() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.beep(f, 0.15, 'sine', 0.06), i * 80)); }
  defeat() { [400, 300, 200, 150].forEach((f, i) => setTimeout(() => this.beep(f, 0.3, 'sawtooth', 0.06), i * 150)); }
  sell() { this.beep(300, 0.1, 'sine', 0.04); setTimeout(() => this.beep(200, 0.1, 'sine', 0.04), 50); }
}

const sfx = new SoundManager();

// ─── Game Entity Types ────────────────────────────────────────────────────────

interface GameTower {
  id: number;
  type: TowerType;
  gridX: number;
  gridY: number;
  upgradePath: number;
  upgradeTier: number;
  cooldown: number;
  targetId: number | null;
  rotation: number;
  disabled: number; // timestamp when disabled until
}

interface GameEnemy {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number;
  baseSpeed: number;
  pathIndex: number;
  x: number; // pixel position
  y: number;
  slowUntil: number;
  reward: number;
  damage: number;
  size: number;
  color: string;
  resistances?: Record<string, number>;
  abilities?: string[];
  shieldUntil: number;
  healCooldown: number;
}

interface GameProjectile {
  id: number;
  x: number;
  y: number;
  targetId: number;
  damage: number;
  speed: number;
  color: string;
  damageType: string;
  splash: number;
  slow: number;
  slowDuration: number;
  emoji: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface GameState {
  status: 'menu' | 'playing' | 'paused' | 'victory' | 'defeat' | 'wave-break';
  currentLevel: number;
  zion: number;
  nodeHp: number;
  maxNodeHp: number;
  waveIndex: number;
  towers: GameTower[];
  enemies: GameEnemy[];
  projectiles: GameProjectile[];
  particles: Particle[];
  waveSpawnQueue: { type: EnemyType; time: number }[];
  waveStartTime: number;
  nextWaveTime: number;
  enemiesKilled: number;
  enemiesEscaped: number;
  selectedTowerType: TowerType | null;
  selectedTowerId: number | null;
  hoverGrid: { x: number; y: number } | null;
  shake: number;
  incomeAccumulator: number;
}

// ─── Game Logic Functions (module-level to avoid purity lint) ────────────────

interface GameRefs {
  enemyIdRef: React.MutableRefObject<number>;
  projectileIdRef: React.MutableRefObject<number>;
}

function applyDamage(s: GameState, enemy: GameEnemy, damage: number, damageType: string, slow: number, slowDuration: number) {
  const now = Date.now();
  if (enemy.shieldUntil > now && now < enemy.shieldUntil - 1500) {
    damage *= 0.3;
  }
  const resist = enemy.resistances?.[damageType];
  if (resist) damage *= resist;
  enemy.hp -= damage;
  if (slow > 0) {
    enemy.slowUntil = now + slowDuration * 1000;
    enemy.speed = enemy.baseSpeed * (1 - slow);
  }
}

function updateGame(s: GameState, dt: number, refs: GameRefs) {
  const level = LEVELS[s.currentLevel];
  const now = Date.now();

  // Spawn enemies from queue
  while (s.waveSpawnQueue.length > 0 && s.waveSpawnQueue[0].time <= now) {
    const spawn = s.waveSpawnQueue.shift()!;
    const enemyDef = ENEMIES[spawn.type];
    const waveScale = 1 + s.waveIndex * 0.15;
    const hp = Math.ceil(enemyDef.baseHp * waveScale);
    const startPos = level.path[0];
    s.enemies.push({
      id: refs.enemyIdRef.current++,
      type: spawn.type,
      hp, maxHp: hp,
      speed: enemyDef.speed, baseSpeed: enemyDef.speed,
      pathIndex: 0,
      x: (startPos.x + 0.5) * CELL_SIZE + CANVAS_PADDING,
      y: (startPos.y + 0.5) * CELL_SIZE + CANVAS_PADDING,
      slowUntil: 0,
      reward: enemyDef.reward, damage: enemyDef.damage,
      size: enemyDef.size, color: enemyDef.color,
      resistances: enemyDef.resistances as Record<string, number> | undefined,
      abilities: enemyDef.abilities,
      shieldUntil: 0, healCooldown: 0,
    });
  }

  // Update enemies
  for (const enemy of s.enemies) {
    if (enemy.pathIndex >= level.path.length - 1) {
      s.nodeHp -= enemy.damage;
      sfx.nodeHit();
      s.shake = 10;
      enemy.hp = 0;
      s.enemiesEscaped++;
      continue;
    }
    if (enemy.abilities?.includes('heal') && enemy.hp < enemy.maxHp) {
      enemy.healCooldown -= dt;
      if (enemy.healCooldown <= 0) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.maxHp * 0.05);
        enemy.healCooldown = 2;
      }
    }
    if (enemy.abilities?.includes('shield') && now > enemy.shieldUntil) {
      enemy.shieldUntil = now + 3000;
    }
    const target = level.path[enemy.pathIndex + 1];
    const targetX = (target.x + 0.5) * CELL_SIZE + CANVAS_PADDING;
    const targetY = (target.y + 0.5) * CELL_SIZE + CANVAS_PADDING;
    const dx = targetX - enemy.x;
    const dy = targetY - enemy.y;
    const dist = Math.hypot(dx, dy);
    const currentSpeed = now < enemy.slowUntil ? enemy.speed * 0.5 : enemy.baseSpeed;
    const moveDist = currentSpeed * CELL_SIZE * dt;
    if (dist <= moveDist) {
      enemy.x = targetX; enemy.y = targetY;
      enemy.pathIndex++;
    } else {
      enemy.x += (dx / dist) * moveDist;
      enemy.y += (dy / dist) * moveDist;
    }
  }

  // Remove dead enemies
  s.enemies = s.enemies.filter((e) => {
    if (e.hp <= 0) {
      if (e.pathIndex < level.path.length - 1) {
        s.zion += e.reward;
        s.enemiesKilled++;
        sfx.kill();
        for (let i = 0; i < 8; i++) {
          s.particles.push({
            x: e.x, y: e.y,
            vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200,
            life: 0.5, maxLife: 0.5, color: e.color, size: 3 + Math.random() * 3,
          });
        }
        if (e.abilities?.includes('split')) {
          for (let i = 0; i < 3; i++) {
            s.enemies.push({
              id: refs.enemyIdRef.current++, type: 'spam',
              hp: 30, maxHp: 30, speed: 2, baseSpeed: 2,
              pathIndex: e.pathIndex,
              x: e.x + (Math.random() - 0.5) * 20, y: e.y + (Math.random() - 0.5) * 20,
              slowUntil: 0, reward: 5, damage: 1, size: 8, color: '#94a3b8',
              shieldUntil: 0, healCooldown: 0,
            });
          }
        }
      }
      return false;
    }
    return true;
  });

  // Mining rig income
  s.incomeAccumulator += dt;
  if (s.incomeAccumulator >= 1) {
    let income = 0;
    for (const tower of s.towers) {
      const def = TOWERS[tower.type];
      const stats = getTowerStats(def, tower.upgradePath, tower.upgradeTier);
      income += stats.income;
    }
    s.zion += income * Math.floor(s.incomeAccumulator);
    s.incomeAccumulator %= 1;
  }

  // Update towers
  for (const tower of s.towers) {
    const def = TOWERS[tower.type];
    const stats = getTowerStats(def, tower.upgradePath, tower.upgradeTier);
    if (def.type === 'guardian' || def.type === 'mining-rig') continue;
    if (now < tower.disabled) continue;
    tower.cooldown -= dt;
    if (tower.cooldown <= 0) {
      const tx = (tower.gridX + 0.5) * CELL_SIZE + CANVAS_PADDING;
      const ty = (tower.gridY + 0.5) * CELL_SIZE + CANVAS_PADDING;
      const rangePx = stats.range * CELL_SIZE;
      let bestTarget: GameEnemy | null = null;
      let bestDist = Infinity;
      for (const enemy of s.enemies) {
        if (enemy.hp <= 0) continue;
        const d = Math.hypot(enemy.x - tx, enemy.y - ty);
        if (d <= rangePx && d < bestDist) { bestDist = d; bestTarget = enemy; }
      }
      if (bestTarget) {
        tower.targetId = bestTarget.id;
        tower.cooldown = 1 / stats.fireRate;
        tower.rotation = Math.atan2(bestTarget.y - ty, bestTarget.x - tx);
        let damage = stats.damage;
        for (const gt of s.towers) {
          if (gt.type !== 'guardian') continue;
          const gDef = TOWERS[gt.type];
          const gStats = getTowerStats(gDef, gt.upgradePath, gt.upgradeTier);
          const gd = Math.hypot(gt.gridX - tower.gridX, gt.gridY - tower.gridY);
          if (gd <= gStats.auraRange) { damage *= gStats.auraBuff; break; }
        }
        s.projectiles.push({
          id: refs.projectileIdRef.current++,
          x: tx, y: ty, targetId: bestTarget.id,
          damage, speed: def.projectileSpeed * CELL_SIZE,
          color: def.color, damageType: def.damageType,
          splash: stats.splash, slow: stats.slow,
          slowDuration: def.slowDuration ?? 0, emoji: def.emoji,
        });
        sfx.shoot();
      }
    }
  }

  // Update projectiles
  for (const proj of s.projectiles) {
    const target = s.enemies.find((e) => e.id === proj.targetId);
    if (!target || target.hp <= 0) { proj.targetId = -1; continue; }
    const dx = target.x - proj.x;
    const dy = target.y - proj.y;
    const dist = Math.hypot(dx, dy);
    const moveDist = proj.speed * dt;
    if (dist <= moveDist + target.size) {
      applyDamage(s, target, proj.damage, proj.damageType, proj.slow, proj.slowDuration);
      if (proj.splash > 0) {
        const splashPx = proj.splash * CELL_SIZE;
        for (const enemy of s.enemies) {
          if (enemy.id === target.id || enemy.hp <= 0) continue;
          const d = Math.hypot(enemy.x - target.x, enemy.y - target.y);
          if (d <= splashPx) {
            applyDamage(s, enemy, proj.damage * (1 - d / splashPx) * 0.7, proj.damageType, proj.slow, proj.slowDuration);
          }
        }
        for (let i = 0; i < 6; i++) {
          s.particles.push({
            x: target.x, y: target.y,
            vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300,
            life: 0.3, maxLife: 0.3, color: proj.color, size: 4 + Math.random() * 4,
          });
        }
      } else {
        for (let i = 0; i < 3; i++) {
          s.particles.push({
            x: target.x, y: target.y,
            vx: (Math.random() - 0.5) * 150, vy: (Math.random() - 0.5) * 150,
            life: 0.2, maxLife: 0.2, color: proj.color, size: 2 + Math.random() * 2,
          });
        }
      }
      sfx.hit();
      proj.targetId = -1;
    } else {
      proj.x += (dx / dist) * moveDist;
      proj.y += (dy / dist) * moveDist;
    }
  }
  s.projectiles = s.projectiles.filter((p) => p.targetId >= 0);

  // Update particles
  for (const p of s.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.95; p.vy *= 0.95;
    p.life -= dt;
  }
  s.particles = s.particles.filter((p) => p.life > 0);

  // Exploiter disable
  for (const enemy of s.enemies) {
    if (enemy.abilities?.includes('disable') && enemy.pathIndex > 0) {
      for (const tower of s.towers) {
        const tx = (tower.gridX + 0.5) * CELL_SIZE + CANVAS_PADDING;
        const ty = (tower.gridY + 0.5) * CELL_SIZE + CANVAS_PADDING;
        const d = Math.hypot(enemy.x - tx, enemy.y - ty);
        if (d < CELL_SIZE * 1.5 && now > tower.disabled) {
          tower.disabled = now + 2000;
        }
      }
    }
  }

  if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 30);
}

function renderCanvas(s: GameState, canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const level = LEVELS[s.currentLevel];
  const canvasW = level.gridCols * CELL_SIZE + CANVAS_PADDING * 2;
  const canvasH = level.gridRows * CELL_SIZE + CANVAS_PADDING * 2;
  if (canvas.width !== canvasW) canvas.width = canvasW;
  if (canvas.height !== canvasH) canvas.height = canvasH;

  const shakeX = s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
  const shakeY = s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
  grad.addColorStop(0, level.bgGradient[0]);
  grad.addColorStop(1, level.bgGradient[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= level.gridCols; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL_SIZE + CANVAS_PADDING, CANVAS_PADDING);
    ctx.lineTo(x * CELL_SIZE + CANVAS_PADDING, canvasH - CANVAS_PADDING);
    ctx.stroke();
  }
  for (let y = 0; y <= level.gridRows; y++) {
    ctx.beginPath();
    ctx.moveTo(CANVAS_PADDING, y * CELL_SIZE + CANVAS_PADDING);
    ctx.lineTo(canvasW - CANVAS_PADDING, y * CELL_SIZE + CANVAS_PADDING);
    ctx.stroke();
  }

  // Path
  ctx.strokeStyle = level.pathColor;
  ctx.lineWidth = CELL_SIZE * 0.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < level.path.length; i++) {
    const p = level.path[i];
    const px = (p.x + 0.5) * CELL_SIZE + CANVAS_PADDING;
    const py = (p.y + 0.5) * CELL_SIZE + CANVAS_PADDING;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = CELL_SIZE * 0.85;
  ctx.stroke();

  // Start/end
  const startP = level.path[0];
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc((startP.x + 0.5) * CELL_SIZE + CANVAS_PADDING, (startP.y + 0.5) * CELL_SIZE + CANVAS_PADDING, 8, 0, Math.PI * 2);
  ctx.fill();

  const endP = level.path[level.path.length - 1];
  const endX = (endP.x + 0.5) * CELL_SIZE + CANVAS_PADDING;
  const endY = (endP.y + 0.5) * CELL_SIZE + CANVAS_PADDING;
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(endX, endY, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🛡️', endX, endY);

  // Hover highlight
  if (s.selectedTowerType && s.hoverGrid) {
    const def = TOWERS[s.selectedTowerType];
    const canPlace = !isOnPath(level, s.hoverGrid.x, s.hoverGrid.y) &&
      !s.towers.some((t) => t.gridX === s.hoverGrid!.x && t.gridY === s.hoverGrid!.y) &&
      s.zion >= def.cost;
    const hx = s.hoverGrid.x * CELL_SIZE + CANVAS_PADDING;
    const hy = s.hoverGrid.y * CELL_SIZE + CANVAS_PADDING;
    ctx.fillStyle = canPlace ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)';
    ctx.fillRect(hx, hy, CELL_SIZE, CELL_SIZE);
    ctx.strokeStyle = canPlace ? '#10b981' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(hx, hy, CELL_SIZE, CELL_SIZE);
    if (canPlace && def.range > 0) {
      const stats = getTowerStats(def, 0, 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hx + CELL_SIZE / 2, hy + CELL_SIZE / 2, stats.range * CELL_SIZE, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Selected tower range
  if (s.selectedTowerId !== null) {
    const tower = s.towers.find((t) => t.id === s.selectedTowerId);
    if (tower) {
      const def = TOWERS[tower.type];
      const stats = getTowerStats(def, tower.upgradePath, tower.upgradeTier);
      const tx = (tower.gridX + 0.5) * CELL_SIZE + CANVAS_PADDING;
      const ty = (tower.gridY + 0.5) * CELL_SIZE + CANVAS_PADDING;
      if (stats.range > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tx, ty, stats.range * CELL_SIZE, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      if (stats.auraRange > 0) {
        ctx.strokeStyle = 'rgba(168,85,247,0.4)';
        ctx.fillStyle = 'rgba(168,85,247,0.05)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tx, ty, stats.auraRange * CELL_SIZE, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(tower.gridX * CELL_SIZE + CANVAS_PADDING, tower.gridY * CELL_SIZE + CANVAS_PADDING, CELL_SIZE, CELL_SIZE);
    }
  }

  // Towers
  for (const tower of s.towers) {
    const def = TOWERS[tower.type];
    const tx = (tower.gridX + 0.5) * CELL_SIZE + CANVAS_PADDING;
    const ty = (tower.gridY + 0.5) * CELL_SIZE + CANVAS_PADDING;
    const isDisabled = Date.now() < tower.disabled;
    ctx.shadowColor = isDisabled ? '#666' : def.glowColor;
    ctx.shadowBlur = 15;
    ctx.fillStyle = isDisabled ? '#444' : def.color;
    ctx.beginPath();
    ctx.arc(tx, ty, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = isDisabled ? 0.4 : 1;
    ctx.fillText(def.emoji, tx, ty);
    ctx.globalAlpha = 1;
    if (tower.upgradeTier > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = '10px sans-serif';
      ctx.fillText('★'.repeat(tower.upgradeTier), tx, ty + 20);
    }
  }

  // Enemies
  for (const enemy of s.enemies) {
    const def = ENEMIES[enemy.type];
    ctx.shadowColor = enemy.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (Date.now() < enemy.shieldUntil) {
      ctx.strokeStyle = 'rgba(100,200,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.size + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = `${enemy.size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.emoji, enemy.x, enemy.y);
    const barW = enemy.size * 2.5;
    const barH = 4;
    const barX = enemy.x - barW / 2;
    const barY = enemy.y - enemy.size - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = enemy.hp > enemy.maxHp * 0.5 ? '#10b981' : enemy.hp > enemy.maxHp * 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(barX, barY, barW * (enemy.hp / enemy.maxHp), barH);
  }

  // Projectiles
  for (const proj of s.projectiles) {
    ctx.shadowColor = proj.color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = proj.color;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Particles
  for (const p of s.particles) {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ZionDefense() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [saveData, setSaveData] = useState<SaveData>(() => loadSave());
  const [muted, setMuted] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [view, setView] = useState<'menu' | 'game'>('menu');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const enemyIdRef = useRef(0);
  const towerIdRef = useRef(0);
  const projectileIdRef = useRef(0);

  useEffect(() => { sfx.enabled = !muted; }, [muted]);
  useEffect(() => { saveSave(saveData); }, [saveData]);

  // Sync gameState from gameRef for rendering
  const syncState = useCallback(() => {
    if (gameRef.current) setGameState({ ...gameRef.current });
  }, []);

  // ─── Start Level ────────────────────────────────────────────────────────────

  const startLevel = useCallback((levelId: number) => {
    const level = LEVELS[levelId];
    sfx.init();
    const state: GameState = {
      status: 'wave-break',
      currentLevel: levelId,
      zion: level.startZion,
      nodeHp: level.nodeHp,
      maxNodeHp: level.nodeHp,
      waveIndex: 0,
      towers: [],
      enemies: [],
      projectiles: [],
      particles: [],
      waveSpawnQueue: [],
      waveStartTime: 0,
      nextWaveTime: Date.now() + 3000,
      enemiesKilled: 0,
      enemiesEscaped: 0,
      selectedTowerType: null,
      selectedTowerId: null,
      hoverGrid: null,
      shake: 0,
      incomeAccumulator: 0,
    };
    gameRef.current = state;
    setGameState(state);
    setView('game');
    syncState();
  }, [syncState]);

  // ─── Start Next Wave ────────────────────────────────────────────────────────

  const startNextWave = useCallback(() => {
    const s = gameRef.current;
    if (!s || s.status !== 'wave-break') return;
    const level = LEVELS[s.currentLevel];
    const wave = level.waves[s.waveIndex];
    if (!wave) return;

    const queue: { type: EnemyType; time: number }[] = [];
    const now = Date.now();
    for (const group of wave.enemies) {
      for (let i = 0; i < group.count; i++) {
        queue.push({ type: group.type, time: now + i * group.interval });
      }
    }
    queue.sort((a, b) => a.time - b.time);

    s.waveSpawnQueue = queue;
    s.status = 'playing';
    s.waveStartTime = now;
    sfx.waveStart();
    syncState();
  }, [syncState]);

  // ─── Game Loop ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (view !== 'game') return;

    const loop = (time: number) => {
      const s = gameRef.current;
      if (!s) return;

      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;

      if (s.status === 'playing') {
        updateGame(s, dt, { enemyIdRef, projectileIdRef });
      }

      renderCanvas(s, canvasRef);

      // Check victory/defeat
      if (s.status === 'playing') {
        if (s.nodeHp <= 0) {
          s.status = 'defeat';
          sfx.defeat();
          syncState();
        } else if (s.waveSpawnQueue.length === 0 && s.enemies.length === 0) {
          const level = LEVELS[s.currentLevel];
          if (s.waveIndex >= level.waves.length - 1) {
            s.status = 'victory';
            sfx.victory();
            // Update save
            const stars = s.nodeHp === s.maxNodeHp ? 3 : s.nodeHp >= s.maxNodeHp * 0.6 ? 2 : 1;
            setSaveData((prev: SaveData) => {
              const newUnlocked = [...new Set([...prev.unlockedLevels, s.currentLevel + 1])];
              const newStars = { ...prev.levelStars, [s.currentLevel]: Math.max(prev.levelStars[s.currentLevel] ?? 0, stars) };
              return { unlockedLevels: newUnlocked, levelStars: newStars, totalZionEarned: prev.totalZionEarned + s.zion };
            });
            syncState();
          } else {
            // Wave cleared, go to break
            s.waveIndex++;
            const level = LEVELS[s.currentLevel];
            const waveReward = level.waves[s.waveIndex - 1]?.reward ?? 0;
            s.zion += waveReward;
            s.status = 'wave-break';
            s.nextWaveTime = Date.now() + 5000;
            syncState();
          }
        }
      }

      // Auto-start wave after break
      if (s.status === 'wave-break' && Date.now() >= s.nextWaveTime) {
        startNextWave();
      }

      animRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [view, startNextWave, syncState]);

  // Force periodic re-renders for UI
  useEffect(() => {
    if (view !== 'game') return;
    const interval = setInterval(() => syncState(), 200);
    return () => clearInterval(interval);
  }, [view, syncState]);

  // ─── Canvas Mouse Handlers ──────────────────────────────────────────────────

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = gameRef.current;
    if (!s) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX - CANVAS_PADDING;
    const y = (e.clientY - rect.top) * scaleY - CANVAS_PADDING;
    const gridX = Math.floor(x / CELL_SIZE);
    const gridY = Math.floor(y / CELL_SIZE);
    const level = LEVELS[s.currentLevel];

    if (gridX < 0 || gridX >= level.gridCols || gridY < 0 || gridY >= level.gridRows) return;

    // Check if clicking on existing tower
    const existingTower = s.towers.find((t) => t.gridX === gridX && t.gridY === gridY);
    if (existingTower) {
      s.selectedTowerId = existingTower.id;
      s.selectedTowerType = null;
      syncState();
      return;
    }

    // Place tower
    if (s.selectedTowerType) {
      const def = TOWERS[s.selectedTowerType];
      if (isOnPath(level, gridX, gridY)) return;
      if (s.zion < def.cost) return;
      s.zion -= def.cost;
      s.towers.push({
        id: towerIdRef.current++,
        type: s.selectedTowerType,
        gridX, gridY,
        upgradePath: 0,
        upgradeTier: 0,
        cooldown: 0,
        targetId: null,
        rotation: 0,
        disabled: 0,
      });
      sfx.place();
      s.selectedTowerType = null;
      syncState();
      return;
    }

    // Deselect
    s.selectedTowerId = null;
    syncState();
  };

  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = gameRef.current;
    if (!s || !s.selectedTowerType) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX - CANVAS_PADDING;
    const y = (e.clientY - rect.top) * scaleY - CANVAS_PADDING;
    const gridX = Math.floor(x / CELL_SIZE);
    const gridY = Math.floor(y / CELL_SIZE);
    const level = LEVELS[s.currentLevel];
    if (gridX >= 0 && gridX < level.gridCols && gridY >= 0 && gridY < level.gridRows) {
      s.hoverGrid = { x: gridX, y: gridY };
    } else {
      s.hoverGrid = null;
    }
  };

  // ─── Tower Actions ──────────────────────────────────────────────────────────

  const selectTowerType = (type: TowerType) => {
    const s = gameRef.current;
    if (!s) return;
    s.selectedTowerType = s.selectedTowerType === type ? null : type;
    s.selectedTowerId = null;
    syncState();
  };

  const upgradeTower = (path: number) => {
    const s = gameRef.current;
    if (!s || s.selectedTowerId === null) return;
    const tower = s.towers.find((t) => t.id === s.selectedTowerId);
    if (!tower) return;
    const def = TOWERS[tower.type];
    if (!canUpgrade(def, path, tower.upgradeTier)) return;
    if (tower.upgradePath !== path && tower.upgradeTier > 0) return; // can't switch paths
    const cost = getUpgradeCost(def, path, tower.upgradeTier);
    if (s.zion < cost) return;
    s.zion -= cost;
    tower.upgradePath = path;
    tower.upgradeTier++;
    sfx.upgrade();
    syncState();
  };

  const sellTower = () => {
    const s = gameRef.current;
    if (!s || s.selectedTowerId === null) return;
    const tower = s.towers.find((t) => t.id === s.selectedTowerId);
    if (!tower) return;
    const def = TOWERS[tower.type];
    const refund = getSellValue(def, tower.upgradePath, tower.upgradeTier);
    s.zion += refund;
    s.towers = s.towers.filter((t) => t.id !== tower.id);
    s.selectedTowerId = null;
    sfx.sell();
    syncState();
  };

  const togglePause = () => {
    const s = gameRef.current;
    if (!s) return;
    if (s.status === 'playing') s.status = 'paused';
    else if (s.status === 'paused') s.status = 'playing';
    syncState();
  };

  const backToMenu = () => {
    setView('menu');
    gameRef.current = null;
    setGameState(null);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (view === 'menu') {
    return <LevelSelect cs={cs} saveData={saveData} onStart={startLevel} muted={muted} setMuted={setMuted} />;
  }

  const s = gameState;
  if (!s) return null;
  const level = LEVELS[s.currentLevel];
  const selectedTower = s.selectedTowerId !== null ? s.towers.find((t) => t.id === s.selectedTowerId) : null;
  const selectedDef = selectedTower ? TOWERS[selectedTower.type] : null;
  const selectedStats = selectedTower && selectedDef ? getTowerStats(selectedDef, selectedTower.upgradePath, selectedTower.upgradeTier) : null;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black pb-8 pt-20 md:pt-24">
      <div className="relative z-10 zion-container space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={backToMenu} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> {cs ? 'Menu' : 'Menu'}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={togglePause} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              {s.status === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button onClick={() => { sfx.init(); setMuted((m) => !m); }} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Game info bar */}
        <div style={{ '--rc': '245, 158, 11' } as React.CSSProperties} className="zion-rainbow-card p-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-xl">{level.emoji}</span>
            <div>
              <p className="text-sm font-bold text-white">{level.layer} — {level.name}</p>
              <p className="text-[10px] text-gray-500">{cs ? `Vlna ${s.waveIndex + 1}/${level.waves.length}` : `Wave ${s.waveIndex + 1}/${level.waves.length}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Coins className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-bold tabular-nums text-emerald-300">{Math.floor(s.zion)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Heart className="h-4 w-4 text-red-400" />
              <span className="text-sm font-bold tabular-nums text-red-300">{s.nodeHp}/{s.maxNodeHp}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-zion-gold" />
              <span className="text-xs tabular-nums text-gray-400">{s.enemiesKilled} {cs ? 'zabito' : 'killed'}</span>
            </div>
          </div>
        </div>

        {/* Canvas + side panel */}
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Canvas */}
          <div className="flex-1 overflow-auto zion-rainbow-card" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMove}
              className="block w-full cursor-pointer"
              style={{ maxWidth: '100%', touchAction: 'none' }}
            />
          </div>

          {/* Side panel */}
          <div className="w-full lg:w-72 space-y-3">
            {/* Tower shop or upgrade panel */}
            {selectedTower && selectedDef && selectedStats ? (
              <UpgradePanel
                cs={cs}
                tower={selectedTower}
                def={selectedDef}
                stats={selectedStats}
                zion={s.zion}
                onUpgrade={upgradeTower}
                onSell={sellTower}
                onClose={() => { if (gameRef.current) { gameRef.current.selectedTowerId = null; syncState(); } }}
              />
            ) : (
              <TowerShop cs={cs} zion={s.zion} selected={s.selectedTowerType} onSelect={selectTowerType} />
            )}
          </div>
        </div>

        {/* Wave break / victory / defeat overlay */}
        {s.status === 'wave-break' && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="rounded-2xl border border-zion-gold/30 bg-black/90 p-6 text-center max-w-sm">
              <p className="text-sm font-bold text-zion-gold mb-2">{cs ? `Vlna ${s.waveIndex + 1} vyčištěna!` : `Wave ${s.waveIndex + 1} cleared!`}</p>
              <p className="text-xs text-gray-400 mb-4">{cs ? `Bonus: +${level.waves[s.waveIndex]?.reward ?? 0} ZION` : `Bonus: +${level.waves[s.waveIndex]?.reward ?? 0} ZION`}</p>
              <button onClick={startNextWave} className="w-full rounded-xl bg-zion-gold/20 border border-zion-gold/30 px-4 py-2.5 text-sm font-bold text-zion-gold hover:bg-zion-gold/30 transition-colors">
                {cs ? 'Další vlna →' : 'Next wave →'}
              </button>
              <p className="mt-2 text-[10px] text-gray-600">{cs ? 'Auto-start za 5s' : 'Auto-start in 5s'}</p>
            </div>
          </div>
        )}

        {s.status === 'victory' && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-black/90 to-emerald-500/10 p-6 text-center max-w-sm">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-lg font-bold text-emerald-300 mb-2">{cs ? 'Vítězství!' : 'Victory!'}</p>
              <div className="flex justify-center gap-1 mb-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Star key={i} className={`h-6 w-6 ${i < (s.nodeHp === s.maxNodeHp ? 3 : s.nodeHp >= s.maxNodeHp * 0.6 ? 2 : 1) ? 'text-zion-gold fill-zion-gold' : 'text-gray-700'}`} />
                ))}
              </div>
              <p className="text-xs text-gray-400 mb-4">{cs ? `${s.enemiesKilled} zabito, ${s.enemiesEscaped} prošlo` : `${s.enemiesKilled} killed, ${s.enemiesEscaped} escaped`}</p>
              <div className="flex gap-2">
                <button onClick={backToMenu} className="flex-1 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition-colors">
                  {cs ? 'Menu' : 'Menu'}
                </button>
                {s.currentLevel < LEVELS.length - 1 && (
                  <button onClick={() => startLevel(s.currentLevel + 1)} className="flex-1 rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-2.5 text-sm font-bold text-emerald-300 hover:bg-emerald-500/30 transition-colors">
                    {cs ? 'Další →' : 'Next →'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {s.status === 'defeat' && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-black/90 to-red-500/10 p-6 text-center max-w-sm">
              <p className="text-3xl mb-2">💀</p>
              <p className="text-lg font-bold text-red-300 mb-2">{cs ? 'Node kompromitována!' : 'Node compromised!'}</p>
              <p className="text-xs text-gray-400 mb-4">{cs ? `Přežil jsi ${s.waveIndex + 1} vln` : `You survived ${s.waveIndex + 1} waves`}</p>
              <div className="flex gap-2">
                <button onClick={backToMenu} className="flex-1 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition-colors">
                  {cs ? 'Menu' : 'Menu'}
                </button>
                <button onClick={() => startLevel(s.currentLevel)} className="flex-1 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-sm font-bold text-red-300 hover:bg-red-500/30 transition-colors">
                  {cs ? 'Zkusit znovu' : 'Retry'}
                </button>
              </div>
            </div>
          </div>
        )}

        {s.status === 'paused' && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="zion-rainbow-card p-6 text-center" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
              <p className="text-lg font-bold text-white mb-4">{cs ? 'Pauza' : 'Paused'}</p>
              <button onClick={togglePause} className="rounded-xl bg-white/10 border border-white/20 px-6 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition-colors">
                {cs ? 'Pokračovat' : 'Resume'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Level Select Screen ──────────────────────────────────────────────────────

function LevelSelect({ cs, saveData, onStart, muted, setMuted }: {
  cs: boolean;
  saveData: SaveData;
  onStart: (id: number) => void;
  muted: boolean;
  setMuted: (f: (m: boolean) => boolean) => void;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black pb-12 pt-20 md:pt-24">
      {/* Starfield */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white opacity-20" style={{
            width: `${1 + (i % 3)}px`, height: `${1 + (i % 3)}px`,
            top: `${(i * 17.3) % 100}%`, left: `${(i * 29.7) % 100}%`,
          }} />
        ))}
      </div>

      <div className="relative z-10 zion-container space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> {cs ? 'Zpět' : 'Back'}
          </Link>
          <button onClick={() => { sfx.init(); setMuted((m) => !m); }} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-gradient">ZION Defense</h1>
          <p className="mt-2 text-sm text-gray-500">
            {cs ? 'Bránit ZION node přes L1→L6. Postav věže, přežij vlny, zachraň síť.' : 'Defend the ZION node across L1→L6. Build towers, survive waves, save the network.'}
          </p>
          <div className="mt-3 flex justify-center gap-4 text-xs text-gray-600">
            <span>{saveData.unlockedLevels.length}/{LEVELS.length} {cs ? 'odemčeno' : 'unlocked'}</span>
            <span>⭐ {(Object.values(saveData.levelStars) as number[]).reduce((a, b) => a + b, 0)}/{LEVELS.length * 3}</span>
          </div>
        </div>

        {/* Level grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LEVELS.map((level: LevelDef) => {
            const unlocked = saveData.unlockedLevels.includes(level.id);
            const stars = saveData.levelStars[level.id] ?? 0;
            return (
              <button
                key={level.id}
                onClick={() => unlocked && onStart(level.id)}
                disabled={!unlocked}
                className={`text-left zion-rainbow-sub p-5 transition-all ${
                  unlocked
                    ? 'cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                }`}
                style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{unlocked ? level.emoji : '🔒'}</span>
                    <div>
                      <p className="text-sm font-bold text-white">{level.layer} — {level.name}</p>
                      <p className="text-[10px] text-gray-500">{level.waves.length} {cs ? 'vln' : 'waves'}</p>
                    </div>
                  </div>
                  {unlocked && (
                    <div className="flex gap-0.5">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < stars ? 'text-zion-gold fill-zion-gold' : 'text-gray-700'}`} />
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">{level.description}</p>
                <div className="mt-3 flex items-center gap-3 text-[10px] text-gray-600">
                  <span className="flex items-center gap-1"><Coins className="h-3 w-3" /> {level.startZion}</span>
                  <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {level.nodeHp}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tower reference */}
        <div className="zion-rainbow-card p-5" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
          <h3 className="mb-3 text-sm font-bold text-white">{cs ? 'Věže' : 'Towers'}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.values(TOWERS).map((tower: TowerDef) => (
              <div key={tower.type} className="zion-tile p-3 text-center">
                <div className="text-2xl mb-1">{tower.emoji}</div>
                <p className="text-xs font-bold text-white">{tower.name}</p>
                <p className="text-[9px] text-gray-500 mt-1 line-clamp-2">{tower.description}</p>
                <p className="text-[10px] text-emerald-400 mt-1">{tower.cost} ZION</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tower Shop Panel ─────────────────────────────────────────────────────────

function TowerShop({ cs, zion, selected, onSelect }: {
  cs: boolean;
  zion: number;
  selected: TowerType | null;
  onSelect: (t: TowerType) => void;
}) {
  return (
    <div className="zion-rainbow-card p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
      <p className="mb-2 text-xs font-bold text-white/80">{cs ? 'Postavit věž' : 'Build Tower'}</p>
      <div className="space-y-2">
        {Object.values(TOWERS).map((tower: TowerDef) => {
          const canAfford = zion >= tower.cost;
          const isSelected = selected === tower.type;
          return (
            <button
              key={tower.type}
              onClick={() => onSelect(tower.type)}
              disabled={!canAfford}
              className={`w-full flex items-center gap-3 rounded-xl border p-2.5 transition-all text-left ${
                isSelected
                  ? 'border-zion-gold/40 bg-zion-gold/10'
                  : canAfford
                  ? 'border-white/10 bg-white/5 hover:bg-white/10'
                  : 'border-white/5 bg-white/3 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="text-2xl shrink-0">{tower.emoji}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white">{tower.name}</p>
                <p className="text-[9px] text-gray-500 truncate">{tower.description}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-xs font-bold ${canAfford ? 'text-emerald-300' : 'text-red-400'}`}>{tower.cost}</p>
                <p className="text-[8px] text-gray-600">ZION</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Upgrade Panel ────────────────────────────────────────────────────────────

function UpgradePanel({ cs, tower, def, stats, zion, onUpgrade, onSell, onClose }: {
  cs: boolean;
  tower: GameTower;
  def: TowerDef;
  stats: ReturnType<typeof getTowerStats>;
  zion: number;
  onUpgrade: (path: number) => void;
  onSell: () => void;
  onClose: () => void;
}) {
  return (
    <div className="zion-rainbow-card p-3" style={{ '--rc': '245, 158, 11' } as React.CSSProperties}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{def.emoji}</span>
          <div>
            <p className="text-sm font-bold text-white">{def.name}</p>
            <p className="text-[10px] text-gray-500">
              {def.type === 'mining-rig' ? `${stats.income} ZION/s` :
               def.type === 'guardian' ? `+${Math.round((stats.auraBuff - 1) * 100)}% dmg, ${stats.auraRange.toFixed(1)} range` :
               `${stats.damage.toFixed(0)} dmg · ${stats.range.toFixed(1)} rng · ${stats.fireRate.toFixed(1)}/s`}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="h-4 w-4" /></button>
      </div>

      {/* Stats display */}
      {def.type !== 'mining-rig' && def.type !== 'guardian' && (
        <div className="mb-3 grid grid-cols-2 gap-1 text-[10px]">
          <div className="flex justify-between rounded bg-white/5 px-2 py-1">
            <span className="text-gray-500">DMG</span>
            <span className="text-white font-bold">{stats.damage.toFixed(0)}</span>
          </div>
          <div className="flex justify-between rounded bg-white/5 px-2 py-1">
            <span className="text-gray-500">RNG</span>
            <span className="text-white font-bold">{stats.range.toFixed(1)}</span>
          </div>
          <div className="flex justify-between rounded bg-white/5 px-2 py-1">
            <span className="text-gray-500">RATE</span>
            <span className="text-white font-bold">{stats.fireRate.toFixed(1)}/s</span>
          </div>
          <div className="flex justify-between rounded bg-white/5 px-2 py-1">
            <span className="text-gray-500">TYPE</span>
            <span style={{ color: DAMAGE_COLORS[def.damageType] }} className="font-bold">{DAMAGE_LABELS[def.damageType]}</span>
          </div>
          {stats.splash > 0 && (
            <div className="flex justify-between rounded bg-white/5 px-2 py-1">
              <span className="text-gray-500">SPLASH</span>
              <span className="text-white font-bold">{stats.splash.toFixed(1)}</span>
            </div>
          )}
          {stats.slow > 0 && (
            <div className="flex justify-between rounded bg-white/5 px-2 py-1">
              <span className="text-gray-500">SLOW</span>
              <span className="text-white font-bold">{(stats.slow * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Upgrade paths */}
      <div className="space-y-2 mb-3">
        {def.upgrades.map((path: TowerUpgradePath, pathIdx: number) => {
          const isCurrentPath = tower.upgradePath === pathIdx;
          const canBuy = canUpgrade(def, pathIdx, isCurrentPath ? tower.upgradeTier : 0);
          const cost = getUpgradeCost(def, pathIdx, isCurrentPath ? tower.upgradeTier : 0);
          const canAfford = zion >= cost;
          const tier = isCurrentPath ? tower.upgradeTier : 0;
          const nextTier = path.tiers[tier];

          return (
            <div key={pathIdx} className={`rounded-xl border p-2 ${isCurrentPath ? 'border-zion-gold/20 bg-zion-gold/5' : 'border-white/5 bg-white/3'}`}>
              <p className="text-[10px] font-bold text-white/80 mb-1">{path.name}</p>
              {nextTier ? (
                <>
                  <p className="text-[9px] text-gray-500 mb-1.5">{nextTier.description}</p>
                  <button
                    onClick={() => onUpgrade(pathIdx)}
                    disabled={!canBuy || !canAfford || (tower.upgradeTier > 0 && !isCurrentPath)}
                    className={`w-full rounded-lg px-2 py-1.5 text-[10px] font-bold transition-colors ${
                      canBuy && canAfford && (isCurrentPath || tower.upgradeTier === 0)
                        ? 'bg-zion-gold/20 border border-zion-gold/30 text-zion-gold hover:bg-zion-gold/30'
                        : 'bg-white/5 border border-white/10 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {tower.upgradeTier > 0 && !isCurrentPath ? (cs ? 'Jiná cesta' : 'Other path') :
                     !canBuy ? (cs ? 'Max' : 'Max') :
                     `${cost} ZION → T${tier + 1}`}
                  </button>
                </>
              ) : (
                <p className="text-[10px] text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> {cs ? 'Maximální úroveň' : 'Max level'}</p>
              )}
              {/* Tier indicators */}
              <div className="mt-1.5 flex gap-1">
                {path.tiers.map((_: unknown, i: number) => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i < (isCurrentPath ? tower.upgradeTier : 0) ? 'bg-zion-gold' : 'bg-white/10'}`} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sell button */}
      <button
        onClick={onSell}
        className="w-full rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-bold text-red-400 hover:bg-red-500/20 transition-colors"
      >
        {cs ? 'Prodat' : 'Sell'} (+{getSellValue(def, tower.upgradePath, tower.upgradeTier)} ZION)
      </button>
    </div>
  );
}
