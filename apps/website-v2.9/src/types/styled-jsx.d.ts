/**
 * styled-jsx je součást Nextu (SWC transform), ale `@types/react` prop `jsx`
 * na elementu `<style>` nezná. Bez tohoto doplnění padá `tsc --noEmit` na
 * `LifeTreeVisualization` (dvě stránky dashboardu), i když produkční build
 * projde, protože `next.config` má `typescript.ignoreBuildErrors: true`.
 *
 * Doplnění je záměrně minimální — jen dva propsy, které styled-jsx používá.
 */
import 'react';

declare module 'react' {
  interface StyleHTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}
