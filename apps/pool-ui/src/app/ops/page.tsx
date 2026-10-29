import type { Metadata } from 'next';
import OpsClient from './OpsClient';

export const metadata: Metadata = {
  title: 'ZION MultiRig Ops',
  robots: { index: false, follow: false },
};

export default function OpsPage() {
  return <OpsClient />;
}
