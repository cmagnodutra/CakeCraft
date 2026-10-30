import { render, screen } from '@testing-library/react';

import { messages } from '@/content/messages';

import MyOrdersPage, { metadata } from './page';

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: () => null }),
}));

describe('MyOrdersPage (/meus-pedidos)', () => {
  it('define metadados privados (noindex) e renderiza MyOrdersView dentro de Suspense', async () => {
    expect(metadata.title).toBe(messages.myOrders.title);
    expect(metadata.robots).toEqual({ index: false, follow: false });

    render(<MyOrdersPage />);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: messages.myOrders.unauthenticatedTitle,
      }),
    ).toBeInTheDocument();
  });
});
