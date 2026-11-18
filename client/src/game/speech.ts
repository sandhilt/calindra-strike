/** Browser speech synthesis shared by the kill announcer and the radio. */

export type Speak = (text: string, volume: number) => void;

export interface VoiceProfile {
  readonly lang: string;
  readonly pitch: number;
  readonly rate: number;
}

/**
 * Who is talking. The announcer owns the moment of a kill and may cut anyone off. The radio only
 * replaces its own previous line and never cuts the announcer mid-word.
 */
export type SpeechChannel = 'announcer' | 'radio';

export interface SpeechEngine {
  readonly synth: SpeechSynthesis;
  readonly Utterance: typeof SpeechSynthesisUtterance;
}

/** Null where the browser has no speech synthesis, or where merely reaching for it throws (sandboxed frames, some embedded views). */
export function browserEngine(): SpeechEngine | null {
  try {
    const synth = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
    const Utterance = (globalThis as { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance }).SpeechSynthesisUtterance;
    return synth && Utterance ? { synth, Utterance } : null;
  } catch {
    return null;
  }
}

/** Speech is garnish: a synthesizer that throws (no voices, a blocked or broken engine) must never reach the game loop. */
function silentOnError(speak: Speak): Speak {
  return (text, volume) => {
    try {
      speak(text, volume);
    } catch {
      // the line is simply not spoken
    }
  };
}

/** What is queued on one synthesizer, shared by every speaker built on it. */
interface Floor {
  announcing: SpeechSynthesisUtterance | null;
  radioWaiting: SpeechSynthesisUtterance | null;
}

const floors = new WeakMap<SpeechSynthesis, Floor>();

function floorOf(synth: SpeechSynthesis): Floor {
  let floor = floors.get(synth);
  if (!floor) {
    floor = { announcing: null, radioWaiting: null };
    floors.set(synth, floor);
  }
  return floor;
}

/** Speaks through the browser's speech synthesis; silent where it is missing (tests, old browsers). */
export function createSpeaker(voice: VoiceProfile, channel: SpeechChannel, engine: SpeechEngine | null = browserEngine()): Speak {
  if (!engine) return () => {};
  const { synth, Utterance } = engine;
  const floor = floorOf(synth);
  const build = (text: string, volume: number): SpeechSynthesisUtterance => {
    const line = new Utterance(text);
    line.lang = voice.lang;
    line.pitch = voice.pitch;
    line.rate = voice.rate;
    line.volume = volume;
    const match = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(voice.lang.slice(0, 2).toLowerCase()));
    if (match) line.voice = match;
    return line;
  };
  const release = (line: SpeechSynthesisUtterance): void => {
    if (floor.announcing === line) floor.announcing = null;
    if (floor.radioWaiting === line) floor.radioWaiting = null;
  };
  if (channel === 'announcer') {
    return silentOnError((text, volume) => {
      const line = build(text, volume);
      line.onend = line.onerror = () => release(line);
      // A new streak replaces the line still being read, so announcements never queue up behind the action.
      synth.cancel();
      floor.radioWaiting = null;
      floor.announcing = line;
      synth.speak(line);
    });
  }
  return silentOnError((text, volume) => {
    const line = build(text, volume);
    line.onstart = line.onend = line.onerror = () => {
      if (floor.radioWaiting === line) floor.radioWaiting = null;
    };
    // The synth.speaking guard covers a browser that never fires onend after a cancel.
    if (floor.announcing && synth.speaking) {
      // The announcement finishes first and one radio line waits behind it; later ones are text only.
      if (floor.radioWaiting) return;
      floor.radioWaiting = line;
      synth.speak(line);
      return;
    }
    floor.announcing = null;
    floor.radioWaiting = null;
    synth.cancel();
    synth.speak(line);
  });
}

/** Teammate voice: natural pitch, a touch fast, so it reads as a quick radio call next to the deep announcer. */
export const RADIO_VOICE: VoiceProfile = { lang: 'pt-BR', pitch: 1, rate: 1.05 };
