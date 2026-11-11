/**
 * Pure GZIP + Base64URL Transfer Code Encoder/Decoder (KG1-...)
 * Works in both Browser (PC / Android) and Node.js (unit tests) with zero external dependencies.
 */

export async function encodePayloadToTransferCode(json: string): Promise<string> {
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(json);

  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(rawBytes);
    writer.close();
    const compressedBuf = await new Response(cs.readable).arrayBuffer();
    const bytes = new Uint8Array(compressedBuf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `KG1-${base64}`;
  }

  let binary = '';
  for (let i = 0; i < rawBytes.length; i++) {
    binary += String.fromCharCode(rawBytes[i]);
  }
  const base64 = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `KG0-${base64}`;
}

export async function decodeTransferCodeToPayload(code: string): Promise<string> {
  const trimmed = code.trim();
  if (!trimmed.startsWith('KG1-') && !trimmed.startsWith('KG0-')) {
    throw new Error('صيغة كود النقل غير صحيحة. يجب أن يبدأ الكود بـ KG1- أو KG0-');
  }

  const isCompressed = trimmed.startsWith('KG1-');
  const payloadBase64 = trimmed.slice(4).replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (payloadBase64.length % 4)) % 4;
  const padded = payloadBase64 + '='.repeat(padLen);

  let binary = '';
  try {
    binary = atob(padded);
  } catch {
    throw new Error('كود النقل غير مكتمل أو تالف، يرجى نسخه بالكامل.');
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  if (isCompressed && typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const decompressedBuf = await new Response(ds.readable).arrayBuffer();
    return new TextDecoder().decode(decompressedBuf);
  }

  return new TextDecoder().decode(bytes);
}
