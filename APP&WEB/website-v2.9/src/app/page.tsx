import HomePageLite from '@/components/HomePageLite';

// Force dynamic rendering so deploy changes appear immediately
export const dynamic = 'force-dynamic';

export default function Home() {
  return <HomePageLite />;
}
