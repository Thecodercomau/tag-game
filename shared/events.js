export const CLIENT_EVENTS = Object.freeze({
  HELLO: 'client:hello',
  QUICK_MATCH: 'client:quick-match',
  LIST_LOBBIES: 'client:list-lobbies',
  CREATE_LOBBY: 'client:create-lobby',
  JOIN_LOBBY: 'client:join-lobby',
  LEAVE_LOBBY: 'client:leave-lobby',
  READY: 'client:ready',
  SELECT_CHARACTER: 'client:select-character',
  UPDATE_SETTINGS: 'client:update-settings',
  START_MATCH: 'client:start-match',
  KICK_PLAYER: 'client:kick-player',
  SEND_CHAT: 'client:chat',
  INPUT: 'client:input',
  TAG: 'client:tag',
  INTERACT: 'client:interact',
  PING: 'client:ping',
  REJOIN: 'client:rejoin',
  RETURN_TO_LOBBY: 'client:return-to-lobby'
});

export const SERVER_EVENTS = Object.freeze({
  WELCOME: 'server:welcome',
  ERROR: 'server:error',
  LOBBY_LIST: 'server:lobby-list',
  LOBBY_JOINED: 'server:lobby-joined',
  LOBBY_UPDATE: 'server:lobby-update',
  LOBBY_LEFT: 'server:lobby-left',
  MATCH_STARTING: 'server:match-starting',
  MATCH_STATE: 'server:match-state',
  MATCH_EVENT: 'server:match-event',
  MATCH_END: 'server:match-end',
  MATCH_LEFT: 'server:match-left',
  TAG_RESULT: 'server:tag-result',
  PONG: 'server:pong',
  SESSION: 'server:session',
  CHAT: 'server:chat',
  CONNECTION_STATE: 'server:connection-state'
});

export const MATCH_PHASES = Object.freeze({
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  ENDED: 'ended'
});

export const ERROR_CODES = Object.freeze({
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  RATE_LIMITED: 'RATE_LIMITED',
  LOBBY_NOT_FOUND: 'LOBBY_NOT_FOUND',
  LOBBY_FULL: 'LOBBY_FULL',
  LOBBY_IN_PROGRESS: 'LOBBY_IN_PROGRESS',
  NOT_HOST: 'NOT_HOST',
  NOT_IN_LOBBY: 'NOT_IN_LOBBY',
  ALREADY_IN_LOBBY: 'ALREADY_IN_LOBBY',
  MATCH_NOT_READY: 'MATCH_NOT_READY',
  TOO_FEW_PLAYERS: 'TOO_FEW_PLAYERS',
  NOT_READY: 'NOT_READY',
  INTERNAL: 'INTERNAL',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  KICKED: 'KICKED',
  INVALID_CODE: 'INVALID_CODE',
  SERVER_FULL: 'SERVER_FULL',
  RESUME_EXPIRED: 'RESUME_EXPIRED'
});
