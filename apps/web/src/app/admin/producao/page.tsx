import type { Metadata } from 'next';

import { messages } from '@/content/messages';
import { KitchenKanbanView } from '@/features/kanban/kitchen-kanban-view';

export const metadata: Metadata = {
  title: messages.adminKanban.title,
  robots: { index: false, follow: false },
};

export default function AdminProductionPage() {
  return <KitchenKanbanView />;
}
