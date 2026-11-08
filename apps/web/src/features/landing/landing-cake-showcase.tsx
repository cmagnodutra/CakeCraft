'use client';

import { useState } from 'react';

import { CakeCanvas3D } from '@/components/cake-3d/cake-canvas-3d';
import { messages } from '@/content/messages';
import type { CakeFormat } from '@/lib/api/orders';

type PresetKey = keyof typeof messages.landing.showcase.presets;

interface PaletteConfig {
  key: PresetKey;
  format: CakeFormat;
  swatchHex: string;
  colorHex: string;
  dripColorHex: string;
  pearlColorHex: string;
  topperColorHex: string;
}

const PALETTES: readonly PaletteConfig[] = [
  {
    key: 'rose',
    format: 'REDONDO',
    swatchHex: '#E8B4B8',
    colorHex: '#E8B4B8',
    dripColorHex: '#A64B56',
    pearlColorHex: '#FAF7F2',
    topperColorHex: '#9A2B1E',
  },
  {
    key: 'pistachio',
    format: 'REDONDO',
    swatchHex: '#BFD8C4',
    colorHex: '#BFD8C4',
    dripColorHex: '#FAF7F2',
    pearlColorHex: '#F3EDE3',
    topperColorHex: '#5E7A64',
  },
  {
    key: 'cocoa',
    format: 'QUADRADO',
    swatchHex: '#6B4423',
    colorHex: '#6B4423',
    dripColorHex: '#C89258',
    pearlColorHex: '#E8DFCF',
    topperColorHex: '#C8A27C',
  },
];

export function LandingCakeShowcase() {
  const [selectedKey, setSelectedKey] = useState<PresetKey>('rose');

  const texts = messages.landing.showcase;
  const palette = PALETTES.find((item) => item.key === selectedKey) ?? PALETTES[0];
  const preset = texts.presets[palette.key];

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

      {/* Palco 3D WebGL em tempo real (Three.js) com rotacao livre e giro suave */}
      <div className="mt-4 flex flex-col items-center rounded-control border border-line bg-paper px-3 pt-4 pb-3">
        <div className="mb-1 max-w-xs truncate rounded-control border border-line-strong bg-surface px-3.5 py-1 font-serif text-sm italic text-ink shadow-xs">
          {preset.plaque}
        </div>

        <CakeCanvas3D
          format={palette.format}
          floorsCount={preset.floors}
          colorHex={palette.colorHex}
          dripColorHex={palette.dripColorHex}
          pearlColorHex={palette.pearlColorHex}
          topperColorHex={palette.topperColorHex}
          autoRotate
          ariaLabel={texts.figureAriaLabel(preset.label, preset.floors)}
          tierTestIdPrefix="landing-cake-tier"
          className="h-64 w-full sm:h-72"
        />

        <p className="mt-1 text-center text-xs text-ink-muted">{texts.dragHint}</p>
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
