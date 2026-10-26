import { MODE_MAP, TAG_IMMUNITY_MS, TAG_STUN_MS } from './constants.js';
import { pick, shuffle } from './utils.js';

const sec = (ms) => ms / 1000;

function ok() {
  return { ok: true };
}

function no(reason) {
  return { ok: false, reason };
}

function emitTag(engine, tagger, target, label) {
  engine.addEvent({
    type: 'tag',
    taggerId: tagger.id,
    targetId: target.id,
    taggerName: tagger.name,
    targetName: target.name,
    message: label || `${tagger.name} tagged ${target.name}`
  });
}

function markTagged(engine, tagger, target) {
  tagger.tags += 1;
  tagger.score += 1;
  target.timesTagged += 1;
  target.taggedUntil = engine.clock + 0.7;
  target.tagImmuneUntil = engine.clock + sec(TAG_IMMUNITY_MS);
  target.stunUntil = Math.max(target.stunUntil, engine.clock + sec(TAG_STUN_MS));
}

export const ClassicTag = {
  id: 'classic',
  init(engine) {
    const chosen = pick(engine.players, engine.rng);
    engine.players.forEach((player) => { player.isIt = player === chosen; });
    engine.modeState = { itId: chosen?.id || null, tagCount: 0, lastTag: null };
  },
  canTag(engine, tagger, target) {
    if (!tagger.isIt) return no('You are not IT.');
    if (target.isIt) return no('You cannot tag yourself.');
    return ok();
  },
  onTag(engine, tagger, target) {
    untagIt(engine);
    tagger.isIt = false;
    tagger.isIt = false;
    target.isIt = true;
    markTagged(engine, tagger, target);
    target.tagImmuneUntil = engine.clock + sec(TAG_IMMUNITY_MS);
    engine.modeState.itId = target.id;
    engine.modeState.tagCount += 1;
    engine.modeState.lastTag = { taggerId: tagger.id, targetId: target.id, at: engine.clock };
    emitTag(engine, tagger, target, `${tagger.name} passed IT to ${target.name}`);
    tagger.taggingUntil = engine.clock + 0.35;
  },
  onRemove(engine) {
    const current = engine.playerMap.get(engine.modeState.itId);
    if (current && current.connected && !current.eliminated) return;
    const next = pick(engine.players.filter((player) => player.connected && !player.eliminated), engine.rng);
    engine.players.forEach((player) => { player.isIt = player === next; });
    engine.modeState.itId = next?.id || null;
  },
  tick() {},
  checkEnd(engine) {
    if (engine.timeLeft > 0) return null;
    const sorted = [...engine.players].sort((a, b) => a.itTime - b.itTime || b.tags - a.tags);
    const min = sorted[0]?.itTime ?? 0;
    const winners = sorted.filter((player) => Math.abs(player.itTime - min) < 0.05).map((player) => player.id);
    return {
      reason: 'time',
      winnerIds: winners,
      title: 'Time!',
      detail: `${sorted[0]?.name || 'Nobody'} spent the least time as IT.`
    };
  },
  getState(engine) {
    return { ...engine.modeState };
  },
  results(engine, finish) {
    return finish;
  }
};

function untagIt(engine) {
  if (engine.modeState?.itId) {
    const previous = engine.playerMap.get(engine.modeState.itId);
    if (previous) previous.isIt = false;
  }
}

export const Infection = {
  id: 'infection',
  init(engine) {
    const chosen = pick(engine.players, engine.rng);
    engine.players.forEach((player) => {
      player.isIt = player === chosen;
      player.infected = player === chosen;
    });
    engine.modeState = {
      infectedIds: chosen ? [chosen.id] : [],
      survivorIds: engine.players.filter((player) => !player.infected).map((player) => player.id),
      lastTag: null,
      tagCount: 0
    };
  },
  canTag(engine, tagger, target) {
    if (!tagger.infected) return no('Only the infected can spread it.');
    if (target.infected) return no('They are already infected.');
    return ok();
  },
  onTag(engine, tagger, target) {
    target.infected = true;
    target.isIt = true;
    markTagged(engine, tagger, target);
    engine.modeState.infectedIds = engine.players.filter((player) => player.infected).map((player) => player.id);
    engine.modeState.survivorIds = engine.players.filter((player) => !player.infected).map((player) => player.id);
    engine.modeState.tagCount += 1;
    engine.modeState.lastTag = { taggerId: tagger.id, targetId: target.id, at: engine.clock };
    emitTag(engine, tagger, target, `${target.name} joined the infected`);
    tagger.taggingUntil = engine.clock + 0.35;
  },
  onRemove(engine) {
    const active = engine.players.filter((player) => player.connected && !player.eliminated);
    if (active.length && !active.some((player) => player.infected)) {
      const next = pick(active, engine.rng);
      next.infected = true;
      next.isIt = true;
    }
    engine.modeState.infectedIds = engine.players.filter((player) => player.infected).map((player) => player.id);
    engine.modeState.survivorIds = engine.players.filter((player) => !player.infected).map((player) => player.id);
  },
  tick() {},
  checkEnd(engine) {
    const survivors = engine.players.filter((player) => !player.infected && !player.eliminated);
    const infected = engine.players.filter((player) => player.infected);
    if (!infected.length && survivors.length) {
      return {
        reason: 'infection-cleared',
        winnerIds: survivors.map((player) => player.id),
        title: 'Outbreak contained',
        detail: 'The last infected player left the arena.'
      };
    }
    if (survivors.length === 0) {
      return {
        reason: 'all-infected',
        winnerIds: infected.map((player) => player.id),
        title: 'Outbreak complete',
        detail: 'Every player has been infected.'
      };
    }
    if (engine.timeLeft > 0) return null;
    return {
      reason: 'time',
      winnerIds: survivors.map((player) => player.id),
      title: 'Survivors hold out',
      detail: `${survivors.length} survivor${survivors.length === 1 ? '' : 's'} made it to the final bell.`
    };
  },
  getState(engine) {
    const survivors = engine.players.filter((player) => !player.infected);
    return { ...engine.modeState, infectedCount: engine.players.length - survivors.length, survivorCount: survivors.length };
  },
  results(engine, finish) {
    return finish;
  }
};

export const FreezeTag = {
  id: 'freeze',
  init(engine) {
    const chosen = pick(engine.players, engine.rng);
    engine.players.forEach((player) => {
      player.isIt = player === chosen;
      player.frozen = false;
    });
    engine.modeState = { itId: chosen?.id || null, frozenIds: [], rescueCount: 0, lastRescue: null };
  },
  canTag(engine, tagger, target) {
    if (!tagger.isIt) return no('Only IT can freeze runners.');
    if (target.isIt) return no('You cannot freeze yourself.');
    if (target.frozen) return no('They are already frozen.');
    return ok();
  },
  onTag(engine, tagger, target) {
    target.frozen = true;
    target.frozenAt = engine.clock;
    target.vx = 0;
    target.vy = 0;
    markTagged(engine, tagger, target);
    engine.modeState.frozenIds = engine.players.filter((player) => player.frozen).map((player) => player.id);
    emitTag(engine, tagger, target, `${target.name} is frozen solid`);
    tagger.taggingUntil = engine.clock + 0.35;
  },
  canInteract(engine, player, target) {
    if (player.isIt) return no('IT cannot thaw runners.');
    if (player.frozen) return no('You are frozen.');
    if (!target.frozen) return no('They are not frozen.');
    return ok();
  },
  onInteract(engine, player, target) {
    target.frozen = false;
    target.frozenAt = 0;
    target.tagImmuneUntil = engine.clock + 1.8;
    player.revives += 1;
    player.lastInteractAt = engine.clock;
    engine.modeState.frozenIds = engine.players.filter((entry) => entry.frozen).map((entry) => entry.id);
    engine.modeState.rescueCount += 1;
    engine.modeState.lastRescue = { playerId: player.id, targetId: target.id, at: engine.clock };
    engine.addEvent({
      type: 'rescue',
      playerId: player.id,
      targetId: target.id,
      message: `${player.name} thawed ${target.name}`
    });
  },
  onRemove(engine) {
    const it = engine.players.find((player) => player.isIt && player.connected && !player.eliminated);
    if (it) return;
    const next = pick(engine.players.filter((player) => !player.frozen && player.connected && !player.eliminated), engine.rng);
    engine.players.forEach((player) => { player.isIt = player === next; });
    engine.modeState.itId = next?.id || null;
    engine.modeState.frozenIds = engine.players.filter((player) => player.frozen).map((player) => player.id);
  },
  tick() {},
  checkEnd(engine) {
    const runners = engine.players.filter((player) => !player.isIt && !player.eliminated);
    const frozen = runners.filter((player) => player.frozen);
    const it = engine.players.find((player) => player.isIt);
    if (runners.length > 0 && frozen.length >= runners.length) {
      return {
        reason: 'all-frozen',
        winnerIds: it ? [it.id] : [],
        title: 'Deep freeze',
        detail: 'IT froze every runner in the playground.'
      };
    }
    if (engine.timeLeft > 0) return null;
    return {
      reason: 'time',
      winnerIds: runners.map((player) => player.id),
      title: 'The runners endure',
      detail: 'The clock ran out before everyone was frozen.'
    };
  },
  getState(engine) {
    return { ...engine.modeState, frozenCount: engine.players.filter((player) => player.frozen).length };
  },
  results(engine, finish) {
    return finish;
  }
};

export const TeamTag = {
  id: 'team',
  init(engine) {
    const order = shuffle(engine.players, engine.rng);
    order.forEach((player, index) => {
      player.team = index % 2 === 0 ? 'coral' : 'azure';
      player.isSeeker = false;
      player.isIt = false;
    });
    const coral = order.filter((player) => player.team === 'coral');
    const azure = order.filter((player) => player.team === 'azure');
    const coralSeeker = pick(coral, engine.rng);
    const azureSeeker = pick(azure, engine.rng);
    for (const seeker of [coralSeeker, azureSeeker]) {
      if (!seeker) continue;
      seeker.isSeeker = true;
      seeker.isIt = true;
    }
    engine.modeState = {
      teamScores: { coral: 0, azure: 0 },
      seekers: {
        coral: coralSeeker?.id || null,
        azure: azureSeeker?.id || null
      },
      lastTag: null,
      tagCount: 0
    };
  },
  canTag(engine, tagger, target) {
    if (!tagger.isSeeker) return no('Only your team seeker can score.');
    if (tagger.team === target.team) return no('That is your own teammate.');
    if (target.isSeeker) return no('Tag a runner, not the opposing seeker.');
    return ok();
  },
  onTag(engine, tagger, target) {
    const previous = engine.players.find((player) => player.isSeeker && player.team === target.team);
    if (previous) {
      previous.isSeeker = false;
      previous.isIt = false;
    }
    target.isSeeker = true;
    target.isIt = true;
    markTagged(engine, tagger, target);
    engine.modeState.teamScores[tagger.team] += 1;
    engine.modeState.seekers[tagger.team] = tagger.id;
    engine.modeState.seekers[target.team] = target.id;
    engine.modeState.tagCount += 1;
    engine.modeState.lastTag = { taggerId: tagger.id, targetId: target.id, team: tagger.team, at: engine.clock };
    emitTag(engine, tagger, target, `${tagger.name} scored for ${tagger.team} — ${target.name} becomes seeker`);
    tagger.taggingUntil = engine.clock + 0.35;
  },
  onRemove(engine, removed) {
    if (!removed.team) return;
    const currentSeeker = engine.players.find((player) => player.isSeeker && player.team === removed.team && player.connected && !player.eliminated);
    if (currentSeeker) return;
    const replacement = engine.players.find((player) => player.team === removed.team && player.connected && !player.eliminated);
    if (replacement) {
      replacement.isSeeker = true;
      replacement.isIt = true;
      engine.modeState.seekers[removed.team] = replacement.id;
    } else {
      engine.modeState.seekers[removed.team] = null;
    }
  },
  tick() {},
  checkEnd(engine) {
    const scores = engine.modeState.teamScores;
    const limit = engine.options.scoreLimit || 0;
    if (limit > 0 && Math.max(scores.coral, scores.azure) >= limit) {
      const team = scores.coral >= scores.azure ? 'coral' : 'azure';
      return {
        reason: 'score-limit',
        winnerIds: engine.players.filter((player) => player.team === team).map((player) => player.id),
        title: `${team === 'coral' ? 'Coral' : 'Azure'} takes the win`,
        detail: `Score limit reached at ${scores[team]}.`
      };
    }
    if (engine.timeLeft > 0) return null;
    if (scores.coral === scores.azure) {
      return { reason: 'time', winnerIds: [], title: 'Dead heat', detail: `Both teams finished on ${scores.coral}.` };
    }
    const winningTeam = scores.coral > scores.azure ? 'coral' : 'azure';
    return {
      reason: 'time',
      winnerIds: engine.players.filter((player) => player.team === winningTeam).map((player) => player.id),
      title: `${winningTeam === 'coral' ? 'Coral' : 'Azure'} wins`,
      detail: `Final score ${scores.coral}–${scores.azure}.`
    };
  },
  getState(engine) {
    return { ...engine.modeState, scores: { ...engine.modeState.teamScores } };
  },
  results(engine, finish) {
    return finish;
  }
};

export const LastPlayerStanding = {
  id: 'last',
  init(engine) {
    const chosen = pick(engine.players, engine.rng);
    engine.players.forEach((player) => {
      player.isIt = player === chosen;
      player.eliminated = false;
    });
    engine.modeState = { itId: chosen?.id || null, eliminatedIds: [], eliminations: [], tagCount: 0 };
  },
  canTag(engine, tagger, target) {
    if (!tagger.isIt) return no('Only IT can eliminate runners.');
    if (target.isIt) return no('You cannot eliminate yourself.');
    if (target.eliminated) return no('Already eliminated.');
    return ok();
  },
  onTag(engine, tagger, target) {
    target.eliminated = true;
    target.vx = 0;
    target.vy = 0;
    target.eliminatedAt = engine.clock;
    markTagged(engine, tagger, target);
    engine.modeState.eliminatedIds = engine.players.filter((player) => player.eliminated).map((player) => player.id);
    engine.modeState.eliminations.push({ taggerId: tagger.id, targetId: target.id, at: engine.clock });
    engine.modeState.tagCount += 1;
    emitTag(engine, tagger, target, `${target.name} is out`);
    tagger.taggingUntil = engine.clock + 0.35;
  },
  onRemove(engine) {
    const current = engine.playerMap.get(engine.modeState.itId);
    if (current && current.connected && !current.eliminated) return;
    const next = pick(engine.players.filter((player) => player.connected && !player.eliminated), engine.rng);
    engine.players.forEach((player) => { player.isIt = player === next; });
    engine.modeState.itId = next?.id || null;
  },
  tick() {},
  checkEnd(engine) {
    const alive = engine.players.filter((player) => !player.eliminated);
    if (alive.length <= 1) {
      return {
        reason: 'last-standing',
        winnerIds: alive.map((player) => player.id),
        title: alive[0] ? `${alive[0].name} is the last one standing` : 'Nobody survived',
        detail: alive[0] ? 'The arena belongs to one player.' : 'A strange silence falls over the arena.'
      };
    }
    if (engine.timeLeft > 0) return null;
    const sorted = [...alive].sort((a, b) => a.itTime - b.itTime || b.tags - a.tags);
    const winner = sorted[0];
    return {
      reason: 'time',
      winnerIds: winner ? [winner.id] : [],
      title: 'Time!',
      detail: `${winner?.name || 'Nobody'} survived with the least time as IT.`
    };
  },
  getState(engine) {
    return { ...engine.modeState, aliveCount: engine.players.filter((player) => !player.eliminated).length };
  },
  results(engine, finish) {
    return finish;
  }
};

export const ReverseTag = {
  id: 'reverse',
  init(engine) {
    const chosen = pick(engine.players, engine.rng);
    engine.players.forEach((player) => {
      player.isIt = player === chosen;
      player.isEvader = player === chosen;
    });
    engine.modeState = { evaderId: chosen?.id || null, evaderName: chosen?.name || null, tagCount: 0, caughtBy: null };
  },
  canTag(engine, tagger, target) {
    if (tagger.isIt) return no('The evader cannot tag hunters.');
    if (!target.isIt || target.id !== engine.modeState.evaderId) return no('Only the evader can be caught.');
    return ok();
  },
  onTag(engine, tagger, target) {
    markTagged(engine, tagger, target);
    tagger.score += 9;
    engine.modeState.tagCount += 1;
    engine.modeState.caughtBy = tagger.id;
    emitTag(engine, tagger, target, `${tagger.name} caught the evader!`);
    const hunters = engine.players.filter((player) => player.id !== target.id);
    engine.finish('caught', hunters.map((player) => player.id), 'The evader is caught', `${tagger.name} ended the hunt.`);
  },
  onRemove(engine, removed) {
    if (removed.id === engine.modeState.evaderId) {
      const hunters = engine.players.filter((player) => player.id !== removed.id && player.connected && !player.eliminated);
      engine.finish('evader-left', hunters.map((player) => player.id), 'The hunt ends', 'The evader left the arena.');
    }
  },
  tick() {},
  checkEnd(engine) {
    const evader = engine.players.find((player) => player.id === engine.modeState.evaderId);
    if (!evader || !evader.connected || evader.eliminated) return null;
    if (engine.timeLeft > 0) return null;
    return {
      reason: 'survived',
      winnerIds: evader ? [evader.id] : [],
      title: 'The evader escapes',
      detail: `${evader?.name || 'The evader'} survived the entire hunt.`
    };
  },
  getState(engine) {
    return { ...engine.modeState };
  },
  results(engine, finish) {
    return finish;
  }
};

export const MODE_RULES = Object.freeze({
  classic: ClassicTag,
  infection: Infection,
  freeze: FreezeTag,
  team: TeamTag,
  last: LastPlayerStanding,
  reverse: ReverseTag
});

export function getModeRules(modeId) {
  return MODE_RULES[modeId] || MODE_RULES.classic;
}

export function modeLabel(modeId) {
  return MODE_MAP[modeId]?.name || 'Classic Tag';
}
