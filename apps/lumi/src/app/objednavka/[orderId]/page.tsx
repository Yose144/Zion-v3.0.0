import { Suspense } from 'react';
import type { Metadata } from 'next';
import OrderConfirmation from '@/components/order-confirmation';

export const metadata: Metadata = {
  title: 'Objednávka',
  robots: { index: false, follow: false },
};

type Params = Promise<{ orderId: string }>;

export default async function OrderPage({ params }: { params: Params }) {
  const { orderId } = await params;
  return (
    <Suspense fallback={null}>
      <OrderConfirmation orderId={orderId} />
    </Suspense>
  );
}
