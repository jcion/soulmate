export interface Word {
  id: number
  answer: string
  clue: string   // Player A sees this
  hint: string   // Player B sees this
}

export interface Puzzle {
  id: number
  theme: string
  words: Word[]
}

export const puzzles: Puzzle[] = [
  {
    id: 0,
    theme: '🇦🇺 Sydney',
    words: [
      { id: 1, answer: 'BONDI',     clue: "Sydney's most famous beach, packed with surfers and backpackers",         hint: "5 letters · _____ Beach · Rhymes with 'fondue' but ends in 'ee'" },
      { id: 2, answer: 'VEGEMITE',  clue: "Australia's dark, salty spread that foreigners always regret trying",     hint: "8 letters · Goes on toast · Rhymes with 'mega-bite'" },
      { id: 3, answer: 'KYLIE',     clue: "Australian pop queen who sang 'Can't Get You Out of My Head'",           hint: "5 letters · First name only · Minogue" },
      { id: 4, answer: 'HARBOUR',   clue: "The famous Sydney bridge spans this body of water",                      hint: "6 letters · Where boats dock · Sydney _____ Bridge" },
      { id: 5, answer: 'SKIPPY',    clue: "Australia's most famous TV kangaroo, star of a classic kids' show",      hint: "6 letters · Rhymes with 'hippy' · _____ the Bush Kangaroo" },
    ],
  },
  {
    id: 1,
    theme: '🇨🇦 Vancouver',
    words: [
      { id: 1, answer: 'CANUCKS',   clue: "Vancouver's beloved NHL hockey team",                                    hint: "7 letters · Ice hockey · Vancouver _____" },
      { id: 2, answer: 'STANLEY',   clue: "Vancouver's massive urban park, bigger than Central Park",               hint: "7 letters · _____ Park · Also the name of hockey's ultimate trophy" },
      { id: 3, answer: 'GASTOWN',   clue: "Vancouver's historic cobblestone neighbourhood with a famous steam clock", hint: "7 letters · Neighbourhood · Named after 'Gassy' Jack Deighton" },
      { id: 4, answer: 'GROUSE',    clue: "The mountain locals hike 'the Grind' on, overlooking the city",         hint: "6 letters · Also a type of bird · _____ Mountain" },
      { id: 5, answer: 'CAPILANO',  clue: "Vancouver's iconic suspension bridge stretched over a deep forest canyon", hint: "8 letters · _____ Suspension Bridge · Also a river" },
    ],
  },
  {
    id: 2,
    theme: '🇨🇦 Toronto',
    words: [
      { id: 1, answer: 'DRAKE',     clue: "Toronto's most famous rapper, born Aubrey Graham, raised on Degrassi",   hint: "5 letters · Also a male duck · 'Started From the Bottom'" },
      { id: 2, answer: 'RAPTORS',   clue: "Toronto's NBA team that shocked the world by winning the 2019 championship", hint: "7 letters · Dinosaur predators · 2019 NBA Champions" },
      { id: 3, answer: 'DEGRASSI',  clue: "The iconic Canadian teen drama that launched Drake's acting career",     hint: "8 letters · Canadian TV show · _____ the Next Generation" },
      { id: 4, answer: 'LEAFS',     clue: "Toronto's NHL team, beloved despite decades of heartbreak",              hint: "5 letters · Maple _____ · Plural of a leaf, hockey edition" },
      { id: 5, answer: 'DUNDAS',    clue: "Toronto's famous square and the street that cuts across the city",       hint: "6 letters · A Toronto street · _____ Square" },
    ],
  },
  {
    id: 3,
    theme: '🇺🇸 New York',
    words: [
      { id: 1, answer: 'BROADWAY',  clue: "New York's legendary avenue and the heart of the theatre world",        hint: "8 letters · Showtime · Where musicals live" },
      { id: 2, answer: 'SEINFELD',  clue: "The sitcom 'about nothing', set in a Manhattan apartment",              hint: "8 letters · A comedian's last name · 'No soup for you!'" },
      { id: 3, answer: 'BROOKLYN',  clue: "The NYC borough that became a global symbol of cool and creativity",    hint: "8 letters · Jay-Z's home · The bridge connects it to Manhattan" },
      { id: 4, answer: 'BAGEL',     clue: "New York's most iconic ring-shaped breakfast bread",                    hint: "5 letters · Topped with cream cheese · Circular bread" },
      { id: 5, answer: 'YANKEES',   clue: "New York's most decorated baseball team, known for pinstripes",        hint: "7 letters · Baseball · 27 World Series titles" },
    ],
  },
  {
    id: 4,
    theme: '🇨🇳 Guangzhou',
    words: [
      { id: 1, answer: 'CANTON',    clue: "The old Western name for Guangzhou, still used to describe its cuisine", hint: "6 letters · Cantonese comes from this · Colonial-era name for the city" },
      { id: 2, answer: 'WONTON',    clue: "Cantonese dumpling stuffed with pork, usually served in broth",         hint: "6 letters · Dumpling in soup · Rhymes with 'con-on'" },
      { id: 3, answer: 'YUMCHA',    clue: "The Cantonese tradition of drinking tea and sharing small dishes",      hint: "6 letters · Cantonese for 'drink tea' · The dim sum experience" },
      { id: 4, answer: 'PEARL',     clue: "The famous river that flows through Guangzhou to the South China Sea",  hint: "5 letters · A gem from an oyster · _____ River" },
      { id: 5, answer: 'CANTONESE', clue: "The dialect spoken in Guangzhou, Hong Kong, and Macau",                hint: "9 letters · A language · Named after the city's old Western name" },
    ],
  },
  {
    id: 5,
    theme: '🇵🇭 Manila',
    words: [
      { id: 1, answer: 'JOLLIBEE',  clue: "The iconic Filipino fast food mascot and chain that beats McDonald's at home", hint: "8 letters · A happy bee · Filipino's favourite burger joint" },
      { id: 2, answer: 'JEEPNEY',   clue: "Manila's colourful, decorated public transport repurposed from WWII American jeeps", hint: "7 letters · Bright and ornate · Filipino road icon" },
      { id: 3, answer: 'ADOBO',     clue: "The Philippines' unofficial national dish — meat braised in vinegar, soy, and garlic", hint: "5 letters · Filipino comfort food · Also a seasoning brand" },
      { id: 4, answer: 'RIZAL',     clue: "The Philippines' national hero, executed by the Spanish in 1896, on every peso coin", hint: "5 letters · José _____ · National hero's surname" },
      { id: 5, answer: 'BALUT',     clue: "Manila's most daring street food — a fertilised duck egg eaten in the shell",        hint: "5 letters · Street food · Fertilised egg · Not for the faint-hearted" },
    ],
  },
]

export function getTodaysPuzzleIndex(): number {
  const start = new Date('2024-01-01').getTime()
  const today = new Date().setHours(0, 0, 0, 0)
  return Math.floor((today - start) / (1000 * 60 * 60 * 24)) % puzzles.length
}

export function getPuzzleByIndex(index: number): Puzzle {
  return puzzles[index % puzzles.length]
}
