import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

interface RequestBody {
  url: string;
}

type ProductMetadata = {
  title?: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
};

function isHttpUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getMetaContent(html: string, attr: "property" | "name", key: string): string | undefined {
  const regex = new RegExp(`<meta[^>]*${attr}=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i");
  const match = html.match(regex);
  return match?.[1]?.trim();
}

function getTitle(html: string): string | undefined {
  return (
    getMetaContent(html, "property", "og:title") ||
    getMetaContent(html, "name", "twitter:title") ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
  );
}

function getImage(html: string): string | undefined {
  return (
    getMetaContent(html, "property", "og:image") ||
    getMetaContent(html, "name", "twitter:image") ||
    html.match(/<link[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1]?.trim()
  );
}

function coercePriceStringToNumber(raw: string): number | undefined {
  if (!raw) return undefined;
  // Remove currency symbols and spaces, normalize decimal separator
  const cleaned = raw.replace(/[^0-9.,]/g, "").trim();
  if (!cleaned) return undefined;
  // If both comma and dot exist, assume comma is thousands sep and dot is decimal
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    // Assume comma is decimal
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned;
  }
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : undefined;
}

function extractFromJsonLd(html: string): Partial<ProductMetadata> {
  const results: Partial<ProductMetadata> = {};
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    const jsonText = match[1].trim();
    try {
      const parsed = JSON.parse(jsonText);
      const nodes: any[] = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        // Find a Product node, possibly within @graph
        const graphNodes: any[] = node?.['@graph'] && Array.isArray(node['@graph']) ? node['@graph'] : [node];
        for (const candidate of graphNodes) {
          const type = candidate?.['@type'] || candidate?.type;
          if (!type) continue;
          const types = Array.isArray(type) ? type : [type];
          if (types.map((t: string) => t.toLowerCase()).includes("product")) {
            if (!results.title && typeof candidate?.name === "string") {
              results.title = candidate.name;
            }
            if (!results.imageUrl) {
              if (typeof candidate?.image === "string") results.imageUrl = candidate.image;
              else if (Array.isArray(candidate?.image) && typeof candidate.image[0] === "string") results.imageUrl = candidate.image[0];
            }
            const offers = candidate?.offers;
            const offer = Array.isArray(offers) ? offers[0] : offers;
            if (offer) {
              if (results.price === undefined && offer.price) {
                const priceNum = typeof offer.price === "number" ? offer.price : coercePriceStringToNumber(String(offer.price));
                if (priceNum !== undefined) results.price = priceNum;
              }
              if (!results.currency && typeof offer.priceCurrency === "string") {
                results.currency = offer.priceCurrency.toUpperCase();
              }
            }
            // Stop after first reasonable Product
            if (results.title || results.imageUrl || results.price) {
              return results;
            }
          }
        }
      }
    } catch {
      // Ignore individual JSON-LD parse errors and continue
    }
  }
  return results;
}

function extractPriceFromMeta(html: string): { price?: number; currency?: string } {
  // Common meta tags
  const candidates: Array<["property" | "name", string]> = [
    ["property", "product:price:amount"],
    ["property", "og:price:amount"],
    ["name", "price"],
    ["name", "product:price:amount"],
  ];
  for (const [attr, key] of candidates) {
    const raw = getMetaContent(html, attr, key);
    const price = raw ? coercePriceStringToNumber(raw) : undefined;
    if (price !== undefined) {
      // Try to find currency alongside
      const currency =
        getMetaContent(html, attr, key.replace("amount", "currency")) ||
        getMetaContent(html, "property", "og:price:currency") ||
        getMetaContent(html, "name", "priceCurrency") ||
        undefined;
      return { price, currency: currency?.toUpperCase() };
    }
  }
  return {};
}

async function fetchHtmlWithTimeout(url: string, timeoutMs = 8000): Promise<string> {
  console.log("FHWT - fetchHtmlWithTimeout", url);
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    console.log("FHWT - 'try' - fetching url");
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    console.log("FHWT - 'try' - resp", resp);
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      console.log("FHWT - 'if (!contentType.includes('text/html'))' - throwing error");
      throw new Error("URL is not an HTML page");
    }
    return await resp.text();
  } finally {
    console.log("FHWT - 'finally' - clearing timeout");
    clearTimeout(id);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url }: RequestBody = await req.json();
    console.log("X - url", url);
    if (!url || !isHttpUrl(url)) {
      console.log("X - returning 400");
      return new Response(
        JSON.stringify({ success: false, error: "A valid http(s) URL is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    console.log("X - fetching html...");
    console.log("X - MARK-1");
    const html = await fetchHtmlWithTimeout(url);

    const meta: ProductMetadata = {};

    // Prefer JSON-LD Product schema for structured data
    const fromJsonLd = extractFromJsonLd(html);
    if (fromJsonLd.title) meta.title = fromJsonLd.title;
    if (fromJsonLd.imageUrl) meta.imageUrl = fromJsonLd.imageUrl;
    if (fromJsonLd.price !== undefined) meta.price = fromJsonLd.price;
    if (fromJsonLd.currency) meta.currency = fromJsonLd.currency;

    // Fallbacks from OG/Twitter meta
    if (!meta.title) meta.title = getTitle(html);
    if (!meta.imageUrl) meta.imageUrl = getImage(html);
    if (meta.price === undefined) {
      const priceMeta = extractPriceFromMeta(html);
      if (priceMeta.price !== undefined) meta.price = priceMeta.price;
      if (priceMeta.currency && !meta.currency) meta.currency = priceMeta.currency;
    }

    return new Response(
      JSON.stringify({ success: true, ...meta }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("Error in fetch-product-metadata:", error?.message || error);
    const message = error?.name === "AbortError" ? "Timed out fetching URL" : "Unable to fetch metadata";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);


