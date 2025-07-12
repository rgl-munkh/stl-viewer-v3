"use client";

import { useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import { STLExporter } from "three/examples/jsm/Addons.js";
import { uploadToSupabase } from "@/lib/filemanager";

export default function PlaceOriginPage() {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [mode, setMode] = useState<"translate" | "rotate" | "scale">(
    "translate"
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const searchParams = useSearchParams();
  const stlUrl = searchParams.get("file");
  const patientId = searchParams.get("id");

  // Extract file name from URL
  const fileName = stlUrl ? stlUrl.split("/").pop() : null;

  // Load STL file from URL
  useEffect(() => {
    if (!stlUrl) return;

    const loadSTL = async () => {
      try {
        const response = await fetch(stlUrl);
        if (!response.ok) {
          alert("Failed to fetch STL file: " + response.statusText);
          return;
        }
        const arrayBuffer = await response.arrayBuffer();
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

    loadSTL();
  }, [stlUrl]);

  // TODO: Clean up this function
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
      const exporter = new STLExporter();
      const mesh = new THREE.Mesh(transformedGeometry);
      const stlString = exporter.parse(mesh);

      // Create blob and upload to Supabase
      const transformedFileName = `transformed_${fileName}`;
      const file = new File([stlString], transformedFileName, {
        type: "application/sla",
      });

      // Upload the transformed mesh to Supabase

      const filePath = `${patientId}/${file.name}`;
      const response = await uploadToSupabase(file, filePath);

      if (response.error) {
        alert("Failed to upload transformed mesh: " + response.error.message);
        return;
      }

      // Fetch current models
      const { data: patientData } = await supabase
        .from("patients")
        .select("models")
        .eq("id", patientId)
        .single();

      // Merge new stl-transformed with public URL
      const newModels = {
        ...patientData?.models,
        "stl-origin": stlUrl,
        "stl-transformed": response.publicUrl,
      };
      // Update patient record
      await supabase
        .from("patients")
        .update({ models: newModels })
        .eq("id", patientId);
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
