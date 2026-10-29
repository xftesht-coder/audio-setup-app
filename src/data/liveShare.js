import { parseLiveSnapshot, variantName } from './liveSystem.js';

export const MAX_SHARE_URL_LENGTH = 16000;
export const MAX_SHARE_JSON_BYTES = 256 * 1024;
const prefix = '#snapshot=v1.';
const encoder = new TextEncoder();
const invalid = () => new Error('Ссылка повреждена или её формат не поддерживается. Попроси автора отправить её заново.');
const tooLarge = () => new Error('Этот вариант слишком большой для ссылки. Уменьши число точек трасс или сохрани его в JSON.');

async function readBounded(stream, max) {
  const reader = stream.getReader(), chunks = [];
  let size = 0;
  try {
    for (let result = await reader.read(); !result.done; result = await reader.read()) {
      const { value } = result;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); throw tooLarge(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

function payload(item) {
  return { type: 'audio-setup-share', version: 1, name: variantName(item.name), snapshot: parseLiveSnapshot(item.snapshot) };
}

// Self-contained immutable snapshot. The fragment is not sent to the web server.
// No identifiers from the library, agent messages or browser settings are exported.
export async function createLiveShareUrl(item, baseUrl) {
  if (typeof CompressionStream === 'undefined') throw new Error('Для создания ссылки нужен современный браузер. Обнови его и попробуй снова.');
  const bytes = encoder.encode(JSON.stringify(payload(item)));
  if (bytes.length > MAX_SHARE_JSON_BYTES) throw tooLarge();
  const zipped = await readBounded(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')), MAX_SHARE_URL_LENGTH);
  const token = btoa(String.fromCharCode(...zipped)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  const url = new URL(baseUrl);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Нужен адрес сайта Audio Setup.');
  url.search = '?view=share'; url.hash = prefix + token;
  if (url.href.length > MAX_SHARE_URL_LENGTH) throw tooLarge();
  return url.href;
}

export async function readLiveShare(hash) {
  if (typeof hash !== 'string' || hash.length > MAX_SHARE_URL_LENGTH || !hash.startsWith(prefix)) throw invalid();
  const token = hash.slice(prefix.length);
  if (!token || !/^[A-Za-z0-9_-]+$/.test(token) || token.length % 4 === 1) throw invalid();
  if (typeof DecompressionStream === 'undefined') throw new Error('Для просмотра снимка нужен современный браузер. Обнови его или открой ссылку в другом.');
  try {
    const binary = atob(token.replaceAll('-', '+').replaceAll('_', '/'));
    const zipped = Uint8Array.from(binary, c => c.charCodeAt(0));
    const bytes = await readBounded(new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip')), MAX_SHARE_JSON_BYTES);
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (value?.type !== 'audio-setup-share' || value.version !== 1) throw invalid();
    return payload(value);
  } catch { throw invalid(); }
}

export function sharedRoomScene(snapshot) {
  return { project: snapshot.workshop.variants[snapshot.workshop.activeVariant], cables: snapshot.room.cables };
}

export const isLegacyShareHash = hash => ['', '#room', '#cabinet', '#system', '#patch'].includes(hash);
