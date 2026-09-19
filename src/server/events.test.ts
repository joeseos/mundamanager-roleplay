import { describe, expect, it, vi } from 'vitest'

import type { SessionEvent } from '#/db/schema.ts'

import { channelCount, emit, listenerCount, subscribe } from './events.ts'

function event(seq: number, sessionId = 'session-1'): SessionEvent {
  return {
    id: `event-${seq}`,
    sessionId,
    seq,
    type: 'note',
    payload: {},
    actorUserId: null,
    createdAt: new Date(),
  }
}

describe('session event fan-out', () => {
  it('delivers an event to every subscriber of that session', () => {
    const a = vi.fn()
    const b = vi.fn()
    const unsubA = subscribe('s1', a)
    const unsubB = subscribe('s1', b)

    emit('s1', event(1, 's1'))

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    unsubA()
    unsubB()
  })

  it('does not deliver across sessions', () => {
    const listener = vi.fn()
    const unsub = subscribe('s1', listener)

    emit('s2', event(1, 's2'))

    expect(listener).not.toHaveBeenCalled()
    unsub()
  })

  /**
   * The failure mode this module exists to avoid. Unsubscribing must remove
   * the listener AND drop the now-empty Set, or the Map grows one entry per
   * session that has ever been watched.
   */
  it('drains completely on unsubscribe, leaving no empty channel behind', () => {
    const before = channelCount()

    const unsubA = subscribe('leak-check', vi.fn())
    const unsubB = subscribe('leak-check', vi.fn())
    expect(listenerCount('leak-check')).toBe(2)

    unsubA()
    expect(listenerCount('leak-check')).toBe(1)
    expect(channelCount()).toBe(before + 1)

    unsubB()
    expect(listenerCount('leak-check')).toBe(0)
    expect(channelCount()).toBe(before)
  })

  it('tolerates unsubscribing more than once', () => {
    const other = vi.fn()
    const unsubOther = subscribe('s1', other)
    const unsub = subscribe('s1', vi.fn())

    unsub()
    unsub()
    unsub()

    // The repeated calls must not have removed the *other* listener.
    expect(listenerCount('s1')).toBe(1)
    emit('s1', event(1, 's1'))
    expect(other).toHaveBeenCalledTimes(1)
    unsubOther()
    expect(listenerCount('s1')).toBe(0)
  })

  it('keeps fanning out when one listener throws', () => {
    const healthy = vi.fn()
    const unsubBad = subscribe('s1', () => {
      throw new Error('stream already closed')
    })
    const unsubGood = subscribe('s1', healthy)

    expect(() => emit('s1', event(1, 's1'))).not.toThrow()
    expect(healthy).toHaveBeenCalledTimes(1)

    unsubBad()
    unsubGood()
  })

  it('lets a listener unsubscribe itself during delivery', () => {
    const seen: Array<number> = []
    let unsubSelf = () => {}
    unsubSelf = subscribe('s1', (e) => {
      seen.push(e.seq)
      unsubSelf()
    })
    const unsubOther = subscribe('s1', (e) => seen.push(e.seq * 100))

    emit('s1', event(1, 's1'))
    emit('s1', event(2, 's1'))

    expect(seen).toEqual([1, 100, 200])
    unsubOther()
    expect(listenerCount('s1')).toBe(0)
  })
})
