import { PLAYER_HALF_HEIGHT } from './constants.js';

const STAND = PLAYER_HALF_HEIGHT + 1;
const p = (x, y, w, h = 24, type = 'ledge') => ({ x, y, w, h, type });
const stand = (x, top) => ({ x, y: top - STAND });
const ground = (width, height) => p(0, height - 100, width, 100, 'ground');

const playground = {
  id: 'playground',
  name: 'School Playground',
  subtitle: 'Recess rules',
  description: 'A sunlit climbing frame of slides, benches and treetop ledges. Hop between tiers, cut corners and keep moving.',
  width: 2800,
  height: 1250,
  difficulty: 'Friendly',
  theme: {
    background: 0x8fcf7a,
    floor: 0x9ed889,
    floorAlt: 0x8bc97b,
    wall: 0x5b7d55,
    wallTop: 0x74966c,
    accent: 0xffcc4d,
    ink: 0x1d3527,
    sky: 0x8ed8ff,
    skyTop: 0x6ec7f5,
    skyBottom: 0xd9f4ff,
    platform: 0x5b7d55,
    platformTop: 0x86b36c,
    platformSide: 0x46663f,
    cloud: 0xffffff
  },
  platforms: [
    ground(2800, 1250),
    p(80, 1020, 300, 26, 'grass'),
    p(500, 1020, 300, 26, 'ledge'),
    p(930, 1020, 320, 26, 'slide'),
    p(1390, 1020, 300, 26, 'grass'),
    p(1830, 1020, 300, 26, 'bench'),
    p(2280, 1020, 280, 26, 'grass'),
    p(2660, 1020, 100, 26, 'ledge'),
    p(260, 890, 260, 24, 'bench'),
    p(670, 890, 260, 24, 'grass'),
    p(1080, 890, 300, 24, 'ledge'),
    p(1520, 890, 280, 24, 'slide'),
    p(1950, 890, 280, 24, 'grass'),
    p(2380, 890, 260, 24, 'bench'),
    p(450, 760, 280, 24, 'ledge'),
    p(860, 760, 260, 24, 'grass'),
    p(1280, 760, 300, 24, 'bench'),
    p(1730, 760, 280, 24, 'ledge'),
    p(2160, 760, 280, 24, 'grass'),
    p(2550, 760, 190, 24, 'ledge'),
    p(650, 630, 260, 22, 'grass'),
    p(1030, 630, 280, 22, 'ledge'),
    p(1450, 630, 300, 22, 'slide'),
    p(1890, 630, 280, 22, 'bench'),
    p(2310, 630, 260, 22, 'ledge'),
    p(860, 500, 280, 22, 'ledge'),
    p(1270, 500, 300, 22, 'grass'),
    p(1710, 500, 280, 22, 'bench'),
    p(2120, 500, 260, 22, 'ledge'),
    p(1080, 370, 300, 20, 'slide'),
    p(1530, 370, 280, 20, 'ledge'),
    p(1950, 370, 260, 20, 'grass'),
    p(1320, 240, 320, 20, 'bench'),
    p(760, 1080, 160, 16, 'bench'),
    p(2050, 1070, 170, 16, 'sandbox'),
    p(600, 940, 140, 16, 'planter'),
    p(2470, 930, 150, 16, 'planter')
  ],
  spawns: [
    stand(300, 1150), stand(850, 1150), stand(1350, 1150), stand(1850, 1150), stand(2300, 1150), stand(2700, 1150),
    stand(160, 1020), stand(560, 1020), stand(1000, 1020), stand(1460, 1020), stand(1900, 1020), stand(2350, 1020),
    stand(340, 890), stand(1160, 890), stand(1600, 890), stand(2010, 890)
  ],
  zones: [
    { x: 880, y: 720, label: 'THE YARD' },
    { x: 2140, y: 640, label: 'SWINGS' },
    { x: 430, y: 820, label: 'SHADE' }
  ],
  landmarks: [
    { x: 1090, y: 1010, label: 'Slide', icon: 'slide' },
    { x: 2350, y: 1000, label: 'Swings', icon: 'swing' },
    { x: 1460, y: 230, label: 'Treehouse', icon: 'house' }
  ],
  decor: [
    { type: 'cloud', x: 300, y: 165, s: 1.2 },
    { type: 'cloud', x: 1280, y: 110, s: 0.85 },
    { type: 'cloud', x: 2380, y: 185, s: 1.1 },
    { type: 'hill', x: 420, y: 1150, s: 1.3 },
    { type: 'hill', x: 1640, y: 1150, s: 1.6 },
    { type: 'hill', x: 2560, y: 1150, s: 1.2 },
    { type: 'tree', x: 150, y: 1150, s: 1.1 },
    { type: 'tree', x: 440, y: 1150, s: 1.35 },
    { type: 'tree', x: 1270, y: 1150, s: 1.2 },
    { type: 'tree', x: 1990, y: 1150, s: 1.35 },
    { type: 'tree', x: 2690, y: 1150, s: 1.15 },
    { type: 'sign', x: 1400, y: 1085, s: 1, label: 'PLAY' }
  ]
};

const campus = {
  id: 'campus',
  name: 'School Campus',
  subtitle: 'After the bell',
  description: 'Rooftops, awnings and covered walkways stack into a vertical chase through the courtyard. Take the high road or duck through the gaps.',
  width: 3000,
  height: 1250,
  difficulty: 'Tactical',
  theme: {
    background: 0x79b6a0,
    floor: 0x8fc4ac,
    floorAlt: 0x7fb69d,
    wall: 0x445b64,
    wallTop: 0x5f7880,
    accent: 0xffa94d,
    ink: 0x172d31,
    sky: 0x8ed8ff,
    skyTop: 0x6cb7dd,
    skyBottom: 0xe4f7ff,
    platform: 0x445b64,
    platformTop: 0x7d9aa3,
    platformSide: 0x30444c,
    cloud: 0xf5fbff
  },
  platforms: [
    ground(3000, 1250),
    p(70, 1020, 340, 26, 'roof'),
    p(540, 1020, 260, 26, 'roof'),
    p(960, 1020, 320, 26, 'roof'),
    p(1430, 1020, 300, 26, 'roof'),
    p(1840, 1020, 280, 26, 'roof'),
    p(2240, 1020, 320, 26, 'roof'),
    p(2680, 1020, 250, 26, 'roof'),
    p(170, 890, 260, 24, 'roof'),
    p(610, 890, 260, 24, 'ledge'),
    p(1060, 890, 240, 24, 'roof'),
    p(1480, 890, 280, 24, 'roof'),
    p(1920, 890, 280, 24, 'ledge'),
    p(2380, 890, 260, 24, 'roof'),
    p(2780, 890, 170, 24, 'roof'),
    p(360, 760, 280, 24, 'ledge'),
    p(830, 760, 300, 24, 'roof'),
    p(1280, 760, 260, 24, 'roof'),
    p(1730, 760, 280, 24, 'ledge'),
    p(2200, 760, 300, 24, 'roof'),
    p(2620, 760, 240, 24, 'roof'),
    p(600, 630, 300, 22, 'roof'),
    p(1100, 630, 280, 22, 'ledge'),
    p(1560, 630, 300, 22, 'roof'),
    p(2060, 630, 280, 22, 'roof'),
    p(2520, 630, 260, 22, 'ledge'),
    p(850, 500, 280, 22, 'ledge'),
    p(1350, 500, 320, 22, 'roof'),
    p(1900, 500, 280, 22, 'roof'),
    p(2370, 500, 260, 22, 'ledge'),
    p(1130, 370, 280, 20, 'roof'),
    p(1660, 370, 300, 20, 'ledge'),
    p(2160, 370, 260, 20, 'roof'),
    p(1460, 240, 320, 20, 'roof'),
    p(780, 1080, 180, 16, 'bench'),
    p(1700, 1070, 180, 16, 'bench'),
    p(2480, 1080, 160, 16, 'bench')
  ],
  spawns: [
    stand(160, 1150), stand(700, 1150), stand(1220, 1150), stand(1780, 1150), stand(2320, 1150), stand(2820, 1150),
    stand(250, 1020), stand(680, 890), stand(1120, 1020), stand(1580, 890), stand(2020, 1020), stand(2460, 890),
    stand(860, 760), stand(1780, 760), stand(2410, 890), stand(3000 - 150, 1150)
  ],
  zones: [
    { x: 1250, y: 730, label: 'COURTYARD' },
    { x: 1630, y: 350, label: 'LIBRARY' },
    { x: 540, y: 860, label: 'WEST WING' }
  ],
  landmarks: [
    { x: 1500, y: 1010, label: 'Library', icon: 'book' },
    { x: 1120, y: 870, label: 'Fountain', icon: 'water' },
    { x: 2040, y: 740, label: 'East Hall', icon: 'door' }
  ],
  decor: [
    { type: 'cloud', x: 560, y: 130, s: 0.9 },
    { type: 'cloud', x: 1740, y: 170, s: 1.1 },
    { type: 'cloud', x: 2640, y: 120, s: 0.8 },
    { type: 'building', x: 260, y: 1150, s: 1.2 },
    { type: 'building', x: 1280, y: 1150, s: 1.5 },
    { type: 'building', x: 2380, y: 1150, s: 1.35 },
    { type: 'tree', x: 720, y: 1150, s: 1.1 },
    { type: 'tree', x: 1880, y: 1150, s: 1.2 },
    { type: 'tree', x: 2860, y: 1150, s: 1.05 },
    { type: 'lamp', x: 1060, y: 1150, s: 1 },
    { type: 'lamp', x: 2160, y: 1150, s: 1 },
    { type: 'sign', x: 1080, y: 1085, s: 1, label: 'CAMPUS' }
  ]
};

const park = {
  id: 'park',
  name: 'City Park',
  subtitle: 'Mind the pond',
  description: 'Stone terraces climb above the pond and willow walk. Long grass ledges make for quick escapes and quick mistakes.',
  width: 3200,
  height: 1250,
  difficulty: 'Open',
  theme: {
    background: 0x69ad78,
    floor: 0x7fbe84,
    floorAlt: 0x6eb178,
    wall: 0x3f6b4c,
    wallTop: 0x557f5e,
    accent: 0x7bdff2,
    ink: 0x152e21,
    sky: 0x9ee4ff,
    skyTop: 0x79cfea,
    skyBottom: 0xe8faff,
    platform: 0x4a7654,
    platformTop: 0x8fc76e,
    platformSide: 0x34553d,
    cloud: 0xffffff
  },
  platforms: [
    ground(3200, 1250),
    p(90, 1000, 320, 26, 'grass'),
    p(520, 1000, 300, 26, 'stone'),
    p(940, 1000, 360, 26, 'grass'),
    p(1430, 1000, 320, 26, 'stone'),
    p(1900, 1000, 340, 26, 'grass'),
    p(2400, 1000, 320, 26, 'stone'),
    p(2850, 1000, 280, 26, 'grass'),
    p(280, 870, 280, 24, 'stone'),
    p(700, 870, 300, 24, 'grass'),
    p(1150, 870, 280, 24, 'stone'),
    p(1580, 870, 300, 24, 'grass'),
    p(2040, 870, 300, 24, 'stone'),
    p(2500, 870, 300, 24, 'grass'),
    p(2920, 870, 220, 24, 'stone'),
    p(500, 740, 300, 24, 'grass'),
    p(960, 740, 280, 24, 'stone'),
    p(1400, 740, 320, 24, 'grass'),
    p(1860, 740, 300, 24, 'stone'),
    p(2320, 740, 300, 24, 'grass'),
    p(2740, 740, 260, 24, 'stone'),
    p(740, 610, 300, 22, 'stone'),
    p(1210, 610, 300, 22, 'grass'),
    p(1680, 610, 300, 22, 'stone'),
    p(2150, 610, 300, 22, 'grass'),
    p(2600, 610, 280, 22, 'stone'),
    p(1000, 480, 300, 22, 'grass'),
    p(1480, 480, 320, 22, 'stone'),
    p(1980, 480, 300, 22, 'grass'),
    p(2460, 480, 280, 22, 'stone'),
    p(1270, 350, 300, 20, 'stone'),
    p(1770, 350, 300, 20, 'grass'),
    p(2260, 350, 280, 20, 'stone'),
    p(1600, 220, 340, 20, 'grass'),
    p(570, 1080, 200, 16, 'bench'),
    p(1490, 1080, 200, 16, 'bench'),
    p(2600, 1080, 180, 16, 'bench')
  ],
  spawns: [
    stand(200, 1150), stand(780, 1150), stand(1300, 1150), stand(1850, 1150), stand(2350, 1150), stand(2980, 1150),
    stand(180, 1000), stand(600, 1000), stand(1020, 1000), stand(1520, 1000), stand(1990, 1000), stand(2470, 1000),
    stand(360, 870), stand(1210, 870), stand(2130, 870), stand(2860, 1000)
  ],
  zones: [
    { x: 1540, y: 680, label: 'MIRROR POND' },
    { x: 660, y: 690, label: 'GAZEBO' },
    { x: 2550, y: 920, label: 'WILLOW WALK' }
  ],
  landmarks: [
    { x: 1600, y: 990, label: 'Mirror Pond', icon: 'water' },
    { x: 690, y: 860, label: 'Gazebo', icon: 'house' },
    { x: 2780, y: 990, label: 'Willows', icon: 'tree' }
  ],
  decor: [
    { type: 'cloud', x: 440, y: 120, s: 1.1 },
    { type: 'cloud', x: 1520, y: 180, s: 0.9 },
    { type: 'cloud', x: 2650, y: 130, s: 1.2 },
    { type: 'hill', x: 620, y: 1150, s: 1.5 },
    { type: 'hill', x: 2060, y: 1150, s: 1.8 },
    { type: 'tree', x: 120, y: 1150, s: 1.2 },
    { type: 'tree', x: 940, y: 1150, s: 1.35 },
    { type: 'tree', x: 1730, y: 1150, s: 1.1 },
    { type: 'tree', x: 2260, y: 1150, s: 1.3 },
    { type: 'tree', x: 3100, y: 1150, s: 1.18 },
    { type: 'bush', x: 540, y: 1150, s: 1.1 },
    { type: 'bush', x: 1450, y: 1150, s: 1.4 },
    { type: 'bush', x: 2740, y: 1150, s: 1.2 },
    { type: 'sign', x: 1060, y: 1085, s: 1, label: 'PARK' }
  ]
};

const mall = {
  id: 'mall',
  name: 'Shopping Centre',
  subtitle: 'After hours',
  description: 'Kiosks, mezzanines and shop signs make a bright, tight climbing route. Bounce from counter to counter and never stay on the floor.',
  width: 3000,
  height: 1250,
  difficulty: 'Tight',
  theme: {
    background: 0x9b93bd,
    floor: 0xc9c2df,
    floorAlt: 0xb9b2d1,
    wall: 0x554d73,
    wallTop: 0x706790,
    accent: 0xff9dc1,
    ink: 0x241d38,
    sky: 0x7ad7ff,
    skyTop: 0xb8a9e8,
    skyBottom: 0xffe4f2,
    platform: 0x554d73,
    platformTop: 0x9e94c4,
    platformSide: 0x3f3959,
    cloud: 0xffdff0
  },
  platforms: [
    ground(3000, 1250),
    p(60, 1020, 320, 26, 'shop'),
    p(500, 1020, 280, 26, 'kiosk'),
    p(920, 1020, 340, 26, 'shop'),
    p(1400, 1020, 300, 26, 'kiosk'),
    p(1820, 1020, 300, 26, 'shop'),
    p(2240, 1020, 320, 26, 'kiosk'),
    p(2680, 1020, 260, 26, 'shop'),
    p(220, 890, 280, 24, 'kiosk'),
    p(650, 890, 260, 24, 'shop'),
    p(1080, 890, 260, 24, 'kiosk'),
    p(1510, 890, 300, 24, 'shop'),
    p(1970, 890, 280, 24, 'kiosk'),
    p(2420, 890, 280, 24, 'shop'),
    p(430, 760, 280, 24, 'shop'),
    p(880, 760, 300, 24, 'kiosk'),
    p(1330, 760, 280, 24, 'shop'),
    p(1790, 760, 300, 24, 'kiosk'),
    p(2260, 760, 300, 24, 'shop'),
    p(2670, 760, 240, 24, 'kiosk'),
    p(690, 630, 300, 22, 'kiosk'),
    p(1170, 630, 280, 22, 'shop'),
    p(1630, 630, 300, 22, 'kiosk'),
    p(2100, 630, 300, 22, 'shop'),
    p(2540, 630, 260, 22, 'kiosk'),
    p(960, 500, 300, 22, 'shop'),
    p(1450, 500, 320, 22, 'kiosk'),
    p(1980, 500, 300, 22, 'shop'),
    p(2450, 500, 280, 22, 'kiosk'),
    p(1250, 370, 300, 20, 'kiosk'),
    p(1770, 370, 300, 20, 'shop'),
    p(2280, 370, 280, 20, 'kiosk'),
    p(1600, 240, 320, 20, 'neon'),
    p(800, 1080, 180, 16, 'bench'),
    p(1750, 1070, 180, 16, 'bench'),
    p(2500, 1070, 160, 16, 'bench')
  ],
  spawns: [
    stand(190, 1150), stand(740, 1150), stand(1280, 1150), stand(1820, 1150), stand(2380, 1150), stand(2880, 1150),
    stand(180, 1020), stand(620, 1020), stand(1040, 1020), stand(1500, 1020), stand(1930, 1020), stand(2380, 1020),
    stand(280, 890), stand(1100, 890), stand(1600, 890), stand(2460, 890)
  ],
  zones: [
    { x: 1120, y: 750, label: 'CENTRAL ATRIUM' },
    { x: 2120, y: 890, label: 'EAST ARCADE' },
    { x: 560, y: 920, label: 'FOOD COURT' }
  ],
  landmarks: [
    { x: 1100, y: 1010, label: 'Mall Kiosk', icon: 'shop' },
    { x: 1960, y: 740, label: 'Mezzanine', icon: 'door' },
    { x: 1620, y: 230, label: 'Rooftop Sign', icon: 'star' }
  ],
  decor: [
    { type: 'cloud', x: 620, y: 120, s: 0.8 },
    { type: 'cloud', x: 1840, y: 165, s: 1 },
    { type: 'tower', x: 420, y: 1150, s: 1.2 },
    { type: 'tower', x: 1520, y: 1150, s: 1.5 },
    { type: 'tower', x: 2620, y: 1150, s: 1.3 },
    { type: 'lamp', x: 880, y: 1150, s: 1 },
    { type: 'lamp', x: 2080, y: 1150, s: 1 },
    { type: 'sign', x: 1560, y: 1085, s: 1, label: 'MALL' },
    { type: 'sign', x: 2840, y: 1085, s: 0.9, label: 'OPEN' }
  ]
};

const neon = {
  id: 'neon',
  name: 'Neon Rooftops',
  subtitle: 'Night run',
  description: 'A dark skyline of floating neon decks. Thin ledges and long gaps reward committed jumps and punish hesitation.',
  width: 3200,
  height: 1250,
  difficulty: 'Expert',
  theme: {
    background: 0x080d20,
    floor: 0x0d1830,
    floorAlt: 0x101d3a,
    wall: 0x121a43,
    wallTop: 0x24306b,
    accent: 0x45f6e0,
    ink: 0xe8fbff,
    sky: 0x060918,
    skyTop: 0x050817,
    skyBottom: 0x1a224d,
    platform: 0x121a43,
    platformTop: 0x45f6e0,
    platformSide: 0x0a1030,
    cloud: 0x9b7bff
  },
  platforms: [
    ground(3200, 1250),
    p(60, 1020, 260, 24, 'neon'),
    p(500, 1020, 300, 24, 'neon'),
    p(980, 1020, 260, 24, 'neon'),
    p(1430, 1020, 280, 24, 'neon'),
    p(1900, 1020, 260, 24, 'neon'),
    p(2360, 1020, 280, 24, 'neon'),
    p(2830, 1020, 300, 24, 'neon'),
    p(270, 890, 240, 22, 'neon'),
    p(700, 890, 260, 22, 'neon'),
    p(1160, 890, 240, 22, 'neon'),
    p(1590, 890, 260, 22, 'neon'),
    p(2040, 890, 240, 22, 'neon'),
    p(2490, 890, 260, 22, 'neon'),
    p(2930, 890, 220, 22, 'neon'),
    p(470, 760, 260, 22, 'neon'),
    p(930, 760, 240, 22, 'neon'),
    p(1380, 760, 260, 22, 'neon'),
    p(1820, 760, 240, 22, 'neon'),
    p(2270, 760, 260, 22, 'neon'),
    p(2720, 760, 240, 22, 'neon'),
    p(690, 630, 260, 20, 'neon'),
    p(1140, 630, 240, 20, 'neon'),
    p(1580, 630, 260, 20, 'neon'),
    p(2030, 630, 240, 20, 'neon'),
    p(2480, 630, 260, 20, 'neon'),
    p(940, 500, 260, 20, 'neon'),
    p(1390, 500, 240, 20, 'neon'),
    p(1840, 500, 260, 20, 'neon'),
    p(2300, 500, 240, 20, 'neon'),
    p(1180, 370, 260, 18, 'neon'),
    p(1640, 370, 240, 18, 'neon'),
    p(2100, 370, 260, 18, 'neon'),
    p(1450, 240, 280, 18, 'neon'),
    p(1720, 110, 260, 18, 'neon'),
    p(800, 1080, 160, 14, 'neon'),
    p(2130, 1080, 160, 14, 'neon')
  ],
  spawns: [
    stand(200, 1150), stand(780, 1150), stand(1340, 1150), stand(1900, 1150), stand(2460, 1150), stand(3050, 1150),
    stand(160, 1020), stand(580, 1020), stand(1050, 1020), stand(1510, 1020), stand(1990, 1020), stand(2440, 1020),
    stand(320, 890), stand(1220, 890), stand(1680, 890), stand(2530, 890)
  ],
  zones: [
    { x: 1420, y: 830, label: 'SKYLINE' },
    { x: 2360, y: 640, label: 'SIGNAL DECK' },
    { x: 690, y: 560, label: 'LOW ORBIT' }
  ],
  landmarks: [
    { x: 1520, y: 1010, label: 'Main Deck', icon: 'star' },
    { x: 1890, y: 230, label: 'Signal Tower', icon: 'antenna' },
    { x: 690, y: 880, label: 'Holo Sign', icon: 'neon' }
  ],
  decor: [
    { type: 'star', x: 360, y: 120, s: 1 },
    { type: 'star', x: 940, y: 90, s: 0.8 },
    { type: 'star', x: 1520, y: 170, s: 1.1 },
    { type: 'star', x: 2240, y: 100, s: 0.9 },
    { type: 'star', x: 2860, y: 150, s: 1 },
    { type: 'tower', x: 420, y: 1150, s: 1.4 },
    { type: 'tower', x: 1320, y: 1150, s: 1.1 },
    { type: 'tower', x: 2100, y: 1150, s: 1.5 },
    { type: 'tower', x: 2960, y: 1150, s: 1.25 },
    { type: 'neon', x: 1010, y: 880, s: 1.1, label: 'TAG' },
    { type: 'neon', x: 2210, y: 630, s: 1, label: 'RUN' }
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

export function platformsForMap(map) {
  return map.platforms || map.walls || [];
}
