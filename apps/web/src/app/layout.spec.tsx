import { messages } from '@/content/messages';

import { metadata } from './layout';

describe('metadata do layout', () => {
  it('o titulo padrao e o nome da marca', () => {
    expect(metadata.title).toMatchObject({ default: messages.brand.name });
  });

  it('as paginas internas ganham o sufixo da marca: "Criar conta | CakeCraft"', () => {
    expect(metadata.title).toMatchObject({ template: `%s | ${messages.brand.name}` });
  });

  it('a descricao e a frase de valor da marca', () => {
    expect(metadata.description).toBe(messages.brand.tagline);
  });
});
