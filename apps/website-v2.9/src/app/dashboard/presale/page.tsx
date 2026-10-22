import type { Metadata } from 'next';
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: 'Presale · ZION',
  description: 'ZION presale analytics and contribution tracking.',
};

export default function DaoDashboardRedirectPage() {
  redirect("/dashboard/dao-tree");
}
