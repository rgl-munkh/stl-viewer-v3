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
import { CSG } from "three-csg-ts";

export default function PlaceOriginAndCutPage() {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [mode, setMode] = useState<"translate" | "rotate" | "scale">(
    "translate"
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCuttingPreview, setShowCuttingPreview] = useState(false);
  const [cutSide, setCutSide] = useState<"positive" | "negative">("positive");

  const meshRef = useRef<THREE.Mesh>(null);
  const planeRef = useRef<THREE.Mesh>(null);
  const arrowHelperRef = useRef<THREE.ArrowHelper>(null);
  const cuttingBoxRef = useRef<THREE.Mesh>(null);

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

  // Update cutting preview when plane moves
  useEffect(() => {
    if (showCuttingPreview && planeRef.current && cuttingBoxRef.current) {
      updateCuttingPreview();
    }
  }, [showCuttingPreview]);

  const updateCuttingPreview = () => {
    if (!planeRef.current || !cuttingBoxRef.current) return;

    const plane = planeRef.current;
    const box = cuttingBoxRef.current;

    // Get plane's world position and normal
    const planePosition = new THREE.Vector3();
    const planeNormal = new THREE.Vector3(0, 0, 1);

    plane.getWorldPosition(planePosition);
    planeNormal.applyMatrix4(plane.matrixWorld).normalize();

    // Position cutting box
    const offset = cutSide === "positive" ? 500 : -500;
    const boxPosition = planePosition
      .clone()
      .add(planeNormal.clone().multiplyScalar(offset));

    box.position.copy(boxPosition);
    box.lookAt(planePosition.clone().add(planeNormal));

    // Update arrow helper
    if (arrowHelperRef.current) {
      arrowHelperRef.current.position.copy(planePosition);
      arrowHelperRef.current.setDirection(planeNormal);
    }
  };



  const cutMesh = async () => {
    if (!meshRef.current || !planeRef.current || !geometry) {
      alert("Missing required components for cutting");
      return;
    }

    setIsProcessing(true);

    try {
      // Small delay to show loading state
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get plane's world position and normal
      const planePosition = new THREE.Vector3();
      const planeNormal = new THREE.Vector3(0, 0, 1);

      planeRef.current.getWorldPosition(planePosition);
      planeNormal.applyMatrix4(planeRef.current.matrixWorld).normalize();

      // Create cutting box (half-space)
      const size = 2000; // Large enough to encompass entire mesh
      const cutterGeo = new THREE.BoxGeometry(size, size, size);
      const cutterMat = new THREE.MeshStandardMaterial({ color: "red" });
      const cutterMesh = new THREE.Mesh(cutterGeo, cutterMat);

      // Position the cutting box
      const offset = cutSide === "positive" ? size / 2 : -size / 2;
      const cutterPosition = planePosition
        .clone()
        .add(planeNormal.clone().multiplyScalar(offset));

      cutterMesh.position.copy(cutterPosition);
      cutterMesh.lookAt(planePosition.clone().add(planeNormal));

      // Create a copy of the original mesh with world transform applied
      const meshCopy = new THREE.Mesh(
        geometry.clone(),
        new THREE.MeshStandardMaterial()
      );
      meshCopy.applyMatrix4(meshRef.current.matrixWorld.clone());

      // Convert both to CSG
      const targetCSG = CSG.fromMesh(meshCopy);
      const cutterCSG = CSG.fromMesh(cutterMesh);

      // Perform CSG operation
      const resultCSG = targetCSG.subtract(cutterCSG);

      // Convert back to mesh
      const resultMesh = resultCSG.toMesh(
        meshRef.current.matrix,
        meshRef.current.material
      );
      resultMesh.geometry.computeVertexNormals();
      resultMesh.geometry.computeBoundingBox();

      const newGeo = resultMesh.geometry;

      // Cleanup old geometry
      geometry.dispose();
      meshCopy.geometry.dispose();
      meshCopy.material.dispose();
      cutterGeo.dispose();
      cutterMat.dispose();

      // Update geometry
      setGeometry(newGeo);

      // Reset mesh transform since the result is positioned correctly
      meshRef.current.position.set(0, 0, 0);
      meshRef.current.rotation.set(0, 0, 0);
      meshRef.current.scale.set(1, 1, 1);

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
              onClick={() => setShowCuttingPreview(!showCuttingPreview)}
              className={`px-3 py-1 rounded ${
                showCuttingPreview ? "bg-green-500 text-white" : "bg-gray-200"
              }`}
            >
              Preview Cut
            </button>

            <select
              value={cutSide}
              onChange={(e) =>
                setCutSide(e.target.value as "positive" | "negative")
              }
              className="px-3 py-1 rounded border"
            >
              <option value="positive">Cut Positive Side</option>
              <option value="negative">Cut Negative Side</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={cutMesh}
              disabled={isProcessing}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:bg-gray-400"
            >
              {isProcessing ? "Cutting..." : "Cut Mesh"}
            </button>
          </div>
        </div>

        {isProcessing && (
          <div className="text-blue-600 font-medium">
            Processing CSG operation... This may take a moment.
          </div>
        )}
      </div>

      {/* 3D Canvas */}
      <Canvas camera={{ position: [50, 50, 100], fov: 60 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} />

        <OrbitControls enabled={!isDragging} />

        {/* Cutting Plane with TransformControls */}
        <TransformControls
          mode={mode}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onObjectChange={updateCuttingPreview}
        >
          <mesh ref={planeRef} position={[0, 0, 0]} rotation={[0, 0, 0]}>
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial
              color="orange"
              transparent
              opacity={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
        </TransformControls>

        {/* STL Mesh with TransformControls */}
        {geometry && (
          <TransformControls
            mode={mode}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
          >
            <mesh ref={meshRef} geometry={geometry}>
              <meshStandardMaterial
                color="#4f46e5"
                wireframe={false}
                transparent={showCuttingPreview}
                opacity={showCuttingPreview ? 0.7 : 1.0}
              />
            </mesh>
          </TransformControls>
        )}

        {/* Cutting Preview Box */}
        {showCuttingPreview && (
          <mesh ref={cuttingBoxRef}>
            <boxGeometry args={[1000, 1000, 1000]} />
            <meshStandardMaterial
              color="red"
              transparent
              opacity={0.2}
              wireframe={true}
            />
          </mesh>
        )}

        {/* Plane Normal Arrow */}
        {planeRef.current && (
          <arrowHelper
            ref={arrowHelperRef}
            args={[
              new THREE.Vector3(0, 0, 1), // direction
              new THREE.Vector3(0, 0, 0), // origin
              50, // length
              0x00ff00, // color
            ]}
          />
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
