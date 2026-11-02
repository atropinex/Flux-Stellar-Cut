import {protocol} from 'electron';
import {createReadStream, statSync} from 'fs';
import {extname, resolve, sep} from 'path';
import {Readable} from 'stream';
import {MEDIA_SCHEME} from '../StellarConnection';
import {ALL_MEDIA_EXTENSIONS} from '../StellarConfig';

const MIME_TYPES: Record<string, string> = {
    mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska',
    ogv: 'video/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
    ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif'
};

/** Must be called before the app is ready. */
export function registerMediaScheme(): void {
    protocol.registerSchemesAsPrivileged([{
        scheme: MEDIA_SCHEME,
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            stream: true,
            bypassCSP: true,
            corsEnabled: true
        }
    }]);
}

/** Serves local media files to the page, with the Range support that video seeking needs. */
export class StellarProtocolController {
    constructor(private cacheFolder: string) {
    }

    register(): void {
        protocol.handle(MEDIA_SCHEME, (request) => this.serve(request));
    }

    private serve(request: Request): Response {
        const url = new URL(request.url);
        const path = decodeURIComponent(url.pathname.slice(1));

        if (!this.isAllowed(path)) {
            return new Response('Not allowed', {status: 404});
        }

        let size = 0;

        try {
            size = statSync(path).size;
        } catch {
            return new Response('Not found', {status: 404});
        }

        const extension = extname(path).slice(1).toLowerCase();
        const headers: Record<string, string> = {
            'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
            'Cross-Origin-Resource-Policy': 'cross-origin'
        };

        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');

        if (!range) {
            headers['Content-Length'] = String(size);
            return new Response(this.stream(path), {status: 200, headers});
        }

        const start = range[1] ? parseInt(range[1], 10) : 0;
        const end = range[2] ? Math.min(parseInt(range[2], 10), size - 1) : size - 1;

        if (start >= size || start > end) {
            return new Response('Bad range', {status: 416, headers: {'Content-Range': `bytes */${size}`}});
        }

        headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
        headers['Content-Length'] = String(end - start + 1);

        return new Response(this.stream(path, start, end), {status: 206, headers});
    }

    private stream(path: string, start?: number, end?: number): ReadableStream {
        return Readable.toWeb(createReadStream(path, {start, end})) as unknown as ReadableStream;
    }

    /** Only media files, and anything in the cache (thumbnails, proxies). */
    private isAllowed(path: string): boolean {
        if (!path) {
            return false;
        }

        const absolute = resolve(path);

        if (absolute.startsWith(resolve(this.cacheFolder) + sep)) {
            return true;
        }

        return ALL_MEDIA_EXTENSIONS.includes(extname(absolute).slice(1).toLowerCase());
    }
}
