/**
 * TECH3D - CAD Viewer 3D Engine (Three.js Engine Controller)
 * Handles isolated model rotation (static grid floor), GLTF/Procedural rendering,
 * real-time clipping planes, material presets, ViewCube orientation, and exploded views.
 */

class CADViewer {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(`CADViewer: container ${containerId} not found`);
      return;
    }

    this.options = Object.assign({
      initialModel: 'part-1-1',
      initialMaterial: 'alloy',
      enableSection: false,
      enableWireframe: false,
      enableGrid: true,
      enableAxes: true,
      autoRotate: false
    }, options);

    this.currentModelType = this.options.initialModel;
    this.currentMaterial = this.options.initialMaterial;
    this.isSectionActive = this.options.enableSection;
    this.sectionAxis = 'x'; // 'x', 'y', 'z'
    this.sectionOffset = 0.0;
    this.isWireframeActive = this.options.enableWireframe;
    this.isExploded = false;
    this.explodeFactor = 0;
    this.isAutoRotating = this.options.autoRotate;
    this.loadRequestId = 0;
    this.gltfLoader = (typeof THREE.GLTFLoader !== 'undefined') ? new THREE.GLTFLoader() : null;

    // Model rotation state (Grid remains stationary on floor)
    this.targetRotX = 0.35;
    this.targetRotY = -0.55;
    this.curRotX = 0.35;
    this.curRotY = -0.55;

    this.initScene();
    this.initLights();
    this.initGridAndAxes();
    this.initClipping();
    this.setupModelInteraction();
    this.loadModel(this.currentModelType);
    this.setupEvents();
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = null; // Transparent to inherit CSS radial CAD gradient

    // Dedicated parent container for model rotation & coordinate axes
    this.modelContainer = new THREE.Group();
    this.modelContainer.name = "CAD_Model_Container";
    this.scene.add(this.modelContainer);

    // Inner group dedicated for mesh loading
    this.modelMeshGroup = new THREE.Group();
    this.modelMeshGroup.name = "CAD_Mesh_Group";
    this.modelContainer.add(this.modelMeshGroup);

    // Coordinate Axes Widget attached to model container (Rotates in sync with the part)
    // Red = X, Green = Y, Blue = Z
    this.axesWidget = this.createAxesWidget();
    if (!this.options.enableAxes) this.axesWidget.visible = false;
    this.modelContainer.add(this.axesWidget);

    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 400;

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    // Stationary camera vantage point overlooking the CAD workbench floor
    this.camera.position.set(0, 4.2, 9.8);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;

    // Clear any previous canvas
    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    // OrbitControls configured ONLY for zoom (Rotation is handled directly on the model)
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableRotate = false; // Keep camera & floor locked!
      this.controls.enablePan = false;
      this.controls.enableZoom = true;
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.minDistance = 4.5;
      this.controls.maxDistance = 22;
      this.controls.target.set(0, 0, 0);
    }
  }

  initLights() {
    // Ambient light with CAD deep tech greenish tone
    const ambientLight = new THREE.AmbientLight(0xdcfce7, 0.85);
    this.scene.add(ambientLight);

    // Main key light (cool white)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(10, 15, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.001;
    this.scene.add(keyLight);

    // Fill light with subtle cyan/neon bounce
    const fillLight = new THREE.DirectionalLight(0x00e676, 0.45);
    fillLight.position.set(-10, -5, -10);
    this.scene.add(fillLight);

    // Specular highlight rim light
    const rimLight = new THREE.PointLight(0x00e5ff, 0.8, 30);
    rimLight.position.set(0, 10, -8);
    this.scene.add(rimLight);
  }

  initGridAndAxes() {
    this.gridGroup = new THREE.Group();
    this.gridGroup.name = "CAD_Grid_Group";

    // Blueprint CAD Grid Floor (Permanently anchored at the base)
    const gridHelper = new THREE.GridHelper(16, 16, 0x00e676, 0x1f3a2e);
    gridHelper.position.y = -2.6;
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.55;
    this.gridGroup.add(gridHelper);

    this.scene.add(this.gridGroup);
  }

  setupModelInteraction() {
    const dom = this.renderer.domElement;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    dom.style.touchAction = 'none';

    dom.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return; // Primary left-click / touch only
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      try { dom.setPointerCapture(e.pointerId); } catch(err) {}
    });

    dom.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      const rotSpeed = 0.0075;
      this.targetRotY += dx * rotSpeed;
      this.targetRotX += dy * rotSpeed;

      // Clamp vertical tilt so the part does not flip upside-down unnaturally
      const maxTilt = Math.PI * 0.48;
      this.targetRotX = Math.max(-maxTilt, Math.min(maxTilt, this.targetRotX));
    });

    const stopDrag = (e) => {
      if (isDragging) {
        isDragging = false;
        try { dom.releasePointerCapture(e.pointerId); } catch(err) {}
      }
    };

    dom.addEventListener('pointerup', stopDrag);
    dom.addEventListener('pointercancel', stopDrag);
  }

  createAxesWidget() {
    const axesGroup = new THREE.Group();
    axesGroup.name = "CAD_Axes_Widget";
    axesGroup.position.set(-3.2, -2.4, -3.0);

    const axisLength = 2.2;
    // Base Three.js AxesHelper (X: Red, Y: Green, Z: Blue)
    const axesLines = new THREE.AxesHelper(axisLength);
    if (axesLines.material) {
      axesLines.material.depthTest = false;
      axesLines.material.transparent = true;
      axesLines.material.opacity = 0.9;
    }
    axesLines.renderOrder = 999;
    axesGroup.add(axesLines);

    // Function to create crisp text badge sprite
    const createAxisBadge = (text, bgHex, textColor = '#ffffff') => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.arc(32, 32, 26, 0, Math.PI * 2);
        ctx.fillStyle = bgHex;
        ctx.shadowColor = bgHex;
        ctx.shadowBlur = 8;
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.font = 'bold 30px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = textColor;
        ctx.shadowBlur = 0;
        ctx.fillText(text, 32, 33);
      }

      const tex = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({
        map: tex,
        depthTest: false,
        depthWrite: false,
        transparent: true
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(0.65, 0.65, 0.65);
      sprite.renderOrder = 1000;
      return sprite;
    };

    // Cone tip geometry
    const coneGeom = new THREE.ConeGeometry(0.12, 0.35, 16);

    // X Axis - Red (#ff5252 / 0xff5252)
    const coneMatX = new THREE.MeshBasicMaterial({ color: 0xff5252, depthTest: false, transparent: true });
    const coneX = new THREE.Mesh(coneGeom, coneMatX);
    coneX.position.set(axisLength, 0, 0);
    coneX.rotation.z = -Math.PI / 2;
    coneX.renderOrder = 999;
    axesGroup.add(coneX);
    const labelX = createAxisBadge('X', '#ff5252', '#ffffff');
    labelX.position.set(axisLength + 0.5, 0, 0);
    axesGroup.add(labelX);

    // Y Axis - Green (#00e676 / 0x00e676)
    const coneMatY = new THREE.MeshBasicMaterial({ color: 0x00e676, depthTest: false, transparent: true });
    const coneY = new THREE.Mesh(coneGeom, coneMatY);
    coneY.position.set(0, axisLength, 0);
    coneY.renderOrder = 999;
    axesGroup.add(coneY);
    const labelY = createAxisBadge('Y', '#00e676', '#06110c');
    labelY.position.set(0, axisLength + 0.5, 0);
    axesGroup.add(labelY);

    // Z Axis - Blue (#2979ff / 0x2979ff)
    const coneMatZ = new THREE.MeshBasicMaterial({ color: 0x2979ff, depthTest: false, transparent: true });
    const coneZ = new THREE.Mesh(coneGeom, coneMatZ);
    coneZ.position.set(0, 0, axisLength);
    coneZ.rotation.x = Math.PI / 2;
    coneZ.renderOrder = 999;
    axesGroup.add(coneZ);
    const labelZ = createAxisBadge('Z', '#2979ff', '#ffffff');
    labelZ.position.set(0, 0, axisLength + 0.5);
    axesGroup.add(labelZ);

    // Origin sphere
    const originGeom = new THREE.SphereGeometry(0.1, 16, 16);
    const originMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true });
    const originMesh = new THREE.Mesh(originGeom, originMat);
    originMesh.renderOrder = 999;
    axesGroup.add(originMesh);

    return axesGroup;
  }

  initClipping() {
    // Local clipping plane definition (in object coordinate space)
    this.localClipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    // World clipping plane that Three.js uses for shading
    this.worldClipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    this.initSectionPlaneHelper();
  }

  initSectionPlaneHelper() {
    this.sectionPlaneHelper = new THREE.Group();
    this.sectionPlaneHelper.name = "CAD_Section_Plane_Helper";
    this.sectionPlaneHelper.visible = false;

    // Translucent section plane disc/quad
    const planeGeom = new THREE.PlaneGeometry(8.5, 8.5);
    this.sectionPlaneMat = new THREE.MeshBasicMaterial({
      color: 0xff5252,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    });
    this.sectionPlaneMesh = new THREE.Mesh(planeGeom, this.sectionPlaneMat);
    this.sectionPlaneHelper.add(this.sectionPlaneMesh);

    // Glowing border outline
    const edgesGeom = new THREE.EdgesGeometry(planeGeom);
    this.sectionBorderMat = new THREE.LineBasicMaterial({
      color: 0xff5252,
      transparent: true,
      opacity: 0.85
    });
    this.sectionBorderLines = new THREE.LineSegments(edgesGeom, this.sectionBorderMat);
    this.sectionPlaneHelper.add(this.sectionBorderLines);

    // Subtle cross guide on plane
    const crossGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-4.25, 0, 0), new THREE.Vector3(4.25, 0, 0),
      new THREE.Vector3(0, -4.25, 0), new THREE.Vector3(0, 4.25, 0)
    ]);
    this.sectionCrossMat = new THREE.LineBasicMaterial({
      color: 0xff5252,
      transparent: true,
      opacity: 0.4
    });
    this.sectionCrossLines = new THREE.LineSegments(crossGeom, this.sectionCrossMat);
    this.sectionPlaneHelper.add(this.sectionCrossLines);

    this.modelContainer.add(this.sectionPlaneHelper);
  }

  updateSectionHelperVisuals() {
    if (!this.sectionPlaneHelper) return;
    if (!this.isSectionActive) {
      this.sectionPlaneHelper.visible = false;
      return;
    }

    this.sectionPlaneHelper.visible = true;

    // Axis mapping: X = Red (0xff5252), Y = Green (0x00e676), Z = Blue (0x2979ff)
    let colorHex = 0xff5252;
    if (this.sectionAxis === 'x') {
      colorHex = 0xff5252;
      this.sectionPlaneHelper.rotation.set(0, Math.PI / 2, 0);
      this.sectionPlaneHelper.position.set(this.sectionOffset, 0, 0);
    } else if (this.sectionAxis === 'y') {
      colorHex = 0x00e676;
      this.sectionPlaneHelper.rotation.set(Math.PI / 2, 0, 0);
      this.sectionPlaneHelper.position.set(0, this.sectionOffset, 0);
    } else { // 'z'
      colorHex = 0x2979ff;
      this.sectionPlaneHelper.rotation.set(0, 0, 0);
      this.sectionPlaneHelper.position.set(0, 0, this.sectionOffset);
    }

    if (this.sectionPlaneMat) this.sectionPlaneMat.color.setHex(colorHex);
    if (this.sectionBorderMat) this.sectionBorderMat.color.setHex(colorHex);
    if (this.sectionCrossMat) this.sectionCrossMat.color.setHex(colorHex);
  }

  updateClippingPlaneTransform() {
    if (!this.isSectionActive) {
      if (this.sectionPlaneHelper) this.sectionPlaneHelper.visible = false;
      return;
    }

    // Set local normal & coplanar offset based on axis
    // X (Red Axis) -> Cut along X axis
    // Y (Green Axis) -> Cut along Y axis
    // Z (Blue Axis) -> Cut along Z axis
    if (this.sectionAxis === 'x') {
      this.localClipPlane.set(new THREE.Vector3(-1, 0, 0), this.sectionOffset);
    } else if (this.sectionAxis === 'y') {
      this.localClipPlane.set(new THREE.Vector3(0, -1, 0), this.sectionOffset);
    } else {
      this.localClipPlane.set(new THREE.Vector3(0, 0, -1), this.sectionOffset);
    }

    // Transform local plane to world space using modelContainer's matrixWorld
    if (this.modelContainer) {
      this.modelContainer.updateMatrixWorld(true);
      this.worldClipPlane.copy(this.localClipPlane).applyMatrix4(this.modelContainer.matrixWorld);
    }

    this.updateSectionHelperVisuals();
  }

  getActiveClippingPlanes() {
    if (!this.isSectionActive) return [];
    this.updateClippingPlaneTransform();
    return [this.worldClipPlane];
  }

  updateClippingPlanes() {
    const planes = this.getActiveClippingPlanes();
    if (this.modelMeshGroup) {
      this.modelMeshGroup.traverse((child) => {
        if (child.isMesh && child.material && child.name !== 'wireframe_overlay') {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(mat => {
            mat.clippingPlanes = planes;
            mat.clipShadows = true;
          });
        }
      });
    }
  }

  base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  loadModel(modelType, glbPath = null) {
    this.currentModelType = modelType;

    // Resolve model key (e.g. part-1-1, part-1-2, etc.)
    let resolvedKey = modelType;
    let resolvedGlb = glbPath;

    if (typeof INVENTOR_DATA !== 'undefined' && INVENTOR_DATA.parts3d) {
      const found = INVENTOR_DATA.parts3d.find(p => p.modelType === modelType || p.id === modelType || p.technicalName === modelType || p.number === modelType);
      if (found) {
        if (found.modelType) resolvedKey = found.modelType;
        if (found.glbPath) resolvedGlb = found.glbPath;
      }
    }

    if (!resolvedKey.startsWith('part-1-')) {
      const numMatch = (modelType || '').match(/(?:part-?0?|part-1-?)(\d+)/i);
      if (numMatch) {
        resolvedKey = `part-1-${numMatch[1]}`;
      }
    }

    if (!resolvedGlb) {
      resolvedGlb = `assets/models/Part ${resolvedKey.replace('part-', '').replace('-', '-')}.glb`;
    }

    const planes = this.getActiveClippingPlanes();

    if (typeof THREE.GLTFLoader !== 'undefined') {
      if (!this.gltfLoader) {
        this.gltfLoader = new THREE.GLTFLoader();
      }

      const requestId = ++this.loadRequestId;

      const onGltfLoaded = (gltf) => {
        if (requestId !== this.loadRequestId) return;

        // Clear existing model inside mesh group
        while (this.modelMeshGroup.children.length > 0) {
          this.modelMeshGroup.remove(this.modelMeshGroup.children[0]);
        }

        const model = gltf.scene;

        // Auto-center and normalize size
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 5.2;
        const scale = (maxDim > 0) ? (targetSize / maxDim) : 1;

        model.position.x = -center.x * scale;
        model.position.y = -center.y * scale;
        model.position.z = -center.z * scale;
        model.scale.set(scale, scale, scale);

        const group = new THREE.Group();
        group.name = "GLTF_Model_" + resolvedKey;
        group.add(model);

        // Apply material presets & clipping
        const presetMat = window.cadFactory ? window.cadFactory.getMaterial(this.currentMaterial, planes) : null;

        group.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (presetMat) {
              child.material = presetMat.clone();
              child.material.clippingPlanes = planes;
              child.material.clipShadows = true;
              child.material.side = THREE.DoubleSide;
              child.material.wireframe = this.isWireframeActive;
            } else if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach(mat => {
                mat.clippingPlanes = planes;
                mat.clipShadows = true;
                mat.side = THREE.DoubleSide;
                mat.wireframe = this.isWireframeActive;
              });
            }
          }
        });

        this.currentMeshGroup = group;
        this.modelMeshGroup.add(this.currentMeshGroup);
        this.isExploded = false;
        this.explodeFactor = 0;
      };

      // 1. First priority: Check Embedded Base64 Data (Works 100% offline & without CORS)
      if (window.CAD_GLB_DATA && (window.CAD_GLB_DATA[resolvedKey] || window.CAD_GLB_DATA[modelType])) {
        const b64Data = window.CAD_GLB_DATA[resolvedKey] || window.CAD_GLB_DATA[modelType];
        try {
          const buffer = this.base64ToArrayBuffer(b64Data);
          this.gltfLoader.parse(
            buffer,
            '',
            onGltfLoaded,
            (err) => {
              console.warn(`Error parsing embedded GLB ${resolvedKey}:`, err);
              this.loadProceduralFallback(modelType, planes);
            }
          );
          return;
        } catch (e) {
          console.warn(`Exception decoding base64 for ${resolvedKey}:`, e);
        }
      }

      // 2. Second priority: Standard Network Fetch (when hosted on HTTP/HTTPS server)
      if (resolvedGlb) {
        this.gltfLoader.load(
          resolvedGlb,
          onGltfLoaded,
          undefined,
          (err) => {
            console.warn(`GLTFLoader fetch failed for ${resolvedGlb}, falling back to procedural:`, err);
            if (requestId !== this.loadRequestId) return;
            this.loadProceduralFallback(modelType, planes);
          }
        );
        return;
      }
    }

    // 3. Third priority: Procedural Fallback
    this.loadProceduralFallback(modelType, planes);
  }

  loadProceduralFallback(modelType, planes) {
    while (this.modelMeshGroup.children.length > 0) {
      this.modelMeshGroup.remove(this.modelMeshGroup.children[0]);
    }
    if (window.cadFactory && typeof window.cadFactory.createModel === 'function') {
      this.currentMeshGroup = window.cadFactory.createModel(modelType, this.currentMaterial, planes);
    } else {
      this.currentMeshGroup = new THREE.Group();
    }
    this.currentMeshGroup.position.set(0, 0, 0);
    this.modelMeshGroup.add(this.currentMeshGroup);
    this.updateWireframeState();
    this.isExploded = false;
    this.explodeFactor = 0;
  }

  setMaterial(materialKey) {
    this.currentMaterial = materialKey;
    const planes = this.getActiveClippingPlanes();
    if (this.modelContainer && window.cadFactory) {
      const presetMat = window.cadFactory.getMaterial(materialKey, planes);
      this.modelContainer.traverse((child) => {
        if (child.isMesh && child.name !== 'wireframe_overlay') {
          child.material = presetMat.clone();
          child.material.clippingPlanes = planes;
          child.material.clipShadows = true;
          child.material.wireframe = this.isWireframeActive;
        }
      });
    }
  }

  toggleSection(forceState) {
    this.isSectionActive = (forceState !== undefined) ? forceState : !this.isSectionActive;
    this.updateClippingPlanes();
    this.updateClippingPlaneTransform();
    return this.isSectionActive;
  }

  setSectionAxis(axis) {
    this.sectionAxis = axis.toLowerCase();
    if (this.isSectionActive) {
      this.updateClippingPlanes();
      this.updateClippingPlaneTransform();
    }
  }

  setSectionOffset(val) {
    this.sectionOffset = parseFloat(val);
    if (this.isSectionActive) {
      this.updateClippingPlaneTransform();
    }
  }

  toggleWireframe(forceState) {
    this.isWireframeActive = (forceState !== undefined) ? forceState : !this.isWireframeActive;
    this.updateWireframeState();
    return this.isWireframeActive;
  }

  updateWireframeState() {
    if (!this.modelContainer) return;
    this.modelContainer.traverse(child => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.wireframe = this.isWireframeActive);
        } else {
          child.material.wireframe = this.isWireframeActive;
        }
      }
    });
  }

  toggleExplode(forceState) {
    if (!this.currentMeshGroup || !this.currentMeshGroup.userData.isAssembly) {
      return false;
    }
    this.isExploded = (forceState !== undefined) ? forceState : !this.isExploded;
    return this.isExploded;
  }

  setExplodeProgress(val) {
    this.explodeFactor = Math.max(0, Math.min(1, val));
    if (this.currentMeshGroup && typeof this.currentMeshGroup.userData.setExplode === 'function') {
      this.currentMeshGroup.userData.setExplode(this.explodeFactor);
    }
  }

  /**
   * Smooth Model Orientations from ViewCube (Grid remains locked on floor)
   */
  setViewOrientation(view) {
    let targetX = 0;
    let targetY = 0;

    switch (view.toUpperCase()) {
      case 'ISO':
        targetX = 0.35;
        targetY = -0.65;
        break;
      case 'TOP':
        targetX = Math.PI * 0.48;
        targetY = 0;
        break;
      case 'FRONT':
        targetX = 0;
        targetY = 0;
        break;
      case 'RIGHT':
        targetX = 0;
        targetY = -Math.PI / 2;
        break;
      case 'LEFT':
        targetX = 0;
        targetY = Math.PI / 2;
        break;
      case 'BACK':
        targetX = 0;
        targetY = Math.PI;
        break;
      case 'BOTTOM':
        targetX = -Math.PI * 0.48;
        targetY = 0;
        break;
      default:
        targetX = 0.35;
        targetY = -0.65;
    }

    this.targetRotX = targetX;
    this.targetRotY = targetY;
  }

  setupEvents() {
    window.addEventListener('resize', () => this.onWindowResize());
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    if (this.modelContainer) {
      if (this.isAutoRotating) {
        this.targetRotY += 0.008;
      }

      // Smooth damping interpolation (lerp)
      this.curRotX += (this.targetRotX - this.curRotX) * 0.12;
      this.curRotY += (this.targetRotY - this.curRotY) * 0.12;

      this.modelContainer.rotation.x = this.curRotX;
      this.modelContainer.rotation.y = this.curRotY;

      // Keep section clipping planes locked to model's orientation during 3D rotation
      if (this.isSectionActive) {
        this.updateClippingPlaneTransform();
      }
    }

    if (this.controls) {
      this.controls.update();
    }

    // Explode animation progression
    if (this.isExploded && this.explodeFactor < 1.0) {
      this.setExplodeProgress(this.explodeFactor + 0.04);
    } else if (!this.isExploded && this.explodeFactor > 0.0) {
      this.setExplodeProgress(this.explodeFactor - 0.04);
    }

    this.renderer.render(this.scene, this.camera);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.container.requestFullscreen().catch(err => {
        console.warn(`Fullscreen error: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }
}

window.CADViewer = CADViewer;
