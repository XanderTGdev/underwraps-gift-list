// /api/csp-report.ts (Vercel Serverless Function, Node)
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

    const ua = req.headers['user-agent'] ?? '';
    const reports: any[] = [];

    if (ct.includes('application/reports+json')) {
      // New Reporting API: array of report objects
      const body = req.body; // Vercel parses JSON by default
      if (Array.isArray(body)) {
        for (const r of body) {
          const blocked = r?.body?.['blocked-uri'] as string | undefined;
          if (blocked?.startsWith('chrome-extension://') || blocked?.startsWith('moz-extension://')) continue;
          reports.push({ received_at: new Date().toISOString(), ip, ua, ...r });
        }
      }
    } else {
      // Legacy format or generic JSON
      const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const legacy = raw?.['csp-report'] ?? raw;
      const blocked = legacy?.['blocked-uri'] as string | undefined;
      if (!blocked?.startsWith?.('chrome-extension://') && !blocked?.startsWith?.('moz-extension://')) {
        reports.push({ received_at: new Date().toISOString(), ip, ua, ...legacy });
      }
    }

    // >>> This is the extra logging you asked for <<<
    if (reports.length === 0) {
      console.log('CSP report: none parsed', { ct, ip, ua });
    } else {
      for (const r of reports) {
        const body = (r as any).body ?? r;
        console.log(
          'CSP report:',
          JSON.stringify({
            blocked: body['blocked-uri'],
            directive: body['violated-directive'],
            doc: body['document-uri'],
            sample: body['sample'] ?? body['script-sample'],
          })
        );
      }
    }
  } catch (e) {
    console.error('CSP handler error', e);
    // still return 204 so browsers don't retry
  }

  return res.status(204).end();
}
