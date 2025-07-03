"use client";

import { useRef, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  GizmoHelper,
  GizmoViewport,
  TransformControls,
} from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { supabase } from "@/lib/supabase";
import * as THREE from "three";

export default function PlaceOriginPage() {
  const router = useRouter();
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [mode, setMode] = useState<"translate" | "rotate" | "scale">(
    "translate"
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const searchParams = useSearchParams();
  const fileName = searchParams.get("file");

  useEffect(() => {
    if (!fileName) return;
    const fetchAndParseSTL = async () => {
      try {
        // 1. Get signed URL from Supabase
        const { data, error } = await supabase.storage
          .from(process.env.NEXT_PUBLIC_BUCKET_NAME!)
          .createSignedUrl(`/${fileName}`, 60);

        if (error || !data?.signedUrl) {
          alert("Could not get signed URL for file.");
          return;
        }
        const signedUrl = data.signedUrl;

        // 2. Fetch the file as a Blob
        const response = await fetch(signedUrl);
        if (!response.ok) {
          alert("Failed to fetch STL file: " + response.statusText);
          return;
        }
        const arrayBuffer = await response.arrayBuffer();

        // 3. Parse as STL and set geometry
        const loader = new STLLoader();
        const geo = loader.parse(arrayBuffer);
        geo.computeVertexNormals();
        geo.computeBoundingBox();

        setGeometry(geo.clone());
      } catch (error) {
        console.error("Error loading STL file:", error);
        alert("Error loading STL file: " + (error as Error).message);
      }
    };
    fetchAndParseSTL();
  }, [fileName]);

  const saveTransformedMesh = async () => {
    if (!meshRef.current || !fileName) {
      alert("No mesh to save or missing file name");
      return;
    }

    setIsSaving(true);
    try {
      // Get the transformed geometry
      const transformedGeometry = meshRef.current.geometry.clone();
      
      // Apply the mesh's world matrix to the geometry
      const matrix = meshRef.current.matrixWorld;
      transformedGeometry.applyMatrix4(matrix);

      // Export as STL
      const { STLExporter } = await import("three/examples/jsm/exporters/STLExporter.js");
      const exporter = new STLExporter();
      const mesh = new THREE.Mesh(transformedGeometry);
      const stlString = exporter.parse(mesh);

      // Create blob and upload to Supabase
      const blob = new Blob([stlString], { type: "application/sla" });
      const transformedFileName = `transformed_${fileName}`;

      const { error } = await supabase.storage
        .from(process.env.NEXT_PUBLIC_BUCKET_NAME!)
        .upload(`/${transformedFileName}`, blob, {
          contentType: "application/sla",
          upsert: true,
        });

      if (error) {
        alert("Failed to save transformed mesh: " + error.message);
      } else {
        alert("Transformed mesh saved successfully!");
        // Optionally redirect to cutting page with the transformed file
        router.push(`/cut-mesh?file=${transformedFileName}`);
      }
    } catch (error) {
      console.error("Error saving transformed mesh:", error);
      alert("Error saving transformed mesh: " + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full h-[calc(100vh-120px)] border border-gray-300 rounded mt-4">
      {/* Control Panel */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("translate")}
              className={`px-3 py-1 rounded ${
                mode === "translate" ? "bg-blue-500 text-white" : "bg-gray-200"
              }`}
            >
              Move
            </button>
            <button
              onClick={() => setMode("rotate")}
              className={`px-3 py-1 rounded ${
                mode === "rotate" ? "bg-blue-500 text-white" : "bg-gray-200"
              }`}
            >
              Rotate
            </button>
            <button
              onClick={() => setMode("scale")}
              className={`px-3 py-1 rounded ${
                mode === "scale" ? "bg-blue-500 text-white" : "bg-gray-200"
              }`}
            >
              Scale
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveTransformedMesh}
              disabled={isSaving}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
            >
              {isSaving ? "Saving..." : "Save Transformed Mesh"}
            </button>
          </div>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas camera={{ position: [50, 50, 100], fov: 60 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} />

        <OrbitControls enabled={!isDragging} />

        {/* STL Mesh with TransformControls */}
        {geometry && (
          <TransformControls
            mode={mode}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
          >
            <mesh ref={meshRef} geometry={geometry}>
              <meshStandardMaterial color="#4f46e5" wireframe={false} />
            </mesh>
          </TransformControls>
        )}

        {/* Scene helpers */}
        <axesHelper args={[200]} />
        <gridHelper args={[1000, 100]} />
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport
            axisColors={["#ff2060", "#20df80", "#2080ff"]}
            labelColor="black"
          />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}
