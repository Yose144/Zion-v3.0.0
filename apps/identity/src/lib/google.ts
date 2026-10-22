// Google Sign-In (OpenID Connect) verification for ZIS.
//
// Verifies a Google ID token (JWT) and returns the standardized user claims.
// Requires GOOGLE_CLIENT_ID environment variable.

import { OAuth2Client } from 'google-auth-library';

export interface GoogleUser {
  sub: string;
  email?: string | null;
  emailVerified: boolean;
  name?: string | null;
  picture?: string | null;
  givenName?: string | null;
  familyName?: string | null;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUser> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID not configured');
  }

  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Google ID token payload missing');
  }

  if (!payload.email_verified) {
    throw new Error('Google email is not verified');
  }

  return {
    sub: payload.sub,
    email: payload.email ?? null,
    emailVerified: Boolean(payload.email_verified),
    name: payload.name ?? null,
    picture: payload.picture ?? null,
    givenName: payload.given_name ?? null,
    familyName: payload.family_name ?? null,
  };
}
