// Which kind of class a schedule row is, from its name (first rule that matches wins), else the studio's own kind.
// "other" (dance, boxing, …) is stored but never shown. Shared by gen.mjs (preview) and save.mjs (database).
export const TYPE_RULES = [
  ["other", /dance|zumba|bolly|hip hop|twerk|pole|aerial|boxing|kickbox|swim|tennis|pickleball|basketball|volleyball|racquetball|aquatic|aqua ?(fit|cise|aerobics)|splash|water (aerobics|fitness|walking)|toddler|\bkids?\b|\bteens?\b|\byouth\b|open play/i],
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
  return /at home|live-?stream|livestream|\bstreaming\b|online|zoom|virtual|digital training/i.test(name);
}

/**
 * Things studios list on their schedule that aren't a group class someone books to work out: teacher trainings, workshops,
 * seminars, retreats, private sessions, and anything over 2.5 hours. Dropped before saving.
 */
export function isNotAGroupClass(name, start, end) {
  if (/teacher training|instructor (training|course)|certification|continuing education|\bce\b|protocols|seminar|workshop|masterclass|retreat|immersion|private (session|lesson)|one[- ]on[- ]one|personal training|child ?care|babysit|consultation|assessment|\bdemo\b|open house|orientation|tour\b|open gym|open climb|drop[- ]in personalized/i.test(name)) return true;
  const m1 = /^(\d{2}):(\d{2})$/.exec(start ?? ""), m2 = /^(\d{2}):(\d{2})$/.exec(end ?? "");
  if (m1 && m2) {
    const len = +m2[1] * 60 + +m2[2] - (+m1[1] * 60 + +m1[2]);
    if (len > 150) return true;
  }
  return false;
}
