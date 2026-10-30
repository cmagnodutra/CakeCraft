import type { Metadata } from 'next';
import { Suspense } from 'react';

import { messages } from '@/content/messages';
import { MyOrdersView } from '@/features/orders/my-orders-view';

export const metadata: Metadata = {
  title: messages.myOrders.title,
  robots: { index: false, follow: false },
};

export default function MyOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-5xl px-5 py-12 text-ink-muted sm:px-8 sm:py-16">
          {messages.myOrders.loadingMessage}
        </div>
      }
    >
      <MyOrdersView />
    </Suspense>
  );
}
