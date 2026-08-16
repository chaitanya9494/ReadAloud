import * as FileSystem from 'expo-file-system/legacy';
import { startTrace } from '@/utils/analytics';

/**
 * Extract readable text from a picked file.
 * Supports: .txt, .pdf (basic text extraction), .epub, .html, .htm, .md, .rtf
 * PDF extraction uses a lightweight JS-based approach.
 * EPUB extraction unzips and parses the XHTML content.
 */
export async function extractText(uri: string, mimeType?: string): Promise<string> {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  const trace = startTrace(`file_parse_${ext || 'unknown'}`);
  trace.putAttribute('file_ext', ext || 'unknown');
  trace.putAttribute('mime_type', mimeType || 'unknown');

  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await trace.stop();
    throw new Error('The selected file is no longer available. Please choose it again.');
  }
  // PDF and EPUB parsing creates base64 and decoded copies in memory. A hard
  // ceiling protects lower-memory phones from a media/binary file OOM.
  const maxBytes = 2 * 1024 * 1024;
  if (typeof info.size === 'number' && info.size > maxBytes) {
    await trace.stop();
    throw new Error('This file is larger than 2 MB. Please use a smaller text document.');
  }

  // Plain text
  if (ext === 'txt' || ext === 'md' || ext === 'csv' || mimeType === 'text/plain') {
    const text = await FileSystem.readAsStringAsync(uri);
    trace.putMetric('text_length', text.length);
    await trace.stop();
    return text;
  }

  // HTML files
  if (ext === 'html' || ext === 'htm' || mimeType === 'text/html') {
    const html = await FileSystem.readAsStringAsync(uri);
    const text = stripHtmlTags(html);
    trace.putMetric('text_length', text.length);
    await trace.stop();
    return text;
  }

  // PDF — read as base64 and extract text streams
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    const text = await extractPdfText(uri);
    trace.putMetric('text_length', text.length);
    await trace.stop();
    return text;
  }

  // EPUB — unzip and extract chapter text
  if (ext === 'epub' || mimeType === 'application/epub+zip') {
    const text = await extractEpubText(uri);
    trace.putMetric('text_length', text.length);
    await trace.stop();
    return text;
  }

  // DOCX — unzip and extract document.xml text
  if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const text = await extractDocxText(uri);
    trace.putMetric('text_length', text.length);
    await trace.stop();
    return text;
  }

  // RTF — basic text extraction
  if (ext === 'rtf' || mimeType === 'application/rtf') {
    const raw = await FileSystem.readAsStringAsync(uri);
    const text = stripRtf(raw);
    trace.putMetric('text_length', text.length);
    await trace.stop();
    return text;
  }

  await trace.stop();
  throw new Error('Unsupported file type. Choose TXT, PDF, EPUB, DOCX, HTML, Markdown, CSV, or RTF.');
}

/**
 * Extract text from a PDF file using a lightweight JS approach.
 * Reads the raw PDF bytes and extracts text from content streams.
 * This handles most simple PDFs (not scanned/image PDFs).
 */
async function extractPdfText(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Decode base64 to binary string
  const binary = atob(base64);
  const textChunks: string[] = [];

  // Find text between BT (Begin Text) and ET (End Text) operators
  // and extract strings in parentheses (literal strings) or angle brackets (hex strings)
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let btMatch;

  while ((btMatch = btEtRegex.exec(binary)) !== null) {
    const block = btMatch[1];

    // Extract literal strings: (text) Tj or (text) TJ or (text) '
    const literalRegex = /\(([^)]*)\)\s*(?:Tj|TJ|')/g;
    let litMatch;
    while ((litMatch = literalRegex.exec(block)) !== null) {
      const decoded = decodePdfString(litMatch[1]);
      if (decoded.trim()) textChunks.push(decoded);
    }

    // Extract from TJ arrays: [(text) num (text) num] TJ
    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    let tjMatch;
    while ((tjMatch = tjArrayRegex.exec(block)) !== null) {
      const arrayContent = tjMatch[1];
      const parts = arrayContent.match(/\(([^)]*)\)/g);
      if (parts) {
        const line = parts.map(p => decodePdfString(p.slice(1, -1))).join('');
        if (line.trim()) textChunks.push(line);
      }
    }
  }

  if (textChunks.length === 0) {
    throw new Error(
      'This PDF appears to be scanned/image-based. Use the camera scanner to read it, or copy the text manually.'
    );
  }

  // Join chunks, adding newlines between them
  return textChunks
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Decode PDF escape sequences in literal strings */
function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

/**
 * Extract text from an EPUB file.
 * EPUBs are ZIP files containing XHTML chapters.
 * We use JSZip to unzip and parse the content.
 */
async function extractEpubText(uri: string): Promise<string> {
  const JSZip = (await import('jszip')).default;

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const zip = await JSZip.loadAsync(base64, { base64: true });
  const textParts: string[] = [];

  // Find the content.opf to get reading order
  let opfPath = '';
  const containerXml = zip.file('META-INF/container.xml');
  if (containerXml) {
    const containerText = await containerXml.async('text');
    const rootfileMatch = containerText.match(/full-path="([^"]+)"/);
    if (rootfileMatch) opfPath = rootfileMatch[1];
  }

  // Get the directory of the OPF file
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  // Parse OPF to get spine order
  const spineItems: string[] = [];
  const opfFile = zip.file(opfPath);
  if (opfFile) {
    const opfText = await opfFile.async('text');

    // Extract manifest items (id -> href mapping)
    const manifest: Record<string, string> = {};
    const itemRegex = /<item\s[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(opfText)) !== null) {
      manifest[itemMatch[1]] = itemMatch[2];
    }

    // Extract spine order
    const spineRegex = /<itemref\s[^>]*idref="([^"]+)"/g;
    let spineMatch;
    while ((spineMatch = spineRegex.exec(opfText)) !== null) {
      const href = manifest[spineMatch[1]];
      if (href) spineItems.push(opfDir + href);
    }
  }

  // If we couldn't parse the spine, just grab all xhtml/html files
  const filesToRead = spineItems.length > 0
    ? spineItems
    : Object.keys(zip.files).filter(f => /\.(xhtml|html|htm)$/i.test(f)).sort();

  for (const filePath of filesToRead) {
    const file = zip.file(filePath);
    if (file) {
      const html = await file.async('text');
      const text = stripHtmlTags(html);
      if (text.trim().length > 20) {
        textParts.push(text.trim());
      }
    }
  }

  if (textParts.length === 0) {
    throw new Error('Could not extract text from this EPUB file.');
  }

  return textParts.join('\n\n');
}

/**
 * Extract text from a DOCX file.
 * DOCX files are ZIP files containing word/document.xml.
 */
async function extractDocxText(uri: string): Promise<string> {
  const JSZip = (await import('jszip')).default;

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const zip = await JSZip.loadAsync(base64, { base64: true });
  const docFile = zip.file('word/document.xml');

  if (!docFile) {
    throw new Error('Invalid DOCX file — could not find document content.');
  }

  const xml = await docFile.async('text');

  // Extract text from <w:t> tags, with paragraph breaks at </w:p>
  const paragraphs: string[] = [];
  const paraRegex = /<w:p[\s>]([\s\S]*?)<\/w:p>/g;
  let paraMatch;

  while ((paraMatch = paraRegex.exec(xml)) !== null) {
    const paraContent = paraMatch[1];
    const textParts: string[] = [];
    const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let textMatch;
    while ((textMatch = textRegex.exec(paraContent)) !== null) {
      textParts.push(textMatch[1]);
    }
    if (textParts.length > 0) {
      paragraphs.push(textParts.join(''));
    }
  }

  if (paragraphs.length === 0) {
    throw new Error('Could not extract text from this DOCX file.');
  }

  return paragraphs.join('\n\n');
}

/** Strip HTML tags and return plain text */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Strip RTF formatting and return plain text */
function stripRtf(rtf: string): string {
  // Remove RTF header and control words
  return rtf
    .replace(/\{\\[^{}]*\}/g, '')       // Remove groups with control words
    .replace(/\\[a-z]+\d*\s?/gi, '')    // Remove control words
    .replace(/[{}]/g, '')                // Remove remaining braces
    .replace(/\\\\/g, '\\')
    .replace(/\\'/g, "'")
    .trim();
}

/** Generate a simple unique ID without external deps */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
