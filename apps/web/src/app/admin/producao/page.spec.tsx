import { render, screen } from '@testing-library/react';

import { messages } from '@/content/messages';

import AdminProductionPage, { metadata } from './page';

describe('AdminProductionPage (/admin/producao)', () => {
  it('define metadados privados (noindex) e renderiza KitchenKanbanView', async () => {
    expect(metadata.title).toBe(messages.adminKanban.title);
    expect(metadata.robots).toEqual({ index: false, follow: false });

    render(<AdminProductionPage />);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: messages.adminKanban.unauthenticatedTitle,
      }),
    ).toBeInTheDocument();
  });
});
