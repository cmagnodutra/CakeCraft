'use client';

import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';

import type { CakeFormat } from '@/lib/api/orders';

import {
  buildCakeModelGroup,
  buildPorcelainPedestal,
  disposeObject3D,
  setupCakeStudioLights,
} from './cake-scene-builder';

export interface WebGLRendererAdapter {
  setPixelRatio(value: number): void;
  shadowMap: { enabled: boolean; type: THREE.ShadowMapType };
  toneMapping: THREE.ToneMapping;
  toneMappingExposure: number;
  outputColorSpace: string;
  setSize(width: number, height: number, updateStyle?: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}

export interface CakeCanvas3DProps {
  format: CakeFormat;
  floorsCount: number;
  colorHex: string;
  dripColorHex?: string;
  pearlColorHex?: string;
  topperColorHex?: string;
  riceImageUrl?: string;
  angleDegrees?: number;
  onAngleChange?: (degrees: number) => void;
  autoRotate?: boolean;
  ariaLabel: string;
  tierTestIdPrefix?: string;
  className?: string;
  rendererFactory?: (canvas: HTMLCanvasElement) => WebGLRendererAdapter | null;
}

function defaultRendererFactory(canvas: HTMLCanvasElement): WebGLRendererAdapter | null {
  if (!isWebGLSupportedInEnvironment()) {
    return null;
  }
  try {
    return new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }
}

function normalizeDegrees(deg: number): number {
  let wrapped = Math.round(deg) % 360;
  if (wrapped > 180) wrapped -= 360;
  if (wrapped < -180) wrapped += 360;
  return Object.is(wrapped, -0) ? 0 : wrapped;
}

function isWebGLSupportedInEnvironment(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  if (navigator.userAgent.toLowerCase().includes('jsdom')) {
    return false;
  }
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function CakeCanvas3D({
  format,
  floorsCount,
  colorHex,
  dripColorHex,
  pearlColorHex,
  topperColorHex,
  riceImageUrl,
  angleDegrees = 0,
  onAngleChange,
  autoRotate = false,
  ariaLabel,
  tierTestIdPrefix = 'cake-tier',
  className = 'h-64 w-full sm:h-72',
  rendererFactory = defaultRendererFactory,
}: CakeCanvas3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const turntableRef = useRef<THREE.Group | null>(null);
  const cakeGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const targetYawRef = useRef<number>((angleDegrees * Math.PI) / 180);
  const currentYawRef = useRef<number>((angleDegrees * Math.PI) / 180);
  const targetPitchRef = useRef<number>(0.36);
  const currentPitchRef = useRef<number>(0.36);
  const cameraDistanceRef = useRef<number>(5.8);
  const lookAtYRef = useRef<number>(0.45);

  const draggingRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const autoRotateRef = useRef(autoRotate);
  const onAngleChangeRef = useRef(onAngleChange);
  const rendererFactoryRef = useRef(rendererFactory);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    onAngleChangeRef.current = onAngleChange;
  }, [onAngleChange]);

  // Sincroniza rotacao externa quando os botoes Girar/Centralizar sao clicados
  useEffect(() => {
    if (!draggingRef.current) {
      targetYawRef.current = (angleDegrees * Math.PI) / 180;
    }
  }, [angleDegrees]);

  // Inicializa cena WebGL Three.js uma unica vez por montagem
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) {
      return;
    }

    const renderer = rendererFactoryRef.current(canvas);
    if (!renderer) {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    setupCakeStudioLights(scene);

    const width = Math.max(container.clientWidth, 280);
    const height = Math.max(container.clientHeight, 240);
    renderer.setSize(width, height, false);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
    cameraRef.current = camera;

    const turntable = new THREE.Group();
    const pedestal = buildPorcelainPedestal();
    turntable.add(pedestal);
    scene.add(turntable);
    turntableRef.current = turntable;

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let prevTime = performance.now();

    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - prevTime) / 1000);
      prevTime = now;

      if (autoRotateRef.current && !draggingRef.current && !prefersReducedMotion) {
        targetYawRef.current += dt * 0.32;
      }

      const smoothing = 1 - Math.exp(-10 * dt);
      currentYawRef.current += (targetYawRef.current - currentYawRef.current) * smoothing;
      currentPitchRef.current += (targetPitchRef.current - currentPitchRef.current) * smoothing;

      turntable.rotation.y = currentYawRef.current;

      const dist = cameraDistanceRef.current;
      const pitch = currentPitchRef.current;
      const lookY = lookAtYRef.current;
      camera.position.set(0, lookY + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
      camera.lookAt(0, lookY, 0);

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const nextW = Math.max(Math.round(entry.contentRect.width), 200);
        const nextH = Math.max(Math.round(entry.contentRect.height), 200);
        renderer.setSize(nextW, nextH, false);
        camera.aspect = nextW / nextH;
        camera.updateProjectionMatrix();
      });
      resizeObserver.observe(container);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      if (cakeGroupRef.current) {
        turntable.remove(cakeGroupRef.current);
        disposeObject3D(cakeGroupRef.current);
        cakeGroupRef.current = null;
      }
      disposeObject3D(pedestal);
      renderer.dispose();
      turntableRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  // Reconstroi a malha 3D das camadas quando formato, andares, cores ou papel de arroz mudam
  useEffect(() => {
    const turntable = turntableRef.current;
    const safeFloors = Math.max(1, Math.min(4, Math.round(floorsCount)));

    cameraDistanceRef.current = 5.25 + (safeFloors - 1) * 0.45;
    lookAtYRef.current = 0.1 + (safeFloors - 1) * 0.26;

    if (!turntable) {
      return;
    }

    if (cakeGroupRef.current) {
      turntable.remove(cakeGroupRef.current);
      disposeObject3D(cakeGroupRef.current);
      cakeGroupRef.current = null;
    }

    const nextCakeGroup = buildCakeModelGroup({
      format,
      floorsCount: safeFloors,
      colorHex,
      dripColorHex,
      pearlColorHex,
      topperColorHex,
      riceImageUrl,
    });
    turntable.add(nextCakeGroup);
    cakeGroupRef.current = nextCakeGroup;
  }, [format, floorsCount, colorHex, dripColorHex, pearlColorHex, topperColorHex, riceImageUrl]);

  const safeFloors = Math.max(1, Math.min(4, Math.round(floorsCount)));
  const tierNumbers = Array.from({ length: safeFloors }, (_, index) => index + 1);

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    draggingRef.current = true;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignora em ambientes sinteticos sem suporte a pointer capture.
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!draggingRef.current) {
      return;
    }
    const dx = event.clientX - lastPointerRef.current.x;
    const dy = event.clientY - lastPointerRef.current.y;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };

    targetYawRef.current += dx * 0.012;
    targetPitchRef.current = Math.max(0.14, Math.min(0.78, targetPitchRef.current + dy * 0.006));

    const nextDeg = normalizeDegrees((targetYawRef.current * 180) / Math.PI);
    onAngleChangeRef.current?.(nextDeg);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!draggingRef.current) {
      return;
    }
    draggingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Sem acao necessaria.
    }
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={`relative select-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
      />
      <span className="sr-only">
        {tierNumbers.map((tierNumber) => (
          <span key={tierNumber} data-testid={`${tierTestIdPrefix}-${tierNumber}`} />
        ))}
      </span>
    </div>
  );
}
