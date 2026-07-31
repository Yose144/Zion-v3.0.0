(function () {
    class StarfighterViewer {
        constructor() {
            this.initialized = false;
            this.canvas = null;
            this.renderer = null;
            this.scene = null;
            this.camera = null;
            this.controls = null;
            this.loader = null;
            this.activeMesh = null;
            this.resizeObserver = null;
        }

        init(canvas) {
            if (this.initialized || !canvas || typeof THREE === 'undefined') {
                return;
            }

            this.canvas = canvas;
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: true,
                alpha: true,
                preserveDrawingBuffer: false
            });
            this.renderer.setPixelRatio(window.devicePixelRatio || 1);
            this.scene = new THREE.Scene();

            this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
            this.camera.position.set(60, 40, 60);

            const hemi = new THREE.HemisphereLight(0xffffff, 0x111111, 0.75);
            this.scene.add(hemi);

            const dirMain = new THREE.DirectionalLight(0xffffff, 1);
            dirMain.position.set(60, 80, 40);
            this.scene.add(dirMain);

            const dirFill = new THREE.DirectionalLight(0xffffff, 0.4);
            dirFill.position.set(-40, -60, -20);
            this.scene.add(dirFill);

            const ambient = new THREE.AmbientLight(0x778899, 0.35);
            this.scene.add(ambient);

            const grid = new THREE.GridHelper(200, 20, 0x1e88e5, 0x0d47a1);
            grid.material.opacity = 0.18;
            grid.material.transparent = true;
            this.scene.add(grid);

            this.controls = new THREE.OrbitControls(this.camera, this.canvas);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.08;
            this.controls.enablePan = false;
            this.controls.maxPolarAngle = Math.PI * 0.92;

            this.loader = new THREE.STLLoader();
            this.initialized = true;

            this.resize();
            this.animate();

            window.addEventListener('resize', () => this.resize());
            if (window.ResizeObserver) {
                this.resizeObserver = new ResizeObserver(() => this.resize());
                this.resizeObserver.observe(this.canvas);
            }
        }

        loadModel(url) {
            if (!this.initialized || !url) return;
            this.clear();
            this.setLoading(true);

            this.loader.load(
                url,
                geometry => {
                    const material = new THREE.MeshStandardMaterial({
                        color: 0xe0f2ff,
                        metalness: 0.15,
                        roughness: 0.35,
                        flatShading: false
                    });

                    geometry.computeVertexNormals();
                    geometry.center();

                    const mesh = new THREE.Mesh(geometry, material);
                    this.normalizeMesh(mesh);
                    this.scene.add(mesh);
                    this.activeMesh = mesh;
                    this.focusOn(mesh);
                    this.setLoading(false);
                },
                undefined,
                error => {
                    console.warn('StarfighterViewer: STL load failed', error);
                    this.setLoading(false);
                }
            );
        }

        normalizeMesh(mesh) {
            const box = new THREE.Box3().setFromObject(mesh);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const target = 90;
            const scale = target / maxDim;
            mesh.scale.setScalar(scale);
        }

        focusOn(object) {
            if (!object) return;
            const box = new THREE.Box3().setFromObject(object);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = this.camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
            cameraZ *= 1.8;

            this.camera.position.set(center.x + cameraZ, center.y + cameraZ * 0.25, center.z + cameraZ);
            this.camera.lookAt(center);
            this.controls.target.copy(center);
            this.controls.update();
        }

        clear() {
            if (this.activeMesh) {
                this.scene.remove(this.activeMesh);
                this.activeMesh.geometry?.dispose();
                this.activeMesh.material?.dispose();
                this.activeMesh = null;
            }
            this.setLoading(false);
        }

        resize() {
            if (!this.initialized || !this.canvas) return;
            const width = this.canvas.clientWidth || 1;
            const height = this.canvas.clientHeight || 1;
            this.renderer.setSize(width, height, false);
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
        }

        animate() {
            if (!this.initialized) return;
            requestAnimationFrame(() => this.animate());
            this.controls?.update();
            this.renderer?.render(this.scene, this.camera);
        }

        setLoading(state) {
            if (!this.canvas) return;
            if (state) {
                this.canvas.classList.add('loading');
            } else {
                this.canvas.classList.remove('loading');
            }
        }
    }

    window.StarfighterViewer = new StarfighterViewer();
})();
