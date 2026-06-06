export async function apiFetch<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`${r.status}`);
    return (await r.json()) as T;
  } catch (e) {
    console.error('API error:', url, e);
    return null;
  }
}
