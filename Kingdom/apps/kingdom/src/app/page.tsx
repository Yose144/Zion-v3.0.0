import { getLocale } from '@/core/locale.server';
import { Gate } from '@/core/gate/Gate';
import { Topbar } from '@/core/shell/Topbar';

export default async function GatePage() {
  const locale = await getLocale();

  return (
    <div className="k-app">
      <Topbar locale={locale} />
      <Gate locale={locale} />
    </div>
  );
}
