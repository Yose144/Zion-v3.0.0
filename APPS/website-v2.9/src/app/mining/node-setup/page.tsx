import { redirect } from 'next/navigation';

// Consolidated into /mining — node setup is now on the main mining page
export default function NodeSetupRedirect() {
  redirect('/mining#node-setup');
}
