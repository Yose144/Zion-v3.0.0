'use client';

export default function Contact() {
  return (
    <section id="contact" className="w-full px-4 py-20 sm:py-28">
      <div className="max-w-3xl mx-auto p-6 sm:p-10 rounded-3xl bg-rasta-dark/60 border border-white/10 backdrop-blur-sm">
        <h2 className="text-2xl sm:text-3xl font-bold text-rasta-gold mb-8 tracking-wide">
          Contact & Form
        </h2>

        <h3 className="text-xl font-bold text-white mb-6">Form</h3>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="space-y-5"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-white/80">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Your name"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-rasta-gold focus:ring-1 focus:ring-rasta-gold"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-white/80">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-rasta-gold focus:ring-1 focus:ring-rasta-gold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="category" className="block text-sm font-medium text-white/80">
              Category
            </label>
            <select
              id="category"
              name="category"
              className="w-full rounded-xl bg-rasta-dark border border-white/10 px-4 py-3 text-white focus:outline-none focus:border-rasta-gold focus:ring-1 focus:ring-rasta-gold"
            >
              <option value="">-</option>
              <option value="info">Info & Consultation</option>
              <option value="it">IT & Web Development Services</option>
              <option value="wood">Wood Working & Arts</option>
              <option value="investment">Investment & Partnerships</option>
            </select>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="block text-sm font-medium text-white/80">Priority</span>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-white/80">
                  <input type="radio" name="priority" value="low" defaultChecked className="accent-rasta-gold" />
                  Low
                </label>
                <label className="flex items-center gap-2 text-white/80">
                  <input type="radio" name="priority" value="high" className="accent-rasta-gold" />
                  High
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <span className="block text-sm font-medium text-white/80">Options</span>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-white/80">
                  <input type="checkbox" name="copy" className="accent-rasta-gold" />
                  Email me a copy
                </label>
                <label className="flex items-center gap-2 text-white/80">
                  <input type="checkbox" name="human" defaultChecked className="accent-rasta-gold" />
                  Not a robot
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="message" className="block text-sm font-medium text-white/80">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              rows={6}
              placeholder="Enter your message"
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-rasta-gold focus:ring-1 focus:ring-rasta-gold resize-y"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              type="submit"
              className="px-8 py-3 rounded-full font-bold text-white bg-rasta-red hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(228,30,43,0.35)]"
            >
              Send Message
            </button>
            <button
              type="reset"
              className="px-8 py-3 rounded-full font-bold text-white border border-white/20 hover:bg-white/5 transition-colors"
            >
              Reset
            </button>
          </div>
        </form>

        <div className="mt-10 flex items-center gap-6">
          <a
            href="https://www.facebook.com/ZionTerraNova/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="text-white/70 hover:text-rasta-gold transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current" aria-hidden="true">
              <path d="M24 12.073C24 5.403 18.627 0 12 0S0 5.403 0 12.073C0 18.1 4.388 23.095 10.125 24v-8.437H7.078v-3.49H10.125V9.413c0-3.025 1.792-4.698 4.533-4.698 1.313 0 2.688.236 2.688.236v2.97h-1.513c-1.49 0-1.956.931-1.956 1.887v2.26h3.328l-.532 3.49h-2.796V24C19.612 23.095 24 18.1 24 12.073z" />
            </svg>
          </a>
          <a
            href="https://www.instagram.com/terranova_project/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="text-white/70 hover:text-rasta-gold transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current" aria-hidden="true">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
