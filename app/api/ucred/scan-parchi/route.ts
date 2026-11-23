import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel, Type } from '@google/genai';
import {
  extractHttpErrorInfo,
  generateContentWithFallback,
  getGeminiServerClient,
} from '@/lib/gemini-server';
import { checkRateLimit, getClientIpFromHeaders } from '@/lib/rate-limit';
import { hasValidImageMagicBytes, verifyApiRequestBoundary } from '@/lib/security';

export const runtime = 'nodejs';

interface ScanParchiBody {
  imageDataUrl?: string;
}

export async function POST(req: NextRequest) {
  try {
    const boundary = verifyApiRequestBoundary(req.headers);
    if (!boundary.ok) {
      return NextResponse.json(
        { error: boundary.reason || 'Request rejected by security boundary.' },
        { status: 403 }
      );
    }

    const clientIp = getClientIpFromHeaders(req.headers);
    const minuteLimit = checkRateLimit(`parchi:min:${clientIp}`, {
      windowMs: 60_000,
      maxRequests: 12,
    });
    if (!minuteLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many receipt scan requests. Please wait a moment and try again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(minuteLimit.retryAfterSeconds) },
        }
      );
    }
    const hourLimit = checkRateLimit(`parchi:hr:${clientIp}`, {
      windowMs: 3_600_000,
      maxRequests: 80,
    });
    if (!hourLimit.allowed) {
      return NextResponse.json(
        { error: 'Hourly receipt scan limit reached. You can still attach receipt photos manually.' },
        {
          status: 429,
          headers: { 'Retry-After': String(hourLimit.retryAfterSeconds) },
        }
      );
    }

    const body = (await req.json()) as ScanParchiBody;
    const rawUrl = String(body.imageDataUrl || '').trim();
    if (!rawUrl) {
      return NextResponse.json({ error: 'Receipt or parchi image is required.' }, { status: 400 });
    }
    if (rawUrl.length > 5_000_000) {
      return NextResponse.json(
        { error: 'Image is too large. Please upload a smaller photo.' },
        { status: 413 }
      );
    }

    const match = rawUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid image format. Upload JPG, PNG, or WebP.' },
        { status: 400 }
      );
    }

    const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
    const base64Data = match[2];
    if (!hasValidImageMagicBytes(base64Data, mimeType)) {
      return NextResponse.json(
        { error: 'Image signature mismatch. Please upload a valid JPG, PNG, or WebP photo.' },
        { status: 400 }
      );
    }

    const ai = getGeminiServerClient();

    const systemInstruction = [
      'You are Ucred Receipt & Parchi OCR parser for Indian shopkeepers.',
      'Extract handwritten kirana slips (parchi), supplier bills, or printed invoices into strict JSON.',
      'Rules:',
      '- partyName: customer or supplier name shown at top/bottom (or "Walk-in Party" if illegible).',
      '- phone: 10-digit Indian mobile number if visible, else empty string.',
      '- direction: "given" for sale/udhaar slip to customer, "received" if clearly marked paid/receipt/payment received.',
      '- billDate: YYYY-MM-DD if written cleanly, else empty string.',
      '- items: line items with name, qty (default 1), rate (unit price), gstRate (0 if not stated).',
      '- totalAmount: grand total shown on slip, or sum of items if grand total missing.',
      '- notes: brief 1-line summary of items or slip reference.',
    ].join('\n');

    const response = await generateContentWithFallback(ai, {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: 'Read this handwritten parchi or printed receipt/bill carefully and extract the structured khata & item details.',
          },
        ],
      },
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            partyName: { type: Type.STRING },
            phone: { type: Type.STRING },
            direction: { type: Type.STRING, description: 'given or received' },
            billDate: { type: Type.STRING },
            notes: { type: Type.STRING },
            totalAmount: { type: Type.NUMBER },
            confidence: { type: Type.STRING, description: 'high, medium, or low' },
            items: {
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
          required: ['partyName', 'phone', 'direction', 'billDate', 'notes', 'totalAmount', 'confidence', 'items'],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText) as {
      partyName?: string;
      phone?: string;
      direction?: string;
      billDate?: string;
      notes?: string;
      totalAmount?: number;
      confidence?: string;
      items?: Array<{ name?: string; qty?: number; rate?: number; gstRate?: number }>;
    };

    const items = Array.isArray(parsed.items)
      ? parsed.items
          .slice(0, 20)
          .map((it) => ({
            name: String(it.name || 'Item').trim().slice(0, 80) || 'Item',
            qty: Math.max(0.01, Number(it.qty) || 1),
            rate: Math.max(0, Math.round((Number(it.rate) || 0) * 100) / 100),
            gstRate: Math.max(0, Math.min(28, Number(it.gstRate) || 0)),
          }))
          .filter((it) => it.name)
      : [];

    const itemSum = items.reduce(
      (sum, it) => sum + it.qty * it.rate * (1 + it.gstRate / 100),
      0
    );
    const totalAmount =
      Number(parsed.totalAmount) > 0
        ? Math.round(Number(parsed.totalAmount) * 100) / 100
        : Math.round(itemSum * 100) / 100;

    return NextResponse.json({
      partyName: String(parsed.partyName || 'Walk-in Party').trim().slice(0, 80) || 'Walk-in Party',
      phone: String(parsed.phone || '').replace(/\D/g, '').slice(-10),
      direction: parsed.direction === 'received' ? 'received' : 'given',
      billDate: String(parsed.billDate || '').trim().slice(0, 24),
      notes: String(parsed.notes || 'Scanned Parchi').trim().slice(0, 160),
      items: items.length > 0 ? items : [{ name: 'Parchi Item', qty: 1, rate: totalAmount, gstRate: 0 }],
      totalAmount,
      confidence:
        parsed.confidence === 'high' || parsed.confidence === 'low'
          ? parsed.confidence
          : 'medium',
    });
  } catch (err) {
    const info = extractHttpErrorInfo(err);
    return NextResponse.json({ error: info.message }, { status: info.status });
  }
}
