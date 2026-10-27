import type { Side } from "../duel/types.js";
import type { DuelTable, TableDuel } from "../duels/DuelTable.js";
import type { CourtState } from "./schema/CourtState.js";
import { DuelState } from "./schema/DuelState.js";
import type { DuelFighterState } from "./schema/DuelFighterState.js";

const SIDES: Side[] = ["self", "rival"];

function writeFighter(view: DuelFighterState, duel: TableDuel, side: Side) {
  const fighter = duel.duel[side];
  view.hp = fighter.hp;
  view.food = fighter.food;
  view.attackTimer = fighter.attackTimer;
  view.spec = fighter.spec;
  view.specQueued = fighter.specQueued;
  view.specLast = fighter.specLast;
  view.eatQueued = fighter.eatQueued;
  view.attacks = fighter.attacks;
  view.emote = duel.gestures[side].id;
  view.emoteCount = duel.gestures[side].count;
  view.specAsk = duel.specAsks[side];
}

function writeDuel(view: DuelState, duel: TableDuel) {
  const { duel: game } = duel;
  view.self = duel.seats.self.id;
  view.rival = duel.seats.rival.id;
  view.selfName = duel.seats.self.name;
  view.rivalName = duel.seats.rival.name;
  view.selfLook = duel.seats.self.look;
  view.rivalLook = duel.seats.rival.look;
  view.spot = duel.spot;
  view.phase = game.phase;
  view.noFood = duel.rules.noFood;
  view.noArmour = duel.rules.noArmour;
  view.noWeapons = duel.rules.noWeapons;
  view.noSpec = duel.rules.noSpec;
  view.stake = duel.stake;
  view.selfAccepted = duel.accepted.self;
  view.rivalAccepted = duel.accepted.rival;
  view.resets = duel.resets;
  view.revision = duel.revision;
  view.ticks = game.ticks;
  view.blows = game.blows;
  writeFighter(view.selfFighter, duel, "self");
  writeFighter(view.rivalFighter, duel, "rival");
  const traded = game.lastExchange;
  view.hitSelf = traded?.self?.damage ?? -1;
  view.hitRival = traded?.rival?.damage ?? -1;
  view.stabsSelf1 = traded?.self?.stabs?.[0] ?? -1;
  view.stabsSelf2 = traded?.self?.stabs?.[1] ?? -1;
  view.stabsRival1 = traded?.rival?.stabs?.[0] ?? -1;
  view.stabsRival2 = traded?.rival?.stabs?.[1] ?? -1;
  const over = game.phase === "settled";
  view.result = !over ? "" : game.drawn ? "drawn" : game.won ? "won" : "lost";
  view.paidSelf = duel.paid.self;
  view.paidRival = duel.paid.rival;
}

/**
 * The table into the room's state, at the end of every step: each offer and duel, and where
 * everybody is seated. Only what changed goes out in the patch.
 */
export function syncDuels(state: CourtState, table: DuelTable) {
  for (const id of [...state.duels.keys()]) if (!table.duels.has(id)) state.duels.delete(id);
  const seated = new Map<string, { duel: string; away: boolean }>();
  for (const duel of table.duels.values()) {
    let view = state.duels.get(duel.id);
    if (!view) {
      view = new DuelState();
      state.duels.set(duel.id, view);
    }
    writeDuel(view, duel);
    for (const side of SIDES) seated.set(duel.seats[side].id, { duel: duel.id, away: duel.duel.phase !== "offer" });
  }
  state.people.forEach((person, id) => {
    const seat = seated.get(id);
    person.duel = seat?.duel ?? "";
    person.away = seat?.away ?? false;
  });
}
