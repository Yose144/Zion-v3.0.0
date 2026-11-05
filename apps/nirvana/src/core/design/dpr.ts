/**
 * Strop pixel ratia pro herní plátna (L-12).
 *
 * `dpr={[1, 1.75]}` je správná hodnota pro monitor, ale na telefonu se
 * nevyplácí: 1,75× znamená ~3× víc pixelů k vyplnění a frame rate to pozná
 * dřív než cokoli jiného. Na dotyku (nebo v úzkém okně) proto stropujeme
 * na 1,25 — obraz je na malém displeji nerozeznatelný, cena je ale třetinová.
 *
 * Je to **jen strop**, ne pevná hodnota: zařízení s `devicePixelRatio = 1`
 * (běžný levný Android) dostane 1 a nic se mu nezvětšuje.
 *
 * Sdílené scény (`SceneRoot`, `ProjectPresentation`) mají vlastní `quality()`
 * s tiery A/B/C — tam se nesahá, tam se rozhoduje i o post-processing.
 */
export function canvasDpr(max = 1.75): [number, number] {
  if (typeof window === 'undefined') return [1, max];
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 720;
  return [1, coarse || narrow ? Math.min(max, 1.25) : max];
}
