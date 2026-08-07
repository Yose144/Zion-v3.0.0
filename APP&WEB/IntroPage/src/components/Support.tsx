import Image from 'next/image';

export default function Support() {
  return (
    <section id="support" className="w-full px-4 py-20 sm:py-28">
      <div className="max-w-3xl mx-auto p-6 sm:p-10 rounded-3xl bg-rasta-dark/60 border border-white/10 backdrop-blur-sm">
        <h2 className="text-2xl sm:text-3xl font-bold text-rasta-gold mb-6 tracking-wide">
          Support Our Project
        </h2>

        <div className="text-center mb-10">
          <p className="text-2xl font-semibold text-white tracking-wider">
            ཨོཾ་ མ་ཎི་ པདྨེ་ ཧཱུྃ
          </p>
        </div>

        <div className="flex justify-center mb-10">
          <Image
            src="/images/kundun.jpg"
            alt="Kundun"
            width={320}
            height={240}
            className="rounded-2xl opacity-90 shadow-lg max-w-full h-auto"
            loading="lazy"
          />
        </div>

        <p className="text-white/90 leading-relaxed mb-2">
          Your contributions help us keep the project alive and thriving. We appreciate every donation, no matter how small. Thank you for your support!
        </p>
        <p className="text-rasta-gold text-center text-lg mb-8">~ &reg; ~</p>

        <h3 className="text-xl font-bold text-white mb-4">Investment Opportunities</h3>
        <p className="text-white/80 leading-relaxed mb-2">
          If you are interested in supporting our project in the long term, we also offer opportunities for investment.
        </p>
        <p className="text-white/80 leading-relaxed mb-8">
          Please contact us for more information about partnership and investment possibilities.
        </p>
        <p className="text-rasta-gold text-center text-lg mb-8">~ &reg; ~</p>

        <h3 className="text-xl font-bold text-white mb-4">Financial Support</h3>
        <h4 className="text-lg font-semibold text-rasta-gold mb-3">Our Transparent Account</h4>
        <div className="space-y-1 text-white/90 mb-8 font-mono text-sm sm:text-base">
          <p>CZ</p>
          <p>259251079/0600</p>
          <p>IBAN: CZ68 0600 0000 0002 5925 1079</p>
          <p>BIC: AGBACZPP</p>
        </div>

        <div className="flex justify-center mb-10">
          <Image
            src="/images/TransAcc.jpeg"
            alt="Transparent account"
            width={256}
            height={256}
            className="rounded-2xl opacity-80 max-w-[40%] h-auto"
            loading="lazy"
          />
        </div>

        <h4 className="text-lg font-semibold text-rasta-gold mb-3">Bitcoin Account</h4>
        <p className="text-white/90 font-mono text-sm sm:text-base break-all mb-8">
          bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw
        </p>

        <div className="flex justify-center mb-10">
          <Image
            src="/images/bitcoin.png"
            alt="Bitcoin"
            width={256}
            height={256}
            className="rounded-2xl opacity-80 max-w-[40%] h-auto"
            loading="lazy"
          />
        </div>

        <p className="text-center text-white/80 text-lg">Namaste</p>
      </div>
    </section>
  );
}
