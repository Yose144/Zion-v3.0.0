"use client";

import { type ReactNode } from "react";
import ExplorerV4Layout from "@/components/explorer/v4/shared/ExplorerV4Layout";

/**
 * Client wrapper for ExplorerV4Layout.
 * The explorer layout.tsx is a Server Component, but ExplorerV4Layout
 * uses usePathname() and scroll listeners (client-only).
 */
export default function ExplorerV4LayoutWrapper({ children }: { children: ReactNode }) {
  return <ExplorerV4Layout showTicker={true}>{children}</ExplorerV4Layout>;
}
