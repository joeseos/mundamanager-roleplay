import type { SessionEvent } from '#/db/schema.ts'

export type SessionEventListener = (event: SessionEvent) => void

/**
 * In-process fan-out. One Map, no broker.
 *
 * Sized for the actual problem: 3-6 people per table, an event every 20-30
 * seconds, ~1s latency acceptable. A broker would be infrastructure to
 * operate for no gain, and the app is single-instance by design.
 */
const channels = new Map<string, Set<SessionEventListener>>()

/**
 * Returns an unsubscribe function that is safe to call more than once.
 *
 * That matters: the SSE route wires cleanup to three independent triggers
 * (request abort, stream cancel, failed enqueue) and any combination of them
 * can fire.
 */
export function subscribe(
  sessionId: string,
  listener: SessionEventListener,
): () => void {
  let listeners = channels.get(sessionId)
  if (!listeners) {
    listeners = new Set()
    channels.set(sessionId, listeners)
  }
  listeners.add(listener)

  let unsubscribed = false
  return () => {
    if (unsubscribed) return
    unsubscribed = true

    const current = channels.get(sessionId)
    if (!current) return
    current.delete(listener)

    // Drop the empty Set as well. Deleting only the listener would leak one
    // empty Set per session that has ever been watched -- the exact shape of
    // leak this module exists to avoid.
    if (current.size === 0) {
      channels.delete(sessionId)
    }
  }
}

export function emit(sessionId: string, event: SessionEvent): void {
  const listeners = channels.get(sessionId)
  if (!listeners) return

  // Iterate a copy: a listener may unsubscribe itself (a closed stream does
  // exactly that) and must not disturb the rest of the fan-out.
  for (const listener of [...listeners]) {
    try {
      listener(event)
    } catch (error) {
      console.error('session event listener failed', error)
    }
  }
}

/** Exported for the leak tests and the dev-only diagnostics route. */
export function listenerCount(sessionId: string): number {
  return channels.get(sessionId)?.size ?? 0
}

/** Number of sessions currently holding a listener set. */
export function channelCount(): number {
  return channels.size
}
