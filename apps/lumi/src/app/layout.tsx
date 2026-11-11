import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '@/lib/lang-context';
import { ThemeProvider } from '@/lib/theme-context';
import { CartProvider } from '@/components/cart-provider';
import SiteHeader from '@/components/site-header';
import SiteFooter from '@/components/site-footer';
import CookieNotice from '@/components/cookie-notice';
import { COMPANY } from '@/lib/company';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
});

const display = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lumi.zionterranova.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Lumi — dřevěné lampiony',
    template: '%s · Lumi',
  },
  description:
    'Ručně řezané dřevěné lampiony z 3mm březové překližky. Lumi 2, Mini a stavebnice. Sestavíte za 30 minut, svíčka ve sklenici, číslovaná edice. Vyrábí Omnity.One s.r.o.',
  keywords: [
    'dřevěný lampion',
    'lampion z překližky',
    'svatební dekorace',
    'dřevěná lucerna',
    'laser cut lantern',
    'Holzlaterne',
    'Lumi',
  ],
  openGraph: {
    type: 'website',
    locale: 'cs_CZ',
    url: siteUrl,
    siteName: 'Lumi',
    title: 'Lumi — dřevěné lampiony',
    description:
      'Ručně řezané dřevěné lampiony z březové překližky. Pro svatební stoly, firemní dárky a večery doma.',
    images: [{ url: '/images/lumi-b/og-lumi.jpg', width: 1200, height: 630, alt: 'Lumi 2 — dřevěný lampion' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lumi — dřevěné lampiony',
    description: 'Ručně řezané dřevěné lampiony. Sestavíte za 30 minut.',
    images: ['/images/lumi-b/og-lumi.jpg'],
  },
  icons: {
    icon: '/favicon.svg',
  },
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f0e1be' },
    { media: '(prefers-color-scheme: dark)', color: '#101c2b' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" suppressHydrationWarning className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('lumi_theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){}})();",
          }}
        />
        <a
          href="#obsah"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-forest focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-parchment"
        >
          Přeskočit na obsah / Skip to content
        </a>
        <ThemeProvider>
          <LanguageProvider>
            <CartProvider>
            <SiteHeader />
            <main id="obsah">{children}</main>
              <SiteFooter />
              <CookieNotice />
            </CartProvider>
          </LanguageProvider>
        </ThemeProvider>
        <script
          type="application/ld+json"
          // Strukturovaná data pomáhají Googlu pochopit, že jde o malou
          // značku s vlastní dílnou, ne o marketplaces agregátor.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Lumi',
              legalName: COMPANY.name,
              url: siteUrl,
              logo: `${siteUrl}/favicon.svg`,
              email: COMPANY.email,
              address: {
                '@type': 'PostalAddress',
                streetAddress: COMPANY.address,
                addressLocality: 'Horní Čermná',
                postalCode: '561 56',
                addressCountry: 'CZ',
              },
            }),
          }}
        />
      </body>
    </html>
  );
}
