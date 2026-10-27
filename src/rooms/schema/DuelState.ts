import { schema, t, type SchemaType } from "@colyseus/schema";
import { DuelFighterState } from "./DuelFighterState.js";

// An offer being agreed or a duel being fought, as everybody in the room sees it — but for its money,
// which only its two duellists are sent (`.view()`: each of them has the duel in their `StateView`). `self` is whoever
// challenged and `rival` whoever was challenged; each client turns it round to its own side.
// Nothing here decides a roll still to come.
export const DuelState = schema({
  self: t.string(),
  rival: t.string(),
  selfName: t.string(),
  rivalName: t.string(),
  // The looks the two wear, roster ids of the game's: kept here, so a fighter who has left the room
  // is still drawn.
  selfLook: t.string(),
  rivalLook: t.string(),
  // Where in the arena it is fought, an index into the game's spots; -1 until it starts.
  spot: t.number().default(-1),
  // offer, countdown, fighting or settled: the game's own phases.
  phase: t.string(),
  noFood: t.boolean().default(false),
  noArmour: t.boolean().default(false),
  noWeapons: t.boolean().default(false),
  noSpec: t.boolean().default(false),
  stake: t.number().default(0).view(),
  selfAccepted: t.boolean().default(false),
  rivalAccepted: t.boolean().default(false),
  resets: t.number().default(0),
  // Goes up with every change; an accept names the one it was made on.
  revision: t.number().default(0),
  // Ticks since "FIGHT!", and ticks anybody attacked on: the client restarts its tick clock on one
  // and plays a blow on the other.
  ticks: t.number().default(0),
  blows: t.number().default(0),
  selfFighter: t.ref(DuelFighterState),
  rivalFighter: t.ref(DuelFighterState),
  // What each side wore on the last tick anybody attacked: -1 for nothing, 0 for a miss; a
  // special's two stabs on their own, -1 when it wasn't one.
  hitSelf: t.number().default(-1),
  hitRival: t.number().default(-1),
  stabsSelf1: t.number().default(-1),
  stabsSelf2: t.number().default(-1),
  stabsRival1: t.number().default(-1),
  stabsRival2: t.number().default(-1),
  // How it ended for `self`: won, lost or drawn; empty until then. What each side was paid.
  result: t.string().default(""),
  paidSelf: t.number().default(0).view(),
  paidRival: t.number().default(0).view(),
});
export type DuelState = SchemaType<typeof DuelState>;
