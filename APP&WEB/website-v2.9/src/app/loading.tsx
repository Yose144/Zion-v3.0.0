import { Orbit } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        {/* Animated orb */}
        <div className="relative mx-auto w-24 h-24 mb-6">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-zion-purple/30 via-zion-gold/20 to-zion-cyan/20 blur-2xl animate-pulse" />
          <div className="relative w-full h-full rounded-full border border-white/10 bg-black/60 backdrop-blur-xl flex items-center justify-center">
            <Orbit className="w-8 h-8 text-zion-gold animate-spin" style={{ animationDuration: '3s' }} />
          </div>
        </div>
        <p className="text-sm uppercase tracking-[0.4em] text-gray-500 animate-pulse">
          Loading...
        </p>
      </div>
    </div>
  );
}
