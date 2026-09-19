// Stand-in for the Supabase project's JWKS endpoint, so the full auth path
// (cookie -> jose -> JWKS -> middleware -> SSE) can be exercised end to end
// without a real Supabase account. Mints one token per identity, all signed
// by the same key and issuer.
import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'
import { SignJWT, exportJWK, generateKeyPair } from 'jose'

const PORT = 9899
const issuer = `http://localhost:${PORT}/auth/v1`

const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true })
const jwk = await exportJWK(publicKey)
Object.assign(jwk, { kid: 'test-key-1', alg: 'ES256', use: 'sig' })

const identities = [
  { sub: 'test-sub-1', email: 'gm@example.com', name: 'Test Arbitrator', out: '/tmp/nrp-token-gm.txt' },
  { sub: 'test-sub-2', email: 'player@example.com', name: 'Test Player', out: '/tmp/nrp-token-player.txt' },
]

const now = Math.floor(Date.now() / 1000)
for (const id of identities) {
  const token = await new SignJWT({
    email: id.email,
    user_metadata: { full_name: id.name },
    // Claims from the "other app" that must be ignored entirely.
    app_role: 'superadmin',
    user_roles: ['owner'],
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key-1' })
    .setSubject(id.sub)
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setIssuedAt(now)
    .setExpirationTime(now + 7200)
    .sign(privateKey)
  writeFileSync(id.out, token)
}

createServer((req, res) => {
  if (req.url?.startsWith('/auth/v1/.well-known/jwks.json')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ keys: [jwk] }))
    return
  }
  res.writeHead(404)
  res.end()
}).listen(PORT, () => console.log(`jwks stand-in on ${PORT}`))
