import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Sliding-window in-memory rate limiter for API routes
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function apiRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.ip || 'local';
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  if (bucket.count >= 90) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute and retry.' });
  }
  bucket.count += 1;
  return next();
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/api', apiRateLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // 1. Integration Health & Readiness Endpoint
  app.get('/api/integrations/status', (_req, res) => {
    const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');

    res.json({
      geminiAi: { configured: hasGemini, model: 'gemini-4-hydrogen' },
      firebase: { configured: true, mode: 'client_sdk_firestore' },
      email: {
        mode: 'mailto_redirect',
        directShareSupported: true,
      },
      whatsapp: {
        mode: 'whatsapp_redirect',
        directShareSupported: true,
      },
    });
  });

  // 2. AI Document Classification & OCR via Server-Side Gemini
  app.post('/api/ai/classify', async (req, res) => {
    try {
      const { fileName, textSnippet, imageBase64, mimeType } = req.body as {
        fileName?: string;
        textSnippet?: string;
        imageBase64?: string;
        mimeType?: string;
      };
      if (!fileName) {
        return res.status(400).json({ error: 'fileName is required.' });
      }

      const ai = getGeminiClient();
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

      if (imageBase64 && mimeType && mimeType.startsWith('image/')) {
        const cleaned = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
        parts.push({
          inlineData: {
            mimeType,
            data: cleaned,
          },
        });
      }

      parts.push({
        text:
          `Analyze this document for the PrintReady document wallet.\n` +
          `Filename: ${fileName}\n` +
          (textSnippet ? `Extracted text / notes: ${textSnippet.slice(0, 4000)}\n` : '') +
          `Classify its document type, suggest a crisp title, category, folder name, up to 5 concise tags, ` +
          `an expiryDate (YYYY-MM-DD if applicable such as ID/Passport/License/Certificate, otherwise empty string), ` +
          `a 1-2 sentence summary, and any OCR text visible in the image (or empty string if no image was provided).`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction:
            'You are the PrintReady Document Intelligence engine. Return accurate, concise structured JSON metadata for document organization and printing.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              documentType: { type: Type.STRING },
              suggestedTitle: { type: Type.STRING },
              category: { type: Type.STRING },
              suggestedFolder: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              expiryDate: { type: Type.STRING },
              summary: { type: Type.STRING },
              ocrText: { type: Type.STRING },
              recommendedColorMode: { type: Type.STRING },
              recommendedSides: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({ ...parsed, provider: 'gemini' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'AI classification unavailable';
      console.warn('[AI Classify Fallback]', msg);
      const { fileName = 'Document', textSnippet = '' } = req.body as { fileName?: string; textSnippet?: string };
      const lower = `${fileName} ${textSnippet}`.toLowerCase();
      const category = lower.includes('resume') || lower.includes('cv')
        ? 'Resume'
        : lower.includes('passport') || lower.includes('aadhaar') || lower.includes('id')
        ? 'Identity'
        : lower.includes('bank') || lower.includes('invoice') || lower.includes('receipt')
        ? 'Banking'
        : lower.includes('report') || lower.includes('notes') || lower.includes('semester') || lower.includes('lab')
        ? 'College'
        : 'Personal';
      const suggestedFolder =
        category === 'Resume'
          ? 'Resumes & Career'
          : category === 'Identity'
          ? 'Identity & KYC'
          : category === 'Banking'
          ? 'Banking & Invoices'
          : category === 'College'
          ? 'Semester 7 Coursework'
          : 'General Vault';
      const cleanBase = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      return res.json({
        documentType: category,
        suggestedTitle: cleanBase || fileName,
        category,
        suggestedFolder,
        tags: [category.toLowerCase(), 'print-ready', 'indexed'],
        expiryDate: '',
        summary: `Indexed ${fileName} under ${category} for print preparation and quick search.`,
        ocrText: textSnippet || `Indexed document: ${cleanBase || fileName}. Ready for printing.`,
        recommendedColorMode: category === 'Identity' || category === 'Resume' ? 'color' : 'bw',
        recommendedSides: category === 'College' ? 'double' : 'single',
        provider: 'heuristic',
      });
    }
  });

  // 3. AI Natural-Language Vault Search via Server-Side Gemini
  app.post('/api/ai/search', async (req, res) => {
    try {
      const { query, documents } = req.body as {
        query?: string;
        documents?: Array<{
          id: string;
          name: string;
          category: string;
          tags: string[];
          ocrText: string;
          summary: string;
          createdAt: string;
        }>;
      };

      if (!query || !Array.isArray(documents)) {
        return res.status(400).json({ error: 'query and documents array are required.' });
      }

      const ai = getGeminiClient();
      const catalog = documents.slice(0, 60).map((d) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        tags: d.tags,
        summary: d.summary,
        ocrSnippet: (d.ocrText || '').slice(0, 300),
        createdAt: d.createdAt,
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `User natural-language query: "${query}"\n\nVault documents:\n${JSON.stringify(catalog)}`,
        config: {
          systemInstruction:
            'You are a precise document search ranker. Return the IDs of matching documents ordered by relevance and a brief 1-sentence explanation.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matchedIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              explanation: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{"matchedIds":[],"explanation":""}').trim());
      return res.json({ ...parsed, provider: 'gemini' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'AI search unavailable';
      console.warn('[AI Search Fallback]', msg);
      const { query = '', documents = [] } = req.body as {
        query?: string;
        documents?: Array<{ id: string; name: string; category: string; tags?: string[]; ocrText?: string; summary?: string }>;
      };
      const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
      const matchedIds = documents
        .filter((d) => {
          const hay = `${d.name} ${d.category} ${(d.tags || []).join(' ')} ${d.ocrText || ''} ${d.summary || ''}`.toLowerCase();
          return tokens.some((t) => hay.includes(t));
        })
        .map((d) => d.id);
      return res.json({
        matchedIds,
        explanation: `Matched ${matchedIds.length} document(s) locally across filenames, tags, and indexed text.`,
        provider: 'heuristic',
      });
    }
  });

  // 4. AI Document Summarizer & Smart Print Advisor
  app.post('/api/ai/summarize', async (req, res) => {
    try {
      const { fileName, textContent, pageCount } = req.body as {
        fileName?: string;
        textContent?: string;
        pageCount?: number;
      };
      if (!fileName) {
        return res.status(400).json({ error: 'fileName is required.' });
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Document: ${fileName} (${pageCount || 1} pages)\nContent:\n${(textContent || 'No extracted text available.').slice(0, 5000)}`,
        config: {
          systemInstruction:
            'Summarize the document concisely in 2-3 sentences, list 3 key points, and suggest optimal print configuration (paper size, B&W vs color, single vs double-sided, binding).',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendedSettingsNote: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({ ...parsed, provider: 'gemini' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'AI summarization unavailable';
      console.warn('[AI Summarize Fallback]', msg);
      const { fileName = 'Document', pageCount = 1 } = req.body as { fileName?: string; pageCount?: number };
      const isLong = pageCount >= 8;
      return res.json({
        summary: `${fileName} (${pageCount} page${pageCount === 1 ? '' : 's'}) is prepared in your PrintReady vault.`,
        keyPoints: [
          `Detected ${pageCount} total page(s) ready for print layout.`,
          isLong ? 'Double-sided (duplex) printing will reduce paper usage by up to 50%.' : 'Single-sided printing recommended for crisp presentation.',
          'Review page ranges and margin fit before final shop submission.',
        ],
        recommendedSettingsNote: isLong
          ? 'Recommended: A4, B&W, Double-sided, Spiral Binding'
          : 'Recommended: A4, Color or B&W, Single-sided, Standard 80gsm/100gsm',
        provider: 'heuristic',
      });
    }
  });

  // Mount Vite dev server or production static bundle
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PrintReady full-stack server running at http://localhost:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start PrintReady server:', err);
  process.exit(1);
});
