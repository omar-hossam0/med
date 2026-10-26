import type { Metadata } from "next";
import { MyDoctorsModule } from "@/components/patient/my-doctors/MyDoctorsModule";

export const metadata: Metadata = {
  title: "My Doctors – Medora",
  description:
    "Browse Medora medical departments, search for doctors and review their professional profiles before booking an appointment.",
};

export default function PatientMyDoctorsPage() {
  return <MyDoctorsModule />;
}
