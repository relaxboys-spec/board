// Makes the sign-in hash for src/ui/login.ts (PASS), so the real username and PIN never
// appear in the source:
//
//   node scripts/login-hash.mjs <username> <pin>
//
// The username is matched case-insensitively. Paste the printed value into PASS.
// Changing it signs the device out (the remembered sign-in no longer matches).

const SEED = 0x51b0a4d;

function hash(str, seed = SEED) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const [user, pin] = process.argv.slice(2);
if (!user || !/^\d{4}$/.test(pin ?? '')) {
  console.error('usage: node scripts/login-hash.mjs <username> <4-digit pin>');
  process.exit(1);
}
console.log(hash(`${user.trim().toLowerCase()}:${pin}`));
