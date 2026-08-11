import { getBridgeStatusResponse } from '@/lib/bridge/helpers';

export async function GET() {
  return getBridgeStatusResponse();
}
