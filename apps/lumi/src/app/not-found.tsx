import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-lumi flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="h2 mt-4">Tuhle stránku tu nemáme</h1>
      <p className="mt-3 max-w-md text-sm text-ink-soft">
        Možná se přesunula, nebo je odkaz starý. Zkuste kolekci — lampiony jsou tam pořád.
      </p>
      <div className="mt-7 flex gap-3">
        <Link href="/kolekce" className="btn-primary">
          Zobrazit kolekci
        </Link>
        <Link href="/" className="btn-outline">
          Domů
        </Link>
      </div>
    </div>
  );
}
