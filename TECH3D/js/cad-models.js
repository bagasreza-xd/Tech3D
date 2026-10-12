/**
 * TECH3D - Procedural 3D Mechanical CAD Model Generator (Three.js)
 * Generates accurate geometric representations of 10 mechanical manufacturing parts
 * with material presets, section clipping planes, and explode view capability.
 */

const CAD_MATERIALS = {
  steel: {
    name: "Baja (Steel St37/AISI 1045)",
    color: 0x9ba6ad,
    metalness: 0.88,
    roughness: 0.28,
    clearcoat: 0.2,
    wireColor: 0x00e676
  },
  alloy: {
    name: "Alloy (AlSi10Mg Aluminum)",
    color: 0xd8e0e6,
    metalness: 0.65,
    roughness: 0.42,
    clearcoat: 0.1,
    wireColor: 0x00e5ff
  },
  castiron: {
    name: "Besi Cor (Cast Iron FC250)",
    color: 0x4a5350,
    metalness: 0.45,
    roughness: 0.72,
    clearcoat: 0.05,
    wireColor: 0x76ff03
  },
  brass: {
    name: "Kuningan / Bronze (CuZn39Pb3)",
    color: 0xdfab37,
    metalness: 0.82,
    roughness: 0.32,
    clearcoat: 0.3,
    wireColor: 0xffd600
  },
  carbon: {
    name: "Carbon Tech Dark",
    color: 0x18241e,
    metalness: 0.7,
    roughness: 0.35,
    clearcoat: 0.6,
    wireColor: 0x00e676
  },
  chrome: {
    name: "Chrome Plated (Kilap)",
    color: 0xf5f7fa,
    metalness: 0.98,
    roughness: 0.08,
    clearcoat: 1.0,
    wireColor: 0x00e5ff
  }
};

class CADModelFactory {
  constructor() {
    this.currentMaterialKey = 'alloy';
  }

  getMaterial(key, clippingPlanes = []) {
    const preset = CAD_MATERIALS[key] || CAD_MATERIALS.steel;
    return new THREE.MeshStandardMaterial({
      color: preset.color,
      metalness: preset.metalness,
      roughness: preset.roughness,
      clearcoat: preset.clearcoat,
      roughnessMap: null,
      clippingPlanes: clippingPlanes,
      clipShadows: true,
      side: THREE.DoubleSide
    });
  }

  getWireMaterial() {
    return new THREE.MeshBasicMaterial({
      color: 0x00e676,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
  }

  /**
   * Helper to add a wireframe overlay mesh
   */
  addWireframeOverlay(mesh, group) {
    const wireGeom = new THREE.WireframeGeometry(mesh.geometry);
    const line = new THREE.LineSegments(wireGeom, new THREE.LineBasicMaterial({
      color: 0x00e676,
      transparent: true,
      opacity: 0.25
    }));
    line.name = "wireframe_overlay";
    line.position.copy(mesh.position);
    line.rotation.copy(mesh.rotation);
    line.scale.copy(mesh.scale);
    group.add(line);
  }

  /**
   * 1. FLANGE COUPLING ASSEMBLY (.iam)
   */
  createFlangeCoupling(materialKey = 'steel', clippingPlanes = []) {
    const group = new THREE.Group();
    group.name = "Flange_Coupling_Assy";
    group.userData.isAssembly = true;
    group.userData.explodeOffset = 0;

    const mainMat = this.getMaterial(materialKey, clippingPlanes);
    const boltMat = this.getMaterial('chrome', clippingPlanes);
    const darkMat = this.getMaterial('carbon', clippingPlanes);

    // Hub A (Left)
    const hubAGroup = new THREE.Group();
    hubAGroup.name = "Flange_Hub_A";

    // Flange Disc A
    const discGeom = new THREE.CylinderGeometry(3.6, 3.6, 0.7, 36);
    discGeom.rotateZ(Math.PI / 2);
    const discMeshA = new THREE.Mesh(discGeom, mainMat);
    discMeshA.castShadow = true;
    discMeshA.receiveShadow = true;
    discMeshA.position.x = -0.35;
    hubAGroup.add(discMeshA);

    // Hub Neck A
    const neckGeom = new THREE.CylinderGeometry(1.8, 1.8, 1.8, 36);
    neckGeom.rotateZ(Math.PI / 2);
    const neckMeshA = new THREE.Mesh(neckGeom, mainMat);
    neckMeshA.castShadow = true;
    neckMeshA.position.x = -1.6;
    hubAGroup.add(neckMeshA);

    // Bore cutout inside A
    const boreGeom = new THREE.CylinderGeometry(0.85, 0.85, 3.2, 32);
    boreGeom.rotateZ(Math.PI / 2);
    const boreMeshA = new THREE.Mesh(boreGeom, darkMat);
    boreMeshA.position.x = -1.2;
    hubAGroup.add(boreMeshA);

    group.add(hubAGroup);

    // Hub B (Right - Mated)
    const hubBGroup = new THREE.Group();
    hubBGroup.name = "Flange_Hub_B";

    const discMeshB = new THREE.Mesh(discGeom, mainMat);
    discMeshB.castShadow = true;
    discMeshB.receiveShadow = true;
    discMeshB.position.x = 0.35;
    hubBGroup.add(discMeshB);

    const neckMeshB = new THREE.Mesh(neckGeom, mainMat);
    neckMeshB.castShadow = true;
    neckMeshB.position.x = 1.6;
    hubBGroup.add(neckMeshB);

    const boreMeshB = new THREE.Mesh(boreGeom, darkMat);
    boreMeshB.position.x = 1.2;
    hubBGroup.add(boreMeshB);

    group.add(hubBGroup);

    // 4x Bolt & Nut Assembly through PCD Ø115
    const boltsGroup = new THREE.Group();
    boltsGroup.name = "Bolted_Connections_4x";
    const pcdRadius = 2.6;
    const numBolts = 4;

    for (let i = 0; i < numBolts; i++) {
      const angle = (i * Math.PI * 2) / numBolts;
      const y = Math.cos(angle) * pcdRadius;
      const z = Math.sin(angle) * pcdRadius;

      const singleBoltGroup = new THREE.Group();
      singleBoltGroup.name = `Bolt_M10_${i + 1}`;

      // Bolt Hex Head
      const headGeom = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 6);
      headGeom.rotateZ(Math.PI / 2);
      const headMesh = new THREE.Mesh(headGeom, boltMat);
      headMesh.position.set(-1.0, y, z);
      singleBoltGroup.add(headMesh);

      // Bolt Shank
      const shankGeom = new THREE.CylinderGeometry(0.24, 0.24, 2.2, 16);
      shankGeom.rotateZ(Math.PI / 2);
      const shankMesh = new THREE.Mesh(shankGeom, boltMat);
      shankMesh.position.set(0.0, y, z);
      singleBoltGroup.add(shankMesh);

      // Washer & Nut on Right
      const nutGeom = new THREE.CylinderGeometry(0.45, 0.45, 0.45, 6);
      nutGeom.rotateZ(Math.PI / 2);
      const nutMesh = new THREE.Mesh(nutGeom, boltMat);
      nutMesh.position.set(1.0, y, z);
      singleBoltGroup.add(nutMesh);

      boltsGroup.add(singleBoltGroup);
    }
    group.add(boltsGroup);

    // Shafts inside coupling (Left & Right)
    const shaftGeom = new THREE.CylinderGeometry(0.8, 0.8, 3.0, 32);
    shaftGeom.rotateZ(Math.PI / 2);
    const shaftMat = this.getMaterial('alloy', clippingPlanes);

    const shaftL = new THREE.Mesh(shaftGeom, shaftMat);
    shaftL.position.x = -3.2;
    shaftL.name = "Drive_Shaft_L";
    group.add(shaftL);

    const shaftR = new THREE.Mesh(shaftGeom, shaftMat);
    shaftR.position.x = 3.2;
    shaftR.name = "Driven_Shaft_R";
    group.add(shaftR);

    // Custom explode animation method
    group.userData.setExplode = function(factor) {
      // factor: 0.0 to 1.0
      hubAGroup.position.x = -factor * 1.8;
      hubBGroup.position.x = factor * 1.8;
      shaftL.position.x = -3.2 - factor * 3.0;
      shaftR.position.x = 3.2 + factor * 3.0;
      boltsGroup.children.forEach((b, idx) => {
        b.children[0].position.x = -1.0 - factor * 2.2;
        b.children[2].position.x = 1.0 + factor * 2.2;
      });
    };

    return group;
  }

  /**
   * 2. SPUR GEAR (Roda Gigi Lurus Involute)
   */
  createSpurGear(materialKey = 'steel', clippingPlanes = []) {
    const group = new THREE.Group();
    group.name = "Spur_Gear_M2.5_Z24";
    const mat = this.getMaterial(materialKey, clippingPlanes);
    const teethCount = 24;
    const pitchRadius = 3.0;
    const faceWidth = 1.2;

    // Center Rim & Web Body
    const coreGeom = new THREE.CylinderGeometry(pitchRadius - 0.3, pitchRadius - 0.3, faceWidth, 36);
    const coreMesh = new THREE.Mesh(coreGeom, mat);
    coreMesh.castShadow = true;
    group.add(coreMesh);

    // Central Hub Boss
    const hubGeom = new THREE.CylinderGeometry(1.4, 1.4, faceWidth + 0.5, 32);
    const hubMesh = new THREE.Mesh(hubGeom, mat);
    group.add(hubMesh);

    // Center Bore Hole (Dark inner cylinder)
    const boreGeom = new THREE.CylinderGeometry(0.7, 0.7, faceWidth + 0.6, 24);
    const boreMat = this.getMaterial('carbon', clippingPlanes);
    const boreMesh = new THREE.Mesh(boreGeom, boreMat);
    group.add(boreMesh);

    // Keyway slot
    const keyGeom = new THREE.BoxGeometry(0.3, faceWidth + 0.6, 0.35);
    keyGeom.translate(0, 0, 0.75);
    const keyMesh = new THREE.Mesh(keyGeom, boreMat);
    group.add(keyMesh);

    // Teeth along the outer diameter
    const toothGeom = new THREE.BoxGeometry(0.38, faceWidth, 0.7);
    for (let i = 0; i < teethCount; i++) {
      const angle = (i * Math.PI * 2) / teethCount;
      const toothMesh = new THREE.Mesh(toothGeom, mat);
      toothMesh.position.x = Math.sin(angle) * (pitchRadius + 0.05);
      toothMesh.position.z = Math.cos(angle) * (pitchRadius + 0.05);
      toothMesh.rotation.y = angle;
      toothMesh.castShadow = true;
      group.add(toothMesh);
    }

    // Web Recess (Relief rings on front & back)
    const recessGeom = new THREE.RingGeometry(1.45, 2.5, 32);
    recessGeom.rotateX(-Math.PI / 2);
    const recessMat = this.getMaterial('castiron', clippingPlanes);
    const recessF = new THREE.Mesh(recessGeom, recessMat);
    recessF.position.y = faceWidth / 2 + 0.01;
    group.add(recessF);

    const recessB = new THREE.Mesh(recessGeom, recessMat);
    recessB.position.y = -faceWidth / 2 - 0.01;
    recessB.rotation.x = Math.PI / 2;
    group.add(recessB);

    return group;
  }

  /**
   * 3. STEPPED SHAFT (Poros Bertingkat)
   */
  createSteppedShaft(materialKey = 'steel', clippingPlanes = []) {
    const group = new THREE.Group();
    group.name = "Stepped_Shaft_Drive";
    const mat = this.getMaterial(materialKey, clippingPlanes);

    const steps = [
      { radius: 0.9, len: 1.5, x: -3.5, label: "Thread M24" },
      { radius: 1.2, len: 2.2, x: -1.7, label: "Bearing Seat 1" },
      { radius: 1.7, len: 2.8, x: 0.7, label: "Main Gear Seat" },
      { radius: 1.3, len: 2.0, x: 3.0, label: "Bearing Seat 2" },
      { radius: 1.0, len: 1.8, x: 4.8, label: "Drive End" }
    ];

    steps.forEach((step, idx) => {
      const geom = new THREE.CylinderGeometry(step.radius, step.radius, step.len, 36);
      geom.rotateZ(Math.PI / 2);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.x = step.x;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);

      // Add chamfer rings at transition steps
      if (idx > 0) {
        const ringGeom = new THREE.TorusGeometry(step.radius, 0.06, 12, 32);
        ringGeom.rotateY(Math.PI / 2);
        const ringMesh = new THREE.Mesh(ringGeom, mat);
        ringMesh.position.x = step.x - step.len / 2;
        group.add(ringMesh);
      }
    });

    // Keyway on Gear Seat
    const keyMat = this.getMaterial('carbon', clippingPlanes);
    const key1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.38), keyMat);
    key1.position.set(0.7, 1.62, 0);
    group.add(key1);

    // Keyway on Drive End
    const key2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 0.28), keyMat);
    key2.position.set(4.8, 0.95, 0);
    group.add(key2);

    return group;
  }

  /**
   * 4. CONNECTING ROD (Batang Piston)
   */
  createConnectingRod(materialKey = 'steel', clippingPlanes = []) {
    const group = new THREE.Group();
    group.name = "Engine_Connecting_Rod";
    const mat = this.getMaterial(materialKey, clippingPlanes);
    const brassMat = this.getMaterial('brass', clippingPlanes);

    // Small End (Piston Pin end)
    const smallEndGeom = new THREE.CylinderGeometry(1.1, 1.1, 1.0, 32);
    const smallEnd = new THREE.Mesh(smallEndGeom, mat);
    smallEnd.position.set(0, 0, -3.2);
    smallEnd.castShadow = true;
    group.add(smallEnd);

    // Small end bronze bushing
    const smallBushGeom = new THREE.CylinderGeometry(0.65, 0.65, 1.05, 32);
    const smallBush = new THREE.Mesh(smallBushGeom, brassMat);
    smallBush.position.set(0, 0, -3.2);
    group.add(smallBush);

    // Big End (Crankshaft journal end)
    const bigEndGeom = new THREE.CylinderGeometry(2.0, 2.0, 1.2, 36);
    const bigEnd = new THREE.Mesh(bigEndGeom, mat);
    bigEnd.position.set(0, 0, 2.8);
    bigEnd.castShadow = true;
    group.add(bigEnd);

    // Big end bore
    const bigBoreGeom = new THREE.CylinderGeometry(1.3, 1.3, 1.25, 36);
    const bigBore = new THREE.Mesh(bigBoreGeom, this.getMaterial('carbon', clippingPlanes));
    bigBore.position.set(0, 0, 2.8);
    group.add(bigBore);

    // Connecting Shank (I-Beam geometry)
    const shankLength = 4.8;
    const shankGeom = new THREE.BoxGeometry(0.7, 0.8, shankLength);
    const shank = new THREE.Mesh(shankGeom, mat);
    shank.position.set(0, 0, -0.2);
    shank.castShadow = true;
    group.add(shank);

    // I-Beam flanges
    const flangeT = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, shankLength), mat);
    flangeT.position.set(0, 0.45, -0.2);
    group.add(flangeT);

    const flangeB = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, shankLength), mat);
    flangeB.position.set(0, -0.45, -0.2);
    group.add(flangeB);

    // 2x Big End Cap Bolts
    const boltMat = this.getMaterial('chrome', clippingPlanes);
    const bolt1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8, 16), boltMat);
    bolt1.position.set(1.6, 0, 2.8);
    bolt1.rotation.x = Math.PI / 2;
    group.add(bolt1);

    const bolt2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8, 16), boltMat);
    bolt2.position.set(-1.6, 0, 2.8);
    bolt2.rotation.x = Math.PI / 2;
    group.add(bolt2);

    return group;
  }

  /**
   * 5. BEARING PILLOW BLOCK (Rumah Bantalan)
   */
  createPillowBlock(materialKey = 'castiron', clippingPlanes = []) {
    const group = new THREE.Group();
    group.name = "Pillow_Block_P205";
    const mat = this.getMaterial(materialKey, clippingPlanes);
    const brassMat = this.getMaterial('brass', clippingPlanes);
    const chromeMat = this.getMaterial('chrome', clippingPlanes);

    // Base Foot
    const baseGeom = new THREE.BoxGeometry(6.4, 0.7, 2.0);
    const baseMesh = new THREE.Mesh(baseGeom, mat);
    baseMesh.position.y = -1.6;
    baseMesh.castShadow = true;
    group.add(baseMesh);

    // Arch Dome Housing
    const archGeom = new THREE.CylinderGeometry(2.2, 2.2, 1.6, 32, 1, false, 0, Math.PI);
    archGeom.rotateZ(Math.PI / 2);
    archGeom.rotateX(Math.PI / 2);
    const archMesh = new THREE.Mesh(archGeom, mat);
    archMesh.position.set(0, -0.2, 0);
    archMesh.castShadow = true;
    group.add(archMesh);

    // Self-Aligning Spherical Bearing Outer Ring
    const ringGeom = new THREE.TorusGeometry(1.4, 0.35, 16, 36);
    ringGeom.rotateY(Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeom, chromeMat);
    ringMesh.position.set(0, 0.0, 0);
    group.add(ringMesh);

    // Inner Ring & Bore
    const innerGeom = new THREE.CylinderGeometry(0.85, 0.85, 1.9, 32);
    innerGeom.rotateZ(Math.PI / 2);
    const innerMesh = new THREE.Mesh(innerGeom, chromeMat);
    group.add(innerMesh);

    // Grease Zerk Fitting (Nipel Gemuk)
    const greaseGeom = new THREE.CylinderGeometry(0.12, 0.16, 0.6, 12);
    const greaseMesh = new THREE.Mesh(greaseGeom, brassMat);
    greaseMesh.position.set(0, 2.1, 0);
    group.add(greaseMesh);

    // Slotted Foundation Bolt Holes (Left & Right)
    const holeMat = this.getMaterial('carbon', clippingPlanes);
    const slotL = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 16), holeMat);
    slotL.position.set(-2.4, -1.6, 0);
    group.add(slotL);

    const slotR = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 16), holeMat);
    slotR.position.set(2.4, -1.6, 0);
    group.add(slotR);

    return group;
  }

  /**
   * 6. V-BELT PULLEY (Puli V-Belt Ganda Alur A)
   */
  createVBeltPulley(materialKey = 'castiron', clippingPlanes = []) {
    const group = new THREE.Group();
    group.name = "VBelt_Pulley_Dual_A";
    const mat = this.getMaterial(materialKey, clippingPlanes);

    // Outer Rim
    const rimGeom = new THREE.CylinderGeometry(3.6, 3.6, 2.2, 40);
    const rimMesh = new THREE.Mesh(rimGeom, mat);
    rimMesh.castShadow = true;
    group.add(rimMesh);

    // 2 V-Grooves (Dual Grooves cut in relief)
    const grooveMat = this.getMaterial('steel', clippingPlanes);
    const groove1 = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.28, 8, 36), grooveMat);
    groove1.rotation.x = Math.PI / 2;
    groove1.position.y = 0.5;
    group.add(groove1);

    const groove2 = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.28, 8, 36), grooveMat);
    groove2.rotation.x = Math.PI / 2;
    groove2.position.y = -0.5;
    group.add(groove2);

    // Center Hub
    const hubGeom = new THREE.CylinderGeometry(1.3, 1.3, 2.6, 32);
    const hubMesh = new THREE.Mesh(hubGeom, mat);
    group.add(hubMesh);

    // Center Bore & Keyway
    const boreGeom = new THREE.CylinderGeometry(0.65, 0.65, 2.7, 32);
    const boreMesh = new THREE.Mesh(boreGeom, this.getMaterial('carbon', clippingPlanes));
    group.add(boreMesh);

    // 5x Lightening holes around web
    const holeMat = this.getMaterial('carbon', clippingPlanes);
    const pcdRadius = 2.4;
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.3, 18), holeMat);
      hole.position.x = Math.sin(angle) * pcdRadius;
      hole.position.z = Math.cos(angle) * pcdRadius;
      group.add(hole);
    }

    return group;
  }

  /**
   * 7. FLANGED HYDRAULIC VALVE BODY
   */
  createValveBody(materialKey = 'steel', clippingPlanes = []) {
    const group = new THREE.Group();
    group.name = "Hydraulic_Valve_Body";
    const mat = this.getMaterial(materialKey, clippingPlanes);
    const darkMat = this.getMaterial('carbon', clippingPlanes);

    // Center Spherical Chamber
    const sphereGeom = new THREE.SphereGeometry(2.1, 32, 24);
    const sphereMesh = new THREE.Mesh(sphereGeom, mat);
    sphereMesh.castShadow = true;
    group.add(sphereMesh);

    // Horizontal Flow Pipe
    const pipeGeom = new THREE.CylinderGeometry(1.2, 1.2, 5.0, 32);
    pipeGeom.rotateZ(Math.PI / 2);
    const pipeMesh = new THREE.Mesh(pipeGeom, mat);
    group.add(pipeMesh);

    // Left Flange
    const flgL = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.6, 32), mat);
    flgL.rotateZ(Math.PI / 2);
    flgL.position.x = -2.5;
    flgL.castShadow = true;
    group.add(flgL);

    // Right Flange
    const flgR = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.6, 32), mat);
    flgR.rotateZ(Math.PI / 2);
    flgR.position.x = 2.5;
    flgR.castShadow = true;
    group.add(flgR);

    // Top Bonnet Actuator Neck
    const bonnetGeom = new THREE.CylinderGeometry(1.1, 1.4, 2.2, 32);
    const bonnet = new THREE.Mesh(bonnetGeom, mat);
    bonnet.position.y = 1.9;
    group.add(bonnet);

    // Top Collar Flange
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.4, 24), mat);
    collar.position.y = 3.0;
    group.add(collar);

    // Internal Passages Flow Hole
    const flowHole = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 5.8, 24), darkMat);
    flowHole.rotateZ(Math.PI / 2);
    group.add(flowHole);

    return group;
  }

  /**
   * 8. GENEVA WHEEL MECHANISM
   */
  createGenevaWheel(materialKey = 'steel', clippingPlanes = []) {
    const group = new THREE.Group();
    group.name = "Geneva_Indexing_Assy";
    const mat = this.getMaterial(materialKey, clippingPlanes);
    const bronzeMat = this.getMaterial('brass', clippingPlanes);
    const darkMat = this.getMaterial('carbon', clippingPlanes);

    // Main 4-Slot Geneva Wheel (Driven)
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(-1.6, 0, 0);

    const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.5, 36), mat);
    baseDisc.castShadow = true;
    wheelGroup.add(baseDisc);

    // 4 Slots
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 1.7), darkMat);
      slot.position.x = Math.sin(angle) * 1.5;
      slot.position.z = Math.cos(angle) * 1.5;
      slot.rotation.y = angle;
      wheelGroup.add(slot);
    }
    group.add(wheelGroup);

    // Drive Crank (Driver)
    const crankGroup = new THREE.Group();
    crankGroup.position.set(2.0, 0, 0);

    const crankArm = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.5, 32), mat);
    crankGroup.add(crankArm);

    // Drive Pin Roller
    const drivePin = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 16), bronzeMat);
    drivePin.position.set(-1.1, 0.4, 0);
    crankGroup.add(drivePin);

    group.add(crankGroup);

    return group;
  }

  /**
   * 9. HEX BOLT & NUT FASTENER ASSEMBLY
   */
  createBoltNut(materialKey = 'steel', clippingPlanes = []) {
    const group = new THREE.Group();
    group.name = "ISO4014_M16x70_Bolt_Nut_Assy";
    group.userData.isAssembly = true;

    const boltMat = this.getMaterial(materialKey, clippingPlanes);
    const chromeMat = this.getMaterial('chrome', clippingPlanes);

    // Hex Head
    const headGeom = new THREE.CylinderGeometry(1.25, 1.25, 0.85, 6);
    headGeom.rotateZ(Math.PI / 2);
    const headMesh = new THREE.Mesh(headGeom, boltMat);
    headMesh.position.x = -3.2;
    headMesh.castShadow = true;
    group.add(headMesh);

    // Shank (Unthreaded portion)
    const shankGeom = new THREE.CylinderGeometry(0.7, 0.7, 3.2, 32);
    shankGeom.rotateZ(Math.PI / 2);
    const shankMesh = new THREE.Mesh(shankGeom, boltMat);
    shankMesh.position.x = -1.2;
    shankMesh.castShadow = true;
    group.add(shankMesh);

    // Threaded Portion (with subtle helical ring geometry)
    const threadGeom = new THREE.CylinderGeometry(0.66, 0.66, 3.6, 32);
    threadGeom.rotateZ(Math.PI / 2);
    const threadMesh = new THREE.Mesh(threadGeom, boltMat);
    threadMesh.position.x = 2.0;
    threadMesh.castShadow = true;
    group.add(threadMesh);

    // Washer
    const washerGeom = new THREE.CylinderGeometry(1.4, 1.4, 0.2, 32);
    washerGeom.rotateZ(Math.PI / 2);
    const washerMesh = new THREE.Mesh(washerGeom, chromeMat);
    washerMesh.position.x = 1.2;
    washerMesh.name = "Washer_ISO7089";
    group.add(washerMesh);

    // Hex Nut
    const nutGeom = new THREE.CylinderGeometry(1.25, 1.25, 1.1, 6);
    nutGeom.rotateZ(Math.PI / 2);
    const nutMesh = new THREE.Mesh(nutGeom, boltMat);
    nutMesh.position.x = 2.0;
    nutMesh.name = "Hex_Nut_ISO4032";
    nutMesh.castShadow = true;
    group.add(nutMesh);

    // Explode helper
    group.userData.setExplode = function(factor) {
      washerMesh.position.x = 1.2 + factor * 1.5;
      nutMesh.position.x = 2.0 + factor * 3.2;
    };

    return group;
  }

  /**
   * 10. UNIVERSAL JOINT YOKE (Garpu U-Joint)
   */
  createUniversalJoint(materialKey = 'steel', clippingPlanes = []) {
    const group = new THREE.Group();
    group.name = "UJ_Yoke_Fork_End";
    const mat = this.getMaterial(materialKey, clippingPlanes);
    const chromeMat = this.getMaterial('chrome', clippingPlanes);

    // Hub Base
    const hubGeom = new THREE.CylinderGeometry(1.4, 1.4, 2.0, 32);
    hubGeom.rotateZ(Math.PI / 2);
    const hubMesh = new THREE.Mesh(hubGeom, mat);
    hubMesh.position.x = -2.0;
    hubMesh.castShadow = true;
    group.add(hubMesh);

    // Fork Base Transition
    const transGeom = new THREE.ConeGeometry(1.8, 1.4, 32);
    transGeom.rotateZ(-Math.PI / 2);
    const transMesh = new THREE.Mesh(transGeom, mat);
    transMesh.position.x = -0.5;
    group.add(transMesh);

    // Upper Prong
    const prongU = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 1.4), mat);
    prongU.position.set(1.2, 1.2, 0);
    prongU.castShadow = true;
    group.add(prongU);

    // Lower Prong
    const prongL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 1.4), mat);
    prongL.position.set(1.2, -1.2, 0);
    prongL.castShadow = true;
    group.add(prongL);

    // Cross Pin Holes (Concentric)
    const holeMat = this.getMaterial('carbon', clippingPlanes);
    const pinHole = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 3.4, 24), holeMat);
    pinHole.position.set(1.7, 0, 0);
    group.add(pinHole);

    // Cross Pin (Spider Pin inside)
    const pinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3.2, 24), chromeMat);
    pinMesh.position.set(1.7, 0, 0);
    group.add(pinMesh);

    return group;
  }

  /**
   * Factory Dispatcher
   */
  createModel(modelType, materialKey = 'steel', clippingPlanes = []) {
    switch (modelType) {
      case 'part-1-1':
      case 'flange_coupling':
        return this.createFlangeCoupling(materialKey, clippingPlanes);
      case 'part-1-2':
      case 'pillow_block':
        return this.createPillowBlock(materialKey, clippingPlanes);
      case 'part-1-3':
      case 'vbelt_pulley':
        return this.createVBeltPulley(materialKey, clippingPlanes);
      case 'part-1-4':
      case 'connecting_rod':
        return this.createConnectingRod(materialKey, clippingPlanes);
      case 'part-1-5':
      case 'spur_gear':
        return this.createSpurGear(materialKey, clippingPlanes);
      case 'part-1-6':
      case 'universal_joint':
        return this.createUniversalJoint(materialKey, clippingPlanes);
      case 'part-1-7':
      case 'bolt_nut':
        return this.createBoltNut(materialKey, clippingPlanes);
      case 'part-1-8':
      case 'stepped_shaft':
        return this.createSteppedShaft(materialKey, clippingPlanes);
      case 'part-1-9':
      case 'valve_body':
        return this.createValveBody(materialKey, clippingPlanes);
      case 'part-1-10':
      case 'geneva_wheel':
        return this.createGenevaWheel(materialKey, clippingPlanes);
      default:
        return this.createFlangeCoupling(materialKey, clippingPlanes);
    }
  }
}

// Instantiate global factory
window.cadFactory = new CADModelFactory();
