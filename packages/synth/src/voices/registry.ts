import type { LibraryVoice } from "./types.ts";

/**
 * The voice library's catalog as the engine and pack validation see it: empty until catalog.ts is imported (it
 * registers itself). The engine's opt-in `library` slots and pack.ts resolve voice ids here, so the radio bundle only
 * carries the whole library (~60 KB gzipped: every pack's voices and presets) when something imports the catalog: a
 * station pack that names library voices imports "../voices/catalog.ts" itself.
 */
let byId: Readonly<Record<string, LibraryVoice>> | null = null;

/** Called by catalog.ts. */
export function registerVoiceLibrary(voices: Readonly<Record<string, LibraryVoice>>) {
  byId = voices;
}

/**
 * Adds voices to the catalog (opt-in: a pack that names the library's later shelves, e.g. voices/new, registers them
 * after importing catalog.ts). Ids already registered are kept.
 */
export function registerVoices(voices: Readonly<Record<string, LibraryVoice>>) {
  byId = { ...voices, ...(byId ?? {}) };
}

/** A catalog voice by id, or undefined (unknown, or the catalog not imported). */
export const libraryVoice = (id: string): LibraryVoice | undefined => byId?.[id];

/** True once the catalog has been imported. */
export const voiceLibraryLoaded = () => byId !== null;
