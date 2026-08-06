"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/contexts/LanguageContext";
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Code,
  Compass,
  Globe,
  Layers,
  Radio,
  Search,
  ShieldCheck,
  Signal,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";
import ExplorerTicker from "./ExplorerTicker";

const ExplorerV4layoutCopy = {
  explorerSections: { cs: `Explorer sekce`, en: `Explorer sections` },
};

interface NavItem {
  href: string;
  labelCs: string;
  labelEn: string;
  icon: typeof Layers;
  group: "main" | "data" | "tools";
}

const navItems: NavItem[] = [
  // Main
  { href: "/explorer", labelCs: "Přehled", labelEn: "Dashboard", icon: Compass, group: "main" },
  { href: "/explorer/blocks", labelCs: "Bloky", labelEn: "Blocks", icon: Layers, group: "main" },
  { href: "/explorer/txs", labelCs: "TX Seznam", labelEn: "TX List", icon: Activity, group: "main" },
  { href: "/explorer/transactions", labelCs: "TX Feed", labelEn: "TX Feed", icon: ArrowLeftRight, group: "main" },
  { href: "/explorer/mempool", labelCs: "Mempool", labelEn: "Mempool", icon: Boxes, group: "main" },
  // Data
  { href: "/explorer/richlist", labelCs: "Rich List", labelEn: "Rich List", icon: TrendingUp, group: "data" },
  { href: "/explorer/supply", labelCs: "Emise", labelEn: "Supply", icon: BarChart3, group: "data" },
  { href: "/explorer/charts", labelCs: "Grafy", labelEn: "Charts", icon: BarChart3, group: "data" },
  { href: "/explorer/status", labelCs: "Status", labelEn: "Status", icon: Signal, group: "data" },
  { href: "/explorer/network-stats", labelCs: "Síť", labelEn: "Network", icon: Globe, group: "data" },
  { href: "/explorer/bridge", labelCs: "Most", labelEn: "Bridge", icon: ArrowLeftRight, group: "data" },
  { href: "/explorer/miners", labelCs: "Mineři", labelEn: "Miners", icon: ShieldCheck, group: "data" },
  // Tools
  { href: "/explorer/search", labelCs: "Hledat", labelEn: "Search", icon: Search, group: "tools" },
  { href: "/explorer/broadcast", labelCs: "Broadcast", labelEn: "Broadcast", icon: Radio, group: "tools" },
  { href: "/explorer/verify-message", labelCs: "Verify", labelEn: "Verify", icon: ShieldCheck, group: "tools" },
  { href: "/explorer/api-docs", labelCs: "API", labelEn: "API Docs", icon: Code, group: "tools" },
];

interface ExplorerV4LayoutProps {
  children: ReactNode;
  showTicker?: boolean;
}

/**
 * Explorer V4 layout with live ticker and pool-style tab navigation.
 * All explorer pages are interconnected via the tab bar —
 * same pattern as the Pool dashboard sections.
 */
export default function ExplorerV4Layout({ children, showTicker = true }: ExplorerV4LayoutProps) {
  const { lang } = useLang();
  const cs = lang === "cs";
  const pathname = usePathname();

  return (
    <div className="min-h-screen pt-28 md:pt-32">
      {/* Live network ticker */}
      {showTicker && (
        <div className="zion-container max-w-[1400px]">
          <div className="zion-rainbow-card overflow-hidden" style={{ "--rc": "7, 137, 48" } as React.CSSProperties}>
            <ExplorerTicker />
          </div>
        </div>
      )}

      {/* Pool-style tab navigation */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.02 }}
        className="zion-container max-w-[1400px] mt-4"
      >
        <div className="zion-rainbow-card p-4 md:p-6" style={{ "--rc": "7, 137, 48" } as React.CSSProperties}>
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mr-1 hidden sm:inline">
              {ExplorerV4layoutCopy.explorerSections[cs ? 'cs' : 'en']}
            </span>
            {navItems.map((item, idx) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/explorer" && pathname.startsWith(item.href));
              // Insert group separator
              const prevItem = idx > 0 ? navItems[idx - 1] : null;
              const showSeparator = prevItem && prevItem.group !== item.group;

              return (
                <span key={item.href} className="flex items-center">
                  {showSeparator && (
                    <span className="w-px h-5 bg-white/10 mx-1.5" />
                  )}
                  <Link
                    href={item.href}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${
                      isActive
                        ? "zion-rainbow-sub text-white"
                        : "border border-white/10 bg-white/5 text-gray-300 hover:border-white/25 hover:text-white"
                    }`}
                    style={isActive ? ({ "--rc": "7, 137, 48" } as React.CSSProperties) : undefined}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {cs ? item.labelCs : item.labelEn}
                  </Link>
                </span>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* Page content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
