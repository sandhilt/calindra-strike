import { getMaps } from '@calindra-strike/shared';
import { QUALITY, type Quality } from '../game/render/quality.ts';
import { rtLabel } from '../game/render/rt-levels.ts';
import { h } from '../ui/dom.ts';
import { benchmarkSetup, isRtVariant, parseBenchmarkParams, type BenchmarkTier } from './options.ts';
import { runBenchmark } from './run.ts';

/** Plain tiers by their menu name; a ray pass variant as `alta` plus its level, e.g. `alta · ray tracing leve`. */
function tierLabel(tier: BenchmarkTier): string {
  if (!isRtVariant(tier)) return QUALITY[tier].label;
  const { profile, rtLevel } = benchmarkSetup(tier);
  return `${profile.label} · ray tracing ${rtLabel(rtLevel)}`;
}

function perFrame(ms: number | null): string {
  return ms === null ? '—' : `${ms.toFixed(1)} ms/quadro`;
}

export function openBenchmark(onApply: (tier: Quality) => void): () => void {
  const { options } = parseBenchmarkParams('', getMaps().map(({ id }) => id));
  const controller = new AbortController();
  const canvas = h('div', { class: 'benchmark-canvas', 'aria-hidden': 'true' });
  const heading = h('h2', { id: 'benchmark-heading', text: 'Teste de desempenho' });
  const progress = h('p', { role: 'status', text: 'Preparando o teste…' });
  const monitor = h('pre', { class: 'benchmark-monitor', text: 'Preparando o teste…' });
  progress.hidden = true;
  const cores = navigator.hardwareConcurrency;
  const closeButton = h('button', { class: 'btn', type: 'button', autofocus: true, text: 'cancelar', onclick: () => cleanup() });
  const actions = h('div', { class: 'benchmark-actions' }, [closeButton]);
  const card = h('section', { class: 'card benchmark-card benchmark-running' }, [heading, progress, actions]);
  const dialog = h('dialog', { class: 'benchmark-overlay', 'aria-labelledby': heading.id }, [canvas, monitor, card]);
  const cleanup = () => {
    controller.abort();
    dialog.close();
    dialog.remove();
  };
  dialog.addEventListener('cancel', () => controller.abort());
  dialog.addEventListener('close', cleanup, { once: true });
  document.body.append(dialog);
  dialog.showModal();

  void runBenchmark(canvas, options, controller.signal, (row) => {
    const label = tierLabel(row.tier);
    const fps = row.fps === null ? '—' : Math.round(row.fps);
    monitor.textContent = [
      `${label} · ${row.map} · ${row.current}/${row.total} (${row.elapsedPct}%)`,
      `${fps} fps · quadro ${perFrame(row.frameMs)}`,
      `CPU: ${perFrame(row.cpuMs)} · ${cores} núcleos lógicos`,
      `GPU: ${row.gpuTimerSupported ? perFrame(row.gpuMs) : 'indisponível neste navegador'}`,
      `Placa de vídeo: ${row.gpu === 'unknown' ? 'não identificada' : row.gpu}`,
      ...(row.heapMb === null ? [] : [`Heap JS: ${row.heapMb.toFixed(1)} MB`]),
    ].join('\n');
  }).then(({ recommendation }) => {
    if (controller.signal.aborted || !recommendation) return;
    monitor.remove();
    card.classList.remove('benchmark-running');
    const { tier, percent, tiers } = recommendation;
    const label = QUALITY[tier].label;
    const metrics = h('ul', { class: 'benchmark-metrics' }, tiers.map((row) =>
      h('li', {}, [
        h('strong', { text: `${tierLabel(row.tier)}: ` }),
        `${Math.round(row.fps)} fps · ${row.smoothPct}% dos quadros a 60 fps`,
        row.gpuMs === null ? null : ` · GPU ${row.gpuMs} ms`,
        ` · CPU ${row.cpuMs} ms`,
      ]),
    ));
    const apply = h('button', {
      class: 'btn btn-primary', type: 'button', text: `usar ${label}`, onclick: () => {
        onApply(tier);
        cleanup();
      },
    });
    progress.replaceWith(
      metrics,
      h('p', { class: 'benchmark-recommendation', role: 'status', text: `Recomendado: ${label} · ${percent}%` }),
      h('p', { class: 'field-hint', text: 'Resultados para este navegador e tamanho de janela.' }),
    );
    closeButton.textContent = 'fechar';
    actions.prepend(apply);
  }).catch(() => {
    if (controller.signal.aborted) return;
    monitor.remove();
    card.classList.remove('benchmark-running');
    progress.hidden = false;
    progress.textContent = 'Não foi possível medir o desempenho neste navegador.';
    closeButton.textContent = 'fechar';
  });
  return cleanup;
}
