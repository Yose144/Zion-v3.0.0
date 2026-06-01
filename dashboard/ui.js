'use strict';

export function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

export function fmtNum(n){
  if(n === null || n === undefined) return '—';
  if(n >= 1e9) return (n/1e9).toFixed(2) + 'B';
  if(n >= 1e6) return (n/1e6).toFixed(2) + 'M';
  if(n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return n.toString();
}

export function toast(msg, kind){
  const t = document.createElement('div');
  t.className = 'fixed bottom-4 right-4 px-4 py-2.5 rounded-xl text-sm font-medium z-50 shadow-lg backdrop-blur-md ' +
    (kind === 'error' ? 'bg-red-600/90 text-white' : 'bg-emerald-600/90 text-white');
  t.style.cssText += 'animation:slide-in 0.3s ease-out;';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; }, 2500);
  setTimeout(() => t.remove(), 3000);
}

export function copyToClipboard(text){
  navigator.clipboard.writeText(text).then(() => toast('Copied!', 'success'));
}
