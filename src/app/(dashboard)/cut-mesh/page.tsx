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
import { STLExporter } from "three/examples/jsm/Addons.js";
import { supabase } from "@/lib/supabase";
import * as THREE from "three";
import { CSG } from "three-csg-ts";
import { uploadToSupabase } from "@/lib/filemanager";

export default function PlaceOriginAndCutPage() {
  const [mode, setMode] = useState<"translate" | "rotate" | "scale">(
    "translate"
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const xPlaneRef = useRef<THREE.Mesh>(null);
  const yPlaneRef = useRef<THREE.Mesh>(null);

  const searchParams = useSearchParams();
  const patientId = searchParams.get("id");
  const stlUrl = searchParams.get("file");

  // Extract file name from URL
  const fileName = stlUrl ? stlUrl.split("/").pop() : null;

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

  const cutMesh = async () => {
    if (
      !meshRef.current ||
      !xPlaneRef.current ||
      !yPlaneRef.current ||
      !geometry
    ) {
      alert("Missing required components for cutting");
      return;
    }

    setIsProcessing(true);

    try {
      const meshCopy = new THREE.Mesh(
        geometry.clone(),
        new THREE.MeshStandardMaterial()
      );
      meshCopy.applyMatrix4(meshRef.current.matrixWorld.clone());
      let resultCSG = CSG.fromMesh(meshCopy);

      const cutWithPlane = (
        planeRef: React.RefObject<THREE.Mesh | null>,
        normal: THREE.Vector3
      ) => {
        const position = new THREE.Vector3();
        const planeNormal = normal.clone();
        planeRef.current!.getWorldPosition(position);
        planeNormal.applyMatrix4(planeRef.current!.matrixWorld).normalize();

        const size = 2000;
        const cutter = new THREE.Mesh(
          new THREE.BoxGeometry(size, size, size),
          new THREE.MeshStandardMaterial()
        );

        const offset = size / 2;
        const cutterPosition = position
          .clone()
          .add(planeNormal.clone().multiplyScalar(offset));
        cutter.position.copy(cutterPosition);
        cutter.lookAt(position.clone().add(planeNormal));

        const cutterCSG = CSG.fromMesh(cutter);
        resultCSG = resultCSG.subtract(cutterCSG);
      };

      cutWithPlane(xPlaneRef, new THREE.Vector3(0, 0, 1));
      cutWithPlane(yPlaneRef, new THREE.Vector3(0, 1, 0));

      const resultMesh = resultCSG.toMesh(
        meshRef.current.matrix,
        meshRef.current.material
      );
      resultMesh.geometry.computeVertexNormals();
      resultMesh.geometry.computeBoundingBox();

      // Update the geometry state with the result
      setGeometry(resultMesh.geometry.clone());

      // Clean up old geometry
      geometry.dispose();
      meshCopy.geometry.dispose();
      meshCopy.material.dispose();

      // Reset mesh transform
      if (meshRef.current) {
        meshRef.current.position.set(0, 0, 0);
        meshRef.current.rotation.set(0, 0, 0);
        meshRef.current.scale.set(1, 1, 1);
      }

      console.log("Cut operation completed successfully");
    } catch (error) {
      console.error("CSG operation failed:", error);
      alert(
        "Cut operation failed. The geometry might be too complex or invalid."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const saveCutMesh = async () => {
    if (!meshRef.current || !geometry || !patientId) {
      alert("No mesh, file, or patient id");
      return;
    }
    try {
      // Export mesh as STL
      const exporter = new STLExporter();
      const mesh = new THREE.Mesh(meshRef.current.geometry.clone());
      const stlString = exporter.parse(mesh);
      const cutFileName = fileName ? `cut_${fileName}` : `cut_mesh}.stl`;
      const file = new File([stlString], cutFileName, {
        type: "application/sla",
      });

      // Upload to Supabase
      const filePath = `${patientId}/${file.name}`;
      const response = await uploadToSupabase(file, filePath);

      // Fetch current models
      const { data: patientData, error: fetchError } = await supabase
        .from("patients")
        .select("models")
        .eq("id", patientId)
        .single();

      if (fetchError) {
        alert("Failed to fetch patient data: " + fetchError.message);
        return;
      }

      if (response.error) {
        alert("Failed to upload cut mesh: " + response.error.message);
        return;
      }

      const { error: updateError } = await supabase
        .from("patients")
        .update({
          models: { ...patientData?.models, "stl-cut": response.publicUrl },
        })
        .eq("id", patientId);
      if (updateError) {
        alert(
          "Cut mesh saved, but failed to update patient: " + updateError.message
        );
      } else {
        alert("Cut mesh saved and patient updated successfully!");
      }
    } catch (error) {
      alert("Error saving cut mesh: " + (error as Error).message);
    }
  };

  return (
    <div className="w-full h-[calc(100vh-120px)] border border-gray-300 rounded mt-4">
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
              onClick={cutMesh}
              disabled={isProcessing}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:bg-gray-400"
            >
              {isProcessing ? "Cutting..." : "Cut Mesh"}
            </button>
            <button
              onClick={saveCutMesh}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Save
            </button>
          </div>
        </div>

        {isProcessing && (
          <div className="text-blue-600 font-medium">
            Processing CSG operation... This may take a moment.
          </div>
        )}
      </div>

      <Canvas camera={{ position: [50, 50, 100], fov: 60 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} />

        <OrbitControls enabled={!isDragging} />

        {geometry && (
          <mesh ref={meshRef} geometry={geometry}>
            <meshStandardMaterial color="#4f46e5" wireframe={false} />
          </mesh>
        )}

        <mesh ref={xPlaneRef} position={[0, 0, -100]} rotation={[0, 0, 0]}>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial
            color="red"
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>

        <mesh
          ref={yPlaneRef}
          position={[0, 200, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial
            color="green"
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>

        {xPlaneRef.current && (
          <TransformControls
            mode={mode}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            object={xPlaneRef.current}
            showX={false}
            showY={false}
            showZ={true}
          />
        )}

        {yPlaneRef.current && (
          <TransformControls
            mode={mode}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            object={yPlaneRef.current}
          />
        )}

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
