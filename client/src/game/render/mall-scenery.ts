import {
  RECYCLE_BIN_DEPTH_UNITS, RECYCLE_BIN_HEIGHT_UNITS, RECYCLE_BIN_WIDTH_UNITS,
  SALE_EASEL_DEPTH_UNITS, SALE_EASEL_WIDTH_UNITS, SALE_SLOT_MS, TICK_MS, saleOn, type MapProp,
} from '@calindra-strike/shared';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { drawBlackFridayRibbon } from '../laptop/draw.ts';
import type { Parts } from './prop-parts.ts';
import type { PropGroup } from './props.ts';
import { canvasTexture } from './textures.ts';

type Easel = Extract<MapProp, { kind: 'saleEasel' }>;
type Ribbon = Extract<MapProp, { kind: 'saleRibbon' }>;
type Bin = Extract<MapProp, { kind: 'recycleBin' }>;

const EASEL_PANEL_HEIGHT = 40;
const EASEL_FRAME = 0x242126;
const BIN_WOOD = 0x97643c;
const BIN_STEEL = 0xb8c0c7;
const BIN_INTERIOR = 0x262723;

function printedMesh(planes: THREE.PlaneGeometry[], texture: THREE.CanvasTexture): THREE.Mesh {
  const geometry = mergeGeometries(planes);
  for (const plane of planes) plane.dispose();
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide }));
}

function label(ctx: CanvasRenderingContext2D, text: string, y: number, size: number, color: string, x = 64): void {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function atlasRow(plane: THREE.PlaneGeometry, row: number, rows: number): void {
  const uv = plane.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (row + 1 - (0.02 + 0.96 * uv.getY(i))) / rows);
}

export function buildSaleEasels(items: readonly Easel[], statics: Parts): THREE.Mesh | null {
  if (!items.length) return null;
  const percents = [...new Set(items.map(({ percent }) => percent))];
  const texture = canvasTexture(128, (ctx) => {
    percents.forEach((percent, row) => {
      ctx.save();
      ctx.translate(0, row * 128);
      ctx.fillStyle = '#8d1225';
      ctx.fillRect(0, 0, 128, 128);
      label(ctx, 'PROMOÇÃO', 37, 17, '#fff3db');
      label(ctx, `-${percent}%`, 92, 43, '#ffffff');
      ctx.restore();
    });
  }, false, 128, 128 * percents.length);

  const planes: THREE.PlaneGeometry[] = [];
  const halfSpread = SALE_EASEL_DEPTH_UNITS / 2 - 1;
  const angle = Math.asin(halfSpread / EASEL_PANEL_HEIGHT);
  const middleY = Math.cos(angle) * EASEL_PANEL_HEIGHT / 2 + Math.sin(angle);
  for (const { x, y, z, yaw, percent } of items) {
    statics.at(x, y, z, yaw);
    for (const side of [-1, 1]) {
      const tilt = -side * angle;
      const middleZ = side * halfSpread / 2;
      statics.box(SALE_EASEL_WIDTH_UNITS, EASEL_PANEL_HEIGHT, 2, EASEL_FRAME,
        { x: 0, y: middleY, z: middleZ, rot: [tilt, 0, 0] });
      const plane = new THREE.PlaneGeometry(28, 32);
      atlasRow(plane, percents.indexOf(percent), percents.length);
      if (side < 0) plane.rotateY(Math.PI);
      plane.rotateX(tilt);
      plane.translate(0, middleY, middleZ + side * 1.1);
      plane.rotateY(yaw);
      plane.translate(x, y, z);
      planes.push(plane);
    }
  }
  return printedMesh(planes, texture);
}

export function buildRecycleBins(items: readonly Bin[], statics: Parts): THREE.Mesh | null {
  if (!items.length) return null;
  const texture = canvasTexture(128, (ctx) => {
    ctx.fillStyle = '#cbd2d9';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ecf0f3';
    ctx.fillRect(0, 0, 128, 5);
    ctx.fillRect(0, 64, 128, 5);
    label(ctx, 'ORGÂNICO', 29, 19, '#262723');
    label(ctx, 'SOBRA DE ALIMENTOS', 49, 10, '#34362e');
    label(ctx, '♻', 86, 22, '#13653b', 17);
    label(ctx, 'RECICLÁVEL', 87, 15, '#20382b', 76);
    label(ctx, 'PAPEL', 110, 8, '#144b97', 17);
    label(ctx, 'PLÁSTICO', 110, 8, '#9e2027', 49);
    label(ctx, 'METAL', 110, 8, '#775400', 83);
    label(ctx, 'VIDRO', 110, 8, '#13653b', 113);
  }, false);
  const planes: THREE.PlaneGeometry[] = [];
  const width = RECYCLE_BIN_WIDTH_UNITS;
  const depth = RECYCLE_BIN_DEPTH_UNITS;
  const height = RECYCLE_BIN_HEIGHT_UNITS;
  const lidY = height - 5;
  for (const { x, y, z, yaw } of items) {
    statics.at(x, y, z, yaw);
    statics.box(width, 28, depth, BIN_WOOD, { x: 0, y: 16, z: 0 });
    statics.box(width, 2, depth, BIN_STEEL, { x: 0, y: 1, z: 0 });
    statics.box(width - 2, 1, depth - 2, BIN_INTERIOR, { x: 0, y: 30.5, z: 0 });
    for (const side of [-1, 1]) {
      statics.box(width, 12, 6, BIN_WOOD, { x: 0, y: 36, z: side * (depth / 2 - 3) });
      statics.box(width, 2, 7, BIN_STEEL, { x: 0, y: lidY, z: side * (depth / 2 - 3.5) });
      statics.box(3, 12, depth - 12, BIN_WOOD, { x: side * (width / 2 - 1.5), y: 36, z: 0 });
      statics.box(4, 2, depth - 14, BIN_STEEL, { x: side * (width / 2 - 2), y: lidY, z: 0 });
    }
    statics.box(4, 12, depth - 12, BIN_WOOD, { x: 0, y: 36, z: 0 });
    statics.box(5, 2, depth - 14, BIN_STEEL, { x: 0, y: lidY, z: 0 });
    for (const side of [-1, 1]) {
      const panelX = -side * width / 4;
      for (const foot of [-1, 1]) statics.box(2, 3, 3, BIN_STEEL, { x: panelX + foot * 5, y: height - 2.5, z: 12 });
      statics.box(12, 2, 3, BIN_STEEL, { x: panelX, y: height - 1, z: 12 });
      const plane = new THREE.PlaneGeometry(26, 13);
      atlasRow(plane, side < 0 ? 0 : 1, 2);
      plane.rotateY(Math.PI);
      plane.translate(panelX, 31, -depth / 2 - 0.05);
      plane.rotateY(yaw);
      plane.translate(x, y, z);
      planes.push(plane);
    }
  }
  return printedMesh(planes, texture);
}

export function buildSaleRibbons(items: readonly Ribbon[]): PropGroup | null {
  if (!items.length) return null;
  const texture = canvasTexture(512, (ctx) => drawBlackFridayRibbon(ctx, 512, 64, 0, 'storefront'), false, 512, 64);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, items.length);
  mesh.name = 'sale-ribbons';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const matrices = items.map(({ x, y, z, yaw, width, height }) =>
    new THREE.Matrix4().makeRotationY(Math.PI + yaw).scale(new THREE.Vector3(width, height, 1)).setPosition(x, y, z));
  let lastSlot = NaN;
  const update = (_dt: number, serverTick: number) => {
    const serverMs = serverTick * TICK_MS;
    const slot = Math.floor(serverMs / SALE_SLOT_MS);
    if (slot === lastSlot) return;
    lastSlot = slot;
    mesh.count = 0;
    for (let i = 0; i < items.length; i++) {
      if (saleOn(items[i].brand, serverMs)) mesh.setMatrixAt(mesh.count++, matrices[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };
  update(0, 0);
  return { object: mesh, update, setQuality() {} };
}
