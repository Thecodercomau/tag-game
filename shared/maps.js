const w = (x, y, width, height, type = 'wall') => ({ x, y, w: width, h: height, type });
const spawn = (x, y) => ({ x, y });

const boundary = (width, height, thickness = 24) => [
  w(0, 0, width, thickness, 'boundary'),
  w(0, height - thickness, width, thickness, 'boundary'),
  w(0, 0, thickness, height, 'boundary'),
  w(width - thickness, 0, thickness, height, 'boundary')
];

const playground = {
  id: 'playground',
  name: 'School Playground',
  subtitle: 'Recess rules',
  description: 'A sunlit playground of benches, trees and noisy equipment. Wide lanes for chases, tight corners for escapes.',
  width: 2000,
  height: 1400,
  difficulty: 'Friendly',
  theme: {
    background: 0x8fcf7a,
    floor: 0x9ed889,
    floorAlt: 0x8bc97b,
    wall: 0x5b7d55,
    wallTop: 0x74966c,
    accent: 0xffcc4d,
    ink: 0x1d3527,
    sky: 0x8ed8ff
  },
  walls: [
    ...boundary(2000, 1400),
    w(140, 120, 112, 112, 'tree'),
    w(310, 96, 74, 74, 'tree'),
    w(1710, 130, 112, 112, 'tree'),
    w(1510, 350, 88, 88, 'tree'),
    w(180, 920, 94, 94, 'tree'),
    w(1210, 1130, 96, 96, 'tree'),
    w(720, 240, 220, 96, 'slide'),
    w(1230, 230, 220, 84, 'swing'),
    w(430, 560, 130, 36, 'bench'),
    w(1430, 680, 130, 36, 'bench'),
    w(890, 1120, 130, 36, 'bench'),
    w(1570, 930, 190, 160, 'playhouse'),
    w(1040, 620, 150, 100, 'sandbox'),
    w(590, 830, 42, 42, 'planter'),
    w(1830, 760, 42, 42, 'planter'),
    w(300, 1190, 42, 42, 'planter'),
    w(940, 430, 42, 42, 'planter')
  ],
  spawns: [
    spawn(380, 420), spawn(680, 590), spawn(1040, 390), spawn(1490, 560),
    spawn(1810, 610), spawn(380, 1010), spawn(1020, 930), spawn(1630, 1190),
    spawn(270, 1260), spawn(1130, 1240), spawn(620, 1010), spawn(1330, 900)
  ],
  zones: [
    { x: 760, y: 760, label: 'THE YARD' },
    { x: 1500, y: 500, label: 'SWINGS' },
    { x: 320, y: 780, label: 'SHADE' }
  ],
  paths: [
    { x: 500, y: 480, w: 1050, h: 64, type: 'path' },
    { x: 1000, y: 450, w: 64, h: 640, type: 'path' },
    { x: 370, y: 380, w: 56, h: 760, type: 'path' }
  ],
  landmarks: [
    { x: 830, y: 288, label: 'Slide', icon: 'slide' },
    { x: 1340, y: 272, label: 'Swings', icon: 'swing' },
    { x: 1665, y: 1010, label: 'Playhouse', icon: 'house' }
  ]
};

const campus = {
  id: 'campus',
  name: 'School Campus',
  subtitle: 'Between classes',
  description: 'Classroom blocks frame a busy courtyard. Cut through the gaps or loop around the library to shake a chaser.',
  width: 2200,
  height: 1600,
  difficulty: 'Tactical',
  theme: {
    background: 0x79b6a0,
    floor: 0x8fc4ac,
    floorAlt: 0x7fb69d,
    wall: 0x445b64,
    wallTop: 0x5f7880,
    accent: 0xffa94d,
    ink: 0x172d31,
    sky: 0x8ed8ff
  },
  walls: [
    ...boundary(2200, 1600),
    w(180, 150, 560, 300, 'building'),
    w(1000, 120, 360, 260, 'building'),
    w(1600, 150, 430, 320, 'building'),
    w(180, 760, 360, 420, 'building'),
    w(1650, 800, 400, 420, 'building'),
    w(930, 1080, 250, 170, 'portable'),
    w(710, 500, 44, 190, 'planter'),
    w(1460, 510, 44, 190, 'planter'),
    w(640, 1210, 140, 36, 'bench'),
    w(1530, 1260, 140, 36, 'bench'),
    w(1200, 650, 120, 120, 'fountain'),
    w(1220, 490, 80, 80, 'tree'),
    w(600, 870, 80, 80, 'tree'),
    w(1960, 620, 80, 80, 'tree'),
    w(260, 1320, 80, 80, 'tree')
  ],
  spawns: [
    spawn(650, 540), spawn(860, 580), spawn(1160, 540), spawn(1530, 610),
    spawn(900, 760), spawn(1200, 810), spawn(1500, 760), spawn(700, 1060),
    spawn(1210, 990), spawn(1450, 1050), spawn(850, 1260), spawn(1650, 1330),
    spawn(400, 1320), spawn(1900, 700)
  ],
  zones: [
    { x: 1080, y: 850, label: 'COURTYARD' },
    { x: 1250, y: 350, label: 'LIBRARY' },
    { x: 500, y: 1300, label: 'WEST WING' }
  ],
  paths: [
    { x: 560, y: 500, w: 980, h: 64, type: 'path' },
    { x: 560, y: 500, w: 64, h: 760, type: 'path' },
    { x: 1480, y: 500, w: 64, h: 760, type: 'path' },
    { x: 560, y: 1200, w: 980, h: 70, type: 'path' },
    { x: 1040, y: 380, w: 80, h: 700, type: 'path' }
  ],
  landmarks: [
    { x: 1250, y: 350, label: 'Library', icon: 'book' },
    { x: 1030, y: 710, label: 'Fountain', icon: 'water' },
    { x: 1720, y: 1000, label: 'East Hall', icon: 'door' }
  ]
};

const park = {
  id: 'park',
  name: 'City Park',
  subtitle: 'Mind the pond',
  description: 'Meandering footpaths, dense trees and a broad reflective pond. Use the gazebo loop to break line of sight.',
  width: 2200,
  height: 1500,
  difficulty: 'Open',
  theme: {
    background: 0x69ad78,
    floor: 0x7fbe84,
    floorAlt: 0x6eb178,
    wall: 0x3f6b4c,
    wallTop: 0x557f5e,
    accent: 0x7bdff2,
    ink: 0x152e21,
    sky: 0x9ee4ff
  },
  walls: [
    ...boundary(2200, 1500),
    w(1150, 480, 520, 330, 'pond'),
    w(340, 310, 200, 200, 'gazebo'),
    w(160, 140, 100, 100, 'tree'),
    w(420, 160, 90, 90, 'tree'),
    w(760, 180, 110, 110, 'tree'),
    w(1500, 200, 100, 100, 'tree'),
    w(1850, 330, 120, 120, 'tree'),
    w(230, 700, 100, 100, 'tree'),
    w(720, 940, 110, 110, 'tree'),
    w(1440, 980, 100, 100, 'tree'),
    w(1880, 1120, 120, 120, 'tree'),
    w(420, 1220, 100, 100, 'tree'),
    w(1080, 1210, 90, 90, 'tree'),
    w(900, 560, 150, 36, 'bench'),
    w(1710, 680, 150, 36, 'bench'),
    w(500, 1000, 150, 36, 'bench'),
    w(1530, 1280, 44, 44, 'planter'),
    w(880, 1270, 44, 44, 'planter'),
    w(740, 420, 44, 44, 'planter')
  ],
  spawns: [
    spawn(320, 560), spawn(680, 380), spawn(1020, 300), spawn(1460, 380),
    spawn(1850, 560), spawn(280, 900), spawn(760, 780), spawn(1100, 980),
    spawn(1510, 880), spawn(1840, 980), spawn(640, 1340), spawn(1320, 1340),
    spawn(2000, 760), spawn(360, 1420)
  ],
  zones: [
    { x: 1000, y: 720, label: 'MIRROR POND' },
    { x: 440, y: 260, label: 'GAZEBO' },
    { x: 1700, y: 1040, label: 'WILLOW WALK' }
  ],
  paths: [
    { x: 240, y: 620, w: 840, h: 70, type: 'path' },
    { x: 1000, y: 300, w: 70, h: 840, type: 'path' },
    { x: 1040, y: 1080, w: 760, h: 70, type: 'path' },
    { x: 1710, y: 620, w: 70, h: 500, type: 'path' },
    { x: 410, y: 690, w: 70, h: 520, type: 'path' }
  ],
  landmarks: [
    { x: 1410, y: 650, label: 'Mirror Pond', icon: 'water' },
    { x: 440, y: 260, label: 'Gazebo', icon: 'house' },
    { x: 1960, y: 860, label: 'Willows', icon: 'tree' }
  ]
};

const mall = {
  id: 'mall',
  name: 'Shopping Centre',
  subtitle: 'After hours',
  description: 'Slick walkways and shop fronts create a maze of corners. Central kiosks make excellent impromptu roundabouts.',
  width: 2100,
  height: 1400,
  difficulty: 'Tight',
  theme: {
    background: 0x9b93bd,
    floor: 0xc9c2df,
    floorAlt: 0xb9b2d1,
    wall: 0x554d73,
    wallTop: 0x706790,
    accent: 0xff9dc1,
    ink: 0x241d38,
    sky: 0x7ad7ff
  },
  walls: [
    ...boundary(2100, 1400),
    w(100, 100, 350, 260, 'shop'),
    w(600, 100, 350, 260, 'shop'),
    w(1200, 100, 350, 260, 'shop'),
    w(1700, 100, 300, 260, 'shop'),
    w(500, 550, 230, 160, 'kiosk'),
    w(1370, 550, 230, 160, 'kiosk'),
    w(850, 860, 400, 160, 'kiosk'),
    w(140, 1050, 300, 250, 'shop'),
    w(1660, 1050, 300, 250, 'shop'),
    w(1040, 460, 50, 50, 'planter'),
    w(1000, 1110, 50, 50, 'planter'),
    w(400, 1230, 44, 44, 'planter'),
    w(1640, 480, 44, 44, 'planter'),
    w(820, 420, 100, 36, 'bench'),
    w(1190, 790, 100, 36, 'bench'),
    w(620, 1060, 100, 36, 'bench')
  ],
  spawns: [
    spawn(300, 470), spawn(760, 470), spawn(1210, 470), spawn(1590, 460),
    spawn(1960, 560), spawn(420, 820), spawn(850, 700), spawn(1250, 700),
    spawn(1660, 810), spawn(500, 990), spawn(1300, 1000), spawn(1900, 980),
    spawn(980, 1230), spawn(1450, 1230)
  ],
  zones: [
    { x: 1050, y: 620, label: 'GRAND WALK' },
    { x: 250, y: 240, label: 'NORTH ARCADE' },
    { x: 1260, y: 1080, label: 'FOOD COURT' }
  ],
  paths: [
    { x: 420, y: 380, w: 1250, h: 70, type: 'path' },
    { x: 400, y: 450, w: 70, h: 560, type: 'path' },
    { x: 1680, y: 420, w: 70, h: 620, type: 'path' },
    { x: 420, y: 1040, w: 1240, h: 70, type: 'path' }
  ],
  landmarks: [
    { x: 275, y: 230, label: 'North Arcade', icon: 'shop' },
    { x: 1470, y: 630, label: 'Clock Kiosk', icon: 'clock' },
    { x: 1300, y: 1090, label: 'Food Court', icon: 'food' }
  ]
};

const neon = {
  id: 'neon',
  name: 'Neon Arena',
  subtitle: 'Afterglow circuit',
  description: 'A symmetrical electronic arena built for lightning-fast rotations. Hard angles, glowing lanes and nowhere to hide for long.',
  width: 1900,
  height: 1300,
  difficulty: 'Competitive',
  theme: {
    background: 0x0c1029,
    floor: 0x151b3d,
    floorAlt: 0x101632,
    wall: 0x293269,
    wallTop: 0x3b4a8f,
    accent: 0x45f6e0,
    ink: 0xd8fdff,
    sky: 0x111a42
  },
  walls: [
    ...boundary(1900, 1300, 22),
    w(380, 230, 240, 84, 'neon'),
    w(1280, 230, 240, 84, 'neon'),
    w(820, 420, 260, 90, 'neon'),
    w(280, 780, 84, 250, 'neon'),
    w(1536, 780, 84, 250, 'neon'),
    w(820, 920, 260, 74, 'neon'),
    w(518, 600, 64, 120, 'neon'),
    w(1318, 600, 64, 120, 'neon'),
    w(720, 690, 170, 48, 'neon'),
    w(1010, 690, 170, 48, 'neon'),
    w(940, 1120, 220, 42, 'neon'),
    w(1680, 420, 54, 54, 'neon'),
    w(168, 420, 54, 54, 'neon'),
    w(1680, 1090, 54, 54, 'neon'),
    w(168, 1090, 54, 54, 'neon')
  ],
  spawns: [
    spawn(280, 350), spawn(700, 330), spawn(950, 290), spawn(1220, 330),
    spawn(1640, 350), spawn(280, 620), spawn(750, 590), spawn(1150, 590),
    spawn(1640, 620), spawn(300, 1120), spawn(700, 1040), spawn(1200, 1040),
    spawn(1600, 1120), spawn(950, 770)
  ],
  zones: [
    { x: 950, y: 780, label: 'THE CIRCUIT' },
    { x: 950, y: 180, label: 'ION GATE' },
    { x: 1700, y: 1180, label: 'SHOCK PAD' }
  ],
  paths: [
    { x: 260, y: 480, w: 1380, h: 44, type: 'neonpath' },
    { x: 260, y: 840, w: 1380, h: 44, type: 'neonpath' },
    { x: 900, y: 260, w: 44, h: 800, type: 'neonpath' }
  ],
  landmarks: [
    { x: 950, y: 180, label: 'Ion Gate', icon: 'bolt' },
    { x: 950, y: 660, label: 'Core', icon: 'core' },
    { x: 1700, y: 1180, label: 'Shock Pad', icon: 'bolt' }
  ]
};

export const MAPS = Object.freeze([playground, campus, park, mall, neon]);
export const MAP_MAP = Object.freeze(Object.fromEntries(MAPS.map((map) => [map.id, map])));
export const DEFAULT_MAP_ID = 'playground';

export function getMap(mapId) {
  return MAP_MAP[mapId] || MAP_MAP[DEFAULT_MAP_ID];
}

export function allSpawns(map) {
  return map.spawns.filter(Boolean);
}
