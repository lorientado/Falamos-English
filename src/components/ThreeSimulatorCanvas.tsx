import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, Compass, Eye, RotateCcw } from 'lucide-react';
import { HOUSE_ROOMS, VOCAB_ITEMS, VOCAB_MAP } from '../data/situations';
import { SituationId } from '../types';
import { buildSituationEnvironment, SITUATION_CAMERA_CONFIG } from '../three/environments';
import { buildVocabModel } from '../three/models';
import { afterDraw, detectSoftwareGl, hasWebGlSupport } from '../three/softwareGl';

export interface ThreeSimulatorCanvasProps {
  situation: SituationId;
  selectedId: string | null;
  highlightedIds?: string[];
  focusRoomId?: string | null;
  onSelectObject?: (vocabId: string) => void;
  reduceMotion?: boolean;
  captionGl?: string;
}

interface CameraGoal {
  camPos: THREE.Vector3;
  target: THREE.Vector3;
}

const _tempBox = new THREE.Box3();
const _tempCenter = new THREE.Vector3();
const _ndc = new THREE.Vector2();

function computeRoomCameraGoal(roomId: string): CameraGoal | null {
  const room = HOUSE_ROOMS.find((r) => r.id === roomId);
  if (!room) return null;
  const [x1, z1, x2, z2] = room.bounds;
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  return {
    camPos: new THREE.Vector3(cx + 3.6, 5.2, cz + 4.8),
    target: new THREE.Vector3(cx, 0.5, cz),
  };
}

function computeObjectCameraGoal(vocabId: string): CameraGoal | null {
  const item = VOCAB_MAP[vocabId];
  if (!item) return null;
  const [x, y, z] = item.position;
  return {
    camPos: new THREE.Vector3(x + 2.6, Math.max(y + 2.2, 2.2), z + 3.4),
    target: new THREE.Vector3(x, Math.max(y + 0.35, 0.35), z),
  };
}

export const ThreeSimulatorCanvas: React.FC<ThreeSimulatorCanvasProps> = ({
  situation,
  selectedId,
  highlightedIds = [],
  focusRoomId = null,
  onSelectObject,
  reduceMotion = false,
  captionGl,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglReady, setWebglReady] = useState(true);
  const [contextLost, setContextLost] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // Refs bridging React props to the stable Three.js instance
  const onSelectRef = useRef(onSelectObject);
  onSelectRef.current = onSelectObject;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  const sceneRefs = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    worldRoot: THREE.Group;
    markerGroup: THREE.Group;
    interactables: THREE.Object3D[];
    goal: CameraGoal | null;
    requestRender: () => void;
    isSoftwareGl: boolean;
  } | null>(null);

  // Initialize WebGLRenderer & Scene ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    if (!hasWebGlSupport()) {
      setWebglReady(false);
      return;
    }

    const isSoftwareGl = detectSoftwareGl();
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 240);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglReady(false);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute('data-testid', 'three-canvas');
    renderer.domElement.setAttribute('aria-label', 'Simulador 3D interactivo');

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const cfg = SITUATION_CAMERA_CONFIG[situation];
    scene.background = new THREE.Color(cfg.skyColor);
    scene.fog = new THREE.Fog(cfg.skyColor, cfg.fogNear, cfg.fogFar);

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 120);
    camera.position.set(...cfg.defaultCam);

    // 3-point warm/cool studio lighting
    const hemi = new THREE.HemisphereLight('#eef5ff', '#a89982', 0.72);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#fff5e4', 1.75);
    keyLight.position.set(8, 14, 9);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -10;
      keyLight.shadow.camera.right = 10;
      keyLight.shadow.camera.top = 10;
      keyLight.shadow.camera.bottom = -10;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 36;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#dbeafe', 0.55);
    rimLight.position.set(-8, 7, -8);
    scene.add(rimLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...cfg.defaultTarget);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minPolarAngle = 0.12;
    controls.minDistance = 2.2;
    controls.maxDistance = 26;
    controls.update();

    const worldRoot = new THREE.Group();
    const markerGroup = new THREE.Group();
    scene.add(worldRoot);
    scene.add(markerGroup);

    let disposed = false;
    let renderBusy = false;
    let renderDirty = false;
    let frameId = 0;
    const activeTimers = new Set<number>();
    let lastTime = performance.now();

    const registerTimer = (id: number) => {
      activeTimers.add(id);
    };

    const stateObj = {
      scene,
      camera,
      renderer,
      controls,
      worldRoot,
      markerGroup,
      interactables: [] as THREE.Object3D[],
      goal: null as CameraGoal | null,
      requestRender: () => {},
      isSoftwareGl,
    };

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = window.requestAnimationFrame((now) => {
        if (disposed) return;
        renderDirty = false;
        const rawDt = (now - lastTime) / 1000;
        lastTime = now;
        const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

        let needsFollowUp = false;
        if (stateObj.goal) {
          if (reduceMotionRef.current || isSoftwareGl) {
            camera.position.copy(stateObj.goal.camPos);
            controls.target.copy(stateObj.goal.target);
            stateObj.goal = null;
          } else {
            const lambda = 6.5;
            camera.position.x = THREE.MathUtils.damp(
              camera.position.x,
              stateObj.goal.camPos.x,
              lambda,
              dt
            );
            camera.position.y = THREE.MathUtils.damp(
              camera.position.y,
              stateObj.goal.camPos.y,
              lambda,
              dt
            );
            camera.position.z = THREE.MathUtils.damp(
              camera.position.z,
              stateObj.goal.camPos.z,
              lambda,
              dt
            );
            controls.target.x = THREE.MathUtils.damp(
              controls.target.x,
              stateObj.goal.target.x,
              lambda,
              dt
            );
            controls.target.y = THREE.MathUtils.damp(
              controls.target.y,
              stateObj.goal.target.y,
              lambda,
              dt
            );
            controls.target.z = THREE.MathUtils.damp(
              controls.target.z,
              stateObj.goal.target.z,
              lambda,
              dt
            );
            const dist =
              camera.position.distanceTo(stateObj.goal.camPos) +
              controls.target.distanceTo(stateObj.goal.target);
            if (dist < 0.05) {
              camera.position.copy(stateObj.goal.camPos);
              controls.target.copy(stateObj.goal.target);
              stateObj.goal = null;
            } else {
              needsFollowUp = true;
            }
          }
        }

        const dampingChanged = controls.update();
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (!disposed && (renderDirty || needsFollowUp || (dampingChanged && !isSoftwareGl))) {
            requestRender();
          }
        };
        if (isSoftwareGl) {
          afterDraw(renderer, done, registerTimer);
        } else {
          done();
        }
      });
    };

    stateObj.requestRender = requestRender;
    sceneRefs.current = stateObj;

    const onControlChange = () => requestRender();
    const onControlStart = () => {
      stateObj.goal = null;
    };
    controls.addEventListener('change', onControlChange);
    controls.addEventListener('start', onControlStart);

    // Raycasting for pointer click & hover
    const raycaster = new THREE.Raycaster();
    let downX = 0;
    let downY = 0;
    let lastMoveCheck = 0;

    const findVocabIdFromHit = (obj: THREE.Object3D | null): string | null => {
      let curr: THREE.Object3D | null = obj;
      while (curr) {
        if (curr.userData?.vocabId) return String(curr.userData.vocabId);
        curr = curr.parent;
      }
      return null;
    };

    const getHitVocabId = (clientX: number, clientY: number): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_ndc, camera);
      const hits = raycaster.intersectObjects(stateObj.interactables, true);
      if (hits.length === 0) return null;
      return findVocabIdFromHit(hits[0].object);
    };

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved > 8) return;
      const hitId = getHitVocabId(e.clientX, e.clientY);
      if (hitId) {
        onSelectRef.current?.(hitId);
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMoveCheck < 55) return;
      lastMoveCheck = now;
      const hitId = getHitVocabId(e.clientX, e.clientY);
      renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(entry.contentRect.width, 280);
        const h = Math.max(entry.contentRect.height, 200);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        requestRender();
      }
    });
    ro.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    requestRender();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      activeTimers.forEach((id) => window.clearTimeout(id));
      activeTimers.clear();
      ro.disconnect();
      controls.removeEventListener('change', onControlChange);
      controls.removeEventListener('start', onControlStart);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      envTex.dispose();
      renderer.dispose();
      sceneRefs.current = null;
    };
    // Mount WebGL once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild situation geometry when `situation` changes
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    const disposeGroup = (group: THREE.Group) => {
      while (group.children.length > 0) {
        const child = group.children[0];
        group.remove(child);
        child.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose());
            } else {
              mesh.material?.dispose();
            }
          }
        });
      }
    };

    disposeGroup(refs.worldRoot);
    refs.interactables = [];

    const cfg = SITUATION_CAMERA_CONFIG[situation];
    refs.scene.background = new THREE.Color(cfg.skyColor);
    refs.scene.fog = new THREE.Fog(cfg.skyColor, cfg.fogNear, cfg.fogFar);

    const envGroup = buildSituationEnvironment(situation);
    refs.worldRoot.add(envGroup);

    const items = VOCAB_ITEMS.filter((v) => v.situation === situation);
    for (const item of items) {
      const model = buildVocabModel(item.modelType);
      model.position.set(...item.position);
      if (item.rotationY) model.rotation.y = item.rotationY;
      model.userData.vocabId = item.id;

      // Grounding contact shadow disc beneath floor items
      if (item.position[1] <= 0.05) {
        _tempBox.setFromObject(model);
        _tempBox.getCenter(_tempCenter);
        const radius = Math.max(
          0.35,
          Math.min(1.1, Math.max(_tempBox.max.x - _tempBox.min.x, _tempBox.max.z - _tempBox.min.z) * 0.45)
        );
        const shadowDisc = new THREE.Mesh(
          new THREE.CircleGeometry(radius, 18),
          new THREE.MeshBasicMaterial({
            color: '#1e293b',
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
          })
        );
        shadowDisc.rotation.x = -Math.PI / 2;
        shadowDisc.position.set(0, 0.015, 0);
        model.add(shadowDisc);
      }

      refs.worldRoot.add(model);
      refs.interactables.push(model);
    }

    // Smoothly frame the new scene
    refs.goal = {
      camPos: new THREE.Vector3(...cfg.defaultCam),
      target: new THREE.Vector3(...cfg.defaultTarget),
    };
    refs.requestRender();
  }, [situation]);

  // Update visual selection / highlight rings
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    while (refs.markerGroup.children.length > 0) {
      const ch = refs.markerGroup.children[0];
      refs.markerGroup.remove(ch);
      const mesh = ch as THREE.Mesh;
      mesh.geometry?.dispose();
      (mesh.material as THREE.Material)?.dispose();
    }

    const addRing = (itemId: string, color: string, innerR: number, outerR: number) => {
      const item = VOCAB_MAP[itemId];
      if (!item || item.situation !== situation) return;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(innerR, outerR, 28),
        new THREE.MeshBasicMaterial({
          color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(item.position[0], Math.max(0.03, item.position[1] + 0.03), item.position[2]);
      refs.markerGroup.add(ring);
    };

    for (const hid of highlightedIds) {
      if (hid !== selectedId) {
        addRing(hid, '#d97706', 0.42, 0.54);
      }
    }
    if (selectedId) {
      addRing(selectedId, '#1d4ed8', 0.46, 0.62);
    }

    refs.requestRender();
  }, [selectedId, highlightedIds, situation]);

  // Camera focus when selectedId or focusRoomId changes
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    if (selectedId) {
      const g = computeObjectCameraGoal(selectedId);
      if (g) {
        refs.goal = g;
        refs.requestRender();
      }
    } else if (focusRoomId && situation === 'home') {
      const g = computeRoomCameraGoal(focusRoomId);
      if (g) {
        refs.goal = g;
        refs.requestRender();
      }
    }
  }, [selectedId, focusRoomId, situation]);

  const handlePresetView = (mode: 'overview' | 'top' | 'room', roomId?: string) => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const cfg = SITUATION_CAMERA_CONFIG[situation];
    if (mode === 'overview') {
      refs.goal = {
        camPos: new THREE.Vector3(...cfg.defaultCam),
        target: new THREE.Vector3(...cfg.defaultTarget),
      };
    } else if (mode === 'top') {
      refs.goal = {
        camPos: new THREE.Vector3(cfg.defaultTarget[0], 15.5, cfg.defaultTarget[2] + 0.8),
        target: new THREE.Vector3(...cfg.defaultTarget),
      };
    } else if (mode === 'room' && roomId) {
      const g = computeRoomCameraGoal(roomId);
      if (g) refs.goal = g;
    }
    refs.requestRender();
  };

  return (
    <div className="relative w-full h-full min-h-[360px] rounded-xl overflow-hidden border border-[#d6cab4] bg-[#ece6da]">
      {!webglReady ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#f3ede1] text-[#182433]">
          <p className="font-display text-lg font-semibold mb-2">
            Vista 3D non dispoñible neste dispositivo
          </p>
          <p className="text-sm text-[#4b5768] max-w-md">
            O navegador non ten WebGL activado. Podes seguir usando as tarxetas, os audios e todas as probas desde o panel lateral.
          </p>
        </div>
      ) : (
        <div ref={mountRef} className="w-full h-full" />
      )}

      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#f7f4ec]/95 text-[#182433] p-6 text-center z-20">
          <p className="text-sm font-medium">
            Recuperando o visor 3D… Agarda un instante.
          </p>
        </div>
      )}

      {captionGl && (
        <div
          className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-lg bg-[#182433]/90 text-[#f7f4ec] text-xs font-medium pointer-events-none"
        >
          {captionGl}
        </div>
      )}

      {/* Collapsible bottom control dock (zero backdrop-filter over WebGL) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center max-w-[95%]">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="mb-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#182433] text-[#f7f4ec] text-xs font-medium hover:bg-[#26364b] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          aria-expanded={!dockCollapsed}
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {dockCollapsed ? 'Amosar controis 3D' : 'Ocultar controis 3D'}
        </button>

        {!dockCollapsed && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#ffffff]/95 border border-[#d6cab4] shadow-sm">
            <button
              type="button"
              onClick={() => handlePresetView('overview')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#182433] bg-[#efe8d8] hover:bg-[#e5dbc5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Vista xeral
            </button>
            <button
              type="button"
              onClick={() => handlePresetView('top')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#182433] bg-[#efe8d8] hover:bg-[#e5dbc5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Planta superior
            </button>

            {situation === 'home' &&
              HOUSE_ROOMS.filter((r) => r.id !== 'hallway').map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => handlePresetView('room', room.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#182433] bg-[#f7f4ec] hover:bg-[#efe8d8] border border-[#d6cab4] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title={`${room.nameEn} · ${room.nameGl}`}
                >
                  <Compass className="w-3 h-3 text-[#1d4ed8]" />
                  {room.nameGl.split(' / ')[0]}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
