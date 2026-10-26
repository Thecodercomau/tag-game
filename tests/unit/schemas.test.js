import { describe, expect, it } from 'vitest';
import { parse, createLobbySchema, quickMatchSchema, inputSchema, chatSchema } from '../../shared/schemas.js';

describe('protocol schemas', () => {
  it('accepts a valid lobby creation payload', () => {
    const result = parse(createLobbySchema, {
      modeId: 'classic',
      mapId: 'playground',
      visibility: 'private',
      options: { maxPlayers: 6, duration: 180 }
    });
    expect(result.ok).toBe(true);
    expect(result.data.visibility).toBe('private');
  });

  it('rejects unknown modes, maps and extra fields', () => {
    expect(parse(createLobbySchema, { modeId: 'nope', mapId: 'playground' }).ok).toBe(false);
    expect(parse(createLobbySchema, { modeId: 'classic', mapId: 'nope' }).ok).toBe(false);
    expect(parse(createLobbySchema, { modeId: 'classic', mapId: 'playground', extra: true }).ok).toBe(false);
  });

  it('validates quick match modes and input ranges', () => {
    expect(parse(quickMatchSchema, { modeId: 'freeze' }).ok).toBe(true);
    expect(parse(quickMatchSchema, { modeId: 'invalid' }).ok).toBe(false);
    expect(parse(inputSchema, { seq: 1, dx: 0.5, sprint: true, jump: false }).ok).toBe(true);
    expect(parse(inputSchema, { seq: 1, dx: -1, sprint: false, jump: true }).ok).toBe(true);
    expect(parse(inputSchema, { seq: 1, dx: 4, sprint: false }).ok).toBe(false);
    expect(parse(inputSchema, { seq: 1, dx: 0, sprint: false, dy: 1 }).ok).toBe(false);
  });

  it('trims and bounds chat messages', () => {
    expect(parse(chatSchema, { message: '  hello  ' }).data.message).toBe('hello');
    expect(parse(chatSchema, { message: '' }).ok).toBe(false);
    expect(parse(chatSchema, { message: 'x'.repeat(141) }).ok).toBe(false);
  });
});
