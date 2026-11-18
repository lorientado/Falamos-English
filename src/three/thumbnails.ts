import * as THREE from 'three';
import { VOCAB_ITEMS } from '../data/situations';
import { buildVocabModel } from './models';
import { hasWebGlSupport } from './softwareGl';

export function renderVocabThumbnails(size = 180): Record<string, string> {
  const result: Record<string, string> = {};
  if (!hasWebGlSupport()) return result;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
  } catch {
    return result;
  }

  renderer.setPixelRatio(1);
  renderer.setSize(size, size);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const dim = new THREE.Vector3();
  const dir = new THREE.Vector3(0.95, 0.65, 1.25).normalize();

  for (const item of VOCAB_ITEMS) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#b8ab95', 1.6));
    const key = new THREE.DirectionalLight('#fff5e6', 1.7);
    key.position.set(3, 6, 4);
    scene.add(key);

    const model = buildVocabModel(item.modelType);
    scene.add(model);

    box.setFromObject(model);
    box.getCenter(center);
    box.getSize(dim);
    const maxDim = Math.max(dim.x, dim.y, dim.z, 0.25);
    const dist = (0.5 * maxDim * 1.65) / Math.sin((camera.fov * Math.PI) / 360);

    camera.position.copy(center).addScaledVector(dir, dist);
    camera.near = Math.max(0.01, dist / 50);
    camera.far = dist * 10;
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
    result[item.id] = renderer.domElement.toDataURL('image/png');

    scene.remove(model);
    model.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry?.dispose();
      }
    });
  }

  renderer.dispose();
  renderer.forceContextLoss();
  return result;
}
