"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { useRef, useState } from "react";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { supabase } from "@/lib/supabase";
import * as THREE from "three";
import { useRouter } from "next/navigation";

function STLMesh({ geometry }: { geometry: THREE.BufferGeometry | null }) {
  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#4f46e5" />
    </mesh>
  );
}

const Page = () => {
  const router = useRouter();
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onUpload = () => {
    if (inputRef.current) inputRef.current.click();
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setFile(file);
    if (!file || !file.name.endsWith(".stl")) {
      alert("Please select a valid STL file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = (e.target as FileReader).result;
      if (!result) return;
      const loader = new STLLoader();
      const geo = loader.parse(result as ArrayBuffer);
      setGeometry(geo);
    };
    reader.readAsArrayBuffer(file);
  };

  const onUploadToSupabase = async () => {
    if (!file) {
      alert("Please upload a file first");
      return;
    }

    // Upload the STL file to the 'models' bucket in Supabase Storage
    const { error } = await supabase.storage
      .from(process.env.NEXT_PUBLIC_BUCKET_NAME!)
      .upload(`/${file.name}`, file, {
        contentType: "application/sla", // MIME type for STL
        upsert: true, // Overwrite if file exists
      });

    if (error) {
      alert("Upload failed: " + error.message);
    } else {
      router.push(`/place-origin?file=${file.name}`);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">STL Viewer</h1>
      <input
        type="file"
        style={{ display: "none" }}
        ref={inputRef}
        onChange={onFileInputChange}
        accept=".stl"
      />

      <div className="space-x-2">
        <button
          type="button"
          onClick={onUpload}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Upload STL from local
        </button>
        <button
          type="button"
          onClick={onUploadToSupabase}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Save STL
        </button>
      </div>
      <div className="w-full h-[calc(100vh-120px)] border border-gray-300 rounded mt-4">
        <Canvas camera={{ position: [50, 50, 100], fov: 60 }}>
          <ambientLight />
          <pointLight position={[10, 10, 10]} />
          <OrbitControls />
          {geometry && <STLMesh geometry={geometry} />}
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
    </div>
  );
};

export default Page;
