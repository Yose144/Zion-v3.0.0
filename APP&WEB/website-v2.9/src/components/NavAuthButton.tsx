'use client';

/**
 * NavAuthButton — shows login button or user avatar in the navbar.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut, LayoutDashboard, User, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LoginModal from './LoginModal';

export default function NavAuthButton() {
  const { user, authenticated, loading, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();

  if (loading) {
    return (
      <div className="h-8 w-8 rounded-xl border border-white/10 bg-black/75 animate-pulse" />
    );
  }

  if (!authenticated) {
    return (
      <>
        <button
          onClick={() => setShowLogin(true)}
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 bg-black/85 text-sm font-semibold text-white hover:border-zion-cyan/40 hover:text-zion-cyan transition-colors"
        >
          <LogIn className="w-4 h-4" />
          Login
        </button>
        <button
          onClick={() => setShowLogin(true)}
          className="sm:hidden p-2 rounded-xl border border-white/15 bg-black/85 text-white"
        >
          <LogIn className="w-4 h-4" />
        </button>
        <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
      </>
    );
  }

  // Authenticated — show avatar + dropdown
  const shortAddr = user?.address ? `${user.address.slice(0, 8)}...${user.address.slice(-4)}` : '';
  const initial = user?.displayName?.[0]?.toUpperCase() || 'Z';

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl border border-white/15 bg-black/75 hover:border-white/25 transition-colors"
        >
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-zion-gold to-zion-purple flex items-center justify-center text-[11px] font-bold text-white">
            {initial}
          </div>
          <span className="hidden lg:inline text-[11px] font-mono text-gray-400">{shortAddr}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showMenu ? 'rotate-180' : ''}`} />
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-[rgba(4,7,16,0.95)] backdrop-blur-xl shadow-[0_18px_60px_rgba(0,0,0,0.55)] z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.displayName || 'ZION User'}
                </p>
                <p className="text-[10px] font-mono text-gray-500 truncate">{user?.address}</p>
              </div>
              <button
                onClick={() => {
                  setShowMenu(false);
                  router.push('/account');
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5" /> My Account
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  router.push('/wallet');
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <User className="w-3.5 h-3.5" /> My Wallet
              </button>
              <div className="h-px bg-white/5" />
              <button
                onClick={async () => {
                  setShowMenu(false);
                  await logout();
                  router.push('/');
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
