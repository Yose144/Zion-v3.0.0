import type { Metadata } from 'next';
import GuardianDashboard from '@/components/GuardianDashboard';

export const metadata: Metadata = {
  title: 'Guardian Portal · ZION TerraNova',
  description: 'Guardian monitoring portal — real-time chain telemetry, treasury overview, and DAO governance.',
};

export default function GuardianPage() {
  return <GuardianDashboard />;
}
