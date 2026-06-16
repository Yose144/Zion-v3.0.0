import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Rich List · ZION Explorer',
  description: 'Top ZION holders by balance — premine allocations, mining rewards, and network economics.',
};

export default function RichListRedirect() {
  redirect('/explorer#richlist');
}
