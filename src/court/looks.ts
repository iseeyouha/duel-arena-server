// The looks a person can be given, going round by join order: a copy of the game's `COURT_LOOKS`
// (`src/games/duel-arena/game/lookTable.ts`), which the client turns into a model with `lookOf`. Every
// look once, and never two of one character in a row. An id the client doesn't know falls back to its
// first look, so a new one here has to exist there first.
export const LOOKS = [
  "soldier-blue",
  "rider",
  "headsman",
  "mage",
  "soldier-red",
  "blacksmithf",
  "hermit",
  "soldier-green",
  "soldierf-blue",
  "headsman-red",
  "blacksmith",
];
