"use client";

import { Suspense, useEffect, useRef, useCallback } from "react";
import { Canvas, useThree, useFrame, useLoader } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Grid,
  useGLTF,
  useFBX,
} from "@react-three/drei";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

export type ModelFormat = "glb" | "gltf" | "obj" | "fbx";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MeshInfo = {
  id: string;
  name: string;
  meshRef: THREE.Mesh;
};

export type MeshAssignment = {
  specId: string;
  scaleX?: number;     // texture repeat X (default 1)
  scaleY?: number;     // texture repeat Y (default 1)
  rotation?: number;   // degrees (default 0)
  roughness?: number;  // 0–1 (default 0.55)
  metalness?: number;  // 0–1 (default 0)
  brightness?: number; // 0.2–1 albedo multiplier (default 1)
};

export type MaterialAssignments = Record<string, MeshAssignment | string>;

const DEFAULT_LEVELS = { scaleX: 1, scaleY: 1, rotation: 0, roughness: 0.55, metalness: 0, brightness: 1 };

export function readAssignment(a: MeshAssignment | string | undefined) {
  if (!a) return null;
  if (typeof a === "string") return { specId: a, ...DEFAULT_LEVELS };
  return {
    specId: a.specId,
    scaleX:     a.scaleX     ?? DEFAULT_LEVELS.scaleX,
    scaleY:     a.scaleY     ?? DEFAULT_LEVELS.scaleY,
    rotation:   a.rotation   ?? DEFAULT_LEVELS.rotation,
    roughness:  a.roughness  ?? DEFAULT_LEVELS.roughness,
    metalness:  a.metalness  ?? DEFAULT_LEVELS.metalness,
    brightness: a.brightness ?? DEFAULT_LEVELS.brightness,
  };
}

export type ToneMappingOption = "agx" | "aces" | "neutral";
export type SceneBackground = "white" | "grey" | "dark";

export interface SceneSettings {
  toneMapping: ToneMappingOption;
  exposure: number;        // 0.25–4
  envIntensity: number;    // 0–3
  background: SceneBackground;
  showGrid: boolean;
  shadowStrength: number;  // 0–1
  keyLight: number;        // 0–1.5
}

export const DEFAULT_SCENE: SceneSettings = {
  toneMapping: "agx",
  exposure: 1.0,
  envIntensity: 1.6,
  background: "white",
  showGrid: true,
  shadowStrength: 0.6,
  keyLight: 0.6,
};

const BG_COLORS: Record<SceneBackground, string> = {
  white: "#FFFFFF",
  grey:  "#E8E6E3",
  dark:  "#1A1A1A",
};

interface StudioCanvasProps {
  meshUrl: string;
  format: ModelFormat;
  selectedMeshIds: string[];
  materialAssignments: MaterialAssignments;       // meshName → assignment
  specImages: Record<string, string | null>;      // specId → image_url
  scene: SceneSettings;
  onMeshesLoaded: (meshes: MeshInfo[]) => void;
  onMeshClick: (meshId: string | null, additive: boolean) => void;
  canvasRef?: React.RefObject<{ capture: () => string }>;
}

// ── Tone mapping map ──────────────────────────────────────────────────────────

const TONE_MAPPING: Record<ToneMappingOption, THREE.ToneMapping> = {
  agx:     THREE.AgXToneMapping,
  aces:    THREE.ACESFilmicToneMapping,
  neutral: THREE.NeutralToneMapping,
};

// ── Renderer setup ────────────────────────────────────────────────────────────

function RendererConfig({
  toneMapping,
  exposure,
}: {
  toneMapping: ToneMappingOption;
  exposure: number;
}) {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMapping = TONE_MAPPING[toneMapping];
    gl.toneMappingExposure = exposure;
  }, [gl, toneMapping, exposure]);
  return null;
}

// ── Camera framing ────────────────────────────────────────────────────────────

function CameraFramer({ meshUrl }: { meshUrl: string }) {
  const { scene, camera } = useThree();
  const framed = useRef(false);

  useFrame(() => {
    if (framed.current) return;
    const box = new THREE.Box3().setFromObject(scene);
    if (box.isEmpty()) return;

    framed.current = true;
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);

    const fov = (camera as THREE.PerspectiveCamera).fov * (Math.PI / 180);
    const distance = (sphere.radius / Math.sin(fov * 0.5)) * 1.4;
    const dir = new THREE.Vector3(1, 0.7, 1).normalize();

    camera.position.copy(sphere.center).addScaledVector(dir, distance);
    (camera as THREE.PerspectiveCamera).near = sphere.radius * 0.01;
    (camera as THREE.PerspectiveCamera).far  = sphere.radius * 100;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  });

  // Reset framing when URL changes
  useEffect(() => { framed.current = false; }, [meshUrl]);

  return null;
}

// ── Texture cache ─────────────────────────────────────────────────────────────

const textureCache = new Map<string, THREE.Texture>();

function loadTexture(url: string): THREE.Texture {
  if (textureCache.has(url)) return textureCache.get(url)!;
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(url, tex);
  return tex;
}

// ── Format-specific normalisation passes ──────────────────────────────────────
//
// FBX and OBJ are not PBR-aligned out of the box. These passes bring them into
// the same shape as a GLB so the rest of the pipeline (texture application,
// selection, IBL lighting) works identically across formats.

function applyScaleHeuristic(group: THREE.Group) {
  // FBX/OBJ are commonly authored in cm; Three works in metres.
  const sphere = new THREE.Sphere();
  new THREE.Box3().setFromObject(group).getBoundingSphere(sphere);
  if (sphere.radius > 50) group.scale.setScalar(0.01);
}

// Strip all source materials and replace with a uniform neutral PBR. The user
// assigns Ida specs from the panel — embedded materials/textures are not used.
function stripMaterials(group: THREE.Group) {
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (!obj.geometry.attributes.normal) obj.geometry.computeVertexNormals();
    obj.material = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.55,
      metalness: 0.0,
    });
  });
}

function normaliseFbx(group: THREE.Group) {
  applyScaleHeuristic(group);
  stripMaterials(group);
}

function normaliseObj(group: THREE.Group) {
  applyScaleHeuristic(group);
  stripMaterials(group);
}

function normaliseGlb(group: THREE.Group) {
  stripMaterials(group);
}

// ── Format-specific loader components ─────────────────────────────────────────

interface ModelLoaderProps {
  url: string;
  selectedMeshIds: string[];
  materialAssignments: MaterialAssignments;
  specImages: Record<string, string | null>;
  onMeshesLoaded: (meshes: MeshInfo[]) => void;
  onMeshClick: (id: string | null, additive: boolean) => void;
}

function GLBModel(props: ModelLoaderProps) {
  const { scene } = useGLTF(props.url);
  const group = scene as THREE.Group;
  if (!group.userData.__normalised) {
    normaliseGlb(group);
    group.userData.__normalised = true;
  }
  return <ModelInner group={group} {...props} />;
}

function FBXModel(props: ModelLoaderProps) {
  const group = useFBX(props.url) as THREE.Group;
  if (!group.userData.__normalised) {
    normaliseFbx(group);
    group.userData.__normalised = true;
  }
  return <ModelInner group={group} {...props} />;
}

function OBJModel(props: ModelLoaderProps) {
  const group = useLoader(OBJLoader, props.url) as unknown as THREE.Group;
  if (!group.userData.__normalised) {
    normaliseObj(group);
    group.userData.__normalised = true;
  }
  return <ModelInner group={group} {...props} />;
}

function Model({ format, ...props }: ModelLoaderProps & { format: ModelFormat }) {
  if (format === "fbx") return <FBXModel {...props} />;
  if (format === "obj") return <OBJModel {...props} />;
  return <GLBModel {...props} />;
}

// ── Inner: shared across all formats — operates on a normalised Group ─────────

function ModelInner({
  group,
  selectedMeshIds,
  materialAssignments,
  specImages,
  onMeshesLoaded,
  onMeshClick,
}: {
  group: THREE.Group;
  selectedMeshIds: string[];
  materialAssignments: MaterialAssignments;
  specImages: Record<string, string | null>;
  onMeshesLoaded: (meshes: MeshInfo[]) => void;
  onMeshClick: (id: string | null, additive: boolean) => void;
}) {
  const scene = group;
  const { gl } = useThree();
  const meshesExtracted = useRef(false);

  // Extract meshes and run post-load passes whenever the group changes
  useEffect(() => {
    meshesExtracted.current = false;
  }, [group]);

  useEffect(() => {
    if (meshesExtracted.current) return;
    meshesExtracted.current = true;

    const found: MeshInfo[] = [];
    const maxAniso = gl.capabilities.getMaxAnisotropy();

    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mat = obj.material as THREE.MeshStandardMaterial;
      if (mat?.map) mat.map.anisotropy = maxAniso;
      found.push({ id: obj.uuid, name: obj.name || obj.uuid, meshRef: obj });
    });

    onMeshesLoaded(found);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  // Apply textures (and per-mesh transforms) from spec images
  useEffect(() => {
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const raw = materialAssignments[obj.name] ?? materialAssignments[obj.uuid];
      const assignment = readAssignment(raw);

      const mat = (obj.material as THREE.MeshStandardMaterial).clone();

      if (assignment) {
        const imageUrl = specImages[assignment.specId];
        if (imageUrl) {
          // Clone the cached texture so each mesh has independent repeat/rotation
          const baseTex = loadTexture(imageUrl);
          const tex = baseTex.clone();
          tex.needsUpdate = true;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.center.set(0.5, 0.5);
          tex.repeat.set(assignment.scaleX, assignment.scaleY);
          tex.rotation = (assignment.rotation * Math.PI) / 180;
          mat.map = tex;
          // Brightness: albedo multiplier (0.2–1). Three's color clamps at 1.
          const b = Math.max(0, Math.min(1, assignment.brightness));
          mat.color.setScalar(b);
        } else {
          mat.map = null;
          mat.color.setScalar(0.8 * Math.max(0, Math.min(1, assignment.brightness)));
        }
        mat.roughness = assignment.roughness;
        mat.metalness = assignment.metalness;
      } else {
        // No assignment — neutral default
        mat.map = null;
        mat.color.set(0xeeeeee);
        mat.roughness = 0.55;
        mat.metalness = 0;
      }
      mat.needsUpdate = true;
      obj.material = mat;
    });
  }, [scene, materialAssignments, specImages]);

  // Wireframe outline on selected mesh
  useEffect(() => {
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const isSelected = selectedMeshIds.includes(obj.uuid) || selectedMeshIds.includes(obj.name);

      // Remove any existing outline child
      const existing = obj.children.find((c) => (c as THREE.Mesh).userData.__outline);
      if (existing) obj.remove(existing);

      if (isSelected) {
        const outline = new THREE.Mesh(
          obj.geometry,
          new THREE.MeshBasicMaterial({
            color: 0xffde28,
            wireframe: true,
            transparent: true,
            opacity: 0.45,
          }),
        );
        outline.userData.__outline = true;
        outline.scale.setScalar(1.002);
        obj.add(outline);
      }
    });
  }, [scene, selectedMeshIds]);

  const handleClick = useCallback(
    (e: { stopPropagation: () => void; object: THREE.Object3D; nativeEvent?: MouseEvent }) => {
      e.stopPropagation();
      const mesh = e.object instanceof THREE.Mesh ? e.object : null;
      if (!mesh) return;
      const ne = e.nativeEvent;
      const additive = !!(ne && (ne.shiftKey || ne.metaKey || ne.ctrlKey));
      onMeshClick(mesh.uuid, additive);
    },
    [onMeshClick],
  );

  return (
    <primitive
      object={scene}
      onClick={handleClick}
    />
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function StudioCanvas({
  meshUrl,
  format,
  selectedMeshIds,
  materialAssignments,
  specImages,
  scene,
  onMeshesLoaded,
  onMeshClick,
  canvasRef,
}: StudioCanvasProps) {
  const glRef = useRef<THREE.WebGLRenderer | null>(null);

  // Expose capture method to parent
  const captureCanvas = useCallback(() => {
    if (!glRef.current) return "";
    glRef.current.render(
      glRef.current.domElement as unknown as THREE.Scene,
      new THREE.PerspectiveCamera(),
    );
    return glRef.current.domElement.toDataURL("image/png");
  }, []);

  useEffect(() => {
    if (canvasRef) {
      (canvasRef as React.MutableRefObject<{ capture: () => string }>).current = {
        capture: captureCanvas,
      };
    }
  }, [canvasRef, captureCanvas]);

  const bg = BG_COLORS[scene.background];

  return (
    <div className="relative w-full h-full">
      <Canvas
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => { glRef.current = gl; }}
        onPointerMissed={() => onMeshClick(null, false)}
        dpr={[1, 2]}
        shadows
        camera={{ position: [3, 2, 3], fov: 35 }}
        style={{ background: bg }}
      >
        <RendererConfig toneMapping={scene.toneMapping} exposure={scene.exposure} />
        <CameraFramer meshUrl={meshUrl} />

        <color attach="background" args={[bg]} />
        <Environment preset="studio" background={false} environmentIntensity={scene.envIntensity} />
        {scene.keyLight > 0 && (
          <directionalLight position={[5, 8, 4]} intensity={scene.keyLight} castShadow />
        )}
        {scene.shadowStrength > 0 && (
          <ContactShadows opacity={scene.shadowStrength} blur={2.5} scale={10} far={4} />
        )}
        {scene.showGrid && (
          <Grid
            cellSize={0.5}
            sectionSize={2}
            fadeDistance={20}
            infiniteGrid
            cellColor={scene.background === "dark" ? "#444" : "#D8D6D2"}
            sectionColor={scene.background === "dark" ? "#777" : "#9A9590"}
          />
        )}
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} />

        <Suspense fallback={null}>
          <Model
            url={meshUrl}
            format={format}
            selectedMeshIds={selectedMeshIds}
            materialAssignments={materialAssignments}
            specImages={specImages}
            onMeshesLoaded={onMeshesLoaded}
            onMeshClick={onMeshClick}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
