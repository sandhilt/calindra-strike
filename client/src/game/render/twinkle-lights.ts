import { strandBulbs, strandPoint, TICK_RATE, type TwinkleStrand } from '@calindra-strike/shared';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { twinkleLevel } from './prop-motion.ts';
import type { PropContext, PropGroup } from './props.ts';
import type { QualityProfile } from './quality.ts';

const BULB_COLORS = [0xff364a, 0xffc450, 0x52ff83, 0x559aff, 0xffeed5];
const BULB_RADIUS_UNITS = 2.6;
const GLOW_SIZE_UNITS = 32;
const GLOW_TEXTURE_PIXELS = 32;
const WIRE_SEGMENTS = 16;
const WIRE_RADIUS_UNITS = 0.5;
const WIRE_SIDES = 4;

function glowTexture(): THREE.DataTexture {
  const size = GLOW_TEXTURE_PIXELS;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot((x + 0.5) * 2 / size - 1, (y + 0.5) * 2 / size - 1);
      const offset = (y * size + x) * 4;
      pixels.fill(255, offset, offset + 3);
      pixels[offset + 3] = Math.round(255 * Math.max(0, 1 - radius) ** 2);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function buildLightMeshes(strands: readonly TwinkleStrand[]) {
  const positions = strands.flatMap(strandBulbs);
  const levels = new THREE.InstancedBufferAttribute(new Float32Array(positions.length), 1).setUsage(THREE.DynamicDrawUsage);
  const pointLevels = new THREE.BufferAttribute(levels.array, 1).setUsage(THREE.DynamicDrawUsage);
  const bulbGeometry = new THREE.OctahedronGeometry(BULB_RADIUS_UNITS);
  bulbGeometry.setAttribute('twinkle', levels);
  const bulbMaterial = new THREE.MeshStandardMaterial({ emissive: 0xffffff, roughness: 0.65 });
  bulbMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float twinkle; varying float vTwinkle;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTwinkle = twinkle;');
    shader.fragmentShader = 'varying float vTwinkle;\n' + shader.fragmentShader
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vColor.rgb * (0.06 + 2.0 * vTwinkle);');
  };
  const bulbs = new THREE.InstancedMesh(bulbGeometry, bulbMaterial, positions.length);

  const glowGeometry = new THREE.BufferGeometry();
  const glowPositions = new Float32Array(positions.length * 3);
  const glowColors = new Float32Array(positions.length * 3);
  const color = new THREE.Color();
  const matrix = new THREE.Matrix4();
  positions.forEach(({ x, y, z }, index) => {
    color.setHex(BULB_COLORS[index % BULB_COLORS.length]);
    bulbs.setColorAt(index, color);
    bulbs.setMatrixAt(index, matrix.makeTranslation(x, y, z));
    glowPositions.set([x, y, z], index * 3);
    color.toArray(glowColors, index * 3);
  });
  glowGeometry.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3));
  glowGeometry.setAttribute('color', new THREE.BufferAttribute(glowColors, 3));
  glowGeometry.setAttribute('twinkle', pointLevels);
  const texture = glowTexture();
  const glowMaterial = new THREE.PointsMaterial({
    map: texture, size: GLOW_SIZE_UNITS, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
  });
  glowMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float twinkle; varying float vTwinkle;\n' + shader.vertexShader
      .replace('gl_PointSize = size;', 'vTwinkle = twinkle;\ngl_PointSize = size * (0.45 + 0.55 * twinkle);');
    shader.fragmentShader = 'varying float vTwinkle;\n' + shader.fragmentShader
      .replace('#include <alphatest_fragment>', 'diffuseColor.a *= vTwinkle;\n#include <alphatest_fragment>');
  };
  const glow = new THREE.Points(glowGeometry, glowMaterial);

  const wires = strands.map((strand) => {
    const start = strandPoint(strand, 0);
    const mid = strandPoint(strand, 0.5);
    const end = strandPoint(strand, 1);
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(start.x, start.y, start.z),
      new THREE.Vector3(mid.x, mid.y - strand.sag, mid.z),
      new THREE.Vector3(end.x, end.y, end.z),
    );
    return new THREE.TubeGeometry(curve, WIRE_SEGMENTS, WIRE_RADIUS_UNITS, WIRE_SIDES);
  });
  const wireGeometry = mergeGeometries(wires);
  for (const wire of wires) wire.dispose();
  const wireMaterial = new THREE.MeshBasicMaterial({ color: 0x244234 });
  const wire = new THREE.Mesh(wireGeometry, wireMaterial);
  const object = new THREE.Group().add(wire, bulbs, glow);

  return {
    object,
    update(serverTick: number) {
      const seconds = serverTick / TICK_RATE;
      for (let i = 0; i < levels.count; i++) levels.setX(i, twinkleLevel(i, seconds));
      levels.needsUpdate = true;
      pointLevels.needsUpdate = true;
    },
    dispose() {
      object.removeFromParent();
      bulbs.dispose();
      bulbGeometry.dispose();
      bulbMaterial.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      texture.dispose();
      wireGeometry.dispose();
      wireMaterial.dispose();
    },
  };
}

export function buildTwinkleLights(strands: readonly TwinkleStrand[], { profile }: PropContext): PropGroup | null {
  if (strands.length === 0) return null;
  const object = new THREE.Group();
  let lights: ReturnType<typeof buildLightMeshes> | undefined;
  function setQuality(next: QualityProfile): void {
    if (next.twinkleLights && !lights) {
      lights = buildLightMeshes(strands);
      object.add(lights.object);
    } else if (!next.twinkleLights && lights) {
      lights.dispose();
      lights = undefined;
    }
  }
  setQuality(profile);
  return { object, setQuality, update(_dt, serverTick) { lights?.update(serverTick); } };
}
