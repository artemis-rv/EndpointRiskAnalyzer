/**
 * api/downloads/index.ts
 * ──────────────────────
 * Download delivery and history.
 * Contract source: `backend/app/api/v1/downloads.py`.
 *
 * The backend owns the download flow entirely: it checks the caller is
 * authenticated and email-verified, checks the release is PUBLISHED, resolves
 * the artefact inside a single trusted storage root, applies its per-release
 * hourly limit, writes the audit record, and streams the bytes. The client's
 * only job is to ask and to save what comes back.
 */

import { apiUrl } from '@/constants/config';
import { ensureAuthenticated, http } from '@/api/client/http';
import { apiErrorFromResponse, networkError } from '@/api/client/errors';
import { tokenStore } from '@/api/client/tokenStore';
import type { DownloadRecord, PageParams, Paginated } from '@/types/api';

export interface DeliveredArtefact {
  blob: Blob;
  /** Filename the server asked the browser to save as. */
  filename: string;
}

/** Read the filename out of Content-Disposition, ignoring anything hostile. */
function parseFilename(header: string | null, fallback: string): string {
  if (!header) return fallback;

  // RFC 5987 form first, then the plain quoted form.
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      const decoded = decodeURIComponent(encoded[1]);
      return sanitiseFilename(decoded) || fallback;
    } catch {
      /* fall through to the plain form */
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(header);
  return (plain?.[1] && sanitiseFilename(plain[1])) || fallback;
}

/**
 * Strip anything that could make the saved name act as a path.
 *
 * The server already builds this name from the release version, but a filename
 * coming off the wire is still untrusted input, and it is about to be handed to
 * a download attribute.
 */
function sanitiseFilename(name: string): string {
  return (
    name
      // Path separators would let the saved name escape the download directory.
      .replace(/[/\\]/g, '')
      // Control characters, including the CR/LF that would matter most if this
      // value were ever echoed back into a header.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, '')
      // A leading dot hides the file on unix-like systems.
      .replace(/^\.+/, '')
      .trim()
      .slice(0, 200)
  );
}

export const downloadsApi = {
  /**
   * GET /downloads/{release_id}/file
   *
   * Fetched with the bearer token in a header rather than opened as a plain
   * link, because a link cannot carry an Authorization header and putting a
   * credential in a URL would leak it into history, logs and referrers.
   *
   * The response is buffered into a Blob so it can be handed to a download
   * anchor. That holds the artefact in memory for the duration of the save,
   * which is the accepted cost of not weakening the authentication scheme.
   */
  async fetchArtefact(releaseId: string, signal?: AbortSignal): Promise<DeliveredArtefact> {
    // Renew first if the access token has expired, so a long-idle tab does not
    // waste a round trip on a predictable 401.
    await ensureAuthenticated();

    const url = apiUrl(`/downloads/${encodeURIComponent(releaseId)}/file`);
    const token = tokenStore.getAccessToken();

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'omit',
        mode: 'cors',
        signal,
      });
    } catch {
      throw networkError();
    }

    if (!response.ok) {
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        // A failure may not carry a JSON body; the status still classifies it.
      }
      throw apiErrorFromResponse(response.status, body);
    }

    return {
      blob: await response.blob(),
      filename: parseFilename(
        response.headers.get('Content-Disposition'),
        'riskintel-release',
      ),
    };
  },

  /**
   * POST /downloads → 201 DownloadResponse
   *
   * Records a download without delivering a file. Retained because it is part
   * of the published API, but the website does not use it: recording here and
   * then streaming from the delivery endpoint would write two rows for one
   * download.
   */
  record(payload: { release_id: string; download_source?: string }): Promise<DownloadRecord> {
    return http.post<DownloadRecord>(
      '/downloads',
      {
        release_id: payload.release_id,
        download_source: payload.download_source ?? 'website',
      },
      { auth: true },
    );
  },

  /** GET /downloads/me → Paginated<DownloadResponse> */
  listMine(params: PageParams = {}, signal?: AbortSignal): Promise<Paginated<DownloadRecord>> {
    return http.get<Paginated<DownloadRecord>>('/downloads/me', {
      auth: true,
      query: { page: params.page, page_size: params.page_size },
      signal,
    });
  },
};
