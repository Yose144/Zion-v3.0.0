/**
 * Runtime sdílených světů.
 *
 * Scény z `apps/shared/scenes` byly psané pro dvě aplikace a importovaly
 * `@genesis/runtime` — alias, který si každá appka musela definovat v tsconfigu.
 * Tady je to skutečný modul: scény berou React, R3F a three z jednoho místa,
 * takže v bundlu není druhá instance.
 */

export { useFrame, useThree } from '@react-three/fiber';
export { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
export * as THREE from 'three';
export { default as React } from 'react';
