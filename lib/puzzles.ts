export type Prompt = { label: string; kind: 'fact' | 'vibe'; rule: string };
export type Puzzle = {
  id: string;
  title: string;
  subtitle: string;
  rows: Prompt[];
  cols: Prompt[];
};
const fact = (label: string, rule = label): Prompt => ({
  label,
  rule,
  kind: 'fact',
});
const vibe = (label: string, rule = label): Prompt => ({
  label,
  rule,
  kind: 'vibe',
});
const era = (s: string) =>
  fact(
    `Released in the ${s}`,
    `The submitted recording was first released in the ${s}. A later reissue does not count.`,
  );
const guitar = vibe(
  'A killer guitar part',
  'A distinctive, prominent guitar riff, solo, texture, or performance is central to the song. Heavy, acoustic, experimental, and clean tones all qualify.',
);
const night = vibe(
  'Late-night headphones',
  'Immersive, intimate, atmospheric or detailed music that rewards focused late-night headphone listening. Any genre qualifies.',
);
const dance = vibe(
  'Gets people moving',
  'A convincing rhythmic groove or energy that invites dancing, bouncing, or movement. This is not limited to mainstream dance music.',
);
const soft = vibe(
  'The softer side',
  'Gentle, restrained, tender or spacious in sound or delivery, including within heavy genres.',
);
const big = vibe(
  'A big release',
  'Builds to or sustains an emotionally cathartic musical release.',
);
const road = vibe(
  'Open-road energy',
  'A feeling of momentum, freedom or forward motion suited to a road trip.',
);
const decades = [era('1970s'), era('1990s'), era('2010s')];
const p = (
  id: string,
  title: string,
  subtitle: string,
  rows: Prompt[],
  cols: Prompt[],
): Puzzle => ({ id, title, subtitle, rows, cols });
const collection: Puzzle[] = [
  p(
    '01',
    'Across the decades',
    'Three eras. Three different ways to feel it.',
    decades,
    [guitar, night, dance],
  ),
  p(
    '02',
    'After hours',
    'The lights go down. The music opens up.',
    [era('1980s'), era('2000s'), era('2020s')],
    [
      night,
      soft,
      vibe(
        'A little unsettling',
        'Creates tension, unease, mystery, or an eerie atmosphere.',
      ),
    ],
  ),
  p(
    '03',
    'The long way home',
    'Build a soundtrack for the scenic route.',
    decades,
    [
      road,
      vibe(
        'Windows-down singalong',
        'An inviting vocal hook or refrain that feels good to sing out loud.',
      ),
      vibe(
        'Watching the rain',
        'Reflective, wistful or melancholy in a way that suits a rainy journey.',
      ),
    ],
  ),
  p(
    '04',
    'Turn it up',
    'Find the feeling inside the noise.',
    [
      fact('Prominent electric guitar'),
      fact('Prominent synthesizer'),
      fact(
        'Prominent acoustic instrument',
        'An acoustic guitar, piano, strings, horns or other acoustic instrument is prominent.',
      ),
    ],
    [big, dance, night],
  ),
  p(
    '05',
    'On the guest list',
    'A wedding has more than one kind of dance floor.',
    [era('1970s'), era('1980s'), era('2000s')],
    [
      vibe(
        'Elite wedding song',
        'A convincing celebratory wedding dance-floor pick; accessible groove, joy or communal singalong appeal.',
      ),
      vibe(
        'First-dance material',
        'A tender, affectionate or emotionally resonant song suitable for a couple’s first dance.',
      ),
      vibe(
        'The final singalong',
        'A communal, memorable chorus suited to the end of a party.',
      ),
    ],
  ),
  p(
    '06',
    'Deep in the groove',
    'Rhythm is a very broad church.',
    [
      fact(
        'Audible bass guitar',
        'A discernible bass guitar part is present; synth bass alone does not count.',
      ),
      fact(
        'Electronic percussion',
        'Includes programmed, sampled or synthesized percussion.',
      ),
      fact('Live drum kit', 'Includes an acoustic drum kit performance.'),
    ],
    [dance, night, road],
  ),
  p(
    '07',
    'A change of scenery',
    'Songs that take you somewhere.',
    [era('1960s'), era('1990s'), era('2020s')],
    [
      vibe(
        'A psychedelic detour',
        'Dreamlike, mind-bending, surreal or exploratory in arrangement or sound.',
      ),
      soft,
      big,
    ],
  ),
  p(
    '08',
    'Human / machine',
    'Different ingredients. Equally human feelings.',
    [
      fact('Includes piano', 'Acoustic or electric piano is audible.'),
      fact('Includes synthesizer'),
      fact(
        'Includes strings',
        'Bowed string instruments are audible, including a clearly identifiable sampled string section.',
      ),
    ],
    [
      vibe(
        'Quietly devastating',
        'Restrained or intimate but emotionally affecting.',
      ),
      dance,
      vibe(
        'Cinematic scale',
        'Evokes a vivid scene or expansive cinematic feeling.',
      ),
    ],
  ),
  p(
    '09',
    'Short stories',
    'A lot can happen in a few minutes.',
    [
      fact('Under 3 minutes', 'The specified recording is shorter than 3:00.'),
      fact(
        '3 to 5 minutes',
        'The specified recording is at least 3:00 and no longer than 5:00.',
      ),
      fact('Over 5 minutes', 'The specified recording is longer than 5:00.'),
    ],
    [guitar, night, big],
  ),
  p(
    '10',
    'Second wind',
    'A little more left in the tank.',
    [era('1980s'), era('1990s'), era('2010s')],
    [
      vibe(
        'Last mile of a run',
        'Driving or motivating enough to carry the final stretch of a run.',
      ),
      vibe('A victory lap', 'Triumphant, exuberant or celebratory.'),
      soft,
    ],
  ),
  p(
    '11',
    'Words to live by',
    'The lyric meets the feeling.',
    [
      fact(
        'A place in the title',
        'The song title contains a real named geographic place.',
      ),
      fact(
        'A person in the title',
        'The title contains a human given name, surname, or recognizable named person.',
      ),
      fact(
        'A number in the title',
        'The title contains a numeral or written-out number.',
      ),
    ],
    [road, night, dance],
  ),
  p(
    '12',
    'Beautiful friction',
    'Make some space for the unexpected.',
    [
      fact(
        'Distorted guitar',
        'Clearly audible distorted or overdriven guitar.',
      ),
      fact(
        'Layered vocals',
        'Includes simultaneous overdubbed vocals or multiple vocalists.',
      ),
      fact(
        'An instrumental passage',
        'Includes a distinct instrumental passage of at least roughly 20 seconds without lead vocals.',
      ),
    ],
    [
      vibe(
        'Beautifully uneasy',
        'Balances beauty with tension, dissonance, darkness, or instability.',
      ),
      big,
      vibe(
        'A surprising groove',
        'An off-kilter, unexpected or unusually compelling rhythmic feel.',
      ),
    ],
  ),
  p(
    '13',
    'Sunday selections',
    'Slow down without standing still.',
    [era('1960s'), era('2000s'), era('2010s')],
    [
      soft,
      vibe(
        'Coffee and a slow start',
        'Warm, easygoing or gently engaging music for an unhurried morning.',
      ),
      vibe(
        'Sun through the window',
        'Feels bright, hopeful, warm or quietly uplifting.',
      ),
    ],
  ),
  p(
    '14',
    'The room changes',
    'One song can shift the whole atmosphere.',
    [
      fact(
        'A solo artist',
        'Released under a solo artist’s name; backing bands and guests are allowed.',
      ),
      fact('A band or duo', 'Released under a band or duo name.'),
      fact(
        'A guest or collaboration',
        'Credited collaboration or a documented featured guest performer.',
      ),
    ],
    [dance, vibe('A little unsettling'), big],
  ),
  p(
    '15',
    'Out of this world',
    'Follow the texture wherever it goes.',
    [era('1970s'), era('2000s'), era('2020s')],
    [
      vibe(
        'Feels like floating',
        'Weightless, suspended, drifting or enveloping in sound.',
      ),
      vibe(
        'Controlled chaos',
        'Dense, frenetic or unpredictable music held together by a convincing musical logic.',
      ),
      night,
    ],
  ),
  p(
    '16',
    'Side A / side B',
    'Think in albums, answer in songs.',
    [
      fact(
        'Album opener',
        'First musical track on an original standard album edition. Name the album if helpful.',
      ),
      fact(
        'Album closer',
        'Last musical track on an original standard album edition, excluding bonus tracks.',
      ),
      fact(
        'Somewhere in between',
        'Appears between the first and last tracks of an original standard album edition.',
      ),
    ],
    [road, soft, big],
  ),
  p(
    '17',
    'Heart on the sleeve',
    'No need to play it cool.',
    [era('1980s'), era('2000s'), era('2010s')],
    [
      vibe(
        'A breakup companion',
        'Fits heartbreak, loss of a relationship, longing, or recovery from a breakup.',
      ),
      vibe(
        'Head-over-heels energy',
        'Captures infatuation, affection or the exhilaration of falling in love.',
      ),
      vibe(
        'A defiant streak',
        'Conveys rebellion, resistance, anger or self-assertion.',
      ),
    ],
  ),
  p(
    '18',
    'Beyond the chorus',
    'Let the instruments do some talking.',
    [
      fact(
        'Instrumental recording',
        'No substantive sung or rapped lyrics; incidental wordless voices are allowed.',
      ),
      fact(
        'Includes a solo',
        'A clearly featured instrumental solo or solo-like passage.',
      ),
      fact(
        'Changes tempo or meter',
        'Has a discernible intentional tempo or meter change; expressive rubato also qualifies.',
      ),
    ],
    [night, road, vibe('A psychedelic detour')],
  ),
  p(
    '19',
    'Old soul, new tricks',
    'Different eras, familiar instincts.',
    [era('1960s'), era('1990s'), era('2020s')],
    [
      dance,
      vibe(
        'A rebellious spirit',
        'Defiant, unconventional or resistant to expectations in sound or lyrics.',
      ),
      vibe(
        'Timeless tenderness',
        'Warmth, vulnerability or affection that translates beyond its era.',
      ),
    ],
  ),
  p(
    '20',
    'The closing set',
    'Leave them with something to remember.',
    [
      fact('Over 6 minutes', 'The specified recording is longer than 6:00.'),
      fact(
        'A cover version',
        'A recording of a song previously released by a different artist; identify the version.',
      ),
      fact(
        'A live recording',
        'A released recording of a live performance, rather than the studio original; identify the version.',
      ),
    ],
    [big, vibe('The final singalong'), night],
  ),
];
// Fixed layouts, shared by everyone. Only compatible categories are mixed:
// instruments can overlap, unlike mutually exclusive release decades.
const reversed = new Set(['02', '05', '07', '10', '13', '17', '19']);
const mixed = new Set(['04', '06', '08', '12', '18']);
export const puzzles: Puzzle[] = collection.map((puzzle) => {
  if (reversed.has(puzzle.id))
    return { ...puzzle, rows: puzzle.cols, cols: puzzle.rows };
  if (mixed.has(puzzle.id))
    return {
      ...puzzle,
      rows: [puzzle.rows[0], puzzle.cols[1], puzzle.rows[2]],
      cols: [puzzle.cols[0], puzzle.rows[1], puzzle.cols[2]],
    };
  return puzzle;
});
export const getPuzzle = (id: string) => puzzles.find((p) => p.id === id);
