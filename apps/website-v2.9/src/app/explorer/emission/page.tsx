import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Emission — ZION Explorer',
  description: 'ZION emission and supply overview.',
};

export default function EmissionRedirectPage() {
  redirect('/explorer/supply');
}
