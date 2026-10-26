import { z } from 'zod';
import { GAME_MODES, MAX_CHAT_LENGTH, MAX_NAME_LENGTH, MAX_PLAYERS, MIN_PLAYERS, OPTION_LIMITS, PALETTES, OUTFITS, ACCESSORIES, TRAILS, CHARACTERS } from './constants.js';
import { MAPS } from './maps.js';

const modeIds = GAME_MODES.map((mode) => mode.id);
const mapIds = MAPS.map((map) => map.id);
const paletteIds = PALETTES.map((item) => item.id);
const outfitIds = OUTFITS.map((item) => item.id);
const accessoryIds = ACCESSORIES.map((item) => item.id);
const trailIds = TRAILS.map((item) => item.id);
const characterIds = CHARACTERS.map((item) => item.id);

export const nameSchema = z.string().trim().min(1).max(MAX_NAME_LENGTH);
export const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5}$/);
export const modeSchema = z.enum(modeIds);
export const mapSchema = z.enum(mapIds);

export const appearanceSchema = z.object({
  characterId: z.enum(characterIds),
  paletteId: z.enum(paletteIds),
  outfitId: z.enum(outfitIds),
  accessoryId: z.enum(accessoryIds),
  trailId: z.enum(trailIds)
}).strict();

export const optionsSchema = z.object({
  duration: z.number().int().min(OPTION_LIMITS.duration.min).max(OPTION_LIMITS.duration.max).optional(),
  tagDistance: z.number().min(OPTION_LIMITS.tagDistance.min).max(OPTION_LIMITS.tagDistance.max).optional(),
  tagCooldownMs: z.number().int().min(OPTION_LIMITS.tagCooldownMs.min).max(OPTION_LIMITS.tagCooldownMs.max).optional(),
  sprintEnabled: z.boolean().optional(),
  minPlayers: z.number().int().min(OPTION_LIMITS.minPlayers.min).max(OPTION_LIMITS.minPlayers.max).optional(),
  maxPlayers: z.number().int().min(OPTION_LIMITS.maxPlayers.min).max(MAX_PLAYERS).optional(),
  countdown: z.number().int().min(1).max(6).optional(),
  reviveRange: z.number().min(OPTION_LIMITS.reviveRange.min).max(OPTION_LIMITS.reviveRange.max).optional(),
  scoreLimit: z.number().int().min(0).max(50).optional()
}).strict();

export const helloSchema = z.object({
  protocol: z.number().int().optional(),
  name: nameSchema.optional(),
  appearance: appearanceSchema.optional(),
  resumeToken: z.string().min(16).max(128).optional()
}).strict();

export const createLobbySchema = z.object({
  name: nameSchema.optional(),
  appearance: appearanceSchema.optional(),
  modeId: modeSchema,
  mapId: mapSchema,
  visibility: z.enum(['public', 'private', 'lan']).default('public'),
  options: optionsSchema.optional()
}).strict();

export const joinLobbySchema = z.object({
  code: codeSchema,
  name: nameSchema.optional(),
  appearance: appearanceSchema.optional()
}).strict();

export const quickMatchSchema = z.object({
  name: nameSchema.optional(),
  appearance: appearanceSchema.optional(),
  modeId: modeSchema.optional()
}).strict();

export const characterSchema = z.object({
  appearance: appearanceSchema,
  name: nameSchema.optional()
}).strict();

export const readySchema = z.object({ ready: z.boolean() }).strict();

export const updateSettingsSchema = z.object({
  modeId: modeSchema.optional(),
  mapId: mapSchema.optional(),
  options: optionsSchema.optional()
}).strict();

export const kickSchema = z.object({ playerId: z.string().min(3).max(64) }).strict();

export const chatSchema = z.object({ message: z.string().trim().min(1).max(MAX_CHAT_LENGTH) }).strict();

export const inputSchema = z.object({
  seq: z.number().int().min(0).max(1e9),
  dx: z.number().min(-1).max(1),
  dy: z.number().min(-1).max(1),
  sprint: z.boolean()
}).strict();

export const tagSchema = z.object({
  targetId: z.string().min(3).max(64).optional()
}).strict();

export const interactSchema = z.object({
  targetId: z.string().min(3).max(64).optional()
}).strict();

export const pingSchema = z.object({ t: z.number().finite() }).strict();

export const rejoinSchema = z.object({ token: z.string().min(16).max(128) }).strict();

export const settingsPayloadSchema = z.object({
  masterVolume: z.number().min(0).max(1).optional(),
  musicVolume: z.number().min(0).max(1).optional(),
  sfxVolume: z.number().min(0).max(1).optional(),
  muted: z.boolean().optional(),
  reducedMotion: z.boolean().optional(),
  graphics: z.enum(['low', 'medium', 'high']).optional(),
  particles: z.boolean().optional(),
  screenShake: z.boolean().optional(),
  colorBlindMarkers: z.boolean().optional()
}).strict();

export function parse(schema, payload) {
  const result = schema.safeParse(payload);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    error: result.error.issues.map((issue) => `${issue.path.join('.') || 'payload'}: ${issue.message}`).join('; ')
  };
}

export const schemas = Object.freeze({
  hello: helloSchema,
  createLobby: createLobbySchema,
  joinLobby: joinLobbySchema,
  quickMatch: quickMatchSchema,
  character: characterSchema,
  ready: readySchema,
  updateSettings: updateSettingsSchema,
  kick: kickSchema,
  chat: chatSchema,
  input: inputSchema,
  tag: tagSchema,
  interact: interactSchema,
  ping: pingSchema,
  rejoin: rejoinSchema,
  settings: settingsPayloadSchema
});
