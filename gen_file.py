content = """'use client';

import { useLang } from "@/components/LanguageProvider";

export default function Test() {
  const { cs } = useLang();
  return (
    <div className="foo bar">
      <h1 className="text-4xl font-bold">{cs ? 'Nadpis' : 'Heading'}</h1>
      <p className="text-sm text-gray-400">{cs ? 'Odstavec' : 'Paragraph'}</p>
      <Link href="/test" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 bg-white/8 text-sm font-semibold text-white hover:border-amber-300/30 transition-colors">
        {cs ? 'Tlačítko' : 'Button'}
      </Link>
    </div>
  );
}
"""
with open("test_output.tsx", "w") as f:
    f.write(content)
