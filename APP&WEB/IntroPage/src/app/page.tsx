import Header from '@/components/Header';
import Intro from '@/components/Intro';
import V3Zion from '@/components/V3Zion';
import Elements from '@/components/Elements';
import Support from '@/components/Support';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main className="relative min-h-screen w-full bg-rasta-black text-white scroll-smooth">
      <div className="absolute inset-0 -z-10 bg-[url(/stargate/nebula.jpg)] bg-cover bg-center bg-no-repeat bg-fixed opacity-20" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-rasta-black to-rasta-black" />

      <Header />
      <Intro />
      <V3Zion />
      <Elements />
      <Support />
      <Contact />
      <Footer />
    </main>
  );
}
