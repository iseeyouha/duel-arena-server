import { schema, t, type SchemaType } from "@colyseus/schema";
import { DuelState } from "./DuelState.js";
import { Person } from "./Person.js";

// Everybody in one court, by session id, and every offer and duel among them, by id.
export const CourtState = schema({
  people: t.map(Person),
  duels: t.map(DuelState),
});
export type CourtState = SchemaType<typeof CourtState>;
