import { runTeamsSync } from '../src/core/teamsSyncJob.js';

const allowedMethods = new Set(['GET', 'POST']);
type VercelLikeRequest = {
  method?: string | null;
};

type VercelLikeResponse = {
  status: (code: number) => VercelLikeResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};
const isTeamsEnabled =
  process.env.TEAMS_SYNC_ENABLED?.toLowerCase() !== 'false';

export default async function handler(
  req: VercelLikeRequest,
  res: VercelLikeResponse,
): Promise<void> {
  if (!allowedMethods.has((req.method ?? '').toUpperCase())) {
    res.setHeader('Allow', Array.from(allowedMethods).join(', '));
    res.status(405).json({ ok: false, message: 'Method not allowed' });
    return;
  }

  if (!isTeamsEnabled) {
    res.status(200).json({
      ok: true,
      skipped: true,
      reason: 'TEAMS_SYNC_ENABLED=false',
    });
    return;
  }

  if (!process.env.TEAMS_WEBHOOK_URL) {
    res.status(200).json({
      ok: true,
      skipped: true,
      reason: 'TEAMS_WEBHOOK_URL ausente',
    });
    return;
  }

  try {
    await runTeamsSync();
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('== Erro durante execução Teams via Vercel ==', error);
    res.status(500).json({
      ok: false,
      message:
        error instanceof Error ? error.message : 'Erro inesperado ao sincronizar Teams.',
    });
  }
}
