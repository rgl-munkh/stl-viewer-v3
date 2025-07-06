'use client'

import Link from "next/link"
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const CreatePatient = () => {
  return (
    <button className="bg-blue-500 text-white p-2 rounded-md cursor-pointer">
      <Link href="/create-patient">
        Create patient
      </Link>
    </button>
  )
}

type Patient = {
  id: number;
  name: string;
  age: number;
  models: { "stl-origin": string, "stl-transformed": string };
};

const ListPatients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    const fetchPatients = async () => {
      setLoading(true);
      const { data, error } = await supabase.from("patients").select();
      if (!error && data) {
        setPatients(data as Patient[]);
      }
      setLoading(false);
    };
    fetchPatients();
  }, []);

  if (loading) return <div>Loading patients...</div>;
  if (patients.length === 0) return <div>No patients found.</div>;


  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-2">Patients List</h2>
      <table className="min-w-full border">
        <thead>
          <tr>
            <th className="border px-2 py-1">ID</th>
            <th className="border px-2 py-1">Name</th>
            <th className="border px-2 py-1">Age</th>
            <th className="border px-2 py-1">Edit</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p) => {
            const stlUrl = p.models["stl-origin"];
            return (
              <tr key={p.id}>
                <td className="border px-2 py-1">{p.id}</td>
                <td className="border px-2 py-1">{p.name}</td>
                <td className="border px-2 py-1">{p.age}</td>
                <td className="border px-2 py-1 space-x-2">
                  <button
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 cursor-pointer"
                    onClick={() => router.push(`/place-origin?file=${encodeURIComponent(p.models["stl-origin"])}&id=${p.id}`)}
                  >
                    Place origin
                  </button>
                  <button
                    className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 cursor-pointer"
                    onClick={() => router.push(`/cut-mesh?file=${encodeURIComponent(p.models["stl-transformed"])}&id=${p.id}`)}
                  >
                    Cut mesh
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default function Home() {
  return (
    <main className="p-10">
      <CreatePatient />
      <ListPatients />
    </main>
  )
}
