import type { Metadata } from 'next';
import StatusPageClient from "./StatusPageClient";

export const metadata: Metadata = {
  title: 'Node Status · ZION Explorer',
  description: 'Real-time ZION node and network status — protocol version, consensus, peers, services, and health metrics.',
};

export default function StatusPage() {
  return <StatusPageClient />;
}
