import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';

export const UCRED_GEMINI_MODEL = 'gemini-4-hydrogen';
export const UCRED_GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

export function getGeminiServerClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new GeminiConfigError(
      'Voice and receipt cloud parsing require GEMINI_API_KEY in server configuration.'
    );
  }
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'ucred-app',
      },
    },
  });
}

export async function generateContentWithFallback(
  ai: GoogleGenAI,
  params: Omit<GenerateContentParameters, 'model'>
): Promise<GenerateContentResponse> {
  try {
    return await ai.models.generateContent({
      ...params,
      model: UCRED_GEMINI_MODEL,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err || '');
    const isTransient =
      msg.includes('503') ||
      msg.toLowerCase().includes('unavailable') ||
      msg.toLowerCase().includes('high demand') ||
      msg.toLowerCase().includes('overloaded');
    if (!isTransient) throw err;
    return await ai.models.generateContent({
      ...params,
      model: UCRED_GEMINI_FALLBACK_MODEL,
    });
  }
}

export class GeminiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiConfigError';
  }
}

export function extractHttpErrorInfo(err: unknown): { status: number; message: string } {
  if (err instanceof GeminiConfigError) {
    return { status: 503, message: err.message };
  }
  const msg = err instanceof Error ? err.message : String(err || 'Cloud parse request failed');
  if (
    msg.includes('503') ||
    msg.toLowerCase().includes('unavailable') ||
    msg.toLowerCase().includes('high demand') ||
    msg.toLowerCase().includes('overloaded')
  ) {
    return {
      status: 503,
      message: 'Cloud parsing service is temporarily busy. Please retry in a few seconds.',
    };
  }
  if (msg.includes('429') || msg.toLowerCase().includes('resource_exhausted')) {
    return { status: 429, message: 'Parsing quota reached. Please retry in a few seconds.' };
  }
  if (
    msg.includes('403') ||
    msg.includes('401') ||
    msg.toLowerCase().includes('api_key_invalid') ||
    msg.toLowerCase().includes('permission_denied')
  ) {
    return {
      status: 403,
      message: 'Server configuration key is invalid. Please update GEMINI_API_KEY.',
    };
  }
  return { status: 500, message: 'Failed to process request. Please try again.' };
}
