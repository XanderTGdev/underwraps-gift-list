import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { handleCorsPreFlight, corsResponse, corsErrorResponse } from "../_shared/cors.ts";

// Product metadata fetcher - extracts product info from URLs

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
  const cleaned = raw.replace(/[^0-9.,]/g, "").trim();
  if (!cleaned) return undefined;
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
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
  console.log("Fetching HTML with timeout:", url);
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      throw new Error("URL is not an HTML page");
    }
    return await resp.text();
  } finally {
    clearTimeout(id);
  }
}

const handler = async (req: Request): Promise<Response> => {
  const preflightResponse = handleCorsPreFlight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const { url }: RequestBody = await req.json();
    console.log("Processing metadata request for URL:", url);

    if (!url) {
      console.log("Missing URL in request");
      return corsErrorResponse(req, "URL is required", 400);
    }

    if (typeof url !== "string") {
      console.log("URL is not a string");
      return corsErrorResponse(req, "URL must be a string", 400);
    }

    const trimmedUrl = url.trim();

    if (trimmedUrl.length > 2048) {
      console.log("URL exceeds maximum length");
      return corsErrorResponse(req, "URL must be less than 2048 characters", 400);
    }

    if (!isHttpUrl(trimmedUrl)) {
      console.log("Invalid HTTP(S) URL");
      return corsErrorResponse(req, "A valid http(s) URL is required", 400);
    }

    // Security: Prevent SSRF by blocking private IP ranges
    const urlObj = new URL(trimmedUrl);
    const hostname = urlObj.hostname.toLowerCase();

    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^::1$/,
      /^fe80:/i,
    ];

    if (blockedPatterns.some(pattern => pattern.test(hostname))) {
      console.log("Blocked attempt to access private network:", hostname);
      return corsErrorResponse(req, "Cannot access private network URLs", 400);
    }

    console.log("Fetching HTML for URL:", trimmedUrl);
    const html = await fetchHtmlWithTimeout(trimmedUrl);

    const meta: ProductMetadata = {};

    const fromJsonLd = extractFromJsonLd(html);
    if (fromJsonLd.title) meta.title = fromJsonLd.title;
    if (fromJsonLd.imageUrl) meta.imageUrl = fromJsonLd.imageUrl;
    if (fromJsonLd.price !== undefined) meta.price = fromJsonLd.price;
    if (fromJsonLd.currency) meta.currency = fromJsonLd.currency;

    if (!meta.title) meta.title = getTitle(html);
    if (!meta.imageUrl) meta.imageUrl = getImage(html);
    if (meta.price === undefined) {
      const priceMeta = extractPriceFromMeta(html);
      if (priceMeta.price !== undefined) meta.price = priceMeta.price;
      if (priceMeta.currency && !meta.currency) meta.currency = priceMeta.currency;
    }

    return corsResponse(req, { success: true, ...meta }, 200);
  } catch (error: any) {
    console.error("Error in fetch-product-metadata function");

    const message = error?.name === "AbortError"
      ? "Request timed out while fetching URL"
      : error?.message === "URL is not an HTML page"
        ? "The URL does not point to a valid web page"
        : "Unable to fetch product information";

    return corsErrorResponse(req, message, 400);
  }
};

serve(handler);
