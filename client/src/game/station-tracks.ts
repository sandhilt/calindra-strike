import type { StationId } from '@calindra-strike/shared';

export const STATION_TRACKS: Record<StationId, { src: string }> = {
  forja: { src: '/music/forja.ogg' },
  escritorio: { src: '/music/escritorio.ogg' },
  shopping: { src: '/music/shopping.ogg' },
  'shopping-natal': { src: '/music/shopping-natal.ogg' },
};

export const SPEAKER_AUDIBLE_UNITS = 420;

export function trackOffsetSeconds(nowMs: number, durationSeconds: number): number {
  const offset = (nowMs / 1000) % durationSeconds;
  return offset < 0 ? offset + durationSeconds : offset;
}

type TrackState<Buffer> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; buffer: Buffer }
  | { kind: 'silent' };

export class StationTracks<Buffer> {
  private readonly states = new Map<StationId, TrackState<Buffer>>();
  private readonly fetchTrack: (src: string) => Promise<Pick<Response, 'ok' | 'arrayBuffer'>>;

  constructor(fetchTrack: StationTracks<Buffer>['fetchTrack']) {
    this.fetchTrack = fetchTrack;
  }

  get(station: StationId): TrackState<Buffer> {
    return this.states.get(station) ?? { kind: 'idle' };
  }

  async load(station: StationId, decode: (data: ArrayBuffer) => Promise<Buffer>): Promise<void> {
    if (this.get(station).kind !== 'idle') return;
    this.states.set(station, { kind: 'loading' });
    try {
      const response = await this.fetchTrack(STATION_TRACKS[station].src);
      if (response.ok) {
        const buffer = await decode(await response.arrayBuffer());
        this.states.set(station, { kind: 'ready', buffer });
        return;
      }
    } catch {
      // A missing or unreadable optional asset stays silent for this page session.
    }
    this.states.set(station, { kind: 'silent' });
  }
}
