import { Wallet, Zap, Gamepad2, type LucideIcon } from 'lucide-react';

const steps: { step: string; title: string; desc: string; icon: LucideIcon }[] = [
  { step: '01', title: 'Connect & Browse', desc: 'Connect your Base L2 wallet and explore OASIS artifacts. Filter by rarity, collection, or listing type.', icon: Wallet },
  { step: '02', title: 'Buy or Bid', desc: 'Pay with wZION on L2 for instant settlement, or send native ZION on L1 with a memo for hybrid settlement.', icon: Zap },
  { step: '03', title: 'Use in OASIS', desc: 'Every artifact is usable in the OASIS game universe. Equip avatars, fly ships, claim territory.', icon: Gamepad2 },
];

export default function HowItWorksSection() {
  return (
    <section>
      <div className="flex items-center gap-4 mb-6">
        <div className="zion-kicker">Guide</div>
        <h2 className="text-2xl font-black font-display text-gradient">How It Works</h2>
        <div className="section-line flex-1" />
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.step} className="zion-tile p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-oasis-cyan/10 border border-oasis-cyan/20 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-oasis-cyan" />
                </div>
                <span className="text-3xl font-black text-white/5 font-mono">{s.step}</span>
              </div>
              <h3 className="font-bold text-white text-lg mb-2 font-display">{s.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
