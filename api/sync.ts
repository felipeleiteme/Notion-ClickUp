import { runSync } from '../src/core/syncService.js';

const allowedMethods = new Set(['GET', 'POST']);
type VercelLikeRequest = {
  method?: string | null;
};

type VercelLikeResponse = {
  status: (code: number) => VercelLikeResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(
  req: VercelLikeRequest,
  res: VercelLikeResponse,
): Promise<void> {
  if (!allowedMethods.has((req.method ?? '').toUpperCase())) {
    res.setHeader('Allow', Array.from(allowedMethods).join(', '));
    res.status(405).json({ ok: false, message: 'Method not allowed' });
    return;
  }

  try {
    await runSync();
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('== Erro durante execução ClickUp via Vercel ==', error);
    res.status(500).json({
      ok: false,
      message:
        error instanceof Error ? error.message : 'Erro inesperado ao sincronizar.',
    });
  }
}
