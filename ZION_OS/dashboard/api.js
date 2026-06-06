'use strict';

import { toast } from './ui.js';

// Safe fetch wrapper: checks .ok, throws on HTTP error, parses JSON
export async function apiFetch(url, opts={}){
  const res = await fetch(url, opts);
  if(!res.ok) throw new Error('HTTP ' + res.status + ' on ' + url);
  return res.json();
}

// Debounce utility for expensive refresh calls
export function debounce(fn, ms){
  let timer;
  return function(...args){
    clearTimeout(timer);
    timer = setTimeout(()=>fn.apply(this, args), ms);
  };
}

// Connection status tracking
export let connectionOk = true;
export let consecutiveFailures = 0;

export function updateConnectionStatus(ok){
  if(ok){ consecutiveFailures = 0; connectionOk = true; }
  else { consecutiveFailures++; if(consecutiveFailures >= 3) connectionOk = false; }
  const badge = document.getElementById('connection-badge');
  if(badge){
    badge.textContent = connectionOk ? '● Connected' : '● Disconnected';
    badge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold ' + (connectionOk ? 'bg-emerald-700/50 text-emerald-300' : 'bg-red-700/50 text-red-300');
  }
}
