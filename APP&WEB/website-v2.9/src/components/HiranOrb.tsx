'use client';

import { useEffect, useRef, useState } from 'react';
import GoldenOrb from './GoldenOrb';

/**
 * HiranOrb — interaktivní WebGL „Siri-style" živá koule pro Hirana.
 * Fake-sphere fragment shader: simplex noise tečoucí po povrchu,
 * ZION paleta gold → purple → cyan, fresnel rim, hot core,
 * breathing, mouse-follow světlo, click pulse ring.
 * Bez three.js — raw WebGL fullscreen quad (~malé náklady).
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uMouse;
uniform float uHover;
uniform float uPulse;
uniform vec2 uRes;

// ── Ashima 3D simplex noise ──
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

mat3 roty(float a){float c=cos(a),s=sin(a);return mat3(c,0.,s, 0.,1.,0., -s,0.,c);}
mat3 rotx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0., 0.,c,-s, 0.,s,c);}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= uRes.x / uRes.y;
  float r = length(uv);

  // breathing radius
  float R = 0.60 + 0.018 * sin(uTime * 0.7);

  // outer aura
  float glow = r > R ? exp(-(r - R) * 5.5) * (0.5 + 0.4 * uHover) : 0.0;

  vec3 gold = vec3(0.99, 0.83, 0.10);
  vec3 purp = vec3(0.62, 0.20, 0.93);
  vec3 cyan = vec3(0.02, 0.72, 0.83);

  vec3 col = vec3(0.0);
  float alpha = 0.0;

  if (r <= R) {
    float z = sqrt(R * R - r * r);
    vec3 n = normalize(vec3(uv, z));

    // povrch „se točí" za kurzorem
    n = roty(uMouse.x * 0.7) * rotx(-uMouse.y * 0.7) * n;

    vec3 p = n * 2.1;
    float t = uTime * 0.22;
    float n1 = snoise(p + vec3(t, t * 0.6, -t * 0.4));
    float n2 = snoise(p * 1.9 + vec3(-t * 1.1, t * 0.8, t * 0.9) + n1 * 0.8);
    float bands = fract(n1 * 0.32 + n2 * 0.22 + t * 0.07 + uMouse.x * 0.06 + 1.0);

    // cyklická ZION paleta: gold → purple → cyan → gold
    vec3 surface;
    if (bands < 0.3333) surface = mix(gold, purp, smoothstep(0.0, 0.3333, bands));
    else if (bands < 0.6666) surface = mix(purp, cyan, smoothstep(0.3333, 0.6666, bands));
    else surface = mix(cyan, gold, smoothstep(0.6666, 1.0, bands));

    // lighting
    vec3 L = normalize(vec3(-0.45 + uMouse.x * 0.8, 0.55 + uMouse.y * 0.8, 0.75));
    float diff = clamp(dot(n, L), 0.0, 1.0);
    float fres = pow(1.0 - z / R, 2.2);

    col = surface * (0.30 + 0.95 * diff);
    col += surface * fres * (1.15 + 0.9 * uHover);
    col += vec3(1.0, 0.96, 0.82) * pow(diff, 8.0) * 0.75;
    col += gold * n2 * 0.10;

    alpha = 1.0;
  }

  // click pulse — expandující zlatý kruh
  if (uPulse >= 0.0 && uPulse < 1.0) {
    float pr = uPulse * 0.95;
    float ring = (1.0 - uPulse) * (1.0 - smoothstep(0.0, 0.055, abs(r - pr)));
    col += vec3(1.0, 0.90, 0.60) * ring;
  }

  col += gold * glow * 0.5;
  alpha = max(alpha, glow * 0.75);

  gl_FragColor = vec4(col, alpha);
}
`;

export default function HiranOrb({ className = '' }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: 'low-power',
    });
    if (!gl) {
      setFailed(true);
      return;
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('HiranOrb shader:', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      setFailed(true);
      return;
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFailed(true);
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uMouse = gl.getUniformLocation(prog, 'uMouse');
    const uHover = gl.getUniformLocation(prog, 'uHover');
    const uPulse = gl.getUniformLocation(prog, 'uPulse');
    const uRes = gl.getUniformLocation(prog, 'uRes');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    let visible = true;
    let raf = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0, hover: 0, thover: 0 };
    let pulseStart = -1;
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(wrap);

    const onMove = (e: MouseEvent) => {
      const rect = wrap.getBoundingClientRect();
      mouse.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.ty = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };
    const onEnter = () => {
      mouse.thover = 1;
    };
    const onLeave = () => {
      mouse.tx = 0;
      mouse.ty = 0;
      mouse.thover = 0;
    };
    const onClick = () => {
      pulseStart = performance.now();
    };
    wrap.addEventListener('mousemove', onMove);
    wrap.addEventListener('mouseenter', onEnter);
    wrap.addEventListener('mouseleave', onLeave);
    wrap.addEventListener('click', onClick);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const t = (now - start) / 1000;
      mouse.x += (mouse.tx - mouse.x) * 0.07;
      mouse.y += (mouse.ty - mouse.y) * 0.07;
      mouse.hover += (mouse.thover - mouse.hover) * 0.08;
      const pulse = pulseStart < 0 ? -1 : (now - pulseStart) / 900;
      if (pulse >= 1) pulseStart = -1;

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, t);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uHover, mouse.hover);
      gl.uniform1f(uPulse, pulse >= 1 ? -1 : pulse);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      wrap.removeEventListener('mousemove', onMove);
      wrap.removeEventListener('mouseenter', onEnter);
      wrap.removeEventListener('mouseleave', onLeave);
      wrap.removeEventListener('click', onClick);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  if (failed) return <GoldenOrb className={className} />;

  return (
    <div ref={wrapRef} className={`relative cursor-pointer ${className}`} title="Hiran">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
