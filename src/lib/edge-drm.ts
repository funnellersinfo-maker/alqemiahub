// ============================================================
// EDGE-DRM — Generación del token Sec-MS-GEC v2 para el
// servicio neuronal TTS de Microsoft Edge (Edge-TTS).
//
// Puerto literal 1:1 de edge-tts/drm.py (v7.3.1, MIT) a
// TypeScript con BigInt: SHA-256 con estado inicial
// precalculado y constantes ajustadas + digest CS64.
// Sin APIs de plataforma: funciona en Bun (dev) y en
// Cloudflare Workers (producción) por igual.
// ============================================================

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
const WIN_EPOCH = 11644473600
const MASK = 0xffffffffn
const B = (v: number): bigint => BigInt(v)

const SHA256_INITIAL = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
].map(B)

const SHA256_STATE = [
  0xfd9fbea2, 0x91243ce7, 0xbe499094, 0xcd2e1e0a, 0x6c006f49, 0x04bd35ab, 0xfeb0a7e4, 0x03effbd2,
].map(B)

const SHA256_SCHEDULE = [
  0xeb24bf9e, 0x1558691f, 0xa0c09ee2, 0x0cfa32ba, 0xa622ee8c, 0xd1dd9491, 0xc0dd25a0, 0xf9e70ab6,
  0xf0c31573, 0x7058ce4e, 0x7188e606, 0x00e5ab33, 0xd258b060, 0x72766564,
].map(B)

const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
].map(B)

const SHA256_ADJUSTMENT = B(0xc9dc06a7)
const SHA256_BLOCK_CONSTANTS = [
  ...SHA256_ROUND_CONSTANTS.slice(0, 14),
  SHA256_ADJUSTMENT,
  ...SHA256_ROUND_CONSTANTS.slice(15),
]
const SHA256_SIGMA0_ADJUSTMENT = B(0x059c0b80)
const SHA256_SIGMA1_ADJUSTMENT = B(0x000b92c0)

const CS64_COEFFICIENTS: Array<[bigint, bigint]> = [
  [0xe82e91b1, 0xb32700d0], [0x44de24c6, 0x88dff51d], [0x3beb65bc, 0x29514038], [0xc89c5933, 0xb328cbdf],
  [0x8d1ec211, 0xd405b4d5], [0x314ef5d5, 0x26e55f3c], [0xe92491b1, 0x607801c6], [0xf0a5b9d5, 0x82b2c1fb],
  [0x06064cf3, 0xfa51a3da], [0xda79fa60, 0x207cc464], [0xbed20560, 0x3c3c74f3], [0x89f9c9f8, 0xd2d14b61],
  [0x35fa38c6, 0xbb04a2c1], [0xcb49e3c6, 0xc5626167],
].map(([c, o]) => [B(c), B(o)] as [bigint, bigint])

const CS64_FACTOR = B(0x82893933)
const CS64_ADJUSTMENT0 = B(0xf2f90b1a)
const CS64_ADJUSTMENT1 = B(0x0b1a0000)

/** Rota un valor de 32 bits 16 posiciones a la izquierda. */
function rol16(value: bigint): bigint {
  const v = value & MASK
  return ((v << 16n) | (v >> 16n)) & MASK
}

/** Divide en palabras u32 little-endian (relleno a 4 bytes, cantidad par). */
function wordsLe4Even(data: Uint8Array): bigint[] {
  const padLen = (4 - (data.length % 4)) % 4
  const padded = new Uint8Array(data.length + padLen)
  padded.set(data)
  const words: bigint[] = []
  for (let i = 0; i < padded.length; i += 4) {
    words.push(
      BigInt(padded[i]!) | (BigInt(padded[i + 1]!) << 8n) | (BigInt(padded[i + 2]!) << 16n) | (BigInt(padded[i + 3]!) << 24n)
    )
  }
  if (words.length % 2 === 1) words.push(0n)
  return words
}

/** Sigma-0 pequeño de SHA-256 (con máscara). */
function sigma0(value: bigint): bigint {
  return ((value >> 7n) ^ (value << 25n) ^ (value >> 18n) ^ (value << 14n) ^ (value >> 3n)) & MASK
}

/** Sigma-1 pequeño de SHA-256 (con máscara). */
function sigma1(value: bigint): bigint {
  return ((value >> 17n) ^ (value << 15n) ^ (value >> 19n) ^ (value << 13n) ^ (value >> 10n)) & MASK
}

type State = [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]

/** Ejecuta las rondas de SHA-256, opcionalmente reanudando dentro del primer bloque. */
function sha256Rounds(state: State, words: bigint[], firstRound = 0): State {
  let a = state[0]!, b = state[1]!, c = state[2]!, d = state[3]!
  let e = state[4]!, f = state[5]!, g = state[6]!, h = state[7]!
  const constants = firstRound === 14 ? SHA256_BLOCK_CONSTANTS : SHA256_ROUND_CONSTANTS
  const aligned = Math.min(64, Math.floor((firstRound + 7) / 8) * 8)

  // Primer bucle (solo aplica con firstRound=14 → 2 iteraciones, constantes de bloque)
  for (let index = firstRound; index < aligned; index++) {
    const rotE = e * 0x100000001n
    const rotA = a * 0x100000001n
    const t1 =
      h + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (g ^ (e & (f ^ g))) + constants[index]! + words[index]!
    const t2 = ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((a & b) | (c & (a | b)))
    // Asignación rotacional estilo tupla de Python: (t1+t2)&m, a, b, c, (d+t1)&m, e, f, g
    const na = (t1 + t2) & MASK
    const nb = a
    const nc = b
    const nd = c
    const ne = (d + t1) & MASK
    const nf = e
    const ng = f
    const nh = g
    a = na; b = nb; c = nc; d = nd; e = ne; f = nf; g = ng; h = nh
  }

  for (let index = aligned; index < 64; index += 8) {
    let rotE = e * 0x100000001n
    let rotA = a * 0x100000001n
    let t1 =
      h + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (g ^ (e & (f ^ g))) + constants[index]! + words[index]!
    d = (d + t1) & MASK
    h = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((a & b) | (c & (a | b)))) & MASK
    rotE = d * 0x100000001n
    rotA = h * 0x100000001n
    t1 = g + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (f ^ (d & (e ^ f))) + constants[index + 1]! + words[index + 1]!
    c = (c + t1) & MASK
    g = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((h & a) | (b & (h | a)))) & MASK
    rotE = c * 0x100000001n
    rotA = g * 0x100000001n
    t1 = f + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (e ^ (c & (d ^ e))) + constants[index + 2]! + words[index + 2]!
    b = (b + t1) & MASK
    f = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((g & h) | (a & (g | h)))) & MASK
    rotE = b * 0x100000001n
    rotA = f * 0x100000001n
    t1 = e + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (d ^ (b & (c ^ d))) + constants[index + 3]! + words[index + 3]!
    a = (a + t1) & MASK
    e = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((f & g) | (h & (f | g)))) & MASK
    rotE = a * 0x100000001n
    rotA = e * 0x100000001n
    t1 = d + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (c ^ (a & (b ^ c))) + constants[index + 4]! + words[index + 4]!
    h = (h + t1) & MASK
    d = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((e & f) | (g & (e | f)))) & MASK
    rotE = h * 0x100000001n
    rotA = d * 0x100000001n
    t1 = c + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (b ^ (h & (a ^ b))) + constants[index + 5]! + words[index + 5]!
    g = (g + t1) & MASK
    c = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((d & e) | (f & (d | e)))) & MASK
    rotE = g * 0x100000001n
    rotA = c * 0x100000001n
    t1 = b + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (a ^ (g & (h ^ a))) + constants[index + 6]! + words[index + 6]!
    f = (f + t1) & MASK
    b = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((c & d) | (e & (c | d)))) & MASK
    rotE = f * 0x100000001n
    rotA = b * 0x100000001n
    t1 = a + ((rotE >> 6n) ^ (rotE >> 11n) ^ (rotE >> 25n)) + (h ^ (f & (g ^ h))) + constants[index + 7]! + words[index + 7]!
    e = (e + t1) & MASK
    a = (t1 + ((rotA >> 2n) ^ (rotA >> 13n) ^ (rotA >> 22n)) + ((b & c) | (d & (b | c)))) & MASK
  }
  return [a, b, c, d, e, f, g, h]
}

/** Expande el calendario de palabras de SHA-256 (sigmas sin máscara intermedia). */
function expandSha256Schedule(words: bigint[], firstWord = 16): void {
  for (let index = firstWord; index < 64; index++) {
    const x = words[index - 2]!
    const y = words[index - 15]!
    const s1 = (x >> 17n) ^ (x << 15n) ^ (x >> 19n) ^ (x << 13n) ^ (x >> 10n)
    const s0 = (y >> 7n) ^ (y << 25n) ^ (y >> 18n) ^ (y << 14n) ^ (y >> 3n)
    words.push((s1 + words[index - 7]! + s0 + words[index - 16]!) & MASK)
  }
}

/** Estado SHA-256 inicial para el prefijo de 7 bytes del token. */
function sha256Init(data7: Uint8Array): State {
  const w14 = (BigInt(data7[0]!) << 16n) | (BigInt(data7[1]!) << 8n) | BigInt(data7[2]!)
  const w15 =
    (BigInt(data7[3]!) << 24n) | (BigInt(data7[4]!) << 16n) | (BigInt(data7[5]!) << 8n) | BigInt(data7[6]!)
  const words: bigint[] = [
    0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n,
    w14,
    w15,
  ]
  for (let index = 16; index < 30; index++) {
    let value = SHA256_SCHEDULE[index - 16]!
    // index - 2 >= 14 siempre (index >= 16)
    value += index === 16 ? sigma1(words[index - 2]!) ^ SHA256_SIGMA1_ADJUSTMENT : sigma1(words[index - 2]!)
    if (index - 7 >= 14) value += words[index - 7]!
    if (index - 15 >= 14) {
      value += index === 29 ? sigma0(words[index - 15]!) ^ SHA256_SIGMA0_ADJUSTMENT : sigma0(words[index - 15]!)
    }
    words.push(value & MASK)
  }
  words.push(
    (sigma1(words[28]!) + words[23]! + sigma0(words[15]!) + words[14]! + SHA256_ADJUSTMENT - SHA256_ROUND_CONSTANTS[14]!) &
      MASK
  )
  expandSha256Schedule(words, 31)
  const working = sha256Rounds(SHA256_STATE, words, 14)
  return SHA256_INITIAL.map((x, i) => (x + working[i]!) & MASK) as State
}

/** Digest SHA-256 (custom) del token. */
function sha256Digest(data: Uint8Array): Uint8Array {
  if (data.length < 7) throw new Error("Token salt must contain at least seven bytes")
  const length = 57 + data.length
  const zeroPad = ((55 - length) % 64 + 64) % 64
  const padded = new Uint8Array(data.length - 7 + 1 + zeroPad + 8)
  padded.set(data.subarray(7), 0)
  padded[data.length - 7] = 0x80
  const bitLen = BigInt(length) * 8n
  for (let i = 0; i < 8; i++) {
    padded[padded.length - 1 - i] = Number((bitLen >> BigInt(8 * i)) & 0xffn)
  }
  let state = sha256Init(data.subarray(0, 7))
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words: bigint[] = []
    for (let i = 0; i < 64; i += 4) {
      words.push(
        (BigInt(padded[offset + i]!) << 24n) |
          (BigInt(padded[offset + i + 1]!) << 16n) |
          (BigInt(padded[offset + i + 2]!) << 8n) |
          BigInt(padded[offset + i + 3]!)
      )
    }
    expandSha256Schedule(words)
    const working = sha256Rounds(state, words)
    state = state.map((x, i) => (x + working[i]!) & MASK) as State
  }
  const out = new Uint8Array(32)
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 4; j++) {
      out[i * 4 + j] = Number((state[i]! >> BigInt(8 * (3 - j))) & 0xffn)
    }
  }
  return out
}

/** Digest CS64 del token. */
function cs64Digest(data: Uint8Array, digest: Uint8Array): [bigint, bigint] {
  let keyA = (BigInt(digest[0]!) | (BigInt(digest[1]!) << 8n) | (BigInt(digest[2]!) << 16n) | (BigInt(digest[3]!) << 24n)) | 1n
  let keyB = (BigInt(digest[4]!) | (BigInt(digest[5]!) << 8n) | (BigInt(digest[6]!) << 16n) | (BigInt(digest[7]!) << 24n)) | 1n
  keyA &= MASK
  keyB &= MASK
  const factors = [ (keyA * CS64_FACTOR) & MASK, (keyB * CS64_FACTOR) & MASK ]
  const terms: bigint[] = CS64_COEFFICIENTS.map(([coef], i) => (coef * factors[i % 2]!) & MASK)
  const offsets: bigint[] = CS64_COEFFICIENTS.map(([, off]) => off)

  const withNull = new Uint8Array(data.length + 1)
  withNull[0] = 0
  withNull.set(data, 1)
  const dataWords = wordsLe4Even(withNull)
  dataWords.forEach((word, index) => {
    let term = word * (index % 2 === 0 ? keyA : keyB)
    let offset = rol16(word) * (index % 2 === 0 ? 0xef0569fbn : 0xc31713dbn)
    if (index === 0) {
      term += CS64_ADJUSTMENT0 * factors[0]!
      offset += CS64_ADJUSTMENT1
    }
    terms.push(term & MASK)
    offsets.push(offset & MASK)
  })

  let swapAcc = 0n
  let swapLast = 0n
  let state = 0n
  let acc = 0n
  for (let index = 0; index < terms.length; index += 2) {
    const x = terms[index]!
    const y = terms[index + 1]!
    let t = rol16((offsets[index]! + x) & MASK)
    let q = (t * 0x76f50f34n) & MASK
    swapAcc += (rol16(q) * 0xc3efea97n + q) & MASK
    t = rol16((offsets[index + 1]! + y) & MASK)
    q = (t * 0x1881ce3cn) & MASK
    swapLast = (rol16(q) * 0x35bd1ec9n + q) & MASK
    swapAcc = (swapAcc + swapLast) & MASK

    state = (state * keyA + x) & MASK
    state = (rol16(state) * 0xcf98b111n) & MASK
    state = (rol16(state) * 0x87085b9fn) & MASK
    state = (rol16(state) * 0x12ceb96dn) & MASK
    state = (rol16(state) * 0x257e1d83n) & MASK
    acc += state
    t = (state * keyB + y) & MASK
    t = (rol16(t) * 0xa27416f5n) & MASK
    t = (rol16(t) * 0xd38396ffn) & MASK
    state = (rol16((rol16(t) * 0x7c932b89n) & MASK) * 0xbfa49f69n) & MASK
    acc += state
  }
  return [swapLast ^ state, swapAcc ^ acc]
}

/** Hex de los 4 bytes de un u32 en orden little-endian (equivale a struct.pack("<I")). */
const hexLe32 = (v: bigint) => {
  const x = v & 0xffffffffn
  return [
    (x & 0xffn).toString(16),
    ((x >> 8n) & 0xffn).toString(16),
    ((x >> 16n) & 0xffn).toString(16),
    ((x >> 24n) & 0xffn).toString(16),
  ]
    .map((s) => s.padStart(2, "0"))
    .join("")
}

/** Hash del token → componentes [cs64(16 hex), sha256(64 hex)]. */
function tokenHash(data: Uint8Array): [string, string] {
  const digest = sha256Digest(data)
  const [cs64A, cs64B] = cs64Digest(data, digest)
  const cs64 = (hexLe32(cs64A) + hexLe32(cs64B)).toUpperCase() // struct "<II" = little-endian
  const sha = [...digest].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()
  return [cs64, sha]
}

/**
 * Genera el token Sec-MS-GEC v2 para el servicio TTS de Edge.
 * Formato: "<16 hex>-<64 hex>".
 */
export function generateSecMsGecV2(unixSeconds?: number): string {
  let ticks = Math.floor(unixSeconds ?? Date.now() / 1000) + WIN_EPOCH
  ticks -= ticks % 300
  const ticks100ns = BigInt(ticks) * 10000000n
  const strToHash = `${ticks100ns.toString()}${TRUSTED_CLIENT_TOKEN}`
  const [cs64, sha] = tokenHash(new TextEncoder().encode(strToHash))
  return `${cs64}-${sha}`
}

export const EDGE_TRUSTED_CLIENT_TOKEN = TRUSTED_CLIENT_TOKEN
