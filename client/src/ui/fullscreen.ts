export function fullscreenButtonLabel(
  context: 'debug' | 'lobby',
  enabled: boolean,
  active: boolean,
): string | null {
  if (!enabled) return null;
  if (context === 'lobby') return active ? null : 'tela cheia';
  return active ? 'sair da tela cheia' : 'maximizar janela';
}

export async function toggleFullscreen(target: HTMLElement): Promise<void> {
  const doc = target.ownerDocument;
  if (!doc.fullscreenEnabled) return;
  try {
    if (doc.fullscreenElement === target) await doc.exitFullscreen();
    else await target.requestFullscreen();
  } catch {
    // The browser may refuse the request. The UI follows fullscreenchange.
  }
}
