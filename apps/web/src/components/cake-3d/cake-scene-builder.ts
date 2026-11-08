import * as THREE from 'three';

import type { CakeFormat } from '@/lib/api/orders';

export interface CakeSceneOptions {
  format: CakeFormat;
  floorsCount: number;
  colorHex: string;
  dripColorHex?: string;
  pearlColorHex?: string;
  topperColorHex?: string;
  toppingMessage?: string;
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

function createTopperPlaqueTexture(text: string): THREE.CanvasTexture | null {
  if (
    typeof document === 'undefined' ||
    (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('jsdom'))
  ) {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.fillStyle = '#FFFDF9';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#C8A97E';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  ctx.strokeStyle = '#E5DCCB';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  const trimmed = text.length > 28 ? `${text.slice(0, 27)}…` : text;
  ctx.fillStyle = '#1B1814';
  ctx.font = 'italic 600 32px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(trimmed, canvas.width / 2, canvas.height / 2 + 2, canvas.width - 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function setupCakeStudioLights(scene: THREE.Scene): void {
  const hemiLight = new THREE.HemisphereLight(0xfffdf9, 0xe6dccb, 1.35);
  hemiLight.position.set(0, 8, 0);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff9f0, 1.75);
  keyLight.position.set(5.2, 8.4, 6.0);
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

  const rimLight = new THREE.DirectionalLight(0xf5e9da, 0.85);
  rimLight.position.set(-5.4, 5.2, -4.6);
  scene.add(rimLight);

  const fillLight = new THREE.PointLight(0xfff6eb, 0.65, 16);
  fillLight.position.set(-2.2, 3.0, 5.2);
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

function buildSingleTierMesh(
  format: CakeFormat,
  spec: TierSpec,
  frostingMaterial: THREE.Material,
  glazeMaterial: THREE.Material,
  pearlMaterial: THREE.Material,
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

    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.halfW - bevelR * 0.8, spec.halfW - bevelR * 0.8, 0.03, 64),
      glazeMaterial,
    );
    topCap.position.y = spec.baseY + spec.height - 0.01;
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

    const glazeShape = createRoundedRectShape(spec.halfW - 0.05, spec.halfD - 0.05, 0.14);
    const glazeGeo = new THREE.ExtrudeGeometry(glazeShape, {
      depth: 0.022,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 3,
      curveSegments: 12,
    });
    glazeGeo.rotateX(-Math.PI / 2);

    const glazeCap = new THREE.Mesh(glazeGeo, glazeMaterial);
    glazeCap.position.y = spec.baseY + spec.height - 0.018;
    glazeCap.receiveShadow = true;
    tierGroup.add(glazeCap);
  }

  // Gotas organicas de calda escorrendo pela borda superior
  const dripCount = Math.max(10, Math.round(spec.halfW * 16));
  const dripPerimeter = samplePerimeterPoints(
    format,
    spec.halfW + 0.008,
    spec.halfD + 0.008,
    dripCount,
  );
  const dripLengths = [0.16, 0.28, 0.12, 0.22, 0.33, 0.15, 0.25];

  dripPerimeter.forEach((pt, idx) => {
    const dropLen = dripLengths[idx % dripLengths.length] * (spec.height / 0.72);
    const dropGeo = new THREE.CapsuleGeometry(0.026, dropLen, 6, 10);
    const dropMesh = new THREE.Mesh(dropGeo, glazeMaterial);
    dropMesh.position.set(pt.x, spec.baseY + spec.height - dropLen / 2 - 0.05, pt.z);
    tierGroup.add(dropMesh);
  });

  // Colar de perolas de confeitaria na base do andar
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

  return tierGroup;
}

function addTopDecorations(
  parent: THREE.Group,
  format: CakeFormat,
  topSpec: TierSpec,
  topY: number,
  topperMaterial: THREE.Material,
  pearlMaterial: THREE.Material,
  toppingMessage?: string,
  riceImageUrl?: string,
): void {
  // Rosetas e trufas artesanais na coroa do ultimo andar
  const crownPoints = samplePerimeterPoints(format, topSpec.halfW * 0.76, topSpec.halfD * 0.76, 10);
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

  // Disco comestivel de papel de arroz no topo (RF05)
  if (riceImageUrl) {
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
      riceImageUrl,
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

  // Placa comemorativa 3D com hastes douradas quando houver frase de topo
  const trimmed = toppingMessage?.trim() ?? '';
  if (trimmed.length > 0) {
    const plaqueTex = createTopperPlaqueTexture(trimmed);
    const stickMat = new THREE.MeshStandardMaterial({
      color: 0xc8a97e,
      roughness: 0.3,
      metalness: 0.7,
    });

    for (const offsetX of [-0.36, 0.36]) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.44, 12), stickMat);
      stick.position.set(offsetX, topY + 0.2, 0);
      stick.castShadow = true;
      parent.add(stick);
    }

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xfaf7f2,
      roughness: 0.35,
      metalness: 0.08,
    });
    const frontMat = plaqueTex
      ? new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.32 })
      : frameMat;

    const plaqueMesh = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.42, 0.036), [
      frameMat,
      frameMat,
      frameMat,
      frameMat,
      frontMat,
      frontMat,
    ]);
    plaqueMesh.position.set(0, topY + 0.46, 0);
    plaqueMesh.castShadow = true;
    parent.add(plaqueMesh);
  }
}

export function buildCakeModelGroup(options: CakeSceneOptions): THREE.Group {
  const root = new THREE.Group();
  const safeFloors = Math.max(1, Math.min(4, Math.round(options.floorsCount)));
  const baseHex = normalizeCakeHex(options.colorHex);
  const baseColor = new THREE.Color(baseHex);

  const baseHsl = { h: 0, s: 0, l: 0 };
  baseColor.getHSL(baseHsl);

  const glazeColor = options.dripColorHex
    ? new THREE.Color(options.dripColorHex)
    : shiftColorLightness(baseHex, baseHsl.l > 0.65 ? -0.14 : 0.18, 0.05);

  const pearlColor = options.pearlColorHex
    ? new THREE.Color(options.pearlColorHex)
    : shiftColorLightness(baseHex, baseHsl.l > 0.8 ? -0.06 : 0.28, -0.08);

  const topperColor = options.topperColorHex
    ? new THREE.Color(options.topperColorHex)
    : shiftColorLightness(baseHex, baseHsl.l > 0.5 ? -0.28 : 0.26, 0.14);

  const frostingMaterial = new THREE.MeshPhysicalMaterial({
    color: baseColor,
    roughness: 0.44,
    metalness: 0.0,
    sheen: 0.35,
    sheenRoughness: 0.6,
    clearcoat: 0.08,
    clearcoatRoughness: 0.42,
  });

  const glazeMaterial = new THREE.MeshPhysicalMaterial({
    color: glazeColor,
    roughness: 0.16,
    metalness: 0.02,
    clearcoat: 0.88,
    clearcoatRoughness: 0.12,
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
      glazeMaterial,
      pearlMaterial,
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
      options.toppingMessage,
      options.riceImageUrl,
    );
  }

  return root;
}

export function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
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
