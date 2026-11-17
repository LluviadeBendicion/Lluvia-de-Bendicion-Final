const { createCipheriv, createDecipheriv, createHash, randomBytes } = require('node:crypto');
const fs = require('node:fs');

const objectPath = 'restricted/prayer-v1.snapshot';
const initial = () => ({ cases: {}, sessions: {}, limits: {}, activity: [], totp: {} });

function openStore({ key, file, token }) {
  const secret = Buffer.from(key || '', 'base64');
  if (secret.length !== 32 || (!file && !token)) throw new Error('PRAYER_STORAGE_UNCONFIGURED');

  function encrypt(state) {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', secret, nonce);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(state)), cipher.final()]);
    return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]);
  }

  function decrypt(value) {
    if (!value) return initial();
    const decipher = createDecipheriv('aes-256-gcm', secret, value.subarray(0, 12));
    decipher.setAuthTag(value.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]));
  }

  const hash = buffer => createHash('sha256').update(buffer).digest('hex');
  function readFile() {
    const value = fs.readFileSync(file, { flag: 'r', throwIfNoEntry: false });
    return value ? { value, etag: hash(value) } : {};
  }

  async function read({ authoritativeVersion = false } = {}) {
    if (file) {
      if (!fs.existsSync(file)) return {};
      return readFile();
    }
    const { get, head, BlobNotFoundError } = await import('@vercel/blob');
    const metadata = async () => {
      try { return await head(objectPath, { token }); }
      catch (error) { if (error instanceof BlobNotFoundError) return null; throw error; }
    };
    const before = authoritativeVersion ? await metadata() : null;
    const result = await get(objectPath, { access: 'private', token, useCache: false });
    if (result?.blob.size > 12_000_000) throw new Error('PRAYER_STORAGE_LIMIT');
    const value = result ? Buffer.from(await new Response(result.stream).arrayBuffer()) : undefined;
    if (!authoritativeVersion) return { value, etag: result?.blob.etag };
    // Match the write against Blob's metadata API and discard reads that overlapped another write.
    const after = await metadata();
    if (before?.etag !== after?.etag || Boolean(result) !== Boolean(after)) return null;
    if (after && !after.etag) throw new Error('PRAYER_STORAGE_VERSION_MISSING');
    return { value, etag: after?.etag };
  }

  async function write(buffer, etag) {
    if (buffer.length > 12_000_000) throw new Error('PRAYER_STORAGE_LIMIT');
    if (file) {
      const current = fs.existsSync(file) ? readFile() : {};
      if (current.etag !== etag) return false;
      const temporary = `${file}.${randomBytes(8).toString('hex')}`;
      fs.writeFileSync(temporary, buffer, { flag: 'wx', mode: 0o600 });
      fs.renameSync(temporary, file);
      return true;
    }
    const { put, BlobPreconditionFailedError } = await import('@vercel/blob');
    try {
      await put(objectPath, buffer, {
        access: 'private', token, contentType: 'application/octet-stream', addRandomSuffix: false,
        ...(etag ? { ifMatch: etag, allowOverwrite: true } : { allowOverwrite: false })
      });
      return true;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError || (!etag && /already exists/i.test(error.message))) return false;
      throw error;
    }
  }

  return {
    async read() { return decrypt((await read()).value); },
    backup(state) {
      return encrypt({ ...state, sessions: {}, limits: {}, totp: {}, recovery: {}, emailRecovery: {} });
    },
    async change(mutate) {
      for (let attempt = 0; attempt < 7; attempt++) {
        const snapshot = await read({ authoritativeVersion: attempt > 0 });
        if (snapshot) {
          const state = decrypt(snapshot.value);
          const result = mutate(state);
          if (await write(encrypt(state), snapshot.etag)) return result;
        }
        await new Promise(resolve => setTimeout(resolve, 30 * 2 ** attempt + Math.floor(Math.random() * 50)));
      }
      throw new Error('PRAYER_STORAGE_CONTENTION');
    }
  };
}

module.exports = { openStore };
