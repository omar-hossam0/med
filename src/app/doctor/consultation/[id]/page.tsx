import { ConsultationRun } from "@/components/doctor/consultation/ConsultationRun";

export default function DoctorConsultationPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { step?: string };
}) {
  return (
    <ConsultationRun
      appointmentId={params.id}
      requestedStep={searchParams?.step ?? null}
    />
  );
}
