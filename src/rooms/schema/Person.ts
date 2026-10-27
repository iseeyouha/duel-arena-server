import { schema, t, type SchemaType } from "@colyseus/schema";

// Somebody in the court, as every client sees them. Positions are the game's: metres on the
// courtyard floor, `heading` a turn about +y from facing +z. The path they are walking stays on the
// server.
export const Person = schema({
  name: t.string(),
  // A roster id from the game's `duellists.ts`; the client turns it into a model with `lookOf`.
  look: t.string(),
  x: t.number().default(0),
  z: t.number().default(0),
  heading: t.number().default(0),
  running: t.boolean().default(true),
  // The gesture being made, a taunt id from the game's `emotes.ts`; empty once they step off. The
  // count goes up with every gesture, so making the same one again is seen as a new one.
  emote: t.string().default(""),
  emoteCount: t.number().default(0),
  // The offer or duel they are at, or empty; and whether it has taken them to the arena, which is
  // when everybody else stops seeing them.
  duel: t.string().default(""),
  away: t.boolean().default(false),
});
export type Person = SchemaType<typeof Person>;
