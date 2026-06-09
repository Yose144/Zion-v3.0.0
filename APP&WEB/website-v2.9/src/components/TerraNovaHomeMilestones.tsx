'use client';

import Link from 'next/link';
import { ArrowDownToLine, ArrowRight } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';

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
            {tr('APP_WEB_website_v2_9_src_components_Terr', 'terra_nova_golden_compass_of_the_new_earth', lang)}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold">
            <span className="text-gradient">Terra Nova</span>
          </h2>
          <p className="text-lg text-gray-300 max-w-2xl">
            {cs
              ? 'Čtvrtá kniha ZION a veřejný vstup do celé sekce Terra Nova. Odtud pokračuje kniha, Kompas i další vrstvy bez roadmapového šumu na homepage.'
              : 'The fourth book of ZION and the public entry into the whole Terra Nova section. From here the book, Compass, and the remaining layers continue without homepage roadmap noise.'}
          </p>
        </div>

        {/* ── Hiranyagarbha Terminal ── */}
        <div className="mb-10 max-w-2xl mx-auto lg:mx-0">
          <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60 backdrop-blur-sm bg-black/60">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border-b border-white/10">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
              <span className="h-3 w-3 rounded-full bg-green-500/80" />
              <span className="flex-1 text-center text-[11px] text-gray-400 font-mono tracking-widest select-none">
                hiranyagarbha — zion-cli v3
              </span>
            </div>
            {/* Body */}
            <div className="p-4 sm:p-6 font-mono text-[10px] sm:text-[11px] leading-snug overflow-x-auto">
              <p className="text-green-400 mb-3">
                <span className="text-zion-gold">zion</span>
                <span className="text-gray-500">@hiranyagarbha</span>
                <span className="text-white">:~$</span>
                {' '}
                <span className="text-cyan-300">genesis --dedicate --ascii-art</span>
              </p>
              <pre className="text-zion-gold/75 leading-tight select-none whitespace-pre">{BRAILLE_TREE}</pre>
              <pre className="text-zion-gold leading-tight select-none mt-2 whitespace-pre">{ZION_ASCII}</pre>
              <div className="mt-3 space-y-1">
                <p><span className="text-gray-500">[genesis]</span> <span className="text-green-400">Mainnet Launch v3</span> <span className="text-gray-600">✓ block #1</span></p>
                <p><span className="text-white font-bold">&gt;</span> <span className="text-white">{tr('APP_WEB_website_v2_9_src_components_Terr', 'zion_is_yours', lang)}</span></p>
                <p><span className="text-white font-bold">&gt;</span> <span className="text-zion-gold">{tr('APP_WEB_website_v2_9_src_components_Terr', 'the_golden_age_begins', lang)}</span></p>
                <p className="text-gray-600 italic text-[10px]">Gate, Gate, Paragate, Parasamgate, Bodhi Swaha</p>
                <p className="text-gray-700 text-[10px]">— Yeshuae Ben Yose / Zion Creator · Om Namo Hiranyagarbha!</p>
              </div>
              <p className="mt-3 text-green-400">
                <span className="text-zion-gold">zion</span>
                <span className="text-gray-500">@hiranyagarbha</span>
                <span className="text-white">:~$</span>
                {' '}
                <span className="inline-block w-2 h-3 bg-green-400 align-middle animate-pulse" />
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href="/download#downloads"
              className="inline-flex items-center gap-2 rounded-2xl border border-zion-cyan/30 bg-zion-cyan/10 px-5 py-3 text-sm font-semibold text-zion-cyan hover:bg-zion-cyan/20 transition-all duration-300"
            >
              <ArrowDownToLine className="w-4 h-4" />
              {tr('APP_WEB_website_v2_9_src_components_Terr', 'download_zion_cli', lang)}
            </Link>
            <p className="text-sm text-gray-400">
              {tr('APP_WEB_website_v2_9_src_components_Terr', 'public_windows_linux_and_macos_binaries_are_live', lang)}
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/terranova"
            className="inline-flex items-center gap-2.5 rounded-2xl border border-zion-gold/30 bg-zion-gold/10 px-8 py-3.5 text-sm font-semibold text-zion-gold hover:bg-zion-gold/20 transition-all duration-300"
          >
            {tr('APP_WEB_website_v2_9_src_components_Terr', 'open_the_terra_nova_section', lang)}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/download"
            className="inline-flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-all duration-300"
          >
            {tr('APP_WEB_website_v2_9_src_components_Terr', 'go_to_download', lang)}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
