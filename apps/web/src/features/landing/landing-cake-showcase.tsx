'use client';

import { useState } from 'react';

import { messages } from '@/content/messages';

type PresetKey = keyof typeof messages.landing.showcase.presets;

interface PaletteConfig {
  key: PresetKey;
  swatchHex: string;
  bodyStartHex: string;
  bodyMidHex: string;
  bodyEndHex: string;
  topHex: string;
  dripHex: string;
  pearlHex: string;
  strokeHex: string;
  topperHex: string;
}

const PALETTES: readonly PaletteConfig[] = [
  {
    key: 'rose',
    swatchHex: '#E8B4B8',
    bodyStartHex: '#F3CFD2',
    bodyMidHex: '#E8B4B8',
    bodyEndHex: '#CE9297',
    topHex: '#F7E1E3',
    dripHex: '#A64B56',
    pearlHex: '#FAF7F2',
    strokeHex: '#8C585E',
    topperHex: '#9A2B1E',
  },
  {
    key: 'pistachio',
    swatchHex: '#BFD8C4',
    bodyStartHex: '#DCEADF',
    bodyMidHex: '#BFD8C4',
    bodyEndHex: '#9AB8A0',
    topHex: '#EDF5EE',
    dripHex: '#FAF7F2',
    pearlHex: '#F3EDE3',
    strokeHex: '#5E7A64',
    topperHex: '#6F8F72',
  },
  {
    key: 'cocoa',
    swatchHex: '#6B4423',
    bodyStartHex: '#8A5C36',
    bodyMidHex: '#6B4423',
    bodyEndHex: '#4E3017',
    topHex: '#9C6B43',
    dripHex: '#C89258',
    pearlHex: '#E8DFCF',
    strokeHex: '#3B2310',
    topperHex: '#C8A27C',
  },
];

interface TierGeometry {
  tierNumber: number;
  cx: number;
  baseY: number;
  topY: number;
  halfW: number;
  depthY: number;
}

function computeTierGeometry(tierIndex: number): TierGeometry {
  const tierHeight = 46;
  const baseY = 232 - tierIndex * (tierHeight - 4);
  const scale = 1 - tierIndex * 0.22;
  const halfW = Math.round(96 * scale);
  const depthY = Math.round(22 * scale);
  return {
    tierNumber: tierIndex + 1,
    cx: 180,
    baseY,
    topY: baseY - tierHeight,
    halfW,
    depthY,
  };
}

function buildPearlPositions(geo: TierGeometry): Array<{ x: number; y: number }> {
  const count = 9;
  const pearls: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const angle = Math.PI * (1 - t);
    const x = geo.cx + Math.cos(angle) * (geo.halfW - 3);
    const y = geo.baseY + Math.sin(angle) * (geo.depthY - 2);
    pearls.push({ x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) });
  }
  return pearls;
}

function buildDripPath(geo: TierGeometry): string {
  const left = geo.cx - geo.halfW;
  const right = geo.cx + geo.halfW;
  const rimY = geo.topY + Math.round(geo.depthY * 0.55);
  const width = right - left;
  const drops = [0.14, 0.31, 0.5, 0.69, 0.86];
  const lengths = [12, 19, 14, 21, 11];

  let d = `M ${left} ${geo.topY}`;
  d += ` A ${geo.halfW} ${geo.depthY} 0 0 0 ${right} ${geo.topY}`;
  d += ` L ${right} ${rimY}`;

  for (let i = drops.length - 1; i >= 0; i--) {
    const dropX = Number((left + width * drops[i]).toFixed(1));
    const dropLen = lengths[i];
    const halfSpan = Number((width * 0.045).toFixed(1));
    d += ` L ${dropX + halfSpan} ${rimY}`;
    d += ` Q ${dropX} ${rimY + dropLen} ${dropX - halfSpan} ${rimY}`;
  }

  d += ` L ${left} ${rimY} Z`;
  return d;
}

export function LandingCakeShowcase() {
  const [selectedKey, setSelectedKey] = useState<PresetKey>('rose');

  const texts = messages.landing.showcase;
  const palette = PALETTES.find((item) => item.key === selectedKey) ?? PALETTES[0];
  const preset = texts.presets[palette.key];
  const tiers = Array.from({ length: preset.floors }, (_, idx) => computeTierGeometry(idx));
  const topTier = tiers[tiers.length - 1];

  return (
    <div className="rounded-control border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-control border border-line bg-sand-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-accent">
          {texts.badge}
        </span>

        <div
          role="group"
          aria-label={texts.presetsAriaLabel}
          className="flex flex-wrap items-center gap-1.5"
        >
          {PALETTES.map((item) => {
            const active = item.key === palette.key;
            const itemLabel = texts.presets[item.key].label;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedKey(item.key)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-control border px-2.5 text-xs transition-colors ${
                  active
                    ? 'border-ink bg-sand-100 font-bold text-ink'
                    : 'border-line-strong bg-surface font-medium text-ink hover:bg-sand-100'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-3 w-3 rounded-full border border-line-strong"
                  style={{ backgroundColor: item.swatchHex }}
                />
                {itemLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Palco visual High-Key com bolo escultural em camadas */}
      <div className="mt-4 flex flex-col items-center rounded-control border border-line bg-paper px-4 pt-5 pb-4">
        <div className="mb-1 rounded-control border border-line-strong bg-surface px-3.5 py-1 font-serif text-sm italic text-ink">
          {preset.plaque}
        </div>

        <svg
          role="img"
          aria-label={texts.figureAriaLabel(preset.label, preset.floors)}
          viewBox="0 0 360 285"
          className="h-64 w-full max-w-sm sm:h-72"
        >
          <defs>
            <linearGradient id="landing-cake-body" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={palette.bodyStartHex} />
              <stop offset="52%" stopColor={palette.bodyMidHex} />
              <stop offset="100%" stopColor={palette.bodyEndHex} />
            </linearGradient>
            <radialGradient id="landing-halo" cx="50%" cy="46%" r="48%">
              <stop offset="0%" stopColor="#F3EDE3" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#FAF7F2" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Halo quente de estudio ao fundo */}
          <circle cx="180" cy="134" r="124" fill="url(#landing-halo)" />

          {/* Pedestal de porcelana da confeitaria */}
          <ellipse cx="180" cy="266" rx="124" ry="13" fill="#E8DFCF" />
          <path
            d="M 152 240 L 142 262 Q 180 270 218 262 L 208 240 Z"
            fill="#EFE7D8"
            stroke="#8C7F69"
            strokeWidth="1.4"
          />
          <ellipse
            cx="180"
            cy="238"
            rx="132"
            ry="22"
            fill="#FFFFFF"
            stroke="#8C7F69"
            strokeWidth="1.6"
          />
          <ellipse
            cx="180"
            cy="238"
            rx="116"
            ry="17"
            fill="none"
            stroke="#E5DCCB"
            strokeWidth="1.2"
          />

          {/* Andares do bolo desenhados da base para o topo */}
          {tiers.map((geo) => {
            const pearls = buildPearlPositions(geo);
            const dripPath = buildDripPath(geo);
            return (
              <g key={geo.tierNumber} data-testid={`landing-cake-tier-${geo.tierNumber}`}>
                <path
                  d={`M ${geo.cx - geo.halfW} ${geo.topY} L ${geo.cx - geo.halfW} ${geo.baseY} A ${geo.halfW} ${geo.depthY} 0 0 0 ${geo.cx + geo.halfW} ${geo.baseY} L ${geo.cx + geo.halfW} ${geo.topY} Z`}
                  fill="url(#landing-cake-body)"
                  stroke={palette.strokeHex}
                  strokeWidth="1.4"
                />

                <path d={dripPath} fill={palette.dripHex} opacity="0.9" />

                <ellipse
                  cx={geo.cx}
                  cy={geo.topY}
                  rx={geo.halfW}
                  ry={geo.depthY}
                  fill={palette.topHex}
                  stroke={palette.strokeHex}
                  strokeWidth="1.4"
                />

                {pearls.map((pearl, idx) => (
                  <circle
                    key={`${geo.tierNumber}-pearl-${idx}`}
                    cx={pearl.x}
                    cy={pearl.y}
                    r="3.2"
                    fill={palette.pearlHex}
                    stroke={palette.strokeHex}
                    strokeWidth="0.9"
                  />
                ))}
              </g>
            );
          })}

          {/* Confeitos artesanais e hastes da placa no topo */}
          {topTier && (
            <g>
              <line
                x1={topTier.cx - 24}
                y1={topTier.topY - 2}
                x2={topTier.cx - 24}
                y2={topTier.topY - 18}
                stroke="#8C7F69"
                strokeWidth="1.6"
              />
              <line
                x1={topTier.cx + 24}
                y1={topTier.topY - 2}
                x2={topTier.cx + 24}
                y2={topTier.topY - 18}
                stroke="#8C7F69"
                strokeWidth="1.6"
              />
              {[-28, -14, 0, 14, 28].map((offsetX, idx) => (
                <circle
                  key={`topper-${idx}`}
                  cx={topTier.cx + offsetX}
                  cy={topTier.topY + (idx % 2 === 0 ? 3 : -2)}
                  r="4.5"
                  fill={palette.topperHex}
                  stroke={palette.strokeHex}
                  strokeWidth="1"
                />
              ))}
            </g>
          )}
        </svg>
      </div>

      {/* Ficha resumo de camadas, rendimento em fatias e preco de referencia */}
      <div className="mt-4 rounded-control border border-line bg-sand-100 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">
          {texts.compositionLabel}
        </p>
        <p className="mt-1 text-sm font-medium text-ink">{preset.composition}</p>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3 border-t border-line pt-3">
          <div>
            <span className="block text-xs text-ink-muted">{texts.servingsLabel}</span>
            <span className="text-sm font-bold text-ink">{preset.servings}</span>
          </div>
          <div className="text-right">
            <span className="block text-xs text-ink-muted">{texts.priceLabel}</span>
            <span className="font-serif text-2xl font-bold text-ink">{preset.price}</span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-muted">{texts.customizeHint}</p>
    </div>
  );
}
