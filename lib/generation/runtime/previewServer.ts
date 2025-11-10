import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface PreviewServer {
  url: string;
  close: () => Promise<void>;
}

/**
 * Starts a temporary HTTP server to serve the rendered HTML for Stagehand to test
 */
export async function startRuntimePreviewServer(html: string): Promise<PreviewServer> {
  return new Promise((resolve, reject) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    });

    server.on('error', reject);

    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to determine runtime preview server address.'));
        return;
      }

      const { address: host, port } = address as AddressInfo;
      const url = `http://${host === '::' ? '127.0.0.1' : host}:${port}`;
      resolve({
        url,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.close((err) => {
              if (err) {
                rejectClose(err);
              } else {
                resolveClose();
              }
            });
          }),
      });
    });
  });
}
