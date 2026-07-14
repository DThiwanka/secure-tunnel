import zlib from 'zlib';
import util from 'util';
import { CompressionProvider } from '@secure-tunnel/core';

const gzipPromise = util.promisify(zlib.gzip);
const gunzipPromise = util.promisify(zlib.gunzip);

export class GzipCompressionProvider implements CompressionProvider {
  public async compress(data: string | Buffer): Promise<Buffer> {
    try {
      const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      return await gzipPromise(buffer);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Gzip compression failed: ${err.message}`);
    }
  }

  public async decompress(data: Buffer): Promise<string> {
    try {
      const decompressed = await gunzipPromise(data);
      return decompressed.toString('utf8');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Gzip decompression failed: ${err.message}`);
    }
  }
}
