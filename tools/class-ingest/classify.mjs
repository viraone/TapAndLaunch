// Which kind of class a schedule row is, from its name (first rule that matches wins), else the studio's own kind.
// "other" (dance, boxing, …) is stored but never shown. Shared by gen.mjs (preview) and save.mjs (database).
export const TYPE_RULES = [
  ["other", /dance|zumba|bolly|hip hop|twerk|pole|aerial|boxing|kickbox|swim|tennis|pickleball/i],
  ["climbing", /climb|boulder|belay|top rope|lead class|crag/i],
  ["spin", /\bspin|cycle\b|flowcycle|cycling|\bride\b|bike|peloton/i],
  ["pilates", /pilates|reformer|lagree|megaformer|xformer|barre|\bmat\b|springboard|jumpboard/i],
  ["yoga", /\byoga\b|corepower yoga|vinyasa|\byin\b|hatha|ashtanga|restorative|nidra|kundalini|hot 26|power flow|slow flow|mellow|yoga sculpt/i],
  ["lifting", /strength|lift|barbell|weights?\b|hiit|bootcamp|boot camp|olympic|power ?lifting|conditioning|kettlebell|crossfit|f45|circuit|bodypump|pump\b|hyrox|muscle/i],
  ["yoga", /flow|meditation|sound (bath|healing)|corerestore/i],
];

export function classTypeOf(name, studioKind) {
  return (TYPE_RULES.find(([, re]) => re.test(name)) ?? [studioKind || "other"])[0];
}

/** Classes you join from home (livestream, "at HOME"). */
export function isOnlineClass(name) {
  return /at home|live-?stream|livestream|online|zoom|virtual|digital training/i.test(name);
}
