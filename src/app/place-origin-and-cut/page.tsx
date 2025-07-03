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

export default function PlaceOriginAndCutPage() {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [mode, setMode] = useState<"translate" | "rotate" | "scale">(
    "translate"
  );
  const [isDragging, setIsDragging] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);
  const searchParams = useSearchParams();
  const fileName = searchParams.get("file");

  useEffect(() => {
    if (!fileName) return;
    const fetchAndParseSTL = async () => {
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
      setGeometry(geo);
    };
    fetchAndParseSTL();
  }, [fileName]);

  return (
    <div className="w-full h-[calc(100vh-120px)] border border-gray-300 rounded mt-4">
      <div className="space-x-2 mb-2">
        <button onClick={() => setMode("translate")}>Move</button>
        <button onClick={() => setMode("rotate")}>Rotate</button>
        <button onClick={() => setMode("scale")}>Scale</button>
      </div>
      <Canvas camera={{ position: [50, 50, 100], fov: 60 }}>
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <OrbitControls enabled={!isDragging} />
        {geometry && (
          <TransformControls
            mode={mode}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
          >
            <mesh ref={meshRef} geometry={geometry}>
              <meshStandardMaterial color="#4f46e5" />
            </mesh>
          </TransformControls>
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
