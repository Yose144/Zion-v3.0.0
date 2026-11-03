import type { Locale } from '@zion/contract';
import { MiningEmbed } from './MiningEmbed';

/**
 * Mining — portál desktop klienta. V prohlížeči ukazuje fallback,
 * v Electronu embeduje agent UI (mining/rig/wallet dashboard).
 */
export default function MiningPortal({ locale }: { locale: Locale }) {
  return <MiningEmbed locale={locale} />;
}
