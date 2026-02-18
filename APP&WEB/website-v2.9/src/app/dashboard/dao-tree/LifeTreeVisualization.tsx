"use client";

import type { LucideIcon } from "lucide-react";
import { Crown, Sparkles, Users } from "lucide-react";

type GuardianInfo = {
  name: string;
  role: string;
  allocation: string;
};

type TreeNode = {
  level: string;
  title: string;
  description: string;
  color: string;
  guardians: GuardianInfo[];
};

interface LifeTreeVisualizationProps {
  treeLevels: TreeNode[];
}

export default function LifeTreeVisualization({
  treeLevels,
}: LifeTreeVisualizationProps) {
  const iconMap: Record<string, LucideIcon> = {
    Crown,
    Heart: Sparkles,
    Roots: Users,
  };

  return (
    <>
      <div className="relative mx-auto mt-12 max-w-5xl rounded-[40px] border border-white/10 bg-black/80 p-10 shadow-[0_30px_120px_rgba(8,8,20,0.65)]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[40px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.25),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(16,185,129,0.2),_transparent_60%)]" />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.35) 1px, transparent 40px), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.25) 1.5px, transparent 35px), radial-gradient(circle at 60% 20%, rgba(255,255,255,0.2) 1px, transparent 45px)",
              backgroundSize: "600px 600px, 500px 500px, 700px 700px",
              mixBlendMode: "screen",
            }}
          />
          <div className="absolute left-1/2 top-6 bottom-6 w-[2px] -translate-x-1/2 bg-gradient-to-b from-emerald-200 via-zion-gold to-rose-400 shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
          <div className="spark spark-1" />
          <div className="spark spark-2" />
          <div className="orbital orbital-1" />
          <div className="orbital orbital-2" />
        </div>
        <div className="relative space-y-14">
          {treeLevels.map((node, idx) => (
            <div
              key={node.level}
              className={`flex flex-col gap-4 md:flex-row md:items-center ${idx % 2 ? "md:flex-row-reverse" : ""}`}
              style={{ animation: `floatNode 9s ease-in-out ${idx * 0.8}s infinite` }}
            >
              <div className="flex-1">
                <div
                  className={`tree-node-card relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br ${node.color} p-6 shadow-[0_10px_40px_rgba(0,0,0,0.45)]`}
                >
                  <div
                    className="absolute inset-0 opacity-15"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.8) 1px, transparent 20px), radial-gradient(circle at 70% 80%, rgba(255,255,255,0.6) 1px, transparent 25px)",
                      backgroundSize: "300px 300px",
                      backgroundRepeat: "repeat",
                    }}
                  />
                  <div className="relative">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const Icon = iconMap[node.level];
                        return Icon ? <Icon className="h-6 w-6 text-white drop-shadow-lg" /> : null;
                      })()}
                      <p className="text-xs uppercase tracking-[0.4em] text-white/80">{node.level}</p>
                    </div>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{node.title}</h3>
                    <p className="mt-2 text-sm text-white/90">{node.description}</p>
                    <div className="mt-4 space-y-3">
                      {node.guardians.map((guardian) => (
                        <div
                          key={guardian.name}
                          className="rounded-2xl border border-white/30 bg-black/40 p-4 text-sm text-white"
                        >
                          <p className="font-semibold text-zion-gold">{guardian.name}</p>
                          <p>{guardian.role} · {guardian.allocation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="tree-node-pin relative mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-black/70 text-white shadow-[0_0_30px_rgba(34,197,94,0.5)]">
                <span className="text-lg font-semibold">{node.level.slice(0, 1)}</span>
                <div className="absolute inset-0 -z-10 rounded-full bg-emerald-400/20" />
              </div>
            </div>
          ))}
        </div>
        <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4 text-xs uppercase tracking-[0.3em] text-gray-300">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" /> Roots · Community Guild
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" /> Heart · Builders Circle
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-300" /> Crown · Guardians Council
          </span>
        </div>
      </div>
      <style jsx>{`
        @keyframes floatNode {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0px); }
        }
        @keyframes sparkRise {
          0% { transform: translate3d(-30%, 0, 0); opacity: 0; }
          50% { opacity: 0.8; }
          100% { transform: translate3d(10%, -120%, 0); opacity: 0; }
        }
        @keyframes spinOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spark {
          position: absolute;
          width: 220px;
          height: 220px;
          background: radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 70%);
          opacity: 0.4;
          filter: blur(2px);
          animation: sparkRise 12s linear infinite;
        }
        .spark-1 { left: 10%; bottom: 0; animation-delay: 0s; }
        .spark-2 { right: 0; top: 20%; animation-delay: 4s; }
        .orbital {
          position: absolute;
          border: 1px dashed rgba(255,255,255,0.15);
          border-radius: 9999px;
          mix-blend-mode: screen;
          animation: spinOrbit 18s linear infinite;
        }
        .orbital-1 { width: 70%; height: 70%; top: 15%; left: 15%; }
        .orbital-2 { width: 90%; height: 90%; top: 5%; left: 5%; animation-duration: 26s; }
        .tree-node-card { animation: pulseGlow 6s ease-in-out infinite; }
        .tree-node-pin { animation: pulseGlow 3s ease-in-out infinite; }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 25px rgba(34,197,94,0.25); }
          50% { box-shadow: 0 0 35px rgba(234,179,8,0.45); }
        }
      `}</style>
    </>
  );
}