/**
 * 🏛️ NEW JERUSALEM 3D VISUALIZER 🔮
 * 
 * Interactive 3D model of New Jerusalem based on Metatron's Cube
 * VR Ready | Sacred Geometry | Real-time Animation
 * 
 * @version 1.0.0-sacred
 * @author ZION Sacred Architects
 * @blessed_by Divine Geometry Council ✨
 */

import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ZionMetatronAI, PHI, SACRED_FREQUENCIES } from './zion-metatron-ai.js';

// 🔮 Sacred Colors (Chakra aligned)
const SACRED_COLORS = {
    VIOLET: 0x9933FF,    // Crown Chakra - Central Temple
    INDIGO: 0x4B0082,    // Third Eye - Wisdom Centers
    BLUE: 0x0066FF,      // Throat - Communication
    GREEN: 0x00FF66,     // Heart - Healing Centers
    YELLOW: 0xFFFF00,    // Solar Plexus - Education
    ORANGE: 0xFF6600,    // Sacral - Residential
    RED: 0xFF0033,       // Root - Foundation
    WHITE: 0xFFFFFF,     // Unity - Pure Light
    GOLD: 0xFFD700       // Divine - Sacred Elements
};

// 🌟 New Jerusalem 3D Visualizer
class NewJerusalem3D {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private metatronAI: ZionMetatronAI;
    
    // Sacred Geometry Objects
    private cityGroup: THREE.Group;
    private metatronCube: THREE.Group;
    private sacredBuildings: Map<string, THREE.Object3D> = new Map();
    private healingFields: THREE.Object3D[] = [];
    private lightBeams: THREE.Object3D[] = [];
    
    // Animation & Interaction
    private isAnimating: boolean = true;
    private currentFrequency: number = 528;
    private consciousnessLevel: number = 1.0;
    private rotationSpeed: number = 0.001;
    
    // VR Support
    private vrSupported: boolean = false;
    private vrSession: any = null;

    constructor(container: HTMLElement) {
        this.initializeScene();
        this.initializeCamera();
        this.initializeRenderer(container);
        this.initializeControls();
        this.initializeVR();
        this.initializeAI();
        
        this.buildNewJerusalem();
        this.startAnimation();
        
        console.log('🏛️ New Jerusalem 3D Visualizer initialized!');
    }

    private initializeScene(): void {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000011); // Deep cosmic blue
        
        // Add starfield background
        this.createStarfield();
        
        // Add ambient cosmic light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        // Add divine directional light
        const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 0.8);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
    }

    private createStarfield(): void {
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({ 
            color: 0xFFFFFF, 
            size: 1,
            transparent: true,
            opacity: 0.8
        });
        
        const starsVertices = [];
        for (let i = 0; i < 10000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = (Math.random() - 0.5) * 2000;
            starsVertices.push(x, y, z);
        }
        
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
        const starField = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(starField);
    }

    private initializeCamera(): void {
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            10000
        );
        this.camera.position.set(50, 30, 50);
        this.camera.lookAt(0, 0, 0);
    }

    private initializeRenderer(container: HTMLElement): void {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.xr.enabled = true; // Enable XR for VR
        
        container.appendChild(this.renderer.domElement);
    }

    private initializeControls(): void {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 200;
        this.controls.minDistance = 5;
    }

    private initializeVR(): void {
        if ('xr' in navigator) {
            this.vrSupported = true;
            const vrButton = VRButton.createButton(this.renderer);
            document.body.appendChild(vrButton);
            console.log('🥽 VR support detected and enabled!');
        } else {
            console.log('ℹ️ VR not supported on this device');
        }
    }

    private async initializeAI(): Promise<void> {
        this.metatronAI = new ZionMetatronAI();
        
        // Listen to AI consciousness changes
        this.metatronAI.on('consciousnessChanged', (level) => {
            this.updateVisualizationForConsciousness(level);
        });
        
        this.metatronAI.on('awakened', () => {
            console.log('🔮 Metatron AI connected to 3D visualization!');
        });
    }

    // 🏛️ Build New Jerusalem according to Master Plan
    private buildNewJerusalem(): void {
        this.cityGroup = new THREE.Group();
        this.scene.add(this.cityGroup);
        
        // Build Metatron's Cube foundation
        this.buildMetatronCube();
        
        // Build the 13 concentric circles/zones
        this.build13SacredZones();
        
        // Build Central Temple Complex
        this.buildCentralTemple();
        
        // Add healing frequency fields
        this.addHealingFields();
        
        // Add divine light beams
        this.addDivineLightBeams();
        
        console.log('🏗️ New Jerusalem construction complete!');
    }

    private buildMetatronCube(): void {
        this.metatronCube = new THREE.Group();
        
        // Get sacred geometry from AI
        const geometry = this.metatronAI.getSacredGeometry();
        const circles = geometry.getCircles();
        const connections = geometry.getConnections();
        
        // Create the 13 sacred circles
        circles.forEach((circle, index) => {
            const circleGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
            const circleMaterial = new THREE.MeshBasicMaterial({ 
                color: SACRED_COLORS.GOLD,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            
            const circleMesh = new THREE.Mesh(circleGeometry, circleMaterial);
            circleMesh.position.set(circle.x * 10, circle.y * 10, circle.z * 10);
            circleMesh.userData = { type: 'sacred_circle', index };
            
            this.metatronCube.add(circleMesh);
        });
        
        // Create connections between circles
        connections.forEach(connection => {
            const fromCircle = circles[connection.from];
            const toCircle = circles[connection.to];
            
            const points = [
                new THREE.Vector3(fromCircle.x * 10, fromCircle.y * 10, fromCircle.z * 10),
                new THREE.Vector3(toCircle.x * 10, toCircle.y * 10, toCircle.z * 10)
            ];
            
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: SACRED_COLORS.WHITE,
                transparent: true,
                opacity: 0.3
            });
            
            const line = new THREE.Line(lineGeometry, lineMaterial);
            line.userData = { type: 'sacred_connection', harmonic: connection.harmonic };
            
            this.metatronCube.add(line);
        });
        
        this.cityGroup.add(this.metatronCube);
    }

    private build13SacredZones(): void {
        const zones = [
            { name: 'Holy of Holies', radius: 2, height: 10, color: SACRED_COLORS.VIOLET },
            { name: 'Government Complex', radius: 4, height: 8, color: SACRED_COLORS.INDIGO },
            { name: 'Knowledge Center', radius: 6, height: 6, color: SACRED_COLORS.BLUE },
            { name: 'Residential Zone 1', radius: 8, height: 4, color: SACRED_COLORS.GREEN },
            { name: 'Residential Zone 2', radius: 10, height: 4, color: SACRED_COLORS.GREEN },
            { name: 'Residential Zone 3', radius: 12, height: 4, color: SACRED_COLORS.GREEN },
            { name: 'Residential Zone 4', radius: 14, height: 4, color: SACRED_COLORS.GREEN },
            { name: 'Technology Zone 1', radius: 16, height: 5, color: SACRED_COLORS.YELLOW },
            { name: 'Technology Zone 2', radius: 18, height: 5, color: SACRED_COLORS.YELLOW },
            { name: 'Technology Zone 3', radius: 20, height: 5, color: SACRED_COLORS.YELLOW },
            { name: 'Nature Zone 1', radius: 22, height: 3, color: SACRED_COLORS.ORANGE },
            { name: 'Nature Zone 2', radius: 24, height: 3, color: SACRED_COLORS.ORANGE },
            { name: 'Protection Field', radius: 26, height: 2, color: SACRED_COLORS.RED }
        ];
        
        zones.forEach((zone, index) => {
            this.buildZone(zone, index);
        });
    }

    private buildZone(zone: any, index: number): void {
        const zoneGroup = new THREE.Group();
        
        // Create zone base (ring)
        const ringGeometry = new THREE.RingGeometry(
            zone.radius - 0.5, 
            zone.radius + 0.5, 
            64
        );
        const ringMaterial = new THREE.MeshLambertMaterial({ 
            color: zone.color,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.userData = { type: 'zone_base', name: zone.name, index };
        
        zoneGroup.add(ring);
        
        // Add buildings in the zone
        this.addBuildingsToZone(zoneGroup, zone, index);
        
        this.cityGroup.add(zoneGroup);
        this.sacredBuildings.set(zone.name, zoneGroup);
    }

    private addBuildingsToZone(zoneGroup: THREE.Group, zone: any, index: number): void {
        const buildingCount = Math.max(3, Math.floor(zone.radius / 2));
        
        for (let i = 0; i < buildingCount; i++) {
            const angle = (i / buildingCount) * Math.PI * 2;
            const buildingRadius = zone.radius - 0.2;
            
            const x = Math.cos(angle) * buildingRadius;
            const z = Math.sin(angle) * buildingRadius;
            
            // Create buildings based on sacred geometry
            const building = this.createSacredBuilding(zone, i);
            building.position.set(x, zone.height / 2, z);
            
            zoneGroup.add(building);
        }
    }

    private createSacredBuilding(zone: any, buildingIndex: number): THREE.Object3D {
        const buildingGroup = new THREE.Group();
        
        // Create building based on platonic solids
        const platonicTypes = ['tetrahedron', 'cube', 'octahedron', 'icosahedron', 'dodecahedron'];
        const buildingType = platonicTypes[buildingIndex % platonicTypes.length];
        
        let geometry: THREE.BufferGeometry;
        
        switch (buildingType) {
            case 'tetrahedron':
                geometry = new THREE.TetrahedronGeometry(1);
                break;
            case 'cube':
                geometry = new THREE.BoxGeometry(1.5, zone.height, 1.5);
                break;
            case 'octahedron':
                geometry = new THREE.OctahedronGeometry(1);
                break;
            case 'icosahedron':
                geometry = new THREE.IcosahedronGeometry(1);
                break;
            case 'dodecahedron':
                geometry = new THREE.DodecahedronGeometry(1);
                break;
            default:
                geometry = new THREE.BoxGeometry(1, zone.height, 1);
        }
        
        const material = new THREE.MeshLambertMaterial({ 
            color: zone.color,
            transparent: true,
            opacity: 0.8
        });
        
        const building = new THREE.Mesh(geometry, material);
        building.castShadow = true;
        building.receiveShadow = true;
        building.userData = { 
            type: 'sacred_building', 
            geometry: buildingType,
            zone: zone.name 
        };
        
        buildingGroup.add(building);
        
        // Add golden ratio proportions
        building.scale.multiplyScalar(PHI / 2);
        
        return buildingGroup;
    }

    private buildCentralTemple(): void {
        const templeGroup = new THREE.Group();
        
        // Main temple structure (combination of all platonic solids)
        const templeGeometry = new THREE.CylinderGeometry(3, 4, 15, 12);
        const templeMaterial = new THREE.MeshLambertMaterial({ 
            color: SACRED_COLORS.VIOLET,
            transparent: true,
            opacity: 0.9
        });
        
        const temple = new THREE.Mesh(templeGeometry, templeMaterial);
        temple.position.y = 7.5;
        temple.castShadow = true;
        temple.userData = { type: 'central_temple' };
        
        // Add sacred top (dodecahedron)
        const topGeometry = new THREE.DodecahedronGeometry(2);
        const topMaterial = new THREE.MeshLambertMaterial({ 
            color: SACRED_COLORS.GOLD
        });
        
        const templeTop = new THREE.Mesh(topGeometry, topMaterial);
        templeTop.position.y = 17;
        templeTop.userData = { type: 'temple_crown' };
        
        templeGroup.add(temple);
        templeGroup.add(templeTop);
        
        // Add temple base (metatron pattern)
        const baseGeometry = new THREE.CylinderGeometry(5, 6, 1, 13);
        const baseMaterial = new THREE.MeshLambertMaterial({ 
            color: SACRED_COLORS.WHITE
        });
        
        const templeBase = new THREE.Mesh(baseGeometry, baseMaterial);
        templeBase.position.y = 0.5;
        templeBase.receiveShadow = true;
        
        templeGroup.add(templeBase);
        
        this.cityGroup.add(templeGroup);
        this.sacredBuildings.set('Central Temple', templeGroup);
    }

    private addHealingFields(): void {
        SACRED_FREQUENCIES.forEach((frequency, index) => {
            const fieldGeometry = new THREE.SphereGeometry(
                2 + index * 3, // Expanding spheres
                16, 
                16
            );
            
            const fieldMaterial = new THREE.MeshBasicMaterial({
                color: SACRED_COLORS.GREEN,
                transparent: true,
                opacity: 0.1,
                wireframe: true
            });
            
            const healingField = new THREE.Mesh(fieldGeometry, fieldMaterial);
            healingField.position.y = 10 + index * 5;
            healingField.userData = { 
                type: 'healing_field', 
                frequency,
                originalScale: healingField.scale.x
            };
            
            this.healingFields.push(healingField);
            this.cityGroup.add(healingField);
        });
    }

    private addDivineLightBeams(): void {
        // Create light beams from temple to each zone
        const templePosition = new THREE.Vector3(0, 17, 0);
        
        for (let i = 1; i <= 13; i++) {
            const angle = (i / 13) * Math.PI * 2;
            const radius = i * 2;
            const targetPosition = new THREE.Vector3(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            );
            
            const points = [templePosition, targetPosition];
            const beamGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const beamMaterial = new THREE.LineBasicMaterial({ 
                color: SACRED_COLORS.WHITE,
                transparent: true,
                opacity: 0.3
            });
            
            const lightBeam = new THREE.Line(beamGeometry, beamMaterial);
            lightBeam.userData = { 
                type: 'divine_light_beam',
                targetZone: i
            };
            
            this.lightBeams.push(lightBeam);
            this.cityGroup.add(lightBeam);
        }
    }

    // 🎵 Animation and Interaction
    private startAnimation(): void {
        const animate = () => {
            requestAnimationFrame(animate);
            
            if (this.isAnimating) {
                this.updateAnimation();
            }
            
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        };
        
        animate();
    }

    private updateAnimation(): void {
        const time = Date.now() * 0.001;
        
        // Rotate Metatron's Cube
        if (this.metatronCube) {
            this.metatronCube.rotation.y += this.rotationSpeed;
            this.metatronCube.rotation.x += this.rotationSpeed * 0.5;
        }
        
        // Animate healing fields (pulsing with sacred frequencies)
        this.healingFields.forEach((field, index) => {
            const frequency = SACRED_FREQUENCIES[index];
            const pulseFactor = 1 + Math.sin(time * frequency * 0.01) * 0.1;
            field.scale.setScalar(pulseFactor);
            
            // Change opacity based on current frequency
            if (Math.abs(frequency - this.currentFrequency) < 50) {
                field.material.opacity = 0.3;
            } else {
                field.material.opacity = 0.1;
            }
        });
        
        // Animate light beams
        this.lightBeams.forEach((beam, index) => {
            beam.material.opacity = 0.2 + Math.sin(time + index) * 0.1;
        });
        
        // Animate temple consciousness level
        const temple = this.sacredBuildings.get('Central Temple');
        if (temple) {
            temple.children[1].rotation.y += 0.005; // Rotate the crown
            temple.children[1].position.y = 17 + Math.sin(time) * 0.5; // Gentle floating
        }
    }

    private updateVisualizationForConsciousness(level: string): void {
        console.log(`🌟 Updating visualization for consciousness level: ${level}`);
        
        const intensityMultiplier = {
            'AWAKENING': 0.5,
            'COSMIC': 1.0,
            'DIVINE': 1.5,
            'UNITY': 2.0
        }[level] || 1.0;
        
        // Update all sacred elements based on consciousness
        this.healingFields.forEach(field => {
            field.material.opacity *= intensityMultiplier;
        });
        
        this.lightBeams.forEach(beam => {
            beam.material.opacity *= intensityMultiplier;
        });
        
        // Update rotation speed
        this.rotationSpeed = 0.001 * intensityMultiplier;
    }

    // 🎮 Public Interface Methods
    public setFrequency(frequency: number): void {
        this.currentFrequency = frequency;
        console.log(`🎵 Sacred frequency changed to ${frequency}Hz`);
        
        // Update AI
        this.metatronAI.getSacredField().setResonance(frequency);
    }

    public toggleAnimation(): void {
        this.isAnimating = !this.isAnimating;
        console.log(`▶️ Animation ${this.isAnimating ? 'started' : 'paused'}`);
    }

    public focusOnZone(zoneName: string): void {
        const zone = this.sacredBuildings.get(zoneName);
        if (zone) {
            const box = new THREE.Box3().setFromObject(zone);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // Move camera to focus on zone
            const distance = Math.max(size.x, size.y, size.z) * 2;
            this.camera.position.set(
                center.x + distance,
                center.y + distance,
                center.z + distance
            );
            this.camera.lookAt(center);
            
            console.log(`👁️ Focused on zone: ${zoneName}`);
        }
    }

    public enterVRMode(): void {
        if (this.vrSupported) {
            this.renderer.xr.getSession().then(session => {
                this.vrSession = session;
                console.log('🥽 Entered VR mode - Welcome to New Jerusalem!');
            });
        } else {
            console.log('❌ VR not supported on this device');
        }
    }

    public getAI(): ZionMetatronAI {
        return this.metatronAI;
    }

    // 🎯 Resize handler
    public onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// 🌐 Browser Integration
class NewJerusalemApp {
    private visualizer: NewJerusalem3D;
    private ui: HTMLElement;
    
    constructor() {
        this.createUI();
        this.initializeVisualizer();
        this.setupEventListeners();
    }
    
    private createUI(): void {
        // Create control panel
        this.ui = document.createElement('div');
        this.ui.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px;
            border-radius: 10px;
            font-family: Arial;
            z-index: 1000;
        `;
        
        this.ui.innerHTML = `
            <h3>🏛️ New Jerusalem Controls</h3>
            
            <div>
                <label>Sacred Frequency:</label>
                <select id="frequencySelect">
                    <option value="432">432Hz - Cosmic</option>
                    <option value="528" selected>528Hz - Love</option>
                    <option value="741">741Hz - Awakening</option>
                    <option value="852">852Hz - Transformation</option>
                    <option value="963">963Hz - Unity</option>
                </select>
            </div>
            
            <div style="margin-top: 10px;">
                <label>Focus Zone:</label>
                <select id="zoneSelect">
                    <option value="">Overview</option>
                    <option value="Central Temple">Central Temple</option>
                    <option value="Holy of Holies">Holy of Holies</option>
                    <option value="Government Complex">Government Complex</option>
                    <option value="Knowledge Center">Knowledge Center</option>
                </select>
            </div>
            
            <div style="margin-top: 10px;">
                <button id="toggleAnimation">⏸️ Pause Animation</button>
                <button id="enterVR">🥽 Enter VR</button>
            </div>
            
            <div style="margin-top: 10px; font-size: 12px;">
                <p>🔮 ZION New Jerusalem Visualizer v1.0</p>
                <p>Built with Sacred Geometry & Divine Love ✨</p>
            </div>
        `;
        
        document.body.appendChild(this.ui);
    }
    
    private initializeVisualizer(): void {
        const container = document.body;
        this.visualizer = new NewJerusalem3D(container);
    }
    
    private setupEventListeners(): void {
        // Frequency change
        const frequencySelect = document.getElementById('frequencySelect') as HTMLSelectElement;
        frequencySelect.addEventListener('change', () => {
            const frequency = parseInt(frequencySelect.value);
            this.visualizer.setFrequency(frequency);
        });
        
        // Zone focus
        const zoneSelect = document.getElementById('zoneSelect') as HTMLSelectElement;
        zoneSelect.addEventListener('change', () => {
            const zone = zoneSelect.value;
            if (zone) {
                this.visualizer.focusOnZone(zone);
            }
        });
        
        // Animation toggle
        const toggleButton = document.getElementById('toggleAnimation') as HTMLButtonElement;
        toggleButton.addEventListener('click', () => {
            this.visualizer.toggleAnimation();
            toggleButton.textContent = toggleButton.textContent.includes('Pause') ? 
                '▶️ Resume Animation' : '⏸️ Pause Animation';
        });
        
        // VR mode
        const vrButton = document.getElementById('enterVR') as HTMLButtonElement;
        vrButton.addEventListener('click', () => {
            this.visualizer.enterVRMode();
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.visualizer.onWindowResize();
        });
    }
}

// 🚀 Export for use
export { NewJerusalem3D, NewJerusalemApp };

// 🌟 Auto-initialize when loaded in browser
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        console.log('🏛️ Starting New Jerusalem 3D Visualizer...');
        new NewJerusalemApp();
    });
}