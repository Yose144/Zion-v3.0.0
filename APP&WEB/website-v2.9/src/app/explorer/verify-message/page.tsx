import type { Metadata } from 'next';
import VerifyMessagePageClient from "./VerifyMessagePageClient";

export const metadata: Metadata = {
  title: 'Verify Message · ZION Explorer',
  description: 'Verify a signed message on the ZION network using Ed25519 cryptography. Confirm signature validity and address match.',
};

export default function VerifyMessagePage() {
  return <VerifyMessagePageClient />;
}
