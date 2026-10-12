/**
 * Minimal ZIP archive generator (STORE method — no compression).
 *
 * Produces a valid ZIP file entirely in memory using only Node's
 * Buffer. This avoids adding a third-party dependency. Files are
 * stored uncompressed, which is fine for already-compressed media
 * (JPEG/PNG/MP4) and keeps the implementation small and safe.
 *
 * Reference: PKZIP Application Note (APPNOTE.TXT), sections 4.3
 * (local file header), 4.4 (central directory), 4.6 (EOCD).
 */

export interface ZipEntry {
  /** File name inside the archive (use forward slashes). */
  name: string;
  /** Raw file bytes. */
  data: Uint8Array;
  /** Optional DOS-style timestamp; defaults to now. */
  date?: Date;
}

/** Encode a Date as a DOS date/time (2 bytes each). */
function dosDateTime(date: Date): { time: number; date: number } {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day =
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { time, date: day };
}

/** CRC-32 lookup table (IEEE polynomial). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Build a ZIP archive from the given entries.
 * Returns the archive as a single Uint8Array.
 */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name.replace(/\\/g, "/"));
    const data = entry.data;
    const crc = crc32(data);
    const { time, date } = dosDateTime(entry.date ?? new Date());

    // ---- Local file header (30 bytes + name) ----
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 flag
    local.writeUInt16LE(0, 8); // method: STORE
    local.writeUInt16LE(time, 10); // mod time
    local.writeUInt16LE(date, 12); // mod date
    local.writeUInt32LE(crc, 14); // crc32
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBytes.length, 26); // name length
    local.writeUInt16LE(0, 28); // extra length
    chunks.push(new Uint8Array(local), nameBytes, data);

    // ---- Central directory header (46 bytes + name) ----
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); // signature
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0x0800, 8); // UTF-8 flag
    cd.writeUInt16LE(0, 10); // method: STORE
    cd.writeUInt16LE(time, 12); // mod time
    cd.writeUInt16LE(date, 14); // mod date
    cd.writeUInt32LE(crc, 16); // crc32
    cd.writeUInt32LE(data.length, 20); // compressed size
    cd.writeUInt32LE(data.length, 24); // uncompressed size
    cd.writeUInt16LE(nameBytes.length, 28); // name length
    cd.writeUInt16LE(0, 30); // extra length
    cd.writeUInt16LE(0, 32); // comment length
    cd.writeUInt16LE(0, 34); // disk number
    cd.writeUInt16LE(0, 36); // internal attrs
    cd.writeUInt32LE(0, 38); // external attrs
    cd.writeUInt32LE(offset, 42); // local header offset
    central.push(new Uint8Array(cd), nameBytes);

    offset += 30 + nameBytes.length + data.length;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);

  // ---- End of central directory (22 bytes) ----
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with central dir
  eocd.writeUInt16LE(entries.length, 8); // entries on disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralSize, 12); // central dir size
  eocd.writeUInt32LE(offset, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length

  return concat([...chunks, ...central, new Uint8Array(eocd)]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}
