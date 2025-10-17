// /api/csp-report.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

async function readRawBody(req: VercelRequest): Promise<string> {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return await new Promise<string>((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS / preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, report-to');
    return res.status(204).end();
  }

  if (req.method !== 'POST') return res.status(405).end();

  const ct = (req.headers['content-type'] || '').toString().toLowerCase();
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.headers['cf-connecting-ip'] ??
    req.socket.remoteAddress ??
    'unknown';
  const ua = req.headers['user-agent'] ?? '';

  try {
    const raw = await readRawBody(req);
    const reports: any[] = [];

    if (ct.includes('application/reports+json')) {
      // New Reporting API: array of report objects
      let arr: unknown = [];
      try {
        arr = raw ? JSON.parse(raw) : [];
      } catch {
        // Sometimes proxies send newline-delimited JSON; try a best-effort split
        arr = raw
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => JSON.parse(l));
      }
      if (Array.isArray(arr)) {
        for (const r of arr) {
          const blocked = (r as any)?.body?.['blocked-uri'] as string | undefined;
          if (blocked?.startsWith('chrome-extension://') || blocked?.startsWith('moz-extension://')) continue;
          reports.push({ received_at: new Date().toISOString(), ip, ua, ...r });
        }
      }
    } else {
      // Legacy CSP (application/csp-report) or generic JSON
      const obj = raw ? JSON.parse(raw) : {};
      const legacy = (obj as any)['csp-report'] ?? obj;
      const blocked = legacy?.['blocked-uri'] as string | undefined;
      if (!blocked?.startsWith?.('chrome-extension://') && !blocked?.startsWith?.('moz-extension://')) {
        reports.push({ received_at: new Date().toISOString(), ip, ua, ...legacy });
      }
    }

    // after you push into `reports`
    if (reports.length === 0) {
      console.log('CSP report: none parsed', { ct, ip, ua, rawLen: (await readRawBody(req))?.length ?? 0 });
    } else {
      for (const r of reports) {
        const body: any = (r as any).body ?? r;
        const blocked =
          body['blocked-uri'] ??
          body['blocked-url'] ??          // newer key seen in some Chrome reports
          body['url'] ??                  // sometimes present
          body['destination'];            // e.g., fetch/img/script destination

        const directive =
          body['effective-directive'] ??  // newer canonical field
          body['violated-directive'];

        const doc =
          body['document-uri'] ??
          (r as any).url ?? '';

        const sample = body['sample'] ?? body['script-sample'] ?? '';

        if (!blocked && !directive) {
          // dump the whole body once so you can see the shape you’re getting
          console.log('CSP report (raw body):', JSON.stringify(body));
        } else {
          console.log('CSP report:', JSON.stringify({ blocked, directive, doc, sample }));
        }
      }
    }

  } catch (e) {
    console.error('CSP handler error', e);
  }

  return res.status(204).end();
}
