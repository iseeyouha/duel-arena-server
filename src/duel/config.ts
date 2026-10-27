// A copy of the game's `src/games/duel-arena/game/config.ts` (void-casino-games), changed only in
// its import paths: the server fights duels by the same rules, and pays them by the same money,
// as the game shows. Keep the two in step.
// Both fighters are maxed: 99 in every combat skill, the way a stake between two mains is fought.
// Combat runs on the game tick, and a whip attacks every four of them.
export const LEVEL = 99
export const HITPOINTS = 99
export const TICK = 0.6
export const WHIP_SPEED = 4
// The first attack goes on the first tick after "FIGHT!": both go for it straight away.
export const FIRST_ATTACK = 1

// The whip in their hands is the authored model (`src/models/weapons/tentacle_whip.glb`). The
// box-built one it replaced is kept: flip this to put it back.
export const WHIP_MODEL = true

// What they hold and wear. The abyssal whip's slash attack and strength bonuses, and a set of armour
// worth this much slash defence — which the "No armour" rule takes off both of them.
export const WHIP_ATTACK = 82
export const WHIP_STRENGTH = 82
export const ARMOUR_DEFENCE = 40
// Boxing ("No weapons"): bare fists have no bonuses at all, and punch every four ticks like the whip.
export const FIST_ATTACK = 0
export const FIST_STRENGTH = 0
export const FIST_SPEED = 4

// The special attack: both carry a dragon dagger beside the whip, and a special is the dagger's
// Puncture — two stabs in the one attack, each 15% more accurate and 15% harder than the dagger's
// own. It costs a quarter of the special bar, which starts full and fills back a tenth every fifty
// ticks (thirty seconds). The dagger's stab bonuses and its speed are the game's.
export const DAGGER_ATTACK = 40
export const DAGGER_STRENGTH = 40
export const DAGGER_SPEED = 4
export const SPEC_BOOST = 1.15
export const SPEC_FULL = 100
export const SPEC_COST = 25
export const SPEC_REGEN = 10
export const SPEC_REGEN_TICKS = 50
// A bot with a special to spend uses it on about this share of its attacks, decided straight after
// the one before.
export const BOT_SPEC_CHANCE = 0.5

// Sharks: each one heals 20 and, like any food, pushes the eater's next attack back three ticks. The
// fight never eats for anybody — when to eat is the whole skill of a duel with food in it.
export const FOOD_COUNT = 2
export const FOOD_HEAL = 20
export const EAT_DELAY = 3

// A bot eats once it is down to somewhere in this range, chosen for each duel, so two of them don't
// fight like the same script.
export const BOT_EAT_LOW = 20
export const BOT_EAT_HIGH = 34

// How long a blow takes on screen. It starts on the tick of the attack, as the game's do, with the
// splat: the arm whips over and the blow lands this long into it — a flick, not a wind-up, three
// held poses (`POSE_RATE`), so the one it lands on is shown the instant it lands — then comes through
// and down to the stand, as short as the game's own. Both are whole numbers of poses.
export const SWING_WINDUP = 0.24
export const SWING_RECOVER = 0.56
// Bodies move in held poses, as the game's do: each pose of a clip is held for four of the game
// client's 20 ms cycles before the next replaces it, never blended into it.
export const POSE_RATE = 12.5

// The execution, in real seconds, beat by beat: the beaten one reels and goes down on their knees,
// the winner walks in while the camera comes with them, the tentacle goes up, it goes in, the body
// slides off it, and the camera backs out to ringside.
export const FINISH_STAGGER = 0.7
export const FINISH_CLOSE = 0.9
export const FINISH_RAISE = 0.75
export const FINISH_PLUNGE = 0.26
// The blade comes back out and goes in again: one drive is an execution, two is a killing.
export const FINISH_RIP = 0.3
export const FINISH_STAB = 0.26
export const FINISH_HOLD = 1.15
export const FINISH_PULL = 0.9
// How long the arena holds after a kill: the whole execution, and a beat on the winner standing
// over them. A duel the player walked out of gets the short pause instead — nobody died.
export const FINISH_PAUSE = 6
// The execution is built and kept, but off: a duel ends the way it does in the game, with the loser
// falling where they stood and the camera staying at ringside. Flip this to bring the cinematic back.
export const EXECUTION = false
// Without it, the arena holds this long on the body before everybody goes back to the court: long
// enough for the winner's celebration to play out.
export const DEATH_PAUSE = 4.6
// Time stretches for the walk-in rather than stopping: the blow itself gets the hard slam.
export const FINISH_SLOW_SCALE = 0.55
export const FINISH_SLOW_HOLD = 2.4
// The blade going in: a hard, short stop.
export const STRIKE_SLOW_HOLD = 0.4
export const STRIKE_SLOW_SCALE = 0.14
// How close the winner ends up, and where the camera watches it from.
export const FINISH_GAP = 0.78
// How far the winner throws themselves forward behind each drive.
export const FINISH_LUNGE = 0.42
export const SHOT_HEIGHT = 1.3
export const SHOT_BACK = 3.5
export const SHOT_SIDE = 1.45
export const SHOT_TARGET_Y = 0.72

// "3 - 2 - 1 - FIGHT", and how long the arena holds on the body before the options come back.
export const COUNTDOWN = 3
export const SETTLED_PAUSE = 3.5
// Both down at once: nobody is left to execute anybody, so the arena holds on the two of them.
export const DRAW_PAUSE = 4

// Longest frame the duel is stepped with, so a tab coming back to life can't fire a swing a frame.
export const MAX_STEP = 0.1

// Both sides put up the same stake and the winner takes the pot, less this share of it for the
// house. That cut is the house's whole interest in a duel: it never prices who wins.
export const HOUSE_CUT = 0.03

// How far each fighter stands from the middle of the courtyard's fight floor (`courtyardMap`), and how far they are turned out of pure profile so
// the camera gets a face rather than an ear.
export const FIGHTER_X = 1
export const FACE_TURN = 0.24
// Boxers stand in arm's reach of each other instead: the boxing clip's cross reaches 0.93 m out from
// the hips, and a boxer's guard carries the head 0.32–0.46 m ahead of them.
export const BOX_X = 0.65

// The head joint of the characters sits here, which is what they are scaled by: the Fantasy Kingdom
// characters' own, so they stand at the pack's size, about 1.8 m.
export const HEAD_HEIGHT = 1.569

// Time stretches on the blow that ends a duel, so the last hit is something you watch rather than
// something that already happened. The whole fight is stepped through it.
export const SLOW_SCALE = 0.3
export const SLOW_HOLD = 0.8
export const SLOW_RECOVER = 0.7

// A heavy blow holds the whole scene still for a few hundredths of a second where it lands, and a
// max hit for longer. Only what is drawn stops: the ticks, and the money, run on real time.
export const HITSTOP = 0.07
export const HITSTOP_MAX = 0.12
export const HITSTOP_SCALE = 0.03

// The ring shakes under a heavy blow. The decay is per second and linear, so it always reaches
// nothing: a shake that only ever halves leaves the camera off its mark for the rest of the session.
// A heavy blow is three quarters of the max hit or more — 18 with a whip, 9 with fists.
export const HEAVY_SHARE = 0.75
export const SHAKE_AMPLITUDE = 0.05
export const SHAKE_DECAY = 3.4
export const SHAKE_FREQUENCY = 31
// A max hit kicks past the ceiling every other heavy blow stops at.
export const MAX_HIT_SHAKE = 1.7

// What a blow leaves in the air: the splat's size on the sand, and the bar over each head.
export const SPLAT_SIZE = 0.42
export const SPLAT_LIFE = 0.95
// Over the Fantasy Kingdom heads, which top out at 1.79–1.84 m.
export const BAR_HEIGHT = 2.02

// Everybody in the lobby is the same combat level, yours included: maxed, like you.
export const COMBAT_LEVEL = 126

// How long the other side takes to answer: the request, and each of the three screens. Long enough
// to read as a person on the other end, short enough that nobody is left waiting on one.
export const REQUEST_DELAY = 0.9
export const RIVAL_ACCEPT_MIN = 0.7
export const RIVAL_ACCEPT_MAX = 2.1

// Demo betting, in integer cents. The interface counts them as coins, one to one.
export const STARTING_BALANCE = 100_000
export const MIN_BET = 10
export const DEFAULT_BET = 1_000

// The 28-slot inventory tab is built and kept, but not shown: the balance has its own card and the
// food is eaten with the Eat button or E. Flip this to put the tab back beside the styles.
export const SHOW_INVENTORY = false

// The renderer's pixel ratio: the screen's own, but never above 2, and no higher than 1.5 on a touch
// screen — a phone's own is 3, and every one of those pixels is lit by five lights. While the frame
// rate can't keep up it comes down a step at a time to 1; at 1 the shadows go for good.
export const MAX_DPR = 2
export const TOUCH_MAX_DPR = 1.5
export const MIN_DPR = 1
export const DPR_STEP = 0.25
