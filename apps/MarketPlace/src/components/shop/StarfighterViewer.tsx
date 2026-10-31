'use client';

import { useEffect, useRef, useState } from 'react';

const LOCAL_STL = /^\/shop\/models\/[a-z0-9_-]+\.stl$/i;

export function isLocalStl(url?: string | null): url is string {
  return typeof url === 'string' && LOCAL_STL.test(url);
}

export default function StarfighterViewer({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isLocalStl(url)) return;

    let stopped = false;
    let frame = 0;
    const disposers: Array<() => void> = [];

    (async () => {
      const THREE = await import('three');
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      if (stopped) return;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
      camera.position.set(60, 40, 60);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, 0.75));
      const key = new THREE.DirectionalLight(0xffffff, 1);
      key.position.set(60, 80, 40);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xfff4d6, 0.4);
      fill.position.set(-40, -60, -20);
      scene.add(fill);
      scene.add(new THREE.AmbientLight(0x778899, 0.35));

      const grid = new THREE.GridHelper(200, 20, 0xc9a227, 0x1a3a1a);
      const gridMat = grid.material;
      if (!Array.isArray(gridMat)) {
        gridMat.opacity = 0.22;
        gridMat.transparent = true;
      }
      scene.add(grid);

      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.maxPolarAngle = Math.PI * 0.92;

      const resize = () => {
        const width = canvas.clientWidth || 1;
        const height = canvas.clientHeight || 1;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);

      const loader = new STLLoader();
      loader.load(
        url,
        (geometry) => {
          if (stopped) {
            geometry.dispose();
            return;
          }
          geometry.computeVertexNormals();
          geometry.center();
          const material = new THREE.MeshStandardMaterial({
            color: 0xe0f2ff,
            metalness: 0.15,
            roughness: 0.35,
          });
          const mesh = new THREE.Mesh(geometry, material);
          const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          mesh.scale.setScalar(90 / maxDim);
          scene.add(mesh);

          const box = new THREE.Box3().setFromObject(mesh);
          const center = box.getCenter(new THREE.Vector3());
          const fitted = box.getSize(new THREE.Vector3());
          const span = Math.max(fitted.x, fitted.y, fitted.z);
          const fov = camera.fov * (Math.PI / 180);
          let cameraZ = Math.abs(span / (2 * Math.tan(fov / 2))) * 1.8;
          camera.position.set(center.x + cameraZ, center.y + cameraZ * 0.25, center.z + cameraZ);
          camera.lookAt(center);
          controls.target.copy(center);
          controls.update();
          disposers.push(() => {
            geometry.dispose();
            material.dispose();
          });
        },
        undefined,
        () => {
          if (!stopped) setFailed(true);
        }
      );

      const animate = () => {
        if (stopped) return;
        frame = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      disposers.push(() => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        controls.dispose();
        renderer.dispose();
      });
    })().catch(() => {
      if (!stopped) setFailed(true);
    });

    return () => {
      stopped = true;
      disposers.forEach((fn) => fn());
    };
  }, [url]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="block w-full h-full" aria-label="3D náhled" />
      <div className="absolute bottom-3 left-3 text-[11px] text-rasta-gold/80 bg-black/50 px-2 py-1 rounded">
        táhni pro otočení
      </div>
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
          3D náhled se nepodařilo načíst
        </div>
      )}
    </div>
  );
}
