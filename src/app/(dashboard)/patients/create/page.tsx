"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { useState } from "react";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import * as THREE from "three";
import { uploadToSupabase } from "@/lib/filemanager";
import { supabase } from "@/lib/supabase";
import { nanoid } from "nanoid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function STLMesh({ geometry }: { geometry: THREE.BufferGeometry | null }) {
  if (!geometry) return null;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#4f46e5" />
    </mesh>
  );
}

const Page = () => {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [patientName, setPatientName] = useState<string>("");
  const [patientAge, setPatientAge] = useState<number | "">("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !file.name.toLowerCase().endsWith(".stl")) {
      alert("Please select a valid STL file");
      return;
    }
    setFile(file);

    // parse the file
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

  const submitPatient = async () => {
    try {
      if (!patientName || !patientAge || !file) {
        alert("Please provide patient name, age, and upload an STL file.");
        return;
      }
      setIsSubmitting(true);
      const patientId = nanoid();
      // Upload STL file to patient folder
      const filePath = `${patientId}/${file.name}`;
      const response = await uploadToSupabase(file, filePath);
      if (response.error) {
        alert("Upload failed: " + response.error.message);
        setIsSubmitting(false);
        return;
      }

      // Insert patient record into Supabase with nanoid and folder path
      await supabase.from("patients").insert([
        {
          id: patientId,
          name: patientName,
          age: Number(patientAge),
          models: { "stl-origin": response.publicUrl },
        },
      ]);
      setIsSubmitting(false);

      alert("Patient and STL saved!");
      setPatientName("");
      setPatientAge("");
      setFile(null);
      setGeometry(null);
    } catch (error) {
      alert("Failed to save patient: " + error);
      setIsSubmitting(false);
    }
  };

  // TODO: Implement auto correction
  const autoCorrection = async () => {
    throw new Error("Not implemented");
  };

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-6">Create patient</h1>

      <div className="mb-4 flex gap-4">
        <Input
          type="text"
          placeholder="Patient Name"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          className="border rounded px-2 py-1 w-48"
        />
        <Input
          type="number"
          placeholder="Age"
          value={patientAge}
          onChange={(e) => setPatientAge(Number(e.target.value))}
          className="border rounded px-2 py-1 w-48"
          min={0}
        />
        <Input
          type="file"
          onChange={onFileInputChange}
          accept=".stl"
          className="border rounded px-2 py-1 w-48"
        />
      </div>

      <div className="space-x-2">
        <Button
          type="button"
          onClick={submitPatient}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : "Save STL & Patient"}
        </Button>
      </div>

      <div className="flex justify-end">
        <Button
          className="bg-green-500 hover:bg-green-600"
          onClick={autoCorrection}
        >
          Auto correction
        </Button>
      </div>

      <div className="w-full h-[calc(100vh-240px)] border border-gray-300 rounded mt-4">
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
