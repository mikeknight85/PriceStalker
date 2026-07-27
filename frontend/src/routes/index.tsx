import { createFileRoute, redirect } from '@tanstack/react-router';

const dashboardTabs = ['products', 'stats', 'add'] as const;
const productSections = ['overview', 'chart', 'stock', 'notifications', 'settings'] as const;

export type DashboardTab = (typeof dashboardTabs)[number];
export type ProductSection = (typeof productSections)[number];

export interface DashboardSearch {
  tab?: DashboardTab;
  product?: number;
  category?: string;
  section?: ProductSection;
}

function isDashboardTab(value: unknown): value is DashboardTab {
  return typeof value === 'string' && dashboardTabs.includes(value as DashboardTab);
}

function isProductSection(value: unknown): value is ProductSection {
  return typeof value === 'string' && productSections.includes(value as ProductSection);
}

function validProductId(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export const Route = createFileRoute('/')({
  validateSearch: (search): DashboardSearch => ({
    tab: isDashboardTab(search.tab) ? search.tab : undefined,
    product: validProductId(search.product),
    category: typeof search.category === 'string' && search.category.length > 0 ? search.category : undefined,
    section: isProductSection(search.section) ? search.section : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (search.product) {
      const sectionPath = search.section === 'chart' ? '/history' : search.section === 'stock' ? '/stock' : search.section === 'notifications' ? '/notifications' : search.section === 'settings' ? '/settings' : '';
      throw redirect({ to: `/products/$productId${sectionPath}`, params: { productId: String(search.product) }, replace: true });
    }
    if (search.tab === 'stats') throw redirect({ to: '/insights', replace: true });
    if (search.tab === 'add') throw redirect({ to: '/products/new', replace: true });
    throw redirect({ to: '/products', search: { category: search.category }, replace: true });
  },
});
