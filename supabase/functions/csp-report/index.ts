// Supabase Edge Function: csp-report
// Accepts CSP violation reports in both legacy (application/csp-report)
// and modern (application/reports+json) formats.
// Logs them; optionally insert into a table (snippet below).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type LegacyCspBody = { "csp-report"?: Record<string, unknown> };
type NLReport = {
  type?: string;               // e.g., "csp-violation"
  age?: number;
  url?: string;                // document-uri
  user_agent?: string;
  body?: Record<string, unknown>; // contains blocked-uri, violated-directive, etc.
};

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
    const ua = req.headers.get("user-agent") ?? "";
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ??
      "unknown";

    let reports: Array<Record<string, unknown>> = [];

    if (contentType.includes("application/reports+json")) {
      // New Reporting API: array of Report objects
      const arr = (await req.json()) as NLReport[] | unknown;
      if (Array.isArray(arr)) {
        for (const r of arr) {
          // Filter out obvious noise from browser extensions (optional):
          const blocked = (r.body as any)?.["blocked-uri"] as string | undefined;
          if (blocked?.startsWith("chrome-extension://") || blocked?.startsWith("moz-extension://")) {
            continue; // drop extension noise
          }

          reports.push({
            received_at: new Date().toISOString(),
            ip,
            user_agent: ua,
            type: r.type ?? "csp-violation",
            url: r.url,
            body: r.body,
          });
        }
      }
    } else if (
      contentType.includes("application/csp-report") ||
      contentType.includes("application/json")
    ) {
      // Legacy format: single object with { "csp-report": { ... } }
      const payload = (await req.json()) as LegacyCspBody | unknown;
      const body =
        (payload as LegacyCspBody)?.["csp-report"] ??
        (payload as Record<string, unknown>);

      const blocked = (body as any)?.["blocked-uri"] as string | undefined;
      if (
        blocked?.startsWith("chrome-extension://") ||
        blocked?.startsWith("moz-extension://")
      ) {
        // drop extension noise
      } else {
        reports.push({
          received_at: new Date().toISOString(),
          ip,
          user_agent: ua,
          type: "csp-violation",
          body,
        });
      }
    } else {
      // Unknown/empty payload—ignore gracefully
      return new Response(null, { status: 204 });
    }

    // Log each report (visible in Supabase → Logs → Functions)
    for (const r of reports) console.log("CSP report:", JSON.stringify(r));

    // Optional: persist to DB (uncomment + create table, see step 3)
    // await saveReports(reports);

    // MUST return 204 per spec (no body)
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("CSP report handler error:", err);
    // Still return 204 so browsers don't retry aggressively
    return new Response(null, { status: 204 });
  }
});

// OPTIONAL: store reports (requires service role; see step 3)
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// async function saveReports(reports: Array<Record<string, unknown>>) {
//   const url = Deno.env.get("SUPABASE_URL")!;
//   const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
//   const supabase = createClient(url, service);
//   const { error } = await supabase.from("csp_reports").insert(
//     reports.map((r) => ({ ...r })) // columns must match table schema below
//   );
//   if (error) console.error("Failed to persist CSP reports:", error);
// }
