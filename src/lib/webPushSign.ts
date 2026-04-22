/**
 * Pure-JS Web Push helper compatible with Cloudflare Workers / TanStack
 * server functions. Builds the VAPID Authorization header and the encrypted
 * aes128gcm push payload using Web Crypto only — no Node `crypto` and no
 * native deps (the `web-push` npm package is Node-only).
 *
 * Refs:
 *  - RFC 8030 (Web Push)
 *  - RFC 8291 (Message Encryption for Web Push, aes128gcm)
 *  - RFC 8292 (VAPID)
 */

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

async function importVapidPrivateKey(b64urlD: string, b64urlPubUncompressed: string): Promise<CryptoKey> {
  const d = b64urlDecode(b64urlD);
  const pub = b64urlDecode(b64urlPubUncompressed); // 0x04 || X(32) || Y(32)
  if (pub[0] !== 0x04 || pub.length !== 65) throw new Error("Invalid VAPID public key");
  const x = pub.slice(1, 33);
  const y = pub.slice(33, 65);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: b64urlEncode(x),
    y: b64urlEncode(y),
    d: b64urlEncode(d),
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

function derSigToJose(der: Uint8Array): Uint8Array {
  // Already JOSE format (raw R||S, 64 bytes) — Web Crypto returns raw.
  // Keeping helper for future-proofing if a backend ever yields DER.
  return der;
}

/** Build a VAPID Authorization header value for the given push endpoint origin. */
export async function buildVapidAuthHeader(opts: {
  endpoint: string;
  subject: string;
  publicKey: string;
  privateKey: string;
  ttlSeconds?: number;
}): Promise<{ authorization: string; cryptoKey: string }> {
  const url = new URL(opts.endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const exp = Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? 12 * 60 * 60);

  const header = { typ: "JWT", alg: "ES256" };
  const claims = { aud, exp, sub: opts.subject };
  const enc = (o: unknown) => b64urlEncode(new TextEncoder().encode(JSON.stringify(o)));
  const signingInput = `${enc(header)}.${enc(claims)}`;

  const key = await importVapidPrivateKey(opts.privateKey, opts.publicKey);
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput)),
  );
  const jwt = `${signingInput}.${b64urlEncode(derSigToJose(sig))}`;
  return { authorization: `vapid t=${jwt}, k=${opts.publicKey}`, cryptoKey: opts.publicKey };
}

/* ===== aes128gcm encryption (RFC 8291) ===== */

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", salt as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm as BufferSource));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", prk as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const infoWithCounter = concat(info, new Uint8Array([1]));
  const out = new Uint8Array(await crypto.subtle.sign("HMAC", key, infoWithCounter as BufferSource));
  return out.slice(0, length);
}

/** Generates an ephemeral ECDH P-256 keypair and returns the raw uncompressed public key + private CryptoKey. */
async function generateEphemeralEcdh(): Promise<{ publicRaw: Uint8Array; privateKey: CryptoKey }> {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  return { publicRaw: raw, privateKey: kp.privateKey };
}

async function importClientP256Public(b64urlRaw: string): Promise<CryptoKey> {
  const raw = b64urlDecode(b64urlRaw);
  return crypto.subtle.importKey("raw", raw as BufferSource, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

/**
 * Encrypts a payload for Web Push using aes128gcm.
 * Returns the binary body that should be POSTed to the subscription endpoint.
 */
export async function encryptPushPayload(opts: {
  payload: string | Uint8Array;
  p256dh: string; // client public key (base64url, raw uncompressed 65 bytes)
  auth: string;   // client auth secret (base64url, 16 bytes)
}): Promise<Uint8Array> {
  const plaintext = typeof opts.payload === "string" ? new TextEncoder().encode(opts.payload) : opts.payload;
  const clientPubRaw = b64urlDecode(opts.p256dh);
  const clientAuth = b64urlDecode(opts.auth);

  const { publicRaw: serverPubRaw, privateKey: serverPriv } = await generateEphemeralEcdh();
  const clientPub = await importClientP256Public(opts.p256dh);

  // ECDH shared secret
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientPub }, serverPriv, 256),
  );

  // PRK_key = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" || ua_pub || as_pub, 32)
  const keyInfo = concat(
    new TextEncoder().encode("WebPush: info\0"),
    clientPubRaw,
    serverPubRaw,
  );
  const prkKey = await hkdfExtract(clientAuth, ecdhSecret);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  // salt: 16 random bytes
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);

  // CEK: HKDF(salt, ikm', "Content-Encoding: aes128gcm\0", 16)
  const cek = await hkdfExpand(prk, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  // NONCE: HKDF(salt, ikm', "Content-Encoding: nonce\0", 12)
  const nonce = await hkdfExpand(prk, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);

  // Build padded plaintext: data || 0x02 (single record, last)
  const padded = concat(plaintext, new Uint8Array([0x02]));

  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, padded as BufferSource),
  );

  // Header: salt(16) || rs(4 BE = 4096) || idlen(1) || keyid(idlen=65 bytes server pub)
  const rs = new Uint8Array([0x00, 0x00, 0x10, 0x00]); // 4096
  const idlen = new Uint8Array([serverPubRaw.length]); // 65
  const header = concat(salt, rs, idlen, serverPubRaw);

  return concat(header, ciphertext);
}