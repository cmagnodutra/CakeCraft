import { fireEvent, render, screen } from '@testing-library/react';
import * as THREE from 'three';

import { CakeCanvas3D } from './cake-canvas-3d';
import {
  buildCakeModelGroup,
  buildPorcelainPedestal,
  disposeObject3D,
  normalizeCakeHex,
  setupCakeStudioLights,
} from './cake-scene-builder';

describe('cake-scene-builder & CakeCanvas3D (Three.js 3D Engine)', () => {
  it('normaliza cores HEX validas e aplica fallback seguro para valores invalidos', () => {
    expect(normalizeCakeHex('#e8b4b8')).toBe('#E8B4B8');
    expect(normalizeCakeHex('invalido')).toBe('#F3EDE3');
  });

  it('constroi iluminacao de estudio High-Key e pedestal de porcelana com sombra', () => {
    const scene = new THREE.Scene();
    setupCakeStudioLights(scene);
    expect(scene.children.length).toBeGreaterThanOrEqual(4);

    const pedestal = buildPorcelainPedestal();
    expect(pedestal.children.length).toBeGreaterThanOrEqual(3);
    expect(() => disposeObject3D(pedestal)).not.toThrow();
  });

  it('constroi malhas 3D para REDONDO, QUADRADO e RETANGULAR com papel de arroz', () => {
    const roundCake = buildCakeModelGroup({
      format: 'REDONDO',
      floorsCount: 3,
      colorHex: '#E8B4B8',
      dripColorHex: '#A64B56',
      pearlColorHex: '#FAF7F2',
      topperColorHex: '#9A2B1E',
      riceImageUrl: 'http://api.test/topo.png',
    });
    expect(roundCake.children.length).toBeGreaterThan(3);

    const squareCake = buildCakeModelGroup({
      format: 'QUADRADO',
      floorsCount: 2,
      colorHex: '#6B4423',
    });
    expect(squareCake.children.length).toBeGreaterThan(2);

    const rectCake = buildCakeModelGroup({
      format: 'RETANGULAR',
      floorsCount: 4,
      colorHex: '#FAF7F2',
    });
    expect(rectCake.children.length).toBeGreaterThan(4);

    expect(() => {
      disposeObject3D(roundCake);
      disposeObject3D(squareCake);
      disposeObject3D(rectCake);
    }).not.toThrow();
  });

  it('renderiza CakeCanvas3D acessivel e notifica mudanca de angulo ao arrastar com o ponteiro', () => {
    const onAngleChange = jest.fn();
    const { container } = render(
      <CakeCanvas3D
        format="REDONDO"
        floorsCount={2}
        colorHex="#E8B4B8"
        angleDegrees={0}
        onAngleChange={onAngleChange}
        ariaLabel="Bolo 3D de teste"
        tierTestIdPrefix="test-tier"
      />,
    );

    expect(screen.getByRole('img', { name: 'Bolo 3D de teste' })).toBeInTheDocument();
    expect(screen.getAllByTestId(/^test-tier-/)).toHaveLength(2);

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    if (canvas) {
      fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 160, clientY: 115 });
      fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 160, clientY: 115 });
    }
    expect(onAngleChange).toHaveBeenCalled();
  });

  it('executa ciclo completo da cena Three.js (render loop, atualizacao de malha e dispose no unmount)', () => {
    const renderMock = jest.fn();
    const disposeMock = jest.fn();
    const setSizeMock = jest.fn();

    let capturedRafCallback: FrameRequestCallback | undefined;
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      capturedRafCallback = cb;
      return 1;
    });
    const cancelSpy = jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);

    const fakeRendererFactory = () => ({
      setPixelRatio: jest.fn(),
      shadowMap: { enabled: false, type: THREE.PCFSoftShadowMap },
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1,
      outputColorSpace: THREE.SRGBColorSpace,
      setSize: setSizeMock,
      render: renderMock,
      dispose: disposeMock,
    });

    const { rerender, unmount } = render(
      <CakeCanvas3D
        format="REDONDO"
        floorsCount={2}
        colorHex="#E8B4B8"
        autoRotate
        ariaLabel="Bolo 3D com renderer simulado"
        rendererFactory={fakeRendererFactory}
      />,
    );

    expect(setSizeMock).toHaveBeenCalled();
    if (capturedRafCallback) {
      capturedRafCallback(performance.now() + 16);
    }
    expect(renderMock).toHaveBeenCalled();

    rerender(
      <CakeCanvas3D
        format="QUADRADO"
        floorsCount={3}
        colorHex="#6B4423"
        autoRotate
        ariaLabel="Bolo 3D atualizado"
        rendererFactory={fakeRendererFactory}
      />,
    );

    unmount();
    expect(cancelSpy).toHaveBeenCalled();
    expect(disposeMock).toHaveBeenCalled();

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
  });
});
