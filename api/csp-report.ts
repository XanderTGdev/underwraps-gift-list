// /api/csp-report.ts (Vercel Serverless Function, Node)
// Accepts both legacy (application/csp-report) and modern (application/reports+json) reports.
// Always 204. Logs to Vercel function logs.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, report-to');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const ct = (req.headers['content-type'] || '').toString().toLowerCase();
  try {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
      req.headers['cf-connecting-ip'] ??
      req.socket.remoteAddress ??
      'unknown';

    let reports: any[] = [];
    if (ct.includes('application/reports+json')) {
      const body = req.body; // should be an array
      if (Array.isArray(body)) {
        for (const r of body) {
          const blocked = r?.body?.['blocked-uri'];
          if (typeof blocked === 'string' && (blocked.startsWith('chrome-extension://') || blocked.startsWith('moz-extension://'))) continue;
          reports.push({ received_at: new Date().toISOString(), ip, ua: req.headers['user-agent'], ...r });
        }
      }
    } else {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const legacy = body?.['csp-report'] ?? body;
      const blocked = legacy?.['blocked-uri'];
      if (typeof blocked !== 'string' || (!blocked.startsWith('chrome-extension://') && !blocked.startsWith('moz-extension://'))) {
        reports.push({ received_at: new Date().toISOString(), ip, ua: req.headers['user-agent'], ...legacy });
      }
    }

    for (const r of reports) console.log('CSP report:', JSON.stringify(r));
  } catch (e) {
    console.error('CSP handler error', e);
    // swallow errors; still return 204
  }
  return res.status(204).end();
}
