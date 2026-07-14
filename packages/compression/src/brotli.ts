import zlib from 'zlib';
import util from 'util';
import { CompressionProvider } from '@secure-tunnel/core';

const brotliCompressPromise = util.promisify(zlib.brotliCompress);
const brotliDecompressPromise = util.promisify(zlib.brotliDecompress);

export class BrotliCompressionProvider implements CompressionProvider {
  public async compress(data: string | Buffer): Promise<Buffer> {
    try {
      const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      return await brotliCompressPromise(buffer);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Brotli compression failed: ${err.message}`);
    }
  }

  public async decompress(data: Buffer): Promise<string> {
    try {
      const decompressed = await brotliDecompressPromise(data);
      return decompressed.toString('utf8');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new Error(`Brotli decompression failed: ${err.message}`);
    }
  }
}
