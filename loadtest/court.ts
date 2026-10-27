import { Client, type Room } from "@colyseus/sdk";
import { cli, type Options } from "@colyseus/loadtest";

// A full court duelling: every client walks about now and then and pairs up by its number — an even
// one challenges the next, the odd one says yes — both accept whatever offer they sit at, eat when
// low, and the challenger asks again a few seconds after each duel is over. Run against `pnpm start`
// with `pnpm loadtest`; one of them logs the room once a minute.
const RULES = { noFood: true, noArmour: true, noWeapons: false, noSpec: true };
const STAKE = 1_000;
const EAT_BELOW = 40;
// Everybody joins in the one process, so the challengers find who they pair with here.
const sessions = new Map<number, string>();

type Fighter = { hp: number; food: number; eatQueued: boolean };
type Duel = { self: string; rival: string; phase: string; revision: number; selfAccepted: boolean; rivalAccepted: boolean; spot: number; selfFighter: Fighter; rivalFighter: Fighter };
type Court = { people: { size: number }; duels: { forEach: (each: (duel: Duel, id: string) => void) => void } };

const between = (low: number, high: number) => low + Math.random() * (high - low);

function yourDuel(state: Court, me: string) {
  let found: { id: string; duel: Duel; side: "self" | "rival" } | null = null;
  state.duels.forEach((duel, id) => {
    if (duel.self === me) found = { id, duel, side: "self" };
    else if (duel.rival === me) found = { id, duel, side: "rival" };
  });
  return found as { id: string; duel: Duel; side: "self" | "rival" } | null;
}

function report(state: Court) {
  const phases: Record<string, number> = {};
  const spots: number[] = [];
  state.duels.forEach((duel) => {
    phases[duel.phase] = (phases[duel.phase] ?? 0) + 1;
    if (duel.spot >= 0) spots.push(duel.spot);
  });
  const twice = spots.length - new Set(spots).size;
  console.log(`[court] ${state.people.size} people; duels ${JSON.stringify(phases)}; spots ${Math.min(...spots)}–${Math.max(...spots)}, ${twice} used twice`);
}

export async function main(options: Options) {
  const client = new Client(options.endpoint);
  client.auth.token = `load-${options.clientId}-${Date.now()}`;
  const room: Room<unknown, Court> = await client.joinOrCreate(options.roomName, {});
  const me = room.sessionId;
  sessions.set(options.clientId, me);
  const challenger = options.clientId % 2 === 0;
  let seated = false;
  let asking = false;
  // The offer and revision last accepted: every new offer starts again at revision 0.
  let accepted = "";
  let ateAt = 0;

  room.onMessage("*", () => {});
  room.onMessage("challenged", ({ from }: { from: string }) => room.send("answer", { from, yes: true }));
  room.onMessage("balance", ({ cents }: { cents: number }) => {
    if (cents < STAKE) room.send("refill");
  });
  room.send("balance");

  // The next one up, once it has joined, until it says yes.
  const challenge = () => {
    const partner = sessions.get(options.clientId + 1);
    if (!partner || seated) {
      setTimeout(challenge, 1_000);
      return;
    }
    asking = true;
    room.send("challenge", { id: partner, rules: RULES, stake: STAKE });
    // Asked again if nothing came of it: they may have been walking off, or busy.
    setTimeout(() => {
      if (asking && !seated) challenge();
    }, 25_000);
  };
  if (challenger) setTimeout(challenge, between(1_000, 4_000));

  const walk = () => {
    if (!seated && !asking) room.send("walkTo", { x: Math.round(between(-9, 9)), z: Math.round(between(-8, 8)) });
    setTimeout(walk, between(5_000, 15_000));
  };
  setTimeout(walk, between(2_000, 8_000));

  room.onStateChange((state) => {
    const seat = yourDuel(state, me);
    if (!seat) {
      if (seated && challenger) setTimeout(challenge, between(2_000, 5_000));
      seated = false;
      return;
    }
    seated = true;
    asking = false;
    const { id, duel, side } = seat;
    const mine = side === "self" ? duel.selfAccepted : duel.rivalAccepted;
    if (duel.phase === "offer" && !mine && accepted !== `${id}:${duel.revision}`) {
      accepted = `${id}:${duel.revision}`;
      room.send("accept", { revision: duel.revision });
    }
    const fighter = side === "self" ? duel.selfFighter : duel.rivalFighter;
    if (duel.phase === "fighting" && fighter.hp < EAT_BELOW && fighter.food > 0 && !fighter.eatQueued && Date.now() - ateAt > 1_200) {
      ateAt = Date.now();
      room.send("eat");
    }
  });

  if (options.clientId === 0) setInterval(() => report(room.state), 60_000);
  room.onLeave((code: number) => console.log(`[${options.clientId}] left (${code})`));
}

// Piped rather than in a terminal — a CI box, a log file — the tool's full-screen display has nowhere
// to draw and never starts the clients: they are joined one after another here instead, and all they
// say goes to the log.
async function plain(run: (options: Options) => Promise<void>) {
  const arg = (name: string, fallback: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 ? process.argv[at + 1] : fallback;
  };
  const numClients = Number(arg("numClients", "1"));
  const base = { endpoint: arg("endpoint", "ws://localhost:2567"), roomName: arg("room", "court"), numClients } as Options;
  for (let clientId = 0; clientId < numClients; clientId++) await run({ ...base, clientId });
  console.log(`[court] ${numClients} clients joined`);
}

if (process.stdout.isTTY) cli(main);
else void plain(main);
