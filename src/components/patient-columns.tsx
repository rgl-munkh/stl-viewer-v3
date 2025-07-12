import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export type Patient = {
  id: number;
  name: string;
  age: number;
  models: { "stl-origin": string; "stl-transformed": string };
};

export const patientColumns: ColumnDef<Patient>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => row.getValue("id"),
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => row.getValue("name"),
  },
  {
    accessorKey: "age",
    header: "Age",
    cell: ({ row }) => row.getValue("age"),
  },
  {
    id: "actions",
    header: "Edit",
    cell: ({ row }) => {
      const patient = row.original;
      const ActionButtons = () => {
        const router = useRouter();
        return (
          <div className="space-x-2">
            <Button
              variant="default"
              className="bg-green-500 hover:bg-green-600"
              onClick={() =>
                router.push(
                  `/place-origin?file=${encodeURIComponent(
                    patient.models["stl-origin"]
                  )}&id=${patient.id}`
                )
              }
            >
              Place origin
            </Button>
            <Button
              variant="default"
              className="bg-yellow-500 hover:bg-yellow-600"
              onClick={() =>
                router.push(
                  `/cut-mesh?file=${encodeURIComponent(
                    patient.models["stl-transformed"]
                  )}&id=${patient.id}`
                )
              }
            >
              Cut mesh
            </Button>
          </div>
        );
      };
      return <ActionButtons />;
    },
  },
];
