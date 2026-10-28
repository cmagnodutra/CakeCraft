import { render, screen } from '@testing-library/react';

import { messages } from '@/content/messages';

import AdminCatalogPage, { metadata } from './page';

describe('AdminCatalogPage (/admin/catalogo)', () => {
  it('renderiza a visao administrativa do catalogo com um unico h1', () => {
    render(<AdminCatalogPage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('define o titulo da aba e bloqueia indexacao da area administrativa', () => {
    expect(metadata.title).toBe(messages.adminCatalog.title);
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
