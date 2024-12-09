/**
 * Uploads a payload to a url with detailed progress updates
 *
 * @param putUrl Url to upload the payload to
 * @param payload The payload to upload
 * @param signal the abort signal
 * @param logger optional logger function
 * @param progressInterval the interval in milliseconds to update the progress
 *
 * @returns the response from the upload
 */
export async function uploadWithDetailedProgress(
  putUrl: string,
  payload: Uint8Array,
  signal: AbortSignal,
  logger?: CallableFunction,
  progressInterval = 1000
): Promise<Response> {
  const totalSize = payload.byteLength;
  let uploadedBytes = 0;
  const CHUNK_SIZE = 16_384; // 16KB chunks
  let now = Date.now();

  const progressStream = new TransformStream({
    transform(chunk: Uint8Array, controller): void {
      uploadedBytes += chunk.length;
      const progress = (uploadedBytes / totalSize) * 100;
      if (Date.now() - now > progressInterval) {
        now = Date.now();
        logger?.(`Upload progress: ${progress.toFixed(2)}% (${uploadedBytes}/${totalSize} bytes)`);
      }
      controller.enqueue(chunk);
    }
  });

  const stream = new ReadableStream({
    start(controller): void {
      // Instead of enqueueing the entire payload at once, chunk it
      for (let offset = 0; offset < totalSize; offset += CHUNK_SIZE) {
        const chunk = payload.slice(offset, offset + CHUNK_SIZE);
        controller.enqueue(chunk);
      }
      controller.close();
    }
  });

  const response = await fetch(putUrl, {
    method: 'PUT',
    signal,
    body: stream.pipeThrough(progressStream),
    duplex: 'half',
    headers: {
      'Content-Length': totalSize.toString()
    }
  });

  return response;
}
