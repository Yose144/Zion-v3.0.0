import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function parseUsers(env: string): Map<string, string> {
  const users = new Map<string, string>();
  for (const entry of env.split(',')) {
    const [username, password] = entry.split(':');
    if (username && password) {
      users.set(username.trim(), password.trim());
    }
  }
  return users;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Missing credentials' }, { status: 400 });
    }

    const adminUsersEnv = process.env.ADMIN_USERS ?? '';
    const adminApiKey = process.env.ADMIN_API_KEY ?? '';
    const users = parseUsers(adminUsersEnv);
    const expected = users.get(username.trim());

    if (!expected || expected !== password) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    if (!adminApiKey) {
      return NextResponse.json({ success: false, error: 'Admin API key not configured' }, { status: 500 });
    }

    return NextResponse.json({ success: true, apiKey: adminApiKey });
  } catch (error) {
    console.error('Admin login failed:', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
