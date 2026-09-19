import { useCallback, useEffect, useRef, useState } from 'react'

export interface StreamEvent {
  id: string
  seq: number
  type: string
  payload: Record<string, unknown>
  actorUserId: string | null
  createdAt: string
}

const MAX_BACKOFF_MS = 30_000

/**
 * How long to tolerate silence before assuming the connection is dead.
 *
 * The server sends a ping every 20s, so 50s means two missed pings. This
 * watchdog is not belt-and-braces -- it is the only thing that actually
 * notices a server that has gone away. Measured against a killed server,
 * Chrome left readyState at OPEN and never fired `error`, on both a hidden
 * and a foreground tab.
 */
const SILENCE_TIMEOUT_MS = 50_000

/**
 * Subscribes to a session's event stream.
 *
 * EventSource rather than fetch + ReadableStream, which is why the token lives
 * in a cookie: EventSource cannot set an Authorization header, but it does
 * handle framing and reconnection.
 *
 * We drive reconnection ourselves so the backoff is explicit, passing
 * `?since=` because a manual reconnect is a fresh request carrying no
 * Last-Event-ID. A deploy restarts the container and drops every open stream,
 * so this path runs on every deploy rather than only in failure.
 */
export function useSessionStream(sessionId: string, initial: Array<StreamEvent>) {
  const [events, setEvents] = useState<Array<StreamEvent>>(initial)
  const [connected, setConnected] = useState(false)
  const lastSeq = useRef(initial.at(-1)?.seq ?? 0)

  useEffect(() => {
    let source: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let silenceTimer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    let stopped = false

    const clearTimers = () => {
      if (retryTimer) clearTimeout(retryTimer)
      if (silenceTimer) clearTimeout(silenceTimer)
      retryTimer = undefined
      silenceTimer = undefined
    }

    const scheduleReconnect = () => {
      if (stopped || retryTimer) return
      const delay =
        Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** attempt) + Math.random() * 500
      attempt += 1
      retryTimer = setTimeout(() => {
        retryTimer = undefined
        connect()
      }, delay)
    }

    const drop = () => {
      setConnected(false)
      source?.close()
      source = null
      clearTimers()
      scheduleReconnect()
    }

    /** Any frame, including a ping, proves the connection is still alive. */
    const noteActivity = () => {
      if (silenceTimer) clearTimeout(silenceTimer)
      silenceTimer = setTimeout(drop, SILENCE_TIMEOUT_MS)
    }

    const connect = () => {
      if (stopped) return

      source = new EventSource(
        `/api/sessions/${sessionId}/events?since=${lastSeq.current}`,
      )

      source.onopen = () => {
        setConnected(true)
        attempt = 0
        noteActivity()
      }

      source.addEventListener('ping', noteActivity)

      source.onmessage = (message) => {
        noteActivity()
        const event = JSON.parse(message.data) as StreamEvent
        // The acting client already added this optimistically, and a replay
        // after reconnect can overlap what we have. `seq` settles both.
        if (event.seq <= lastSeq.current) return
        lastSeq.current = event.seq
        setEvents((previous) => [...previous, event])
      }

      source.onerror = drop
    }

    connect()

    /**
     * React's cleanup below covers unmount, but a page moved into the
     * back-forward cache is not unmounted -- it is frozen with its socket
     * open, which strands a listener on the server. `pagehide` fires in both
     * that case and a real unload.
     */
    const onPageHide = () => {
      setConnected(false)
      source?.close()
      source = null
      clearTimers()
    }

    const onPageShow = (event: PageTransitionEvent) => {
      // Restored from the back-forward cache: the old stream is gone, so
      // reconnect and replay whatever was missed.
      if (event.persisted && !stopped && !source) {
        attempt = 0
        connect()
      }
    }

    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      stopped = true
      source?.close()
      source = null
      clearTimers()
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [sessionId])

  /**
   * Adds an event the server has confirmed but the stream has not echoed yet,
   * so the acting client does not wait a round trip to see its own action.
   */
  const reconcile = useCallback((event: StreamEvent) => {
    if (event.seq <= lastSeq.current) return
    lastSeq.current = event.seq
    setEvents((previous) => [...previous, event])
  }, [])

  return { events, connected, reconcile }
}
