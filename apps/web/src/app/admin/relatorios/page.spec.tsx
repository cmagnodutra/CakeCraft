import { render, screen } from '@testing-library/react';

import { messages } from '@/content/messages';

import AdminReportsPage, { metadata } from './page';

describe('AdminReportsPage (/admin/relatorios)', () => {
  it('define metadados privados (noindex) e renderiza AdminReportsView', async () => {
    expect(metadata.title).toBe(messages.adminReports.title);
    expect(metadata.robots).toEqual({ index: false, follow: false });

    render(<AdminReportsPage />);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: messages.adminReports.unauthenticatedTitle,
      }),
    ).toBeInTheDocument();
  });
});
