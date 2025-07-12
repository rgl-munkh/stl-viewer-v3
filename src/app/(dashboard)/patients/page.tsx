"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DataTable } from "@/components/data-table";
import { patientColumns, Patient } from "@/components/patient-columns";
import { Button } from "@/components/ui/button";
import { ChevronRightIcon } from "lucide-react";

const CreatePatient = () => {
  return (
    <div className="flex justify-end">
      <Button variant="outline" className="cursor-pointer">
        <Link href="/patients/create" className="flex items-center gap-2">
          <span>Create patient</span>
          <ChevronRightIcon />
        </Link>
      </Button>
    </div>
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

  return <DataTable columns={patientColumns} data={patients} />;
};

export default function PatientsPage() {
  return (
    <main className="w-full">
      <h1 className="text-2xl font-semibold mb-2">Patients List</h1>
      <div className="mt-10 flex flex-col gap-4">
        <CreatePatient />
        <ListPatients />
      </div>
    </main>
  );
}
