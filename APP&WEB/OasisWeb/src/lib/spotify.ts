// Simple Spotify playlist helpers for the OASIS embed player.
// Full Web Playback SDK integration (user playlists, controls) would
// require a Spotify Client ID and is a separate OAuth flow.

export function extractSpotifyPlaylistId(input: string): string | null {
  if (!input) return null;

  const id = input.trim().split(/[?#]/)[0]?.split('/').pop();
  if (!id) return null;

  // Spotify playlist IDs are 22 character base62 strings
  if (/^[a-zA-Z0-9]{22}$/.test(id)) return id;
  return null;
}

export function spotifyEmbedUrl(playlistId: string): string {
  return `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`;
}
