import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { messages } from '@/content/messages';

import { CakePreview3D } from './cake-preview-3d';

const previewTexts = messages.builder.preview;

describe('CakePreview3D (RF04 - visualizacao 3D interativa)', () => {
  it('renderiza a quantidade exata de andares, o formato e a cor HEX escolhida', () => {
    render(
      <CakePreview3D
        format="REDONDO"
        floorsCount={3}
        colorHex="#E8B4B8"
        toppingMessage="Parabéns, Marina!"
      />,
    );

    expect(
      screen.getByRole('img', {
        name: previewTexts.figureLabel(3, 'Redondo', '#E8B4B8'),
      }),
    ).toBeInTheDocument();

    expect(screen.getAllByTestId(/^cake-tier-/)).toHaveLength(3);
    expect(screen.getByText('Parabéns, Marina!')).toBeInTheDocument();
  });

  it('adapta a geometria para formatos QUADRADO e RETANGULAR e exibe selo de papel de arroz', () => {
    const { rerender } = render(
      <CakePreview3D
        format="QUADRADO"
        floorsCount={2}
        colorHex="#FAF7F2"
        riceImageUrl="http://api.test/api/uploads/rice-paper/1.png"
      />,
    );

    expect(
      screen.getByRole('img', {
        name: previewTexts.figureLabel(2, 'Quadrado', '#FAF7F2'),
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(previewTexts.ricePaperBadge)).toBeInTheDocument();

    rerender(<CakePreview3D format="RETANGULAR" floorsCount={1} colorHex="invalido" />);
    expect(
      screen.getByRole('img', {
        name: previewTexts.figureLabel(1, 'Retangular', '#F3EDE3'),
      }),
    ).toBeInTheDocument();
  });

  it('permite girar o modelo 3D para esquerda, direita e centralizar novamente', async () => {
    const user = userEvent.setup();
    render(<CakePreview3D format="REDONDO" floorsCount={2} colorHex="#F3EDE3" />);

    expect(screen.getByText(previewTexts.angleBadge(0))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: previewTexts.rotateRight }));
    expect(screen.getByText(previewTexts.angleBadge(30))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: previewTexts.rotateLeft }));
    await user.click(screen.getByRole('button', { name: previewTexts.rotateLeft }));
    expect(screen.getByText(previewTexts.angleBadge(-30))).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: previewTexts.resetAngle });
    expect(resetBtn.className).toContain('border-line-strong');
    await user.click(resetBtn);
    expect(screen.getByText(previewTexts.angleBadge(0))).toBeInTheDocument();
  });
});
