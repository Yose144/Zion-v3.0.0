/**
 * Procedurální textura planety — pro tělesa, která v repu nemají obrázek.
 *
 * Pluto je jediný případ: přidávat binární texturu kvůli jedné planetě nemá
 * smysl, a tak se kreslí deterministicky do canvasu. Stejné id = stejné
 * skvrny při každém načtení, takže se scéna mezi obnoveními nemění.
 *
 * Modul je sdílený (vesmír i stránka `/pluto`) — kdyby si každý kreslil
 * vlastní, planeta by na dvou místech vypadala jinak.
 */

import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

export function proceduralTexture(id: string, tint: string): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const cached = cache.get(id);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // deterministický šum: stejné id = stejné skvrny
  let seed = 0;
  for (let i = 0; i < id.length; i += 1) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  // „srdce" — světlá pláň Sputnik Planitia, kterou Pluto proslavil
  const heart = ctx.createRadialGradient(300, 150, 10, 300, 150, 120);
  heart.addColorStop(0, 'rgba(255, 246, 232, 0.92)');
  heart.addColorStop(1, 'rgba(255, 246, 232, 0)');
  ctx.fillStyle = heart;
  ctx.beginPath();
  ctx.ellipse(300, 150, 110, 78, 0.2, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 90; i += 1) {
    const x = rand() * canvas.width;
    const y = rand() * canvas.height;
    const r = 6 + rand() * 26;
    const dark = rand() > 0.5;
    ctx.fillStyle = dark ? 'rgba(60, 46, 38, 0.18)' : 'rgba(255, 240, 220, 0.14)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(id, texture);
  return texture;
}
