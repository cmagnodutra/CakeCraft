import type { Metadata } from 'next';

import { messages } from '@/content/messages';
import { AdminReportsView } from '@/features/reports/admin-reports-view';

export const metadata: Metadata = {
  title: messages.adminReports.title,
  robots: { index: false, follow: false },
};

export default function AdminReportsPage() {
  return <AdminReportsView />;
}
