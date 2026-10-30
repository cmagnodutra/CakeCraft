'use client';

import { useState } from 'react';

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

const DEFAULT_HEX = '#F3EDE3';
const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function normalizeHex(raw: string): string {
  return HEX_PATTERN.test(raw) ? raw.toUpperCase() : DEFAULT_HEX;
}

function adjustHexBrightness(hex: string, factor: number): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);

  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  const adjust = (channel: number) =>
    factor >= 0 ? clamp(channel + (255 - channel) * factor) : clamp(channel * (1 + factor));

  const toHex = (channel: number) => adjust(channel).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * RF04: Visualizacao 3D interativa e rotacionavel em SVG isometrico + CSS 3D.
 *
 * Decisao de engenharia: projecao isometrica vetorial com iluminacao High-Key
 * calculada a partir do HEX escolhido, zero dependencia de WebGL/Three.js
 * (evita perda de contexto GPU em celulares e mantem o bundle enxuto).
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
  const baseHex = normalizeHex(colorHex);
  const topTint = adjustHexBrightness(baseHex, 0.22);
  const leftTint = adjustHexBrightness(baseHex, -0.08);
  const rightTint = adjustHexBrightness(baseHex, -0.18);
  const strokeTint = adjustHexBrightness(baseHex, -0.34);

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

  // Desenha da base (1o andar) ate o topo para sobreposicao z-order natural.
  const tiers = Array.from({ length: safeFloors }, (_, index) => index + 1);
  const yawOffset = Math.sin((angle * Math.PI) / 180) * 14;

  return (
    <div className="rounded-control border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-serif text-xl">{texts.title}</h2>
        <span className="rounded-control bg-sand-100 px-2.5 py-1 text-xs font-medium text-ink-muted">
          {texts.angleBadge(angle)}
        </span>
      </div>

      <div
        className="mt-4 flex flex-col items-center justify-center rounded-control border border-line bg-paper px-4 py-6"
        style={{ perspective: '900px' }}
      >
        {trimmedTopping.length > 0 && (
          <div className="mb-2 max-w-xs truncate rounded-control border border-line-strong bg-surface px-3 py-1 font-serif text-sm italic text-ink shadow-xs">
            {trimmedTopping}
          </div>
        )}

        <svg
          role="img"
          aria-label={texts.figureLabel(safeFloors, formatLabel, baseHex)}
          viewBox="0 0 320 270"
          className="h-60 w-full max-w-xs transition-transform duration-200"
          style={{
            transform: `rotateX(6deg) rotateY(${angle * 0.35}deg)`,
          }}
        >
          {/* Sombra suave e prato pedestal de confeitaria */}
          <ellipse cx="160" cy="246" rx="116" ry="16" fill="#E8DFCF" />
          <rect x="142" y="224" width="36" height="20" rx="4" fill="#D8CCB8" />
          <ellipse cx="160" cy="222" rx="122" ry="20" fill="#FFFFFF" stroke="#8C7F69" strokeWidth="1.5" />

          {tiers.map((floorNumber) => {
            const tierIndex = floorNumber - 1;
            const tierHeight = 38;
            const baseY = 214 - tierIndex * (tierHeight - 2);
            const scale = 1 - tierIndex * 0.19;
            const halfW = (format === 'RETANGULAR' ? 98 : 84) * scale;
            const depthY = (format === 'RETANGULAR' ? 18 : 22) * scale;
            const cx = 160 + yawOffset * (tierIndex * 0.22);

            if (format === 'REDONDO') {
              const topY = baseY - tierHeight;
              return (
                <g key={floorNumber} data-testid={`cake-tier-${floorNumber}`}>
                  <path
                    d={`M ${cx - halfW} ${topY} L ${cx - halfW} ${baseY} A ${halfW} ${depthY} 0 0 0 ${cx + halfW} ${baseY} L ${cx + halfW} ${topY} Z`}
                    fill={leftTint}
                    stroke={strokeTint}
                    strokeWidth="1.4"
                  />
                  <ellipse
                    cx={cx}
                    cy={baseY}
                    rx={halfW}
                    ry={depthY}
                    fill="none"
                    stroke={strokeTint}
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                  <ellipse
                    cx={cx}
                    cy={topY}
                    rx={halfW}
                    ry={depthY}
                    fill={topTint}
                    stroke={strokeTint}
                    strokeWidth="1.4"
                  />
                  {floorNumber === safeFloors && riceImageUrl && (
                    <ellipse
                      cx={cx}
                      cy={topY}
                      rx={halfW * 0.62}
                      ry={depthY * 0.62}
                      fill="#FFFFFF"
                      stroke="#8A5A2B"
                      strokeWidth="1.4"
                    />
                  )}
                </g>
              );
            }

            // Prisma isometrico para QUADRADO e RETANGULAR
            const topY = baseY - tierHeight;
            const skewX = yawOffset * 0.55;
            const leftX = cx - halfW;
            const rightX = cx + halfW;
            const frontX = cx + skewX;
            const backX = cx - skewX;

            const topPoints = [
              `${frontX},${topY + depthY}`,
              `${rightX},${topY}`,
              `${backX},${topY - depthY}`,
              `${leftX},${topY}`,
            ].join(' ');

            const leftFace = [
              `${leftX},${topY}`,
              `${frontX},${topY + depthY}`,
              `${frontX},${baseY + depthY}`,
              `${leftX},${baseY}`,
            ].join(' ');

            const rightFace = [
              `${frontX},${topY + depthY}`,
              `${rightX},${topY}`,
              `${rightX},${baseY}`,
              `${frontX},${baseY + depthY}`,
            ].join(' ');

            return (
              <g key={floorNumber} data-testid={`cake-tier-${floorNumber}`}>
                <polygon
                  points={leftFace}
                  fill={leftTint}
                  stroke={strokeTint}
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <polygon
                  points={rightFace}
                  fill={rightTint}
                  stroke={strokeTint}
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <polygon
                  points={topPoints}
                  fill={topTint}
                  stroke={strokeTint}
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                {floorNumber === safeFloors && riceImageUrl && (
                  <ellipse
                    cx={cx}
                    cy={topY}
                    rx={halfW * 0.45}
                    ry={depthY * 0.5}
                    fill="#FFFFFF"
                    stroke="#8A5A2B"
                    strokeWidth="1.4"
                  />
                )}
              </g>
            );
          })}
        </svg>

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
