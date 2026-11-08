/**
 * The new voices of the shared library (docs/sound/VOICE-LIBRARY-NEW.md): physical models (waveguide strings, bowed
 * strings, modal keys and percussion, a source-filter voice, a particle shaker) and analog voices through nonlinear
 * ladders, rendered sample by sample (dsp/) and played through the library's VoiceHost. Opt-in: the engine names none.
 */
export { NEW_LIBRARY, NEW_LIBRARY_BY_ID, NEW_RENDERERS } from "./catalog.ts";
export { eventOf, player, playRendered, renderNote } from "./voices.ts";
export type { NoteEvent, Params as NewVoiceParams, Rendered, Renderer } from "./dsp/core.ts";
export { ENTRIES as NEW_AUDITION, PHRASES as NEW_PHRASES, entry as newAuditionEntry, playBed as newAuditionBed, playPhrase as newAuditionPhrase, SECONDS as NEW_AUDITION_SECONDS } from "./audition.ts";
