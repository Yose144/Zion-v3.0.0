import { prisma } from './db';

export type ShopTheme = 'rasta' | 'zion';

const THEME_KEY = 'shop_theme';

export async function getActiveTheme(): Promise<ShopTheme> {
  const setting = await prisma.shopSetting.findUnique({
    where: { key: THEME_KEY },
  });
  const value = setting?.value ?? 'rasta';
  if (value === 'zion' || value === 'rasta') return value;
  return 'rasta';
}

export async function setActiveTheme(theme: ShopTheme): Promise<void> {
  await prisma.shopSetting.upsert({
    where: { key: THEME_KEY },
    create: { key: THEME_KEY, value: theme },
    update: { value: theme },
  });
}
