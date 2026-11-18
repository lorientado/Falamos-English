import * as THREE from 'three';
import { HOUSE_ROOMS } from '../data/situations';
import { SituationId } from '../types';

export interface SituationSceneConfig {
  skyColor: string;
  fogNear: number;
  fogFar: number;
  defaultCam: [number, number, number];
  defaultTarget: [number, number, number];
}

export const SITUATION_CAMERA_CONFIG: Record<SituationId, SituationSceneConfig> = {
  home: {
    skyColor: '#ede6d8',
    fogNear: 24,
    fogFar: 55,
    defaultCam: [9.5, 11.5, 13.5],
    defaultTarget: [0.5, 0.4, 0],
  },
  school: {
    skyColor: '#e8eef5',
    fogNear: 18,
    fogFar: 42,
    defaultCam: [5.5, 5.2, 7.2],
    defaultTarget: [0, 0.9, -1.2],
  },
  cafe: {
    skyColor: '#f3eadb',
    fogNear: 18,
    fogFar: 42,
    defaultCam: [5.4, 4.8, 6.8],
    defaultTarget: [0, 0.8, -0.8],
  },
  routine: {
    skyColor: '#ece7f0',
    fogNear: 18,
    fogFar: 42,
    defaultCam: [5.0, 4.5, 6.4],
    defaultTarget: [-0.4, 0.7, -0.8],
  },
  town: {
    skyColor: '#d9ebf7',
    fogNear: 20,
    fogFar: 52,
    defaultCam: [7.5, 6.8, 9.8],
    defaultTarget: [0, 0.8, 0],
  },
  doctor: {
    skyColor: '#e4f0ee',
    fogNear: 18,
    fogFar: 42,
    defaultCam: [5.2, 4.8, 6.6],
    defaultTarget: [0, 0.8, -1.0],
  },
  travel: {
    skyColor: '#dce8f2',
    fogNear: 22,
    fogFar: 55,
    defaultCam: [7.2, 5.8, 9.2],
    defaultTarget: [0, 0.9, 0],
  },
};

function wall(
  w: number,
  h: number,
  d: number,
  color: string,
  x: number,
  y: number,
  z: number
): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02 })
  );
  m.position.set(x, y, z);
  m.receiveShadow = true;
  m.castShadow = true;
  return m;
}

export function buildSituationEnvironment(situation: SituationId): THREE.Group {
  const env = new THREE.Group();

  if (situation === 'home') {
    // Ground yard
    const lawn = new THREE.Mesh(
      new THREE.CircleGeometry(24, 36),
      new THREE.MeshStandardMaterial({ color: '#c4d4ae', roughness: 0.95 })
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = -0.06;
    lawn.receiveShadow = true;
    env.add(lawn);

    // Base plinth
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(13.4, 0.08, 12.2),
      new THREE.MeshStandardMaterial({ color: '#c8bcab', roughness: 0.88 })
    );
    slab.position.set(0.5, -0.04, 0.9);
    slab.receiveShadow = true;
    env.add(slab);

    // Individual room floors (offset +0.02 above slab so no z-fighting)
    for (const room of HOUSE_ROOMS) {
      const [x1, z1, x2, z2] = room.bounds;
      const rw = x2 - x1;
      const rd = z2 - z1;
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(rw - 0.06, 0.04, rd - 0.06),
        new THREE.MeshStandardMaterial({ color: room.floorColor, roughness: 0.82 })
      );
      floor.position.set((x1 + x2) / 2, 0.0, (z1 + z2) / 2);
      floor.receiveShadow = true;
      floor.userData = { roomId: room.id };
      env.add(floor);
    }

    // Cutaway back & interior walls
    const wCol = '#e6ddd0';
    const trimCol = '#c9b9a0';
    env.add(wall(13.2, 2.5, 0.16, wCol, 0.5, 1.25, -5.0)); // North back wall
    env.add(wall(0.16, 2.5, 10.0, wCol, -6.0, 1.25, 0)); // West outer wall
    env.add(wall(0.16, 2.5, 10.0, wCol, 7.0, 1.25, 0)); // East outer wall
    // Interior partitions (low cutaway height 1.8m so objects remain clickable)
    env.add(wall(0.14, 1.8, 3.6, trimCol, -1.0, 0.9, -3.2)); // Bedroom/Bath divider
    env.add(wall(0.14, 1.8, 8.2, trimCol, 3.5, 0.9, -0.4)); // Kitchen/Dining divider
    env.add(wall(4.5, 1.8, 0.14, trimCol, -3.7, 0.9, -0.5)); // Bedroom/Study divider
    env.add(wall(3.5, 1.8, 0.14, trimCol, -4.2, 0.9, 1.5)); // Study/Hall divider
    // Balcony railing
    env.add(wall(3.5, 0.85, 0.08, '#64748b', 5.25, 0.45, 6.75));
    return env;
  }

  if (situation === 'school') {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.1, 9),
      new THREE.MeshStandardMaterial({ color: '#dfc9a6', roughness: 0.78 })
    );
    floor.position.set(0, -0.05, -0.5);
    floor.receiveShadow = true;
    env.add(floor);
    env.add(wall(10, 2.9, 0.16, '#f4efe6', 0, 1.45, -4.0));
    env.add(wall(0.16, 2.9, 9, '#e7e0d4', -4.2, 1.45, -0.5));
    // Classroom window frame
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.3, 2.2),
      new THREE.MeshStandardMaterial({ color: '#bae6fd', emissive: '#e0f2fe', emissiveIntensity: 0.25 })
    );
    win.position.set(-4.16, 1.6, -1.2);
    env.add(win);
    return env;
  }

  if (situation === 'cafe') {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 0.1, 8.6),
      new THREE.MeshStandardMaterial({ color: '#e6dccb', roughness: 0.72 })
    );
    floor.position.set(0, -0.05, -0.4);
    floor.receiveShadow = true;
    env.add(floor);
    env.add(wall(9.6, 2.8, 0.16, '#f5ebe0', 0, 1.4, -4.0));
    env.add(wall(0.16, 2.8, 8.6, '#d9bfa9', -4.2, 1.4, -0.4));
    // Customer café table
    const tableTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.75, 0.06, 24),
      new THREE.MeshStandardMaterial({ color: '#9c6644', roughness: 0.65 })
    );
    tableTop.position.set(-1.0, 0.72, 1.3);
    tableTop.castShadow = true;
    env.add(tableTop);
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.12, 0.7, 12),
      new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.4, metalness: 0.7 })
    );
    leg.position.set(-1.0, 0.35, 1.3);
    env.add(leg);
    // Second table on right
    const t2 = tableTop.clone();
    t2.position.set(1.3, 0.72, 1.3);
    env.add(t2);
    const l2 = leg.clone();
    l2.position.set(1.3, 0.35, 1.3);
    env.add(l2);
    return env;
  }

  if (situation === 'routine') {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.1, 8),
      new THREE.MeshStandardMaterial({ color: '#e5d4be', roughness: 0.8 })
    );
    floor.position.set(0, -0.05, -0.2);
    floor.receiveShadow = true;
    env.add(floor);
    env.add(wall(9, 2.7, 0.16, '#f1eaf4', 0, 1.35, -3.5));
    env.add(wall(0.16, 2.7, 8, '#e6dceb', -3.6, 1.35, -0.2));
    // Bed + bedside shelf prop so clothes & alarm clock rest naturally
    const bedProp = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.54, 1.6),
      new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.85 })
    );
    bedProp.position.set(-0.6, 0.27, -2.0);
    bedProp.receiveShadow = true;
    env.add(bedProp);
    const standProp = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 0.55),
      new THREE.MeshStandardMaterial({ color: '#a87447', roughness: 0.65 })
    );
    standProp.position.set(-2.2, 0.3, -2.5);
    env.add(standProp);
    // Vanity counter for toothbrush/hairbrush
    const vanity = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.88, 0.6),
      new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.45 })
    );
    vanity.position.set(-2.4, 0.44, 1.45);
    env.add(vanity);
    return env;
  }

  if (situation === 'town') {
    // Open outdoor ground extending to horizon (no indoor wall box!)
    const parkGrass = new THREE.Mesh(
      new THREE.CircleGeometry(34, 40),
      new THREE.MeshStandardMaterial({ color: '#a3c586', roughness: 0.95 })
    );
    parkGrass.rotation.x = -Math.PI / 2;
    parkGrass.position.y = -0.04;
    parkGrass.receiveShadow = true;
    env.add(parkGrass);

    const plaza = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 0.06, 9.5),
      new THREE.MeshStandardMaterial({ color: '#d6d3cb', roughness: 0.86 })
    );
    plaza.position.set(0, -0.01, -0.4);
    plaza.receiveShadow = true;
    env.add(plaza);

    const road = new THREE.Mesh(
      new THREE.BoxGeometry(14, 0.04, 2.2),
      new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.9 })
    );
    road.position.set(0, 0.0, 0.9);
    road.receiveShadow = true;
    env.add(road);

    // Decorative trees on perimeter
    for (const [tx, tz] of [[-5.2, 2.8], [5.0, -2.2], [5.2, 3.4]]) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8),
        new THREE.MeshStandardMaterial({ color: '#784c2a', roughness: 0.85 })
      );
      trunk.position.set(tx, 0.55, tz);
      env.add(trunk);
      const canopy = new THREE.Mesh(
        new THREE.SphereGeometry(0.75, 12, 12),
        new THREE.MeshStandardMaterial({ color: '#4d8b55', roughness: 0.82 })
      );
      canopy.position.set(tx, 1.45, tz);
      env.add(canopy);
    }
    return env;
  }

  if (situation === 'doctor') {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(9.4, 0.1, 8.2),
      new THREE.MeshStandardMaterial({ color: '#d7ebe8', roughness: 0.65 })
    );
    floor.position.set(0, -0.05, -0.4);
    floor.receiveShadow = true;
    env.add(floor);
    env.add(wall(9.4, 2.8, 0.16, '#f2f9f8', 0, 1.4, -3.7));
    env.add(wall(0.16, 2.8, 8.2, '#e2f1ef', -3.8, 1.4, -0.4));
    // Wall shelf for first-aid kit
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.08, 0.4),
      new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.5 })
    );
    shelf.position.set(-3.2, 0.86, -2.5);
    env.add(shelf);
    return env;
  }

  // 'travel' — open railway station platform
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(36, 40),
    new THREE.MeshStandardMaterial({ color: '#cbd5c0', roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  env.add(ground);

  const gravel = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.06, 4.2),
    new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.95 })
  );
  gravel.position.set(0, -0.03, -3.2);
  env.add(gravel);

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(11.5, 0.14, 5.2),
    new THREE.MeshStandardMaterial({ color: '#d6d3d1', roughness: 0.85 })
  );
  platform.position.set(0, -0.07, 1.5);
  platform.receiveShadow = true;
  env.add(platform);

  const yellowLine = new THREE.Mesh(
    new THREE.BoxGeometry(11.4, 0.02, 0.12),
    new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.65 })
  );
  yellowLine.position.set(0, 0.01, -0.85);
  env.add(yellowLine);

  // Steel rails
  for (const rz of [-3.4, -2.4]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.06, 0.08),
      new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.3, metalness: 0.85 })
    );
    rail.position.set(0, 0.03, rz);
    env.add(rail);
  }
  return env;
}
