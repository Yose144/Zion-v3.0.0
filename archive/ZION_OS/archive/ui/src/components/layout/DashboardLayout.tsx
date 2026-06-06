import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function DashboardLayout({ children }: Props) {
  return (
    <div className="h-screen w-full bg-zion-bg relative overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,255,200,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,200,0.3) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />
      {children}
    </div>
  );
}
