import ContractsPageClient from './ContractsPageClient';

export const metadata = {
  title: 'Contracts · ZION Explorer',
  description: 'Verified ZION ecosystem contract addresses on Base mainnet, grouped by public category.',
};

export default function ContractsPage() {
  return <ContractsPageClient />;
}
