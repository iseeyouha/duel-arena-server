import { schema, t, type SchemaType } from "@colyseus/schema";

// One side of a duel as both clients draw it: the game's `Fighter`, less what only the tick needs.
export const DuelFighterState = schema({
  hp: t.number().default(0),
  food: t.number().default(0),
  // Ticks until the next attack lands: the client starts the windup off it, before the tick.
  attackTimer: t.number().default(0),
  spec: t.number().default(0),
  specQueued: t.boolean().default(false),
  specLast: t.boolean().default(false),
  eatQueued: t.boolean().default(false),
  attacks: t.number().default(0),
  // The taunt made in the ring, a taunt id of the game's `emotes.ts`, and how many have been made.
  emote: t.string().default(""),
  emoteCount: t.number().default(0),
  // The newest special ask of this side's client the table has answered (`TableDuel.specAsks`).
  specAsk: t.number().default(0),
});
export type DuelFighterState = SchemaType<typeof DuelFighterState>;
