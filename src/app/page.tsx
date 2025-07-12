"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DataTable } from "@/components/data-table";
import { patientColumns, Patient } from "@/components/patient-columns";

const CreatePatient = () => {
  return (
    <button className="bg-blue-500 text-white p-2 rounded-md cursor-pointer">
      <Link href="/create-patient">Create patient</Link>
    </button>
  );
};

const ListPatients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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
      <DataTable columns={patientColumns} data={patients} />
    </div>
  );
};

export default function Home() {
  return (
    <main className="p-10">
      <CreatePatient />
      <ListPatients />
    </main>
  );
}
