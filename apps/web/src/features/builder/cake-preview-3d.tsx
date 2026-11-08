'use client';

import { useState } from 'react';

import { CakeCanvas3D } from '@/components/cake-3d/cake-canvas-3d';
import { normalizeCakeHex } from '@/components/cake-3d/cake-scene-builder';
import { Button } from '@/components/ui/button';
import { messages } from '@/content/messages';
import type { CakeFormat } from '@/lib/api/orders';

export interface CakePreview3DProps {
  format: CakeFormat;
  floorsCount: number;
  colorHex: string;
  toppingMessage?: string;
  riceImageUrl?: string;
}

/**
 * RF04: Visualizacao 3D interativa em tempo real com WebGL (Three.js),
 * iluminacao de estudio High-Key, sombras suaves, pedestal de porcelana e
 * rotacao livre em 360 graus via arraste de mouse/toque ou controles acessiveis.
 */
export function CakePreview3D({
  format,
  floorsCount,
  colorHex,
  toppingMessage,
  riceImageUrl,
}: CakePreview3DProps) {
  const [angle, setAngle] = useState(0);

  const safeFloors = Math.max(1, Math.min(4, Math.round(floorsCount)));
  const baseHex = normalizeCakeHex(colorHex);
  const formatLabel = messages.builder.structureSection.formats[format];
  const texts = messages.builder.preview;
  const trimmedTopping = toppingMessage?.trim() ?? '';

  function rotateBy(delta: number) {
    setAngle((prev) => {
      const next = prev + delta;
      if (next > 180) return next - 360;
      if (next < -180) return next + 360;
      return next;
    });
  }

  return (
    <div className="rounded-control border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-xl">{texts.title}</h2>
        <span className="rounded-control bg-sand-100 px-2.5 py-1 text-xs font-medium text-ink-muted">
          {texts.angleBadge(angle)}
        </span>
      </div>

      <div className="mt-4 flex flex-col items-center justify-center rounded-control border border-line bg-paper px-3 py-4">
        {trimmedTopping.length > 0 && <span className="sr-only">{trimmedTopping}</span>}

        <CakeCanvas3D
          format={format}
          floorsCount={safeFloors}
          colorHex={baseHex}
          toppingMessage={trimmedTopping}
          riceImageUrl={riceImageUrl}
          angleDegrees={angle}
          onAngleChange={setAngle}
          ariaLabel={texts.figureLabel(safeFloors, formatLabel, baseHex)}
          tierTestIdPrefix="cake-tier"
          className="h-64 w-full sm:h-72"
        />

        <p className="mt-1 text-center text-xs text-ink-muted">{texts.dragHint}</p>

        {riceImageUrl && (
          <p className="mt-2 rounded-control border border-line bg-sand-100 px-3 py-1 text-xs font-medium text-ink">
            {texts.ricePaperBadge}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" size="md" onClick={() => rotateBy(-30)}>
          {texts.rotateLeft}
        </Button>
        <Button variant="ghost" size="md" onClick={() => setAngle(0)}>
          {texts.resetAngle}
        </Button>
        <Button variant="secondary" size="md" onClick={() => rotateBy(30)}>
          {texts.rotateRight}
        </Button>
      </div>
    </div>
  );
}
