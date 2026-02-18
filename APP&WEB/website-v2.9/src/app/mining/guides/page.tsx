import { redirect } from 'next/navigation';

// Consolidated into /mining — all guides are now on one page
export default function MiningGuidesRedirect() {
  redirect('/mining#guides');
}
