/**
 * Extract readable text content from a web URL.
 * Fetches the HTML, strips tags, and extracts the main article text.
 * Works entirely on-device — no external APIs needed.
 */

/**
 * Fetch a URL and extract the main readable text content.
 */
export async function extractTextFromUrl(url: string): Promise<{ text: string; title: string }> {
  // Normalize URL
  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  const response = await fetch(normalizedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Loudify/1.0',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page (${response.status})`);
  }

  const html = await response.text();
  const title = extractTitle(html) || getDomainTitle(normalizedUrl);
  const text = extractArticleText(html);

  if (!text || text.length < 20) {
    throw new Error('Could not extract readable text from this page. Try copying the text manually.');
  }

  return { text, title };
}

/** Extract <title> from HTML */
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : '';
}

/** Fallback title from domain */
function getDomainTitle(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'Web Article';
  }
}

/**
 * Extract article text from HTML using a heuristic approach:
 * 1. Remove script, style, nav, header, footer, aside tags
 * 2. Look for <article>, <main>, or common content containers
 * 3. Fall back to <body> with aggressive tag stripping
 * 4. Clean up whitespace
 */
function extractArticleText(html: string): string {
  // Remove unwanted elements entirely
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Try to find article/main content first
  let content = '';
  const articleMatch = cleaned.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i);
  const mainMatch = cleaned.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);

  // Common content div patterns
  const contentDivMatch = cleaned.match(
    /<div[^>]*(?:class|id)=["'][^"']*(?:content|article|post|entry|story|text)(?:-body|-content|-text)?[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  );

  if (articleMatch) {
    content = articleMatch[1];
  } else if (mainMatch) {
    content = mainMatch[1];
  } else if (contentDivMatch) {
    content = contentDivMatch[1];
  } else {
    // Fallback: use body
    const bodyMatch = cleaned.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);
    content = bodyMatch ? bodyMatch[1] : cleaned;
  }

  // Convert block elements to newlines
  content = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/blockquote>/gi, '\n\n');

  // Strip remaining HTML tags
  content = content.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  content = decodeHtmlEntities(content);

  // Clean up whitespace
  content = content
    .replace(/[ \t]+/g, ' ')           // collapse horizontal whitespace
    .replace(/\n[ \t]+/g, '\n')        // trim line starts
    .replace(/[ \t]+\n/g, '\n')        // trim line ends
    .replace(/\n{3,}/g, '\n\n')        // max 2 consecutive newlines
    .trim();

  return content;
}

/** Decode common HTML entities */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** Check if a string looks like a URL */
export function isUrl(text: string): boolean {
  const trimmed = text.trim();
  return /^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed) || /^\S+\.\S+\//.test(trimmed);
}
