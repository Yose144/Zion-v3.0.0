import type { Metadata } from 'next';
import BroadcastPageClient from "./BroadcastPageClient";

export const metadata: Metadata = {
  title: 'Broadcast Transaction · ZION Explorer',
  description: 'Broadcast a signed transaction to the ZION network. Submit raw hex or JSON transaction payload.',
};

export default function BroadcastPage() {
  return <BroadcastPageClient />;
}
