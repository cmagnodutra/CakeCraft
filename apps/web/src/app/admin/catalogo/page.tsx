import type { Metadata } from 'next';

import { messages } from '@/content/messages';
import { AdminCatalogView } from '@/features/catalog/admin-catalog-view';

export const metadata: Metadata = {
  title: messages.adminCatalog.title,
  robots: { index: false, follow: false },
};

export default function AdminCatalogPage() {
  return <AdminCatalogView />;
}
