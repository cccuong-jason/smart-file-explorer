import { invoke } from '@tauri-apps/api/core';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogArea =
  | 'app'
  | 'watch'
  | 'scan'
  | 'indexing'
  | 'search'
  | 'tray'
  | 'tree'
  | 'settings'
  | 'cloud'
  | 'ui';

export interface LogEvent {
  id: string;
  timestamp: string;
  level: LogLevel;
  area: LogArea;
  event: string;
  message: string;
  correlationId?: string;
  sessionId?: string;
  path?: string;
  data?: unknown;
  error?: string;
}

export type LogEventInput = Omit<LogEvent, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: string;
};

type Subscriber = (event: LogEvent) => void;

const MAX_RECENT_EVENTS = 250;
const SENSITIVE_KEY_PATTERN = /(api[-_ ]?key|token|secret|password|authorization|bearer|credential)/i;
const recentEvents: LogEvent[] = [];
const subscribers = new Set<Subscriber>();

let nextEventId = 0;

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function nextId() {
  nextEventId += 1;
  return `fe-${Date.now().toString(36)}-${nextEventId.toString(36)}`;
}

function inferAreaFromLegacyContext(context?: string): LogArea {
  if (!context) {
    return 'app';
  }

  const prefix = context.split(/[-:.]/)[0];
  if (
    prefix === 'watch'
    || prefix === 'scan'
    || prefix === 'indexing'
    || prefix === 'search'
    || prefix === 'tray'
    || prefix === 'tree'
    || prefix === 'settings'
    || prefix === 'cloud'
    || prefix === 'ui'
  ) {
    return prefix;
  }

  if (context.includes('cloud')) {
    return 'cloud';
  }

  return 'app';
}

export function redactLogData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactLogData);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    redacted[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? '[redacted]'
      : redactLogData(nestedValue);
  }

  return redacted;
}

export function createLogEvent(input: LogEventInput): LogEvent {
  return {
    ...input,
    id: input.id ?? nextId(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    data: redactLogData(input.data),
  };
}

export function getRecentLogEvents() {
  return [...recentEvents];
}

export function clearRecentLogEvents() {
  recentEvents.length = 0;
}

export function subscribeToLogEvents(handler: Subscriber) {
  subscribers.add(handler);
  return () => {
    subscribers.delete(handler);
  };
}

function storeEvent(event: LogEvent) {
  recentEvents.push(event);
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.splice(0, recentEvents.length - MAX_RECENT_EVENTS);
  }

  for (const subscriber of subscribers) {
    subscriber(event);
  }
}

function writeToConsole(event: LogEvent) {
  const line = `[${event.area}:${event.event}] ${event.message}`;
  if (event.level === 'error') {
    console.error(line, event);
    return;
  }
  if (event.level === 'warn') {
    console.warn(line, event);
    return;
  }
  if (event.level === 'debug') {
    console.debug(line, event);
    return;
  }
  console.info(line, event);
}

export async function logEvent(input: LogEventInput) {
  const event = createLogEvent(input);
  storeEvent(event);

  if (!isTauriRuntime()) {
    if (import.meta.env.DEV) {
      writeToConsole(event);
    }
    return event;
  }

  try {
    await invoke('log_frontend_event', { event });
  } catch (error) {
    console.error('Failed to forward frontend log event', error);
  }

  return event;
}

export async function logFrontendMessage(level: 'info' | 'warn' | 'error', message: string, context?: string) {
  return logEvent({
    level,
    area: inferAreaFromLegacyContext(context),
    event: context ?? 'message',
    message,
  });
}
