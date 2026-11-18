import * as THREE from 'three';

function makeCanvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeat = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  return tex;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(
  color: string | number,
  roughness = 0.72,
  metalness = 0.05,
  extra?: Partial<THREE.MeshStandardMaterialParameters>
): THREE.MeshStandardMaterial {
  const key = `${color}-${roughness}-${metalness}-${extra ? JSON.stringify(Object.keys(extra)) : ''}`;
  if (!extra && matCache.has(key)) return matCache.get(key)!;
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    ...extra,
  });
  if (!extra) matCache.set(key, m);
  return m;
}

function addPart(
  g: THREE.Group,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

export function buildVocabModel(modelType: string): THREE.Group {
  const g = new THREE.Group();
  const wood = mat('#b67d4b', 0.65, 0.04);
  const darkWood = mat('#6d4628', 0.7, 0.05);
  const cream = mat('#f5efe4', 0.85, 0.02);
  const blueFabric = mat('#365f91', 0.88, 0.02);
  const tealFabric = mat('#2a7c76', 0.86, 0.02);
  const terra = mat('#c25b38', 0.82, 0.04);
  const metal = mat('#c4ccd4', 0.25, 0.85);
  const darkMetal = mat('#2c3440', 0.35, 0.75);
  const ceramic = mat('#f9fafb', 0.2, 0.05);
  const glass = mat('#9ad0ec', 0.12, 0.1, { transparent: true, opacity: 0.45 });

  switch (modelType) {
    case 'sofa': {
      addPart(g, new THREE.BoxGeometry(1.9, 0.24, 0.86), blueFabric, 0, 0.26, 0);
      addPart(g, new THREE.BoxGeometry(1.9, 0.48, 0.2), blueFabric, 0, 0.56, -0.33);
      addPart(g, new THREE.BoxGeometry(0.2, 0.38, 0.86), blueFabric, -0.85, 0.42, 0);
      addPart(g, new THREE.BoxGeometry(0.2, 0.38, 0.86), blueFabric, 0.85, 0.42, 0);
      addPart(g, new THREE.BoxGeometry(0.7, 0.12, 0.62), mat('#4b79b2', 0.9, 0.01), -0.38, 0.42, 0.05);
      addPart(g, new THREE.BoxGeometry(0.7, 0.12, 0.62), mat('#4b79b2', 0.9, 0.01), 0.38, 0.42, 0.05);
      for (const [lx, lz] of [[-0.82, -0.34], [0.82, -0.34], [-0.82, 0.34], [0.82, 0.34]]) {
        addPart(g, new THREE.CylinderGeometry(0.035, 0.025, 0.14, 10), darkWood, lx, 0.07, lz);
      }
      break;
    }

    case 'armchair': {
      addPart(g, new THREE.BoxGeometry(0.84, 0.24, 0.82), terra, 0, 0.26, 0);
      addPart(g, new THREE.BoxGeometry(0.84, 0.5, 0.18), terra, 0, 0.56, -0.32);
      addPart(g, new THREE.BoxGeometry(0.16, 0.36, 0.82), terra, -0.34, 0.42, 0);
      addPart(g, new THREE.BoxGeometry(0.16, 0.36, 0.82), terra, 0.34, 0.42, 0);
      addPart(g, new THREE.BoxGeometry(0.42, 0.22, 0.12), mat('#e5b44c', 0.9, 0.01), 0, 0.48, -0.16, -0.2);
      for (const [lx, lz] of [[-0.34, -0.32], [0.34, -0.32], [-0.34, 0.32], [0.34, 0.32]]) {
        addPart(g, new THREE.CylinderGeometry(0.03, 0.02, 0.14, 10), darkWood, lx, 0.07, lz);
      }
      break;
    }

    case 'coffee_table': {
      addPart(g, new THREE.BoxGeometry(1.1, 0.06, 0.62), wood, 0, 0.4, 0);
      addPart(g, new THREE.BoxGeometry(0.9, 0.03, 0.48), darkWood, 0, 0.18, 0);
      for (const [lx, lz] of [[-0.46, -0.24], [0.46, -0.24], [-0.46, 0.24], [0.46, 0.24]]) {
        addPart(g, new THREE.CylinderGeometry(0.025, 0.02, 0.38, 10), darkMetal, lx, 0.19, lz);
      }
      break;
    }

    case 'rug': {
      const rugTex = makeCanvasTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#c86a43';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#f3d8a3';
        ctx.lineWidth = 8;
        ctx.strokeRect(12, 12, w - 24, h - 24);
        ctx.fillStyle = '#2f5e7e';
        ctx.fillRect(34, 34, w - 68, h - 68);
      });
      addPart(
        g,
        new THREE.BoxGeometry(2.3, 0.03, 1.55),
        new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.95, metalness: 0 }),
        0,
        0.015,
        0
      );
      addPart(g, new THREE.BoxGeometry(2.38, 0.02, 0.05), cream, 0, 0.01, -0.79);
      addPart(g, new THREE.BoxGeometry(2.38, 0.02, 0.05), cream, 0, 0.01, 0.79);
      break;
    }

    case 'lamp': {
      addPart(g, new THREE.CylinderGeometry(0.2, 0.22, 0.04, 18), darkMetal, 0, 0.02, 0);
      addPart(g, new THREE.CylinderGeometry(0.025, 0.03, 1.38, 12), metal, 0, 0.7, 0);
      const shadeMat = new THREE.MeshStandardMaterial({
        color: '#fff2cf',
        emissive: '#f5b841',
        emissiveIntensity: 0.45,
        roughness: 0.65,
      });
      addPart(g, new THREE.CylinderGeometry(0.18, 0.28, 0.34, 18), shadeMat, 0, 1.46, 0);
      addPart(g, new THREE.SphereGeometry(0.06, 12, 12), shadeMat, 0, 1.38, 0);
      break;
    }

    case 'curtains': {
      addPart(g, new THREE.CylinderGeometry(0.02, 0.02, 1.7, 10), darkMetal, 0, 2.05, 0, 0, 0, Math.PI / 2);
      addPart(g, new THREE.BoxGeometry(1.3, 1.25, 0.05), glass, 0, 1.35, -0.05);
      for (const sx of [-0.62, 0.62]) {
        addPart(g, new THREE.BoxGeometry(0.32, 1.85, 0.09), tealFabric, sx, 1.1, 0.04);
        addPart(g, new THREE.BoxGeometry(0.1, 1.85, 0.11), mat('#21635e', 0.9, 0.01), sx + (sx < 0 ? 0.1 : -0.1), 1.1, 0.05);
      }
      break;
    }

    case 'bed': {
      addPart(g, new THREE.BoxGeometry(1.5, 0.28, 2.05), wood, 0, 0.22, 0);
      addPart(g, new THREE.BoxGeometry(1.54, 0.85, 0.1), darkWood, 0, 0.48, -1.0);
      addPart(g, new THREE.BoxGeometry(1.38, 0.2, 1.92), cream, 0, 0.44, 0);
      for (const [lx, lz] of [[-0.68, -0.94], [0.68, -0.94], [-0.68, 0.94], [0.68, 0.94]]) {
        addPart(g, new THREE.BoxGeometry(0.08, 0.14, 0.08), darkWood, lx, 0.07, lz);
      }
      break;
    }

    case 'pillow': {
      addPart(g, new THREE.BoxGeometry(0.56, 0.12, 0.36), cream, -0.32, 0.06, 0, 0.1, 0.05, 0);
      addPart(g, new THREE.BoxGeometry(0.56, 0.12, 0.36), mat('#e7eef6', 0.9, 0.01), 0.32, 0.06, 0, 0.1, -0.05, 0);
      addPart(g, new THREE.BoxGeometry(1.22, 0.04, 0.38), mat('#d7e1ec', 0.92, 0.01), 0, 0.02, 0);
      break;
    }

    case 'blanket': {
      addPart(g, new THREE.BoxGeometry(1.4, 0.1, 1.18), mat('#3a6ea5', 0.9, 0.01), 0, 0.05, 0);
      addPart(g, new THREE.BoxGeometry(1.42, 0.06, 0.22), cream, 0, 0.08, -0.52);
      addPart(g, new THREE.BoxGeometry(1.41, 0.04, 0.14), mat('#e5b44c', 0.88, 0.02), 0, 0.09, 0.15);
      break;
    }

    case 'wardrobe': {
      addPart(g, new THREE.BoxGeometry(1.25, 2.0, 0.62), wood, 0, 1.02, 0);
      addPart(g, new THREE.BoxGeometry(1.3, 0.08, 0.66), darkWood, 0, 2.04, 0);
      addPart(g, new THREE.BoxGeometry(0.58, 1.84, 0.04), mat('#c89260', 0.6, 0.04), -0.3, 1.0, 0.32);
      addPart(g, new THREE.BoxGeometry(0.58, 1.84, 0.04), mat('#c89260', 0.6, 0.04), 0.3, 1.0, 0.32);
      addPart(g, new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8), metal, -0.06, 1.02, 0.36);
      addPart(g, new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8), metal, 0.06, 1.02, 0.36);
      break;
    }

    case 'bedside_table': {
      addPart(g, new THREE.BoxGeometry(0.52, 0.52, 0.45), wood, 0, 0.32, 0);
      addPart(g, new THREE.BoxGeometry(0.46, 0.18, 0.04), mat('#cf9968', 0.65, 0.04), 0, 0.42, 0.23);
      addPart(g, new THREE.BoxGeometry(0.46, 0.18, 0.04), mat('#cf9968', 0.65, 0.04), 0, 0.21, 0.23);
      addPart(g, new THREE.SphereGeometry(0.025, 10, 10), metal, 0, 0.42, 0.26);
      addPart(g, new THREE.SphereGeometry(0.025, 10, 10), metal, 0, 0.21, 0.26);
      for (const [lx, lz] of [[-0.2, -0.17], [0.2, -0.17], [-0.2, 0.17], [0.2, 0.17]]) {
        addPart(g, new THREE.BoxGeometry(0.05, 0.08, 0.05), darkWood, lx, 0.04, lz);
      }
      break;
    }

    case 'desk': {
      addPart(g, new THREE.BoxGeometry(1.36, 0.06, 0.68), wood, 0, 0.73, 0);
      addPart(g, new THREE.BoxGeometry(0.38, 0.66, 0.6), darkWood, 0.44, 0.36, 0);
      addPart(g, new THREE.BoxGeometry(0.05, 0.7, 0.6), darkMetal, -0.6, 0.35, 0);
      addPart(g, new THREE.BoxGeometry(0.42, 0.04, 0.3), mat('#2d3748', 0.45, 0.3), -0.12, 0.78, -0.05);
      addPart(g, new THREE.BoxGeometry(0.42, 0.28, 0.03), mat('#1e293b', 0.2, 0.5), -0.12, 0.92, -0.19, -0.15);
      break;
    }

    case 'student_desk': {
      addPart(g, new THREE.BoxGeometry(0.84, 0.05, 0.58), wood, 0, 0.72, 0);
      addPart(g, new THREE.BoxGeometry(0.78, 0.1, 0.48), darkWood, 0, 0.65, 0);
      for (const [lx, lz] of [[-0.36, -0.24], [0.36, -0.24], [-0.36, 0.24], [0.36, 0.24]]) {
        addPart(g, new THREE.CylinderGeometry(0.022, 0.022, 0.7, 8), darkMetal, lx, 0.35, lz);
      }
      break;
    }

    case 'chair': {
      addPart(g, new THREE.BoxGeometry(0.46, 0.05, 0.46), wood, 0, 0.44, 0);
      addPart(g, new THREE.BoxGeometry(0.46, 0.46, 0.05), wood, 0, 0.68, -0.2);
      for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
        addPart(g, new THREE.BoxGeometry(0.04, 0.44, 0.04), darkWood, lx, 0.22, lz);
      }
      break;
    }

    case 'bookcase': {
      addPart(g, new THREE.BoxGeometry(1.15, 1.82, 0.38), darkWood, 0, 0.91, 0);
      for (const sy of [0.38, 0.84, 1.3, 1.72]) {
        addPart(g, new THREE.BoxGeometry(1.06, 0.04, 0.34), wood, 0, sy, 0.02);
      }
      const bookCols = ['#c25b38', '#2563eb', '#15803d', '#d97706', '#7c3aed'];
      for (let i = 0; i < 5; i++) {
        addPart(
          g,
          new THREE.BoxGeometry(0.08, 0.28 + (i % 2) * 0.04, 0.24),
          mat(bookCols[i], 0.75, 0.02),
          -0.38 + i * 0.11,
          1.46,
          0.03
        );
        addPart(
          g,
          new THREE.BoxGeometry(0.08, 0.26, 0.24),
          mat(bookCols[(i + 2) % 5], 0.75, 0.02),
          -0.32 + i * 0.12,
          1.0,
          0.03
        );
      }
      break;
    }

    case 'dining_table': {
      addPart(g, new THREE.BoxGeometry(1.8, 0.07, 1.05), wood, 0, 0.75, 0);
      for (const [lx, lz] of [[-0.8, -0.44], [0.8, -0.44], [-0.8, 0.44], [0.8, 0.44]]) {
        addPart(g, new THREE.BoxGeometry(0.08, 0.74, 0.08), darkWood, lx, 0.37, lz);
      }
      addPart(g, new THREE.CylinderGeometry(0.14, 0.1, 0.04, 16), ceramic, -0.4, 0.8, 0.1);
      addPart(g, new THREE.CylinderGeometry(0.14, 0.1, 0.04, 16), ceramic, 0.4, 0.8, -0.1);
      break;
    }

    case 'fridge': {
      addPart(g, new THREE.BoxGeometry(0.84, 1.82, 0.74), mat('#edf2f7', 0.28, 0.25), 0, 0.91, 0);
      addPart(g, new THREE.BoxGeometry(0.78, 0.02, 0.03), darkMetal, 0, 1.15, 0.37);
      addPart(g, new THREE.CylinderGeometry(0.015, 0.015, 0.32, 8), metal, -0.32, 1.44, 0.4);
      addPart(g, new THREE.CylinderGeometry(0.015, 0.015, 0.28, 8), metal, -0.32, 0.75, 0.4);
      break;
    }

    case 'stove': {
      addPart(g, new THREE.BoxGeometry(0.82, 0.86, 0.72), mat('#e5e7eb', 0.3, 0.55), 0, 0.43, 0);
      addPart(g, new THREE.BoxGeometry(0.78, 0.04, 0.68), darkMetal, 0, 0.88, 0);
      for (const [bx, bz] of [[-0.2, -0.16], [0.2, -0.16], [-0.2, 0.16], [0.2, 0.16]]) {
        addPart(g, new THREE.CylinderGeometry(0.11, 0.11, 0.02, 16), mat('#111827', 0.4, 0.6), bx, 0.91, bz);
      }
      addPart(g, new THREE.BoxGeometry(0.62, 0.36, 0.04), glass, 0, 0.42, 0.37);
      addPart(g, new THREE.CylinderGeometry(0.014, 0.014, 0.52, 8), metal, 0, 0.66, 0.4, 0, 0, Math.PI / 2);
      break;
    }

    case 'bathtub': {
      addPart(g, new THREE.BoxGeometry(1.62, 0.52, 0.84), ceramic, 0, 0.26, 0);
      addPart(g, new THREE.BoxGeometry(1.38, 0.06, 0.62), mat('#7dd3fc', 0.12, 0.1), 0, 0.48, 0);
      addPart(g, new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10), metal, 0.7, 0.6, 0);
      addPart(g, new THREE.BoxGeometry(0.14, 0.03, 0.05), metal, 0.62, 0.67, 0);
      break;
    }

    case 'shower': {
      addPart(g, new THREE.BoxGeometry(0.92, 0.08, 0.92), ceramic, 0, 0.04, 0);
      addPart(g, new THREE.BoxGeometry(0.04, 1.9, 0.9), glass, 0.44, 0.99, 0);
      addPart(g, new THREE.CylinderGeometry(0.02, 0.02, 1.78, 10), metal, -0.35, 0.95, -0.35);
      addPart(g, new THREE.CylinderGeometry(0.11, 0.08, 0.04, 16), metal, -0.22, 1.85, -0.22, 0.3, 0, -0.3);
      break;
    }

    case 'sink': {
      addPart(g, new THREE.BoxGeometry(0.72, 0.45, 0.46), wood, 0, 0.45, 0);
      addPart(g, new THREE.BoxGeometry(0.76, 0.12, 0.5), ceramic, 0, 0.74, 0);
      addPart(g, new THREE.BoxGeometry(0.56, 0.04, 0.34), mat('#bae6fd', 0.15, 0.1), 0, 0.8, 0.02);
      addPart(g, new THREE.CylinderGeometry(0.02, 0.025, 0.16, 10), metal, 0, 0.88, -0.17);
      addPart(g, new THREE.BoxGeometry(0.04, 0.03, 0.12), metal, 0, 0.95, -0.12);
      break;
    }

    case 'toilet': {
      addPart(g, new THREE.CylinderGeometry(0.18, 0.14, 0.38, 16), ceramic, 0, 0.19, 0.08);
      addPart(g, new THREE.CylinderGeometry(0.22, 0.2, 0.06, 18), ceramic, 0, 0.4, 0.08);
      addPart(g, new THREE.BoxGeometry(0.42, 0.44, 0.2), ceramic, 0, 0.58, -0.18);
      addPart(g, new THREE.CylinderGeometry(0.025, 0.025, 0.03, 10), metal, 0, 0.81, -0.18);
      break;
    }

    case 'mirror': {
      addPart(g, new THREE.BoxGeometry(0.76, 0.96, 0.05), darkWood, 0, 0, 0);
      addPart(g, new THREE.BoxGeometry(0.64, 0.84, 0.06), mat('#dbeafe', 0.06, 0.9), 0, 0, 0.01);
      break;
    }

    case 'towel_rail': {
      addPart(g, new THREE.CylinderGeometry(0.018, 0.018, 0.72, 10), metal, 0, 0, 0, 0, 0, Math.PI / 2);
      addPart(g, new THREE.BoxGeometry(0.44, 0.56, 0.05), terra, 0, -0.26, 0.02);
      addPart(g, new THREE.BoxGeometry(0.44, 0.08, 0.07), mat('#a84627', 0.9, 0.01), 0, -0.02, 0.02);
      break;
    }

    case 'flowerpot': {
      addPart(g, new THREE.CylinderGeometry(0.24, 0.16, 0.36, 16), terra, 0, 0.18, 0);
      addPart(g, new THREE.CylinderGeometry(0.22, 0.22, 0.04, 14), darkWood, 0, 0.35, 0);
      const leafMat = mat('#2f7a45', 0.75, 0.02);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        addPart(g, new THREE.SphereGeometry(0.11, 10, 10), leafMat, Math.cos(ang) * 0.13, 0.48 + (i % 2) * 0.08, Math.sin(ang) * 0.13);
      }
      addPart(g, new THREE.SphereGeometry(0.14, 12, 12), mat('#3a9154', 0.72, 0.02), 0, 0.58, 0);
      break;
    }

    // ============ SCHOOL ============
    case 'blackboard': {
      const boardTex = makeCanvasTexture(256, 128, (ctx, w, h) => {
        ctx.fillStyle = '#1e4631';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText('ENGLISH A1–A2', 24, 48);
        ctx.font = '18px sans-serif';
        ctx.fillText('Hello! How are you?', 24, 86);
      });
      addPart(g, new THREE.BoxGeometry(2.6, 1.24, 0.08), wood, 0, 0, 0);
      addPart(g, new THREE.BoxGeometry(2.44, 1.08, 0.09), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.75 }), 0, 0, 0.01);
      addPart(g, new THREE.BoxGeometry(2.5, 0.06, 0.14), wood, 0, -0.64, 0.06);
      break;
    }

    case 'backpack': {
      addPart(g, new THREE.BoxGeometry(0.36, 0.48, 0.22), mat('#2563eb', 0.85, 0.02), 0, 0.25, 0);
      addPart(g, new THREE.BoxGeometry(0.28, 0.22, 0.08), mat('#1d4ed8', 0.85, 0.02), 0, 0.16, 0.14);
      addPart(g, new THREE.TorusGeometry(0.08, 0.02, 8, 14, Math.PI), darkMetal, 0, 0.5, 0);
      break;
    }

    case 'notebook': {
      addPart(g, new THREE.BoxGeometry(0.26, 0.04, 0.34), mat('#dc2626', 0.75, 0.03), 0, 0.02, 0);
      addPart(g, new THREE.BoxGeometry(0.24, 0.03, 0.31), cream, 0.01, 0.02, 0);
      addPart(g, new THREE.BoxGeometry(0.03, 0.045, 0.34), darkMetal, -0.12, 0.02, 0);
      break;
    }

    case 'pencil_case': {
      addPart(g, new THREE.CylinderGeometry(0.06, 0.06, 0.24, 14), mat('#f59e0b', 0.78, 0.03), 0, 0.06, 0, 0, 0, Math.PI / 2);
      addPart(g, new THREE.BoxGeometry(0.24, 0.02, 0.02), darkMetal, 0, 0.12, 0);
      addPart(g, new THREE.CylinderGeometry(0.01, 0.01, 0.18, 8), mat('#ef4444', 0.6), 0.06, 0.08, 0.07, 0, 0, Math.PI / 2);
      break;
    }

    case 'globe': {
      addPart(g, new THREE.CylinderGeometry(0.14, 0.16, 0.04, 16), darkWood, 0, 0.02, 0);
      addPart(g, new THREE.CylinderGeometry(0.02, 0.02, 0.16, 10), metal, 0, 0.1, 0);
      addPart(g, new THREE.TorusGeometry(0.22, 0.015, 8, 24, Math.PI), metal, 0, 0.36, 0, 0, 0, -Math.PI / 2);
      addPart(g, new THREE.SphereGeometry(0.18, 20, 20), mat('#2b7bbb', 0.45, 0.1), 0, 0.36, 0);
      addPart(g, new THREE.SphereGeometry(0.08, 10, 10), mat('#3a9154', 0.7, 0.02), 0.11, 0.4, 0.08);
      break;
    }

    case 'wall_clock': {
      addPart(g, new THREE.CylinderGeometry(0.3, 0.3, 0.06, 24), darkMetal, 0, 0, 0, Math.PI / 2, 0, 0);
      addPart(g, new THREE.CylinderGeometry(0.26, 0.26, 0.07, 24), ceramic, 0, 0, 0.01, Math.PI / 2, 0, 0);
      addPart(g, new THREE.BoxGeometry(0.025, 0.16, 0.02), darkMetal, 0, 0.07, 0.05);
      addPart(g, new THREE.BoxGeometry(0.12, 0.02, 0.02), mat('#dc2626', 0.4), 0.06, 0, 0.05);
      break;
    }

    case 'trash_bin': {
      addPart(g, new THREE.CylinderGeometry(0.22, 0.17, 0.46, 18), mat('#15803d', 0.55, 0.2), 0, 0.23, 0);
      addPart(g, new THREE.TorusGeometry(0.22, 0.02, 8, 18), darkMetal, 0, 0.46, 0, Math.PI / 2, 0, 0);
      addPart(g, new THREE.BoxGeometry(0.1, 0.08, 0.08), cream, 0.02, 0.45, 0.02, 0.3, 0.4, 0);
      break;
    }

    // ============ CAFÉ ============
    case 'menu_board': {
      const menuTex = makeCanvasTexture(256, 128, (ctx, w, h) => {
        ctx.fillStyle = '#292524';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('SUNNY CAFÉ MENU', 20, 36);
        ctx.font = '18px sans-serif';
        ctx.fillText('Sandwich · Cake · Juice', 20, 74);
        ctx.fillText('Hot Chocolate · Tea', 20, 102);
      });
      addPart(g, new THREE.BoxGeometry(2.1, 1.05, 0.07), darkWood, 0, 0, 0);
      addPart(g, new THREE.BoxGeometry(1.96, 0.92, 0.08), new THREE.MeshStandardMaterial({ map: menuTex, roughness: 0.7 }), 0, 0, 0.01);
      break;
    }

    case 'counter': {
      addPart(g, new THREE.BoxGeometry(3.8, 0.96, 0.84), wood, 0, 0.48, 0);
      addPart(g, new THREE.BoxGeometry(3.92, 0.08, 0.96), cream, 0, 0.98, 0);
      addPart(g, new THREE.BoxGeometry(3.6, 0.72, 0.05), tealFabric, 0, 0.45, 0.42);
      break;
    }

    case 'coffee_machine': {
      addPart(g, new THREE.BoxGeometry(0.56, 0.48, 0.44), metal, 0, 0.24, 0);
      addPart(g, new THREE.BoxGeometry(0.46, 0.08, 0.14), darkMetal, 0, 0.38, 0.22);
      addPart(g, new THREE.CylinderGeometry(0.05, 0.04, 0.1, 12), ceramic, -0.1, 0.09, 0.2);
      addPart(g, new THREE.CylinderGeometry(0.05, 0.04, 0.1, 12), ceramic, 0.1, 0.09, 0.2);
      break;
    }

    case 'cup': {
      addPart(g, new THREE.CylinderGeometry(0.07, 0.055, 0.12, 16), ceramic, 0, 0.06, 0);
      addPart(g, new THREE.CylinderGeometry(0.06, 0.05, 0.02, 14), mat('#6f4e37', 0.3), 0, 0.11, 0);
      addPart(g, new THREE.TorusGeometry(0.035, 0.01, 8, 12), ceramic, 0.075, 0.06, 0);
      break;
    }

    case 'glass': {
      addPart(g, new THREE.CylinderGeometry(0.055, 0.045, 0.16, 16), glass, 0, 0.08, 0);
      addPart(g, new THREE.CylinderGeometry(0.046, 0.04, 0.11, 14), mat('#fb923c', 0.2, 0.05), 0, 0.06, 0);
      break;
    }

    case 'plate': {
      addPart(g, new THREE.CylinderGeometry(0.18, 0.13, 0.03, 20), ceramic, 0, 0.015, 0);
      addPart(g, new THREE.TorusGeometry(0.17, 0.012, 8, 24), mat('#cbd5e1', 0.3), 0, 0.025, 0, Math.PI / 2, 0, 0);
      break;
    }

    case 'sandwich': {
      addPart(g, new THREE.BoxGeometry(0.18, 0.025, 0.16), mat('#eab308', 0.85), 0, 0.015, 0);
      addPart(g, new THREE.BoxGeometry(0.17, 0.02, 0.15), mat('#22c55e', 0.7), 0, 0.038, 0);
      addPart(g, new THREE.BoxGeometry(0.17, 0.02, 0.15), mat('#f97316', 0.6), 0, 0.055, 0);
      addPart(g, new THREE.BoxGeometry(0.18, 0.025, 0.16), mat('#d97706', 0.85), 0, 0.078, 0);
      break;
    }

    case 'cake': {
      addPart(g, new THREE.CylinderGeometry(0.24, 0.24, 0.04, 20), ceramic, 0, 0.02, 0);
      addPart(g, new THREE.CylinderGeometry(0.18, 0.18, 0.15, 20), mat('#78350f', 0.8), 0, 0.11, 0);
      addPart(g, new THREE.CylinderGeometry(0.185, 0.185, 0.04, 20), cream, 0, 0.19, 0);
      addPart(g, new THREE.SphereGeometry(0.035, 10, 10), mat('#dc2626', 0.3), 0, 0.23, 0);
      break;
    }

    case 'spoon': {
      addPart(g, new THREE.BoxGeometry(0.16, 0.012, 0.02), metal, -0.04, 0.01, 0);
      addPart(g, new THREE.SphereGeometry(0.032, 12, 10), metal, 0.06, 0.012, 0);
      break;
    }

    case 'bill_tray': {
      addPart(g, new THREE.BoxGeometry(0.22, 0.02, 0.3), darkWood, 0, 0.01, 0);
      addPart(g, new THREE.BoxGeometry(0.15, 0.01, 0.22), cream, 0, 0.022, 0);
      addPart(g, new THREE.CylinderGeometry(0.02, 0.02, 0.01, 12), mat('#eab308', 0.2, 0.85), 0.04, 0.03, 0.05);
      break;
    }

    // ============ ROUTINE & CLOTHES ============
    case 'alarm_clock': {
      addPart(g, new THREE.CylinderGeometry(0.12, 0.12, 0.07, 20), mat('#dc2626', 0.35, 0.3), 0, 0.14, 0, Math.PI / 2, 0, 0);
      addPart(g, new THREE.CylinderGeometry(0.095, 0.095, 0.08, 20), ceramic, 0, 0.14, 0.01, Math.PI / 2, 0, 0);
      addPart(g, new THREE.SphereGeometry(0.04, 10, 10), metal, -0.09, 0.26, 0);
      addPart(g, new THREE.SphereGeometry(0.04, 10, 10), metal, 0.09, 0.26, 0);
      break;
    }

    case 'tshirt': {
      addPart(g, new THREE.BoxGeometry(0.46, 0.06, 0.52), mat('#ef4444', 0.88), 0, 0.03, 0);
      addPart(g, new THREE.BoxGeometry(0.2, 0.06, 0.18), mat('#ef4444', 0.88), -0.3, 0.03, -0.14, 0, 0.3, 0);
      addPart(g, new THREE.BoxGeometry(0.2, 0.06, 0.18), mat('#ef4444', 0.88), 0.3, 0.03, -0.14, 0, -0.3, 0);
      break;
    }

    case 'trousers': {
      const denim = mat('#1e40af', 0.86, 0.03);
      addPart(g, new THREE.BoxGeometry(0.42, 0.06, 0.2), denim, 0, 0.03, -0.22);
      addPart(g, new THREE.BoxGeometry(0.18, 0.06, 0.56), denim, -0.11, 0.03, 0.14);
      addPart(g, new THREE.BoxGeometry(0.18, 0.06, 0.56), denim, 0.11, 0.03, 0.14);
      break;
    }

    case 'jacket': {
      addPart(g, new THREE.BoxGeometry(0.42, 0.56, 0.16), mat('#eab308', 0.72), 0, 0.0, 0);
      addPart(g, new THREE.BoxGeometry(0.14, 0.44, 0.14), mat('#ca8a04', 0.72), -0.26, -0.02, 0, 0, 0, -0.2);
      addPart(g, new THREE.BoxGeometry(0.14, 0.44, 0.14), mat('#ca8a04', 0.72), 0.26, -0.02, 0, 0, 0, 0.2);
      break;
    }

    case 'trainers': {
      for (const sx of [-0.11, 0.11]) {
        addPart(g, new THREE.BoxGeometry(0.13, 0.04, 0.26), ceramic, sx, 0.02, 0);
        addPart(g, new THREE.BoxGeometry(0.12, 0.09, 0.24), mat('#2563eb', 0.75), sx, 0.075, -0.01);
        addPart(g, new THREE.BoxGeometry(0.125, 0.02, 0.08), cream, sx, 0.11, 0.02);
      }
      break;
    }

    case 'cap': {
      addPart(g, new THREE.SphereGeometry(0.14, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#dc2626', 0.8), 0, 0.02, 0);
      addPart(g, new THREE.CylinderGeometry(0.14, 0.14, 0.02, 14, 1, false, -Math.PI / 3, (2 * Math.PI) / 3), mat('#b91c1c', 0.75), 0, 0.02, 0.1);
      addPart(g, new THREE.SphereGeometry(0.02, 8, 8), cream, 0, 0.16, 0);
      break;
    }

    case 'coat_rack': {
      addPart(g, new THREE.CylinderGeometry(0.24, 0.28, 0.05, 16), darkWood, 0, 0.025, 0);
      addPart(g, new THREE.CylinderGeometry(0.035, 0.045, 1.75, 12), wood, 0, 0.9, 0);
      for (let i = 0; i < 4; i++) {
        const ang = (i * Math.PI) / 2;
        addPart(g, new THREE.CylinderGeometry(0.015, 0.015, 0.24, 8), metal, Math.cos(ang) * 0.1, 1.68, Math.sin(ang) * 0.1, 0, -ang, Math.PI / 4);
      }
      break;
    }

    case 'toothbrush': {
      addPart(g, new THREE.BoxGeometry(0.025, 0.02, 0.22), mat('#0ea5e9', 0.35), 0, 0.015, 0);
      addPart(g, new THREE.BoxGeometry(0.028, 0.03, 0.05), ceramic, 0, 0.035, 0.08);
      break;
    }

    case 'hairbrush': {
      addPart(g, new THREE.CylinderGeometry(0.018, 0.018, 0.14, 10), wood, 0, 0.02, -0.06, Math.PI / 2, 0, 0);
      addPart(g, new THREE.CylinderGeometry(0.055, 0.055, 0.025, 16), darkWood, 0, 0.02, 0.04);
      addPart(g, new THREE.CylinderGeometry(0.045, 0.045, 0.02, 14), darkMetal, 0, 0.04, 0.04);
      break;
    }

    // ============ TOWN ============
    case 'shop_bakery':
    case 'shop_bookshop':
    case 'shop_pharmacy': {
      const facadeColor =
        modelType === 'shop_bakery'
          ? '#f6d5a3'
          : modelType === 'shop_bookshop'
            ? '#cbd5e1'
            : '#e2f2e8';
      const awningColor =
        modelType === 'shop_bakery'
          ? '#d97706'
          : modelType === 'shop_bookshop'
            ? '#1d4ed8'
            : '#15803d';
      addPart(g, new THREE.BoxGeometry(2.3, 2.2, 1.5), mat(facadeColor, 0.8), 0, 1.1, 0);
      addPart(g, new THREE.BoxGeometry(2.44, 0.18, 1.64), darkWood, 0, 2.25, 0);
      addPart(g, new THREE.BoxGeometry(2.2, 0.12, 0.6), mat(awningColor, 0.7), 0, 1.48, 0.92, 0.28, 0, 0);
      addPart(g, new THREE.BoxGeometry(0.75, 1.25, 0.06), darkWood, -0.55, 0.65, 0.76);
      addPart(g, new THREE.BoxGeometry(1.0, 0.95, 0.06), glass, 0.48, 0.85, 0.76);
      if (modelType === 'shop_pharmacy') {
        addPart(g, new THREE.BoxGeometry(0.45, 0.14, 0.08), mat('#16a34a', 0.35), 0, 1.9, 0.79);
        addPart(g, new THREE.BoxGeometry(0.14, 0.45, 0.08), mat('#16a34a', 0.35), 0, 1.9, 0.79);
      }
      break;
    }

    case 'bus_stop': {
      addPart(g, new THREE.BoxGeometry(1.6, 0.06, 0.8), darkMetal, 0, 2.1, 0);
      addPart(g, new THREE.BoxGeometry(1.5, 1.9, 0.05), glass, 0, 1.05, -0.35);
      addPart(g, new THREE.CylinderGeometry(0.04, 0.04, 2.1, 10), darkMetal, -0.75, 1.05, -0.35);
      addPart(g, new THREE.CylinderGeometry(0.04, 0.04, 2.1, 10), darkMetal, 0.75, 1.05, -0.35);
      addPart(g, new THREE.BoxGeometry(1.1, 0.08, 0.36), wood, 0, 0.46, -0.1);
      addPart(g, new THREE.CylinderGeometry(0.18, 0.18, 0.04, 16), mat('#2563eb', 0.4), 0.92, 1.9, 0, Math.PI / 2, 0, 0);
      break;
    }

    case 'traffic_light': {
      addPart(g, new THREE.CylinderGeometry(0.05, 0.06, 2.2, 10), darkMetal, 0, 1.1, 0);
      addPart(g, new THREE.BoxGeometry(0.28, 0.76, 0.22), mat('#1e293b', 0.5), 0, 2.1, 0);
      addPart(g, new THREE.SphereGeometry(0.075, 12, 12), mat('#ef4444', 0.2, 0, { emissive: '#dc2626', emissiveIntensity: 0.7 }), 0, 2.32, 0.1);
      addPart(g, new THREE.SphereGeometry(0.075, 12, 12), mat('#f59e0b', 0.3), 0, 2.1, 0.1);
      addPart(g, new THREE.SphereGeometry(0.075, 12, 12), mat('#22c55e', 0.2, 0, { emissive: '#16a34a', emissiveIntensity: 0.5 }), 0, 1.88, 0.1);
      break;
    }

    case 'zebra_crossing': {
      for (let i = -2; i <= 2; i++) {
        addPart(g, new THREE.BoxGeometry(0.32, 0.02, 1.4), ceramic, i * 0.52, 0.01, 0);
      }
      break;
    }

    case 'bench': {
      addPart(g, new THREE.BoxGeometry(1.5, 0.07, 0.48), wood, 0, 0.44, 0);
      addPart(g, new THREE.BoxGeometry(1.5, 0.36, 0.06), wood, 0, 0.72, -0.2);
      for (const sx of [-0.62, 0.62]) {
        addPart(g, new THREE.BoxGeometry(0.07, 0.44, 0.44), darkMetal, sx, 0.22, 0);
      }
      break;
    }

    case 'street_lamp': {
      addPart(g, new THREE.CylinderGeometry(0.14, 0.2, 0.25, 12), darkMetal, 0, 0.125, 0);
      addPart(g, new THREE.CylinderGeometry(0.04, 0.06, 2.6, 10), darkMetal, 0, 1.4, 0);
      addPart(g, new THREE.SphereGeometry(0.18, 16, 16), mat('#fef3c7', 0.2, 0, { emissive: '#fbbf24', emissiveIntensity: 0.6 }), 0, 2.75, 0);
      break;
    }

    case 'signpost': {
      addPart(g, new THREE.CylinderGeometry(0.04, 0.05, 1.9, 10), darkMetal, 0, 0.95, 0);
      addPart(g, new THREE.BoxGeometry(0.68, 0.16, 0.04), mat('#2563eb', 0.5), 0.12, 1.72, 0);
      addPart(g, new THREE.BoxGeometry(0.62, 0.16, 0.04), mat('#15803d', 0.5), -0.1, 1.48, 0.03);
      break;
    }

    case 'bicycle': {
      for (const wx of [-0.45, 0.45]) {
        addPart(g, new THREE.TorusGeometry(0.26, 0.035, 10, 22), darkMetal, wx, 0.3, 0);
      }
      addPart(g, new THREE.BoxGeometry(0.68, 0.04, 0.04), mat('#dc2626', 0.35, 0.5), 0, 0.52, 0, 0, 0, 0.2);
      addPart(g, new THREE.CylinderGeometry(0.02, 0.02, 0.44, 8), mat('#dc2626', 0.35, 0.5), 0.34, 0.52, 0, 0, 0, -0.2);
      addPart(g, new THREE.BoxGeometry(0.04, 0.04, 0.34), metal, 0.3, 0.74, 0);
      addPart(g, new THREE.BoxGeometry(0.16, 0.04, 0.1), darkMetal, -0.22, 0.64, 0);
      break;
    }

    // ============ DOCTOR ============
    case 'exam_bed': {
      addPart(g, new THREE.BoxGeometry(1.75, 0.16, 0.78), mat('#e0f2fe', 0.55), 0, 0.58, 0);
      addPart(g, new THREE.BoxGeometry(0.45, 0.12, 0.74), mat('#bae6fd', 0.55), -0.62, 0.68, 0, 0, 0, 0.25);
      for (const [lx, lz] of [[-0.75, -0.32], [0.75, -0.32], [-0.75, 0.32], [0.75, 0.32]]) {
        addPart(g, new THREE.CylinderGeometry(0.03, 0.03, 0.56, 10), metal, lx, 0.28, lz);
      }
      break;
    }

    case 'stethoscope': {
      addPart(g, new THREE.TorusGeometry(0.12, 0.015, 8, 20, Math.PI * 1.4), mat('#1e293b', 0.45), 0, 0.03, 0, Math.PI / 2, 0, 0);
      addPart(g, new THREE.CylinderGeometry(0.045, 0.045, 0.03, 14), metal, 0.14, 0.02, 0.08);
      break;
    }

    case 'thermometer': {
      addPart(g, new THREE.CylinderGeometry(0.018, 0.018, 0.24, 10), ceramic, 0, 0.02, 0, 0, 0, Math.PI / 2);
      addPart(g, new THREE.BoxGeometry(0.08, 0.02, 0.03), mat('#0ea5e9', 0.2), -0.02, 0.03, 0);
      addPart(g, new THREE.SphereGeometry(0.024, 10, 10), metal, 0.13, 0.02, 0);
      break;
    }

    case 'first_aid_kit': {
      addPart(g, new THREE.BoxGeometry(0.42, 0.3, 0.18), ceramic, 0, 0.15, 0);
      addPart(g, new THREE.BoxGeometry(0.16, 0.05, 0.02), mat('#dc2626', 0.4), 0, 0.15, 0.095);
      addPart(g, new THREE.BoxGeometry(0.05, 0.16, 0.02), mat('#dc2626', 0.4), 0, 0.15, 0.095);
      addPart(g, new THREE.TorusGeometry(0.06, 0.015, 8, 12, Math.PI), darkMetal, 0, 0.3, 0);
      break;
    }

    case 'medicine_cabinet': {
      addPart(g, new THREE.BoxGeometry(0.95, 1.55, 0.42), ceramic, 0, 0.78, 0);
      addPart(g, new THREE.BoxGeometry(0.42, 0.9, 0.03), glass, -0.22, 1.05, 0.22);
      addPart(g, new THREE.BoxGeometry(0.42, 0.9, 0.03), glass, 0.22, 1.05, 0.22);
      addPart(g, new THREE.CylinderGeometry(0.04, 0.04, 0.14, 10), mat('#2563eb', 0.4), -0.18, 0.9, 0.05);
      addPart(g, new THREE.CylinderGeometry(0.04, 0.04, 0.14, 10), mat('#16a34a', 0.4), 0.18, 0.9, 0.05);
      break;
    }

    case 'weighing_scale': {
      addPart(g, new THREE.BoxGeometry(0.42, 0.07, 0.42), ceramic, 0, 0.035, 0);
      addPart(g, new THREE.BoxGeometry(0.18, 0.02, 0.1), mat('#0f172a', 0.2), 0, 0.075, -0.12);
      break;
    }

    case 'eye_chart': {
      const chartTex = makeCanvasTexture(128, 192, (ctx, w, h) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#111827';
        ctx.textAlign = 'center';
        ctx.font = 'bold 48px sans-serif';
        ctx.fillText('E', w / 2, 54);
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText('F P', w / 2, 98);
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('T O Z', w / 2, 134);
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('L P E D', w / 2, 166);
      });
      addPart(g, new THREE.BoxGeometry(0.68, 0.98, 0.04), darkMetal, 0, 0, 0);
      addPart(g, new THREE.BoxGeometry(0.62, 0.92, 0.05), new THREE.MeshStandardMaterial({ map: chartTex, roughness: 0.7 }), 0, 0, 0.01);
      break;
    }

    // ============ TRAVEL ============
    case 'train_carriage': {
      addPart(g, new THREE.BoxGeometry(4.6, 1.35, 1.35), mat('#1d4ed8', 0.35, 0.4), 0, 0.85, 0);
      addPart(g, new THREE.BoxGeometry(4.64, 0.22, 1.38), mat('#f8fafc', 0.3), 0, 1.48, 0);
      addPart(g, new THREE.BoxGeometry(4.64, 0.14, 1.38), mat('#f59e0b', 0.4), 0, 0.35, 0);
      for (const wx of [-1.5, -0.5, 0.5, 1.5]) {
        addPart(g, new THREE.BoxGeometry(0.62, 0.46, 0.06), glass, wx, 0.98, 0.68);
        addPart(g, new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16), darkMetal, wx, 0.18, 0.55, Math.PI / 2, 0, 0);
      }
      break;
    }

    case 'ticket_machine': {
      addPart(g, new THREE.BoxGeometry(0.64, 1.55, 0.48), mat('#1e40af', 0.4, 0.4), 0, 0.78, 0);
      addPart(g, new THREE.BoxGeometry(0.46, 0.36, 0.04), mat('#bae6fd', 0.2, 0.1, { emissive: '#38bdf8', emissiveIntensity: 0.3 }), 0, 1.15, 0.24);
      addPart(g, new THREE.BoxGeometry(0.32, 0.06, 0.08), darkMetal, 0, 0.78, 0.25);
      break;
    }

    case 'departure_board': {
      const depTex = makeCanvasTexture(256, 128, (ctx, w, h) => {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('16:30 VIGO      PL 2', 16, 42);
        ctx.fillText('17:05 A CORUÑA  PL 1', 16, 78);
        ctx.fillText('17:40 OURENSE   PL 3', 16, 112);
      });
      addPart(g, new THREE.BoxGeometry(2.2, 1.0, 0.1), darkMetal, 0, 0, 0);
      addPart(g, new THREE.BoxGeometry(2.06, 0.86, 0.11), new THREE.MeshStandardMaterial({ map: depTex, roughness: 0.4 }), 0, 0, 0.01);
      break;
    }

    case 'suitcase': {
      addPart(g, new THREE.BoxGeometry(0.48, 0.62, 0.26), mat('#eab308', 0.5, 0.1), 0, 0.36, 0);
      addPart(g, new THREE.BoxGeometry(0.22, 0.28, 0.04), darkMetal, 0, 0.8, -0.05);
      for (const wx of [-0.18, 0.18]) {
        addPart(g, new THREE.CylinderGeometry(0.04, 0.04, 0.04, 10), darkMetal, wx, 0.04, 0, 0, 0, Math.PI / 2);
      }
      break;
    }

    case 'luggage_trolley': {
      addPart(g, new THREE.BoxGeometry(0.95, 0.06, 0.56), metal, 0, 0.2, 0);
      addPart(g, new THREE.BoxGeometry(0.05, 0.86, 0.52), metal, -0.44, 0.62, 0);
      addPart(g, new THREE.BoxGeometry(0.42, 0.38, 0.24), terra, 0.12, 0.42, 0);
      for (const [wx, wz] of [[-0.38, -0.22], [0.38, -0.22], [-0.38, 0.22], [0.38, 0.22]]) {
        addPart(g, new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), darkMetal, wx, 0.08, wz, Math.PI / 2, 0, 0);
      }
      break;
    }

    case 'ticket_barrier': {
      addPart(g, new THREE.BoxGeometry(0.24, 0.96, 0.95), metal, -0.45, 0.48, 0);
      addPart(g, new THREE.BoxGeometry(0.24, 0.96, 0.95), metal, 0.45, 0.48, 0);
      addPart(g, new THREE.BoxGeometry(0.36, 0.46, 0.04), mat('#ef4444', 0.45), -0.18, 0.55, 0);
      addPart(g, new THREE.BoxGeometry(0.36, 0.46, 0.04), mat('#ef4444', 0.45), 0.18, 0.55, 0);
      addPart(g, new THREE.BoxGeometry(0.14, 0.04, 0.14), mat('#22c55e', 0.3, 0, { emissive: '#16a34a', emissiveIntensity: 0.5 }), 0.45, 0.98, 0.3);
      break;
    }

    default: {
      addPart(g, new THREE.BoxGeometry(0.6, 0.6, 0.6), wood, 0, 0.3, 0);
      addPart(g, new THREE.BoxGeometry(0.64, 0.08, 0.64), darkWood, 0, 0.64, 0);
      addPart(g, new THREE.SphereGeometry(0.06, 10, 10), metal, 0, 0.72, 0);
      break;
    }
  }

  return g;
}
