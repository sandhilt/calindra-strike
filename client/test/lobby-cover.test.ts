import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('the lobby backdrop is the bundled poster, and the poster is there', () => {
  assert.match(css, /\.lobby-cover\s*\{[^}]*url\('\/brand\/cover\.jpg'\)/);
  assert.ok(existsSync(new URL('../public/brand/cover.jpg', import.meta.url)));
});

test('the poster box keeps its 4:3 shape so the wordmark cut-out stays on the printed wordmark', () => {
  const rule = css.slice(css.indexOf('.lobby-cover {'), css.indexOf('}', css.indexOf('.lobby-cover {')));
  assert.match(rule, /aspect-ratio:\s*4\s*\/\s*3/);
  assert.match(rule, /radial-gradient\(ellipse/);
});

test('the poster is faded enough to leave the lobby words readable', () => {
  const rule = css.slice(css.indexOf('.lobby-cover {'), css.indexOf('}', css.indexOf('.lobby-cover {')));
  const opacity = Number(/opacity:\s*([\d.]+)/.exec(rule)?.[1]);
  assert.ok(opacity > 0 && opacity <= 0.5, 'opacity ' + opacity);
});

test('the lobby has no icon grid any more', () => {
  assert.doesNotMatch(css, /\.tile-grid/);
});
