import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-guard';
import {
  csvRow,
  csvDate,
  halToCsvAmount,
  generalLedger,
  inventoryReport,
} from '@/lib/accounting';

export const dynamic = 'force-dynamic';

type ExportType = 'journal' | 'ledger' | 'inventory';

function csvResponse(filename: string, rows: string[]): NextResponse {
  // UTF-8 BOM + CRLF — Excel na Windows jinak rozbije diakritiku i sloupce
  const body = '\uFEFF' + rows.join('\r\n') + '\r\n';
  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (auth) return auth;

  const url = new URL(request.url);
  const type = (url.searchParams.get('type') ?? 'journal') as ExportType;
  const period = parseInt(url.searchParams.get('period') ?? String(new Date().getFullYear()), 10);
  const account = (url.searchParams.get('account') ?? '').trim();

  if (!['journal', 'ledger', 'inventory'].includes(type)) {
    return NextResponse.json(
      { success: false, error: 'type musí být journal | ledger | inventory' },
      { status: 400 }
    );
  }

  if (type === 'journal') {
    const entries = await prisma.ledgerEntry.findMany({
      where: { period },
      include: { lines: true },
      orderBy: [{ date: 'asc' }, { entryNumber: 'asc' }],
    });

    const rows: string[] = [
      csvRow([
        'Doklad',
        'Datum',
        'Popis',
        'Doklad č.',
        'Zdroj',
        'Účet',
        'Strana',
        'Částka (Kč)',
      ]),
    ];
    for (const e of entries) {
      for (const l of e.lines) {
        rows.push(
          csvRow([
            e.entryNumber,
            csvDate(e.date),
            e.description,
            e.documentRef ?? '',
            e.sourceType ?? 'manual',
            l.accountCode,
            l.side,
            halToCsvAmount(l.amountHal),
          ])
        );
      }
    }
    return csvResponse(`denik-${period}.csv`, rows);
  }

  if (type === 'ledger') {
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Chybí parametr account (číslo účtu)' },
        { status: 400 }
      );
    }
    const ledger = await generalLedger(account, period);
    if (!ledger) {
      return NextResponse.json(
        { success: false, error: `Účet ${account} není v účtovém rozvrhu` },
        { status: 404 }
      );
    }

    const rows: string[] = [
      csvRow(['Účet', `${ledger.accountCode} ${ledger.name}`]),
      csvRow(['Období', String(ledger.period)]),
      '',
      csvRow([
        'Doklad',
        'Datum',
        'Popis',
        'Doklad č.',
        'Zdroj',
        'Strana',
        'Částka (Kč)',
        'Zůstatek (Kč)',
      ]),
      csvRow([
        '',
        '',
        `Počáteční stav k 1. 1. ${period}`,
        '',
        '',
        '',
        '',
        halToCsvAmount(ledger.openingHal),
      ]),
    ];
    for (const l of ledger.lines) {
      rows.push(
        csvRow([
          l.entryNumber,
          csvDate(l.date),
          l.description,
          l.documentRef ?? '',
          l.sourceType ?? 'manual',
          l.side,
          halToCsvAmount(l.amountHal),
          halToCsvAmount(l.balanceHal),
        ])
      );
    }
    rows.push(
      csvRow([
        '',
        '',
        'Obrat MD',
        '',
        '',
        'MD',
        halToCsvAmount(ledger.mdHal),
        '',
      ]),
      csvRow([
        '',
        '',
        'Obrat DAL',
        '',
        '',
        'DAL',
        halToCsvAmount(ledger.dalHal),
        '',
      ]),
      csvRow([
        '',
        '',
        'Konečný stav',
        '',
        '',
        '',
        '',
        halToCsvAmount(ledger.closingHal),
      ])
    );
    return csvResponse(`hlavni-kniha-${ledger.accountCode}-${period}.csv`, rows);
  }

  // inventory
  const inv = await inventoryReport(period);
  const kindLabel = { asset: 'aktivní', liability: 'pasivní', equity: 'kapitál' } as const;

  const rows: string[] = [
    csvRow(['Inventurní soupis stavů', `k 31. 12. ${period}`]),
    '',
    csvRow(['Účet', 'Název', 'Třída', 'Druh', 'Zůstatek (Kč)']),
  ];
  for (const r of inv.rows) {
    rows.push(
      csvRow([r.accountCode, r.name, r.cls, kindLabel[r.kind], halToCsvAmount(r.balanceHal)])
    );
  }
  rows.push(
    '',
    csvRow(['Aktiva celkem', '', '', '', halToCsvAmount(inv.assetsHal)]),
    csvRow(['Závazky celkem', '', '', 'pasivní', halToCsvAmount(inv.liabilitiesHal)]),
    csvRow(['Vlastní kapitál', '', '', 'kapitál', halToCsvAmount(inv.equityHal)]),
    csvRow(['Výsledek hospodaření', '', '', 'VH', halToCsvAmount(inv.profitHal)]),
    csvRow(['Kontrolní rozdíl', '', '', '', halToCsvAmount(inv.controlDiffHal)]),
    csvRow(['Kontrola MD = DAL', '', '', '', inv.balanced ? 'OK' : 'NESOUHLASÍ'])
  );
  return csvResponse(`inventura-${period}.csv`, rows);
}
