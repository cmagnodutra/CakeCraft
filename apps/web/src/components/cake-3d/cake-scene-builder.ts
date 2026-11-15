import * as THREE from 'three';

import type { CakeFormat } from '@/lib/api/orders';

export type CakeRuffleStyle = 'NONE' | 'TOP' | 'SIDES' | 'BOTH';
export type CakeMiniDecoration = 'PEARLS' | 'FLOWERS' | 'ROSETTES';

export const CAKE_RUFFLE_STYLES: readonly CakeRuffleStyle[] = ['NONE', 'TOP', 'SIDES', 'BOTH'];
export const CAKE_MINI_DECORATIONS: readonly CakeMiniDecoration[] = [
  'PEARLS',
  'FLOWERS',
  'ROSETTES',
];

export interface CakeSceneOptions {
  format: CakeFormat;
  floorsCount: number;
  colorHex: string;
  ruffleStyle?: CakeRuffleStyle;
  decorations?: readonly CakeMiniDecoration[];
  dripColorHex?: string;
  pearlColorHex?: string;
  topperColorHex?: string;
  riceImageUrl?: string;
}

const DEFAULT_HEX = '#F3EDE3';
const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function normalizeCakeHex(raw: string): string {
  return HEX_PATTERN.test(raw) ? raw.toUpperCase() : DEFAULT_HEX;
}

function shiftColorLightness(hex: string, deltaL: number, deltaS = 0): THREE.Color {
  const color = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  const nextL = Math.max(0.06, Math.min(0.96, hsl.l + deltaL));
  const nextS = Math.max(0, Math.min(1, hsl.s + deltaS));
  return new THREE.Color().setHSL(hsl.h, nextS, nextL);
}

function createRoundedRectShape(halfW: number, halfD: number, radius: number): THREE.Shape {
  const r = Math.min(radius, halfW * 0.45, halfD * 0.45);
  const shape = new THREE.Shape();
  shape.moveTo(-halfW + r, -halfD);
  shape.lineTo(halfW - r, -halfD);
  shape.quadraticCurveTo(halfW, -halfD, halfW, -halfD + r);
  shape.lineTo(halfW, halfD - r);
  shape.quadraticCurveTo(halfW, halfD, halfW - r, halfD);
  shape.lineTo(-halfW + r, halfD);
  shape.quadraticCurveTo(-halfW, halfD, -halfW, halfD - r);
  shape.lineTo(-halfW, -halfD + r);
  shape.quadraticCurveTo(-halfW, -halfD, -halfW + r, -halfD);
  return shape;
}

function samplePerimeterPoints(
  format: CakeFormat,
  halfW: number,
  halfD: number,
  count: number,
): Array<{ x: number; z: number; nx: number; nz: number }> {
  const points: Array<{ x: number; z: number; nx: number; nz: number }> = [];

  if (format === 'REDONDO') {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const nx = Math.cos(angle);
      const nz = Math.sin(angle);
      points.push({ x: nx * halfW, z: nz * halfD, nx, nz });
    }
    return points;
  }

  const shape = createRoundedRectShape(halfW, halfD, 0.16);
  const spaced = shape.getSpacedPoints(count);
  for (let i = 0; i < count; i++) {
    const pt = spaced[i];
    if (!pt) continue;
    const len = Math.hypot(pt.x, pt.y) || 1;
    points.push({
      x: pt.x,
      z: -pt.y,
      nx: pt.x / len,
      nz: -pt.y / len,
    });
  }
  return points;
}

export function setupCakeStudioLights(scene: THREE.Scene): void {
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.45);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xfaf6f0, 0.75);
  hemiLight.position.set(0, 8, 0);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfffcf7, 0.85);
  keyLight.position.set(4.8, 4.4, 7.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 22;
  keyLight.shadow.camera.left = -4.5;
  keyLight.shadow.camera.right = 4.5;
  keyLight.shadow.camera.top = 5.5;
  keyLight.shadow.camera.bottom = -3.5;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xfffaf2, 0.55);
  rimLight.position.set(-5.2, 3.8, -4.6);
  scene.add(rimLight);

  const fillLight = new THREE.PointLight(0xffffff, 0.55, 18);
  fillLight.position.set(-3.8, 2.4, 6.2);
  scene.add(fillLight);
}

export function buildPorcelainPedestal(): THREE.Group {
  const group = new THREE.Group();

  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.35, 48),
    new THREE.ShadowMaterial({ opacity: 0.14 }),
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = -1.24;
  shadowDisc.receiveShadow = true;
  group.add(shadowDisc);

  const porcelainMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.16,
    metalness: 0.02,
    clearcoat: 0.8,
    clearcoatRoughness: 0.12,
  });

  const profilePoints = [
    new THREE.Vector2(0.0, -1.24),
    new THREE.Vector2(1.02, -1.24),
    new THREE.Vector2(1.06, -1.16),
    new THREE.Vector2(0.86, -1.08),
    new THREE.Vector2(0.36, -0.94),
    new THREE.Vector2(0.28, -0.58),
    new THREE.Vector2(0.38, -0.48),
    new THREE.Vector2(0.29, -0.38),
    new THREE.Vector2(0.48, -0.14),
    new THREE.Vector2(2.02, -0.08),
    new THREE.Vector2(2.14, 0.0),
    new THREE.Vector2(2.08, 0.05),
    new THREE.Vector2(1.94, 0.01),
    new THREE.Vector2(0.0, 0.01),
  ];

  const pedestalMesh = new THREE.Mesh(
    new THREE.LatheGeometry(profilePoints, 64),
    porcelainMaterial,
  );
  pedestalMesh.castShadow = true;
  pedestalMesh.receiveShadow = true;
  group.add(pedestalMesh);

  const goldRim = new THREE.Mesh(
    new THREE.TorusGeometry(2.1, 0.022, 16, 72),
    new THREE.MeshStandardMaterial({
      color: 0xc8a97e,
      roughness: 0.28,
      metalness: 0.62,
    }),
  );
  goldRim.rotation.x = Math.PI / 2;
  goldRim.position.y = 0.02;
  group.add(goldRim);

  return group;
}

interface TierSpec {
  halfW: number;
  halfD: number;
  height: number;
  baseY: number;
}

interface TierDecorationFlags {
  hasTopRuffle: boolean;
  hasSideRuffle: boolean;
  hasPearls: boolean;
}

function buildSingleTierMesh(
  format: CakeFormat,
  spec: TierSpec,
  frostingMaterial: THREE.Material,
  ruffleMaterial: THREE.Material,
  pearlMaterial: THREE.Material,
  flags: TierDecorationFlags,
): THREE.Group {
  const tierGroup = new THREE.Group();

  if (format === 'REDONDO') {
    const bevelR = 0.045;
    const bodyH = spec.height - bevelR;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.halfW, spec.halfW, bodyH, 64, 1),
      frostingMaterial,
    );
    body.position.y = spec.baseY + bodyH / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    tierGroup.add(body);

    const shoulder = new THREE.Mesh(
      new THREE.TorusGeometry(spec.halfW - bevelR, bevelR, 16, 64),
      frostingMaterial,
    );
    shoulder.rotation.x = Math.PI / 2;
    shoulder.position.y = spec.baseY + bodyH;
    shoulder.castShadow = true;
    shoulder.receiveShadow = true;
    tierGroup.add(shoulder);

    // Usa exatamente o mesmo frostingMaterial no topo para garantir tom identico as laterais
    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.halfW - bevelR * 0.8, spec.halfW - bevelR * 0.8, 0.03, 64),
      frostingMaterial,
    );
    topCap.position.y = spec.baseY + spec.height - 0.015;
    topCap.receiveShadow = true;
    tierGroup.add(topCap);
  } else {
    const bevel = 0.045;
    const shape = createRoundedRectShape(spec.halfW - bevel, spec.halfD - bevel, 0.16);
    const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
      depth: spec.height - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 5,
      curveSegments: 16,
    });
    extrudeGeo.rotateX(-Math.PI / 2);

    const boxTier = new THREE.Mesh(extrudeGeo, frostingMaterial);
    boxTier.position.y = spec.baseY + bevel;
    boxTier.castShadow = true;
    boxTier.receiveShadow = true;
    tierGroup.add(boxTier);
  }

  // Decoracao em cima (coroa dupla trancada de bico pitanga na borda superior do andar)
  if (flags.hasTopRuffle) {
    const topCount = Math.max(28, Math.round(spec.halfW * 38));
    const outerPerimeter = samplePerimeterPoints(
      format,
      spec.halfW - 0.018,
      spec.halfD - 0.018,
      topCount,
    );
    const innerPerimeter = samplePerimeterPoints(
      format,
      spec.halfW - 0.075,
      spec.halfD - 0.075,
      topCount,
    );
    const outerShellGeo = new THREE.SphereGeometry(0.052, 12, 10);
    const innerShellGeo = new THREE.SphereGeometry(0.038, 10, 8);

    outerPerimeter.forEach((pt, idx) => {
      const wave = new THREE.Mesh(outerShellGeo, ruffleMaterial);
      const waveLift = idx % 2 === 0 ? 0.032 : 0.018;
      wave.scale.set(1.32, 0.72, 1.32);
      wave.position.set(pt.x, spec.baseY + spec.height + waveLift, pt.z);
      wave.castShadow = true;
      tierGroup.add(wave);
    });

    innerPerimeter.forEach((pt, idx) => {
      const innerWave = new THREE.Mesh(innerShellGeo, pearlMaterial);
      const waveLift = idx % 2 === 0 ? 0.02 : 0.03;
      innerWave.scale.set(1.18, 0.62, 1.18);
      innerWave.position.set(pt.x, spec.baseY + spec.height + waveLift, pt.z);
      innerWave.castShadow = true;
      tierGroup.add(innerWave);
    });
  }

  // Decoracao nas laterais (festoes Lambeth duplos plissados + faixa ondulada + rosetas nos encontros)
  if (flags.hasSideRuffle) {
    const archCount = Math.max(6, Math.round(spec.halfW * 6));
    const samplesPerArch = 10;
    const totalSideSamples = archCount * samplesPerArch;
    const sidePerimeter = samplePerimeterPoints(
      format,
      spec.halfW + 0.016,
      spec.halfD + 0.016,
      totalSideSamples,
    );

    const upperSwagGeo = new THREE.SphereGeometry(0.044, 12, 10);
    const lowerSwagGeo = new THREE.SphereGeometry(0.034, 10, 8);
    const frillBeadGeo = new THREE.SphereGeometry(0.038, 10, 8);
    const knotRosetteGeo = new THREE.SphereGeometry(0.058, 12, 10);
    const knotCenterGeo = new THREE.SphereGeometry(0.032, 10, 8);

    const highY = spec.baseY + spec.height * 0.82;
    const archDrop = spec.height * 0.34;
    const midWaveBaseY = spec.baseY + spec.height * 0.26;

    sidePerimeter.forEach((pt, idx) => {
      const localPhase = ((idx % samplesPerArch) / samplesPerArch) * Math.PI;
      const sag = Math.sin(localPhase);
      const pleatOffset = idx % 2 === 0 ? 0.012 : -0.012;

      // 1. Festao superior plissado em arco (draped Lambeth swag)
      const yUpper = highY - sag * archDrop + pleatOffset;
      const upperPuff = new THREE.Mesh(upperSwagGeo, ruffleMaterial);
      upperPuff.scale.set(1.28, 0.78, 1.28);
      upperPuff.position.set(pt.x + pt.nx * 0.008, yUpper, pt.z + pt.nz * 0.008);
      upperPuff.castShadow = true;
      tierGroup.add(upperPuff);

      // 2. Festao paralelo inferior acompanhando a curvatura
      const yLower = highY - sag * (archDrop * 1.08) - 0.088;
      const lowerPuff = new THREE.Mesh(lowerSwagGeo, pearlMaterial);
      lowerPuff.scale.set(1.15, 0.68, 1.15);
      lowerPuff.position.set(pt.x + pt.nx * 0.012, yLower, pt.z + pt.nz * 0.012);
      lowerPuff.castShadow = true;
      tierGroup.add(lowerPuff);

      // 3. Faixa de decoracao sinuosa continua na parte inferior-media da lateral
      const rippleY =
        midWaveBaseY + Math.sin((idx / totalSideSamples) * archCount * Math.PI * 2) * 0.038;
      const frillBead = new THREE.Mesh(frillBeadGeo, ruffleMaterial);
      frillBead.scale.set(1.22, 0.66, 1.22);
      frillBead.position.set(pt.x + pt.nx * 0.006, rippleY, pt.z + pt.nz * 0.006);
      frillBead.castShadow = true;
      tierGroup.add(frillBead);

      // 4. Roseta com perola central em cada vertice de encontro dos festoes
      if (idx % samplesPerArch === 0) {
        const knot = new THREE.Mesh(knotRosetteGeo, ruffleMaterial);
        knot.scale.set(1.1, 1.1, 1.1);
        knot.position.set(pt.x + pt.nx * 0.018, highY + 0.01, pt.z + pt.nz * 0.018);
        knot.castShadow = true;
        tierGroup.add(knot);

        const knotPearl = new THREE.Mesh(knotCenterGeo, pearlMaterial);
        knotPearl.position.set(pt.x + pt.nx * 0.042, highY + 0.01, pt.z + pt.nz * 0.042);
        knotPearl.castShadow = true;
        tierGroup.add(knotPearl);
      }
    });
  }

  // Mini decoracao: colar de perolas de confeitaria na base do andar
  if (flags.hasPearls) {
    const pearlCount = Math.max(18, Math.round(spec.halfW * 28));
    const pearlPerimeter = samplePerimeterPoints(
      format,
      spec.halfW + 0.032,
      spec.halfD + 0.032,
      pearlCount,
    );
    const pearlGeo = new THREE.SphereGeometry(0.044, 14, 12);

    for (const pt of pearlPerimeter) {
      const pearl = new THREE.Mesh(pearlGeo, pearlMaterial);
      pearl.scale.set(1, 0.82, 1);
      pearl.position.set(pt.x, spec.baseY + 0.034, pt.z);
      pearl.castShadow = true;
      tierGroup.add(pearl);
    }
  }

  return tierGroup;
}

function buildFlowerCluster(
  x: number,
  y: number,
  z: number,
  petalMaterial: THREE.Material,
  centerMaterial: THREE.Material,
): THREE.Group {
  const flowerGroup = new THREE.Group();
  flowerGroup.position.set(x, y, z);

  const petalGeo = new THREE.SphereGeometry(0.042, 12, 10);
  const petalCount = 5;
  const petalRadius = 0.046;

  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeo, petalMaterial);
    petal.scale.set(1.15, 0.48, 1.15);
    petal.position.set(Math.cos(angle) * petalRadius, 0, Math.sin(angle) * petalRadius);
    petal.castShadow = true;
    flowerGroup.add(petal);
  }

  const centerGeo = new THREE.SphereGeometry(0.032, 12, 10);
  const center = new THREE.Mesh(centerGeo, centerMaterial);
  center.position.y = 0.018;
  center.castShadow = true;
  flowerGroup.add(center);

  return flowerGroup;
}

function addTopDecorations(
  parent: THREE.Group,
  format: CakeFormat,
  topSpec: TierSpec,
  topY: number,
  topperMaterial: THREE.Material,
  pearlMaterial: THREE.Material,
  options: {
    hasFlowers: boolean;
    hasRosettes: boolean;
    riceImageUrl?: string;
  },
): void {
  // Mini decoracao: flores de acucar modeladas em 3D no topo
  if (options.hasFlowers) {
    const flowerPoints = samplePerimeterPoints(
      format,
      topSpec.halfW * 0.68,
      topSpec.halfD * 0.68,
      8,
    );
    for (const pt of flowerPoints) {
      const flower = buildFlowerCluster(pt.x, topY + 0.024, pt.z, pearlMaterial, topperMaterial);
      parent.add(flower);
    }
  }

  // Mini decoracao: rosetas e trufas artesanais na coroa do ultimo andar
  if (options.hasRosettes) {
    const crownPoints = samplePerimeterPoints(
      format,
      topSpec.halfW * 0.78,
      topSpec.halfD * 0.78,
      10,
    );
    const rosetteGeo = new THREE.SphereGeometry(0.068, 16, 14);
    const berryGeo = new THREE.SphereGeometry(0.048, 14, 12);

    crownPoints.forEach((pt, idx) => {
      const rosette = new THREE.Mesh(rosetteGeo, pearlMaterial);
      rosette.scale.set(1, 0.68, 1);
      rosette.position.set(pt.x, topY + 0.035, pt.z);
      rosette.castShadow = true;
      parent.add(rosette);

      if (idx % 2 === 0) {
        const berry = new THREE.Mesh(berryGeo, topperMaterial);
        berry.position.set(pt.x, topY + 0.09, pt.z);
        berry.castShadow = true;
        parent.add(berry);
      }
    });
  }

  // Disco comestivel de papel de arroz no topo (RF05)
  if (options.riceImageUrl) {
    const waferRadius = Math.min(topSpec.halfW, topSpec.halfD) * 0.54;
    const waferMat = new THREE.MeshStandardMaterial({
      color: 0xfffdf8,
      roughness: 0.45,
      metalness: 0.0,
    });
    const waferMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(waferRadius, waferRadius, 0.018, 48),
      waferMat,
    );
    waferMesh.position.y = topY + 0.014;
    parent.add(waferMesh);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      options.riceImageUrl,
      (loadedTex) => {
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        waferMat.map = loadedTex;
        waferMat.needsUpdate = true;
      },
      undefined,
      () => {
        // Mantem o disco de papel de arroz marfim caso a URL externa nao permita CORS.
      },
    );
  }
}

export function buildCakeModelGroup(options: CakeSceneOptions): THREE.Group {
  const root = new THREE.Group();
  const safeFloors = Math.max(1, Math.min(4, Math.round(options.floorsCount)));
  const baseHex = normalizeCakeHex(options.colorHex);
  const baseColor = new THREE.Color(baseHex);

  const baseHsl = { h: 0, s: 0, l: 0 };
  baseColor.getHSL(baseHsl);

  const ruffleColor = options.dripColorHex
    ? new THREE.Color(options.dripColorHex)
    : shiftColorLightness(baseHex, baseHsl.l > 0.65 ? -0.14 : 0.18, 0.05);

  const pearlColor = options.pearlColorHex
    ? new THREE.Color(options.pearlColorHex)
    : shiftColorLightness(baseHex, baseHsl.l > 0.8 ? -0.06 : 0.28, -0.08);

  const topperColor = options.topperColorHex
    ? new THREE.Color(options.topperColorHex)
    : shiftColorLightness(baseHex, baseHsl.l > 0.5 ? -0.28 : 0.26, 0.14);

  const frostingMaterial = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.65,
    metalness: 0.0,
  });

  const ruffleMaterial = new THREE.MeshPhysicalMaterial({
    color: ruffleColor,
    roughness: 0.22,
    metalness: 0.02,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
  });

  const pearlMaterial = new THREE.MeshPhysicalMaterial({
    color: pearlColor,
    roughness: 0.28,
    metalness: 0.02,
    clearcoat: 0.35,
  });

  const topperMaterial = new THREE.MeshPhysicalMaterial({
    color: topperColor,
    roughness: 0.24,
    metalness: 0.04,
    clearcoat: 0.55,
  });

  const ruffleStyle: CakeRuffleStyle = options.ruffleStyle ?? 'NONE';
  const decorations = new Set<CakeMiniDecoration>(options.decorations ?? []);

  const tierFlags: TierDecorationFlags = {
    hasTopRuffle: ruffleStyle === 'TOP' || ruffleStyle === 'BOTH',
    hasSideRuffle: ruffleStyle === 'SIDES' || ruffleStyle === 'BOTH',
    hasPearls: decorations.has('PEARLS'),
  };

  const tierHeight = safeFloors >= 4 ? 0.58 : 0.68;
  let currentY = 0.01;
  let lastSpec: TierSpec | undefined;

  for (let i = 0; i < safeFloors; i++) {
    const scale = 1 - i * 0.21;
    const baseHalfW = options.format === 'RETANGULAR' ? 1.58 : 1.38;
    const baseHalfD = options.format === 'RETANGULAR' ? 1.12 : 1.38;

    const spec: TierSpec = {
      halfW: baseHalfW * scale,
      halfD: baseHalfD * scale,
      height: tierHeight,
      baseY: currentY,
    };

    const tierMesh = buildSingleTierMesh(
      options.format,
      spec,
      frostingMaterial,
      ruffleMaterial,
      pearlMaterial,
      tierFlags,
    );
    root.add(tierMesh);

    currentY += tierHeight - 0.02;
    lastSpec = spec;
  }

  if (lastSpec) {
    addTopDecorations(
      root,
      options.format,
      lastSpec,
      currentY,
      topperMaterial,
      pearlMaterial,
      {
        hasFlowers: decorations.has('FLOWERS'),
        hasRosettes: decorations.has('ROSETTES'),
        riceImageUrl: options.riceImageUrl,
      },
    );
  }

  return root;
}

export function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Sprite) {
      child.material.map?.dispose();
      child.material.dispose();
      return;
    }
    if (child instanceof THREE.Mesh) {
      const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
      mesh.geometry.dispose();
      const materials: THREE.Material[] = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const mat of materials) {
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.map?.dispose();
        }
        mat.dispose();
      }
    }
  });
}
