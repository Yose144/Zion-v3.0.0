export default function ConstructionBanner() {
  return (
    <div className="relative z-50 bg-gradient-to-r from-zion-gold/20 via-zion-gold/20 to-zion-purple/20 border-b border-zion-gold/30 backdrop-blur-sm">
      <div className="zion-container py-3">
        <div className="flex flex-wrap items-center justify-center gap-2 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zion-gold shrink-0">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          <span className="text-zion-gold font-medium text-sm uppercase tracking-wider">
            Web in reconstruction
          </span>
          <span className="hidden sm:inline text-zion-gold/60">|</span>
          <span className="text-gray-300 text-sm">
            Some features are temporarily unavailable. We apologize for any inconvenience.
          </span>
        </div>
      </div>
    </div>
  );
}
