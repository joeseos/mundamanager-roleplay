import { describe, expect, it } from 'vitest'

import { PRIVATE, privatePageHeaders, publicPageHeaders } from './cacheHeaders.ts'

/** Only the root match carries the loader data the decision reads. */
function ctx(user: unknown) {
  return { matches: [{ loaderData: { user } }] }
}

describe('page cache headers', () => {
  it('never lets a shared cache hold a signed-in page', () => {
    const headers = publicPageHeaders(ctx({ id: 'user-1' }))

    // Both names, because Cloudflare reads CDN-Cache-Control first and a Cache
    // Rule with an Edge TTL override ignores Cache-Control entirely.
    expect(headers['Cache-Control']).toBe('private, no-store')
    expect(headers['CDN-Cache-Control']).toBe('private, no-store')
  })

  it('lets a shared cache hold an anonymous page', () => {
    const headers = publicPageHeaders(ctx(null))

    expect(headers['Cache-Control']).toContain('s-maxage=60')
    expect(headers['Cache-Control']).not.toContain('no-store')
    expect(headers['CDN-Cache-Control']).toBe('max-age=60')
  })

  it('treats a missing root loader as signed in rather than public', () => {
    expect(publicPageHeaders({ matches: [] })).toEqual(PRIVATE)
  })

  it('keeps every route behind requireUser out of shared caches', () => {
    expect(privatePageHeaders()).toEqual(PRIVATE)
  })
})
