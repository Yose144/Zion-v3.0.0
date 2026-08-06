'use client';

import Link from 'next/link';
import { ArrowDownToLine, ArrowRight } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const TerraNovaHomeMilestonesCopy = {
  terraNovaGoldenCompassOfTheNew: { cs: `Terra Nova · Zlatý Kompas Nové Země`, en: `Terra Nova · Golden Compass of the New Earth` },
  theFourthBookOfZionAndThePubli: { cs: `Čtvrtá kniha ZION a veřejný vstup do celé sekce Terra Nova. Odtud pokračuje kniha, Kompas i další vrstvy bez roadmapového šumu na homepage.`, en: `The fourth book of ZION and the public entry into the whole Terra Nova section. From here the book, Compass, and the remaining layers continue without homepage roadmap noise.` },
  zionIsYours: { cs: `ZION je váš.`, en: `ZION is yours.` },
  theGoldenAgeBegins: { cs: `Zlatý věk začíná.`, en: `The Golden Age begins.` },
  downloadZionCli: { cs: `Download ZION CLI`, en: `Download ZION CLI` },
  publicWindowsLinuxAndMacosBina: { cs: `Veřejné binárky pro Windows, Linux a macOS jsou živé.`, en: `Public Windows, Linux, and macOS binaries are live.` },
  openTheTerraNovaSection: { cs: `Otevřít sekci Terra Nova`, en: `Open the Terra Nova section` },
  goToDownload: { cs: `Přejít na Download`, en: `Go to Download` },
};

const BRAILLE_TREE = `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⣀⢂⣁⣧⣖⡖⠠⢠⠀⠀⢤⡀⢀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢼⣶⡭⣛⠫⡞⠡⠀⡤⢦⠆⠨⠀⠀⢸⠋⠬⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡀⠀⠒⢈⠀⢭⣉⠂⡄⢠⠖⣸⠑⣆⡦⠊⢀⠀⡂⢉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠍⠚⣁⣀⡀⣤⣰⢶⢷⢼⣿⠏⡡⢠⢗⡙⣶⣞⠛⣍⣪⣼⡠⠠⢶⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠀⠀⢄⣎⡠⢠⠉⠋⠓⠉⠋⢨⠘⠚⢉⡄⠁⢾⡌⣗⢿⠛⠲⠛⠋⡝⠑⠀⠌⡤⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠘⠥⠄⡚⣜⢣⣴⡨⢁⡀⣈⡅⠀⣀⠀⠈⣄⣀⢿⣯⡔⢊⢺⣷⠆⣷⠶⠂⠀⠀⠀⢀⡀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠘⢁⣨⡅⠨⣤⣭⣵⣿⢿⢏⠿⠯⡁⠹⣿⡯⡜⠫⢯⢿⡾⣻⡅⣠⣆⣄⣰⡐⠲⠼⢶⠒⠯⠅⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠂⢈⠙⡋⣟⡛⣷⠴⢼⠓⠋⣺⣴⣷⣷⢾⣿⡿⣡⣠⣸⠗⠻⠹⠿⣟⢥⠯⣿⠻⢅⢴⢎⠄⠀⡄⢠⣀⠀⡀⠀⢄⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢘⠳⠋⣤⣶⡿⢜⣳⢦⢶⣌⣩⠶⢠⣤⣯⠷⠈⠬⡉⠎⠎⣀⡌⠟⣝⣿⠇⡚⠒⠔⢀⣴⣍⣾⢲⠋⠟⠈⠙⠑⠉⢀⠄⠀
⠀⠀⠀⡀⣽⠿⠻⡈⠱⢻⣽⡟⣶⣚⡻⢏⢹⡋⠁⣀⣂⣤⣴⠄⢤⣐⣴⡾⣶⠯⣄⣉⢓⡭⢍⡆⡀⣈⣿⣷⡷⠶⠒⢂⣠⣠⢶⣾⣳⣯⣵⡄
⠀⠀⠀⠰⠴⠀⢘⢉⣧⣥⣏⠳⢈⣫⠞⣿⣷⢤⣤⣿⣿⣾⣧⣾⣿⣿⣿⣗⣿⣿⣿⠋⣚⡃⠿⡭⠹⣷⣿⠾⡿⢤⣤⣜⢿⣯⡿⣷⠯⣽⣿⡾
⠀⠀⠀⠀⠀⠐⠞⠻⣿⢟⣿⢿⠷⠥⣼⣷⢷⣯⠟⠻⠙⢉⡿⣿⢻⣹⣿⣿⢉⢳⣿⣿⣯⡶⡄⡶⢦⣷⣶⣿⡬⢥⠨⣭⣹⠏⠁⡘⢫⠉⠈⠀
⠀⠀⠔⣼⢂⠬⢌⠧⢋⡛⢡⣮⡡⠈⠓⣃⢀⣒⣊⣽⠻⣛⠟⢿⢸⣯⣿⣓⣿⡟⣷⣟⣿⣿⣿⣿⣻⣷⣟⣒⡺⠏⢰⡿⠿⣶⣶⡻⠒⡿⠦⡀
⠀⢆⣀⣆⣸⣿⠋⡴⢲⡁⡋⠀⢴⣮⣷⠟⠫⠿⣿⢶⢅⢴⣇⣸⣷⣿⣿⣧⣾⣿⣿⣿⣿⣿⣿⣿⣿⢿⢿⣟⣲⢦⠦⢋⡀⢿⣾⣷⣶⣤⠋⠆
⠈⠘⠛⠼⠿⡝⣻⠛⠻⠀⠀⠐⠛⢹⣱⣟⣽⣯⣿⡟⡊⣿⣷⣖⢽⣿⣿⣿⢿⣿⠀⠀⠘⠋⠃⠁⠀⠀⠨⠟⠿⡷⣥⣉⠁⠘⠉⠊⠚⠚⠓⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠋⠀⠀⠀⠀⠈⠋⠹⣎⢻⣿⠟⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠛⢳⡕⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣾⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣹⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠚⠛⠃`;

const ZION_ASCII = `████████╗██╗ ██████╗███╗   ██╗
╚══███╔╝██║██╔═══██╗████╗  ██║
  ███╔╝ ██║██║   ██║██╔██╗ ██║
 ███╔╝  ██║██║   ██║██║╚██╗██║
███████╗██║╚██████╔╝██║ ╚████║
╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝`;

export default function TerraNovaHomeMilestones() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <section className="relative py-20 px-4 overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[700px] rounded-full blur-[200px] bg-zion-gold/5" />
      </div>

      <div className="zion-container relative">
        {/* Header */}
        <div className="mb-10 flex flex-col items-start gap-3 max-w-3xl">
          <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
            {TerraNovaHomeMilestonesCopy.terraNovaGoldenCompassOfTheNew[cs ? 'cs' : 'en']}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold">
            <span className="text-gradient">Terra Nova</span>
          </h2>
          <p className="text-lg text-gray-300 max-w-2xl">
            {TerraNovaHomeMilestonesCopy.theFourthBookOfZionAndThePubli[cs ? 'cs' : 'en']}
          </p>
        </div>

        {/* ── Hiranyagarbha Terminal ── */}
        <div className="mb-10 max-w-2xl mx-auto lg:mx-0">
          <div className="zion-rainbow-card shadow-2xl shadow-black/60 backdrop-blur-sm" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border-b border-white/10">
              <span className="h-3 w-3 rounded-full bg-zion-purple/80" />
              <span className="h-3 w-3 rounded-full bg-zion-gold/80" />
              <span className="h-3 w-3 rounded-full bg-zion-cyan/80" />
              <span className="flex-1 text-center text-[11px] text-gray-400 font-mono tracking-widest select-none">
                hiranyagarbha — zion-cli v3
              </span>
            </div>
            {/* Body */}
            <div className="p-4 sm:p-6 font-mono text-[10px] sm:text-[11px] leading-snug overflow-x-auto">
              <p className="text-zion-cyan mb-3">
                <span className="text-zion-gold">zion</span>
                <span className="text-gray-500">@hiranyagarbha</span>
                <span className="text-white">:~$</span>
                {' '}
                <span className="text-zion-cyan">genesis --dedicate --ascii-art</span>
              </p>
              <pre className="text-zion-gold/75 leading-tight select-none whitespace-pre">{BRAILLE_TREE}</pre>
              <pre className="text-zion-gold leading-tight select-none mt-2 whitespace-pre">{ZION_ASCII}</pre>
              <div className="mt-3 space-y-1">
                <p><span className="text-gray-500">[genesis]</span> <span className="text-zion-cyan">Mainnet Launch v3</span> <span className="text-gray-600">✓ block #1</span></p>
                <p><span className="text-white font-bold">&gt;</span> <span className="text-white">{TerraNovaHomeMilestonesCopy.zionIsYours[cs ? 'cs' : 'en']}</span></p>
                <p><span className="text-white font-bold">&gt;</span> <span className="text-zion-gold">{TerraNovaHomeMilestonesCopy.theGoldenAgeBegins[cs ? 'cs' : 'en']}</span></p>
                <p className="text-gray-600 italic text-[10px]">Gate, Gate, Paragate, Parasamgate, Bodhi Swaha</p>
                <p className="text-gray-700 text-[10px]">— Yeshuae Ben Yose / Zion Creator · Om Namo Hiranyagarbha!</p>
              </div>
              <p className="mt-3 text-zion-cyan">
                <span className="text-zion-gold">zion</span>
                <span className="text-gray-500">@hiranyagarbha</span>
                <span className="text-white">:~$</span>
                {' '}
                <span className="inline-block w-2 h-3 bg-zion-cyan align-middle animate-pulse" />
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/download#downloads"
              className="inline-flex items-center gap-2 rounded-2xl border border-zion-cyan/30 bg-zion-cyan/10 px-5 py-3 text-sm font-semibold text-zion-cyan hover:bg-zion-cyan/20 transition-all duration-300"
            >
              <ArrowDownToLine className="w-4 h-4" />
              {TerraNovaHomeMilestonesCopy.downloadZionCli[cs ? 'cs' : 'en']}
            </Link>
            <p className="text-sm text-gray-400">
              {TerraNovaHomeMilestonesCopy.publicWindowsLinuxAndMacosBina[cs ? 'cs' : 'en']}
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/terranova"
            className="inline-flex items-center gap-2.5 rounded-2xl border border-zion-gold/30 bg-zion-gold/10 px-8 py-3.5 text-sm font-semibold text-zion-gold hover:bg-zion-gold/20 transition-all duration-300"
          >
            {TerraNovaHomeMilestonesCopy.openTheTerraNovaSection[cs ? 'cs' : 'en']}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/download"
            className="zion-rainbow-sub inline-flex items-center gap-2.5 px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-all duration-300"
            style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
          >
            {TerraNovaHomeMilestonesCopy.goToDownload[cs ? 'cs' : 'en']}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
