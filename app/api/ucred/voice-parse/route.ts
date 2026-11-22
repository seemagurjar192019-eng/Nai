import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel, Type } from '@google/genai';
import {
  extractHttpErrorInfo,
  generateContentWithFallback,
  getGeminiServerClient,
} from '@/lib/gemini-server';
import { checkRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';

interface VoiceParseRequestBody {
  transcript?: string;
  partyNames?: string[];
  stockNames?: string[];
  language?: string;
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIpFromHeaders(req.headers);
    const minuteLimit = checkRateLimit(`voice:min:${clientIp}`, {
      windowMs: 60_000,
      maxRequests: 25,
    });
    if (!minuteLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many voice AI requests. Please wait a moment and try again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(minuteLimit.retryAfterSeconds) },
        }
      );
    }
    const hourLimit = checkRateLimit(`voice:hr:${clientIp}`, {
      windowMs: 3_600_000,
      maxRequests: 200,
    });
    if (!hourLimit.allowed) {
      return NextResponse.json(
        { error: 'Hourly AI parsing quota reached. Offline voice parsing still works seamlessly.' },
        {
          status: 429,
          headers: { 'Retry-After': String(hourLimit.retryAfterSeconds) },
        }
      );
    }

    const body = (await req.json()) as VoiceParseRequestBody;
    const transcript = String(body.transcript || '').trim();
    if (!transcript) {
      return NextResponse.json({ error: 'Transcript is required.' }, { status: 400 });
    }
    if (transcript.length > 1200) {
      return NextResponse.json(
        { error: 'Voice transcript exceeds 1200 character limit.' },
        { status: 400 }
      );
    }

    const partyNames = Array.isArray(body.partyNames)
      ? body.partyNames.slice(0, 35).map((s) => String(s).slice(0, 60))
      : [];
    const stockNames = Array.isArray(body.stockNames)
      ? body.stockNames.slice(0, 35).map((s) => String(s).slice(0, 60))
      : [];

    const ai = getGeminiServerClient();

    const systemInstruction = [
      'You are Ucred, an expert Indian kirana/wholesale shopkeeper Hinglish/Hindi bookkeeping & billing parser.',
      'Convert spoken shopkeeper commands into clean structured JSON.',
      'Rules:',
      '- intent="bill" ONLY when the speaker lists multiple shop items with quantities/rates to create a bill/invoice (e.g., "Verma ka 2 bag chawal 1200 aur 1 tel 180 bill banao").',
      '- intent="balance_query" when asking how much is due/balance for someone.',
      '- intent="daily_summary" when asking for today total hisaab/summary.',
      '- intent="entries" for one or multiple Udhaar/Jama khata transactions. Map udhaar/credit/diya/bakaya/likho => type="credit"; map jama/mila/wapas/paid/cash aaya => type="debit".',
      '- Match existing party names cleanly when phonetic spelling is close (known parties provided in prompt).',
      '- Every amount must be a numeric rupee value >= 0. Keep item/note text concise.',
    ].join('\n');

    const prompt = [
      `Spoken transcript (${body.language || 'hinglish'}): "${transcript}"`,
      partyNames.length > 0 ? `Known shop parties: ${partyNames.join(', ')}` : '',
      stockNames.length > 0 ? `Known stock items: ${stockNames.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await generateContentWithFallback(ai, {
      contents: prompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: {
              type: Type.STRING,
              description: 'One of entries, bill, balance_query, daily_summary',
            },
            customerName: {
              type: Type.STRING,
              description: 'Primary party name for bill or balance_query',
            },
            paymentStatus: {
              type: Type.STRING,
              description: 'paid or unpaid for bill intent',
            },
            confidence: {
              type: Type.STRING,
              description: 'high, medium, or low',
            },
            entries: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  amount: { type: Type.NUMBER },
                  type: { type: Type.STRING, description: 'credit or debit' },
                  note: { type: Type.STRING },
                },
                required: ['name', 'amount', 'type', 'note'],
              },
            },
            billItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  qty: { type: Type.NUMBER },
                  rate: { type: Type.NUMBER },
                  gstRate: { type: Type.NUMBER },
                },
                required: ['name', 'qty', 'rate', 'gstRate'],
              },
            },
          },
          required: ['intent', 'customerName', 'paymentStatus', 'confidence', 'entries', 'billItems'],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText) as {
      intent?: string;
      customerName?: string;
      paymentStatus?: string;
      confidence?: string;
      entries?: Array<{ name?: string; amount?: number; type?: string; note?: string }>;
      billItems?: Array<{ name?: string; qty?: number; rate?: number; gstRate?: number }>;
    };

    const intent =
      parsed.intent === 'bill' ||
      parsed.intent === 'balance_query' ||
      parsed.intent === 'daily_summary'
        ? parsed.intent
        : 'entries';

    const entries = Array.isArray(parsed.entries)
      ? parsed.entries
          .slice(0, 10)
          .map((e) => ({
            name: String(e.name || 'Customer').trim().slice(0, 80) || 'Customer',
            amount: Math.max(0, Math.round((Number(e.amount) || 0) * 100) / 100),
            type: e.type === 'debit' ? ('debit' as const) : ('credit' as const),
            note: String(e.note || '').trim().slice(0, 140),
          }))
          .filter((e) => e.amount > 0)
      : [];

    const billItems = Array.isArray(parsed.billItems)
      ? parsed.billItems
          .slice(0, 20)
          .map((it) => ({
            name: String(it.name || 'Item').trim().slice(0, 80) || 'Item',
            qty: Math.max(0.01, Number(it.qty) || 1),
            rate: Math.max(0, Math.round((Number(it.rate) || 0) * 100) / 100),
            gstRate: Math.max(0, Math.min(28, Number(it.gstRate) || 0)),
          }))
          .filter((it) => it.name && it.rate > 0)
      : [];

    return NextResponse.json({
      intent,
      customerName: String(parsed.customerName || entries[0]?.name || '').trim().slice(0, 80),
      paymentStatus: parsed.paymentStatus === 'paid' ? 'paid' : 'unpaid',
      confidence:
        parsed.confidence === 'high' || parsed.confidence === 'low'
          ? parsed.confidence
          : 'medium',
      entries,
      billItems,
      source: 'ai',
    });
  } catch (err) {
    const info = extractHttpErrorInfo(err);
    return NextResponse.json({ error: info.message }, { status: info.status });
  }
}
