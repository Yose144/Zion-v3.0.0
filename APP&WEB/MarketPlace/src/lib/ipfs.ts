/**
 * IPFS upload utilities — Pinata gateway for OASIS artifact metadata
 *
 * Usage:
 *   const { cid, uri } = await uploadArtifactMetadata({
 *     name, description, image, attributes, ...
 *   });
 *   // uri = "ipfs://Qm.../metadata.json"
 */

const PINATA_API = 'https://api.pinata.cloud';
const GATEWAY = process.env.IPFS_GATEWAY ?? 'https://ipfs.io/ipfs/';

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

interface ArtifactMetadata {
  name: string;
  description: string;
  image: string;          // IPFS URI or HTTPS URL
  external_url?: string;
  attributes: Array<{ trait_type: string; value: string | number }>;
  properties?: {
    category: string;
    rarity: string;
    collection: string;
    source: string;       // 'oasis' | 'manual' | 'quest'
    gameId?: string;
  };
}

function authHeaders(): HeadersInit {
  const apiKey = process.env.IPFS_API_KEY;
  const apiSecret = process.env.IPFS_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error('IPFS_API_KEY / IPFS_API_SECRET not set');
  }
  return {
    pinata_api_key: apiKey,
    pinata_secret_api_key: apiSecret,
  };
}

/**
 * Upload a JSON object to IPFS via Pinata.
 * Returns { cid, uri, gatewayUrl }.
 */
export async function uploadJSON(
  data: Record<string, unknown>,
  name?: string
): Promise<{ cid: string; uri: string; gatewayUrl: string }> {
  const body = JSON.stringify({
    pinataContent: data,
    pinataMetadata: name ? { name } : undefined,
  });

  const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata upload failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as PinataResponse;
  const cid = json.IpfsHash;
  return {
    cid,
    uri: `ipfs://${cid}`,
    gatewayUrl: `${GATEWAY}${cid}`,
  };
}

/**
 * Upload a file (image, 3D model, etc.) to IPFS via Pinata.
 * Expects a Buffer or Blob-like object.
 */
export async function uploadFile(
  file: Buffer | ArrayBuffer | Blob,
  filename: string
): Promise<{ cid: string; uri: string; gatewayUrl: string }> {
  const formData = new FormData();
  formData.append('file', new Blob([file as BlobPart]), filename);

  const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
    method: 'POST',
    headers: authHeaders() as Record<string, string>,
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata file upload failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as PinataResponse;
  const cid = json.IpfsHash;
  return {
    cid,
    uri: `ipfs://${cid}`,
    gatewayUrl: `${GATEWAY}${cid}`,
  };
}

/**
 * Upload complete artifact metadata (ERC-1155 compatible).
 * If image is a Buffer, uploads it first; if it's already a URI, uses it directly.
 */
export async function uploadArtifactMetadata(
  metadata: ArtifactMetadata,
  opts?: { imageBuffer?: Buffer; imageFilename?: string }
): Promise<{ cid: string; uri: string; gatewayUrl: string; metadata: ArtifactMetadata }> {
  let finalImage = metadata.image;

  // Upload image first if buffer provided
  if (opts?.imageBuffer) {
    const img = await uploadFile(
      opts.imageBuffer,
      opts.imageFilename ?? 'artifact.png'
    );
    finalImage = img.uri;
  }

  const fullMetadata: ArtifactMetadata = {
    ...metadata,
    image: finalImage,
  };

  const result = await uploadJSON(
    fullMetadata as unknown as Record<string, unknown>,
    `${metadata.name}-metadata`
  );

  return { ...result, metadata: fullMetadata };
}

/**
 * Convert an ipfs:// URI to a gateway URL for display.
 */
export function ipfsToGateway(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    const cid = uri.slice(7);
    return `${GATEWAY}${cid}`;
  }
  return uri;
}

/**
 * Batch upload metadata for multiple artifacts (e.g. from OASIS quest rewards).
 */
export async function uploadBatchMetadata(
  items: ArtifactMetadata[]
): Promise<Array<{ cid: string; uri: string; gatewayUrl: string }>> {
  return Promise.all(
    items.map((m) => uploadArtifactMetadata(m).then((r) => ({ cid: r.cid, uri: r.uri, gatewayUrl: r.gatewayUrl })))
  );
}
