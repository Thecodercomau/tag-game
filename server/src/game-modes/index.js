import { ClassicTag } from './ClassicTag.js';
import { Infection } from './Infection.js';
import { FreezeTag } from './FreezeTag.js';
import { TeamTag } from './TeamTag.js';
import { LastPlayerStanding } from './LastPlayerStanding.js';
import { ReverseTag } from './ReverseTag.js';

const classes = {
  classic: ClassicTag,
  infection: Infection,
  freeze: FreezeTag,
  team: TeamTag,
  last: LastPlayerStanding,
  reverse: ReverseTag
};

export const SERVER_MODES = Object.freeze(
  Object.fromEntries(Object.entries(classes).map(([id, ModeClass]) => [id, new ModeClass()]))
);

export function getServerMode(modeId) {
  return SERVER_MODES[modeId] || SERVER_MODES.classic;
}
