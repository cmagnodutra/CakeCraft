import { render, screen } from '@testing-library/react';

import { messages } from '@/content/messages';
import { fetchPublicCatalog } from '@/lib/api/catalog';

import BuilderPage, { metadata } from './page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/api/catalog');

const fetchPublicCatalogMock = jest.mocked(fetchPublicCatalog);

describe('BuilderPage (/builder)', () => {
  it('define o titulo de pagina e renderiza o CakeBuilderView', async () => {
    fetchPublicCatalogMock.mockResolvedValue([]);

    expect(metadata.title).toBe(messages.builder.title);

    render(<BuilderPage />);

    expect(
      await screen.findByRole('heading', { level: 1, name: messages.builder.title }),
    ).toBeInTheDocument();
  });
});
