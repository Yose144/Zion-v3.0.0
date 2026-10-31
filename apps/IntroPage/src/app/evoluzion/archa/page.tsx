import type { Metadata } from "next";
import ArchaClient from "./ArchaClient";

export const metadata: Metadata = {
  title: "Nirvana · Království srdce — archa",
  description: "Čtvrté plavidlo flotily Tres Marías. Koncept ve fázi vision.",
  robots: { index: false, follow: false },
};

export default function ArchaPage() {
  return <ArchaClient />;
}
