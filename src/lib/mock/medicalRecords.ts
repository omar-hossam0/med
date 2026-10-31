/**
 * Typed demo data for the Patient Medical Records module.
 *
 * Frontend-only phase: these fixtures back every screen so the same visit,
 * doctor, prescription, result and report stay consistent across the module.
 * They are deliberately kept out of components and are never written to the
 * PostgreSQL database.
 */

export type MedicalDoctor = {
  id: string;
  name: string;
  specialty: string;
  facility: string;
};

export type VisitStatus = "Completed" | "Cancelled" | "Scheduled";
export type LabStatus = "Normal" | "Abnormal";
export type PrescriptionStatus = "Active" | "Completed";
export type ReportStatus = "Completed" | "Draft";
export type DocumentStatus =
  | "Patient Uploaded"
  | "Clinically Reviewed"
  | "Awaiting Review";

export type DocumentCategory =
  | "Medical Report"
  | "Lab Result"
  | "Imaging"
  | "Prescription"
  | "Other";

export type RecordType =
  | "visit"
  | "prescription"
  | "lab"
  | "imaging"
  | "document"
  | "report";

export type MedicalRecordEntry = {
  key: string;
  type: RecordType;
  id: string;
  title: string;
  subtitle: string;
  facility: string;
  date: string;
  time?: string;
  status: string;
  searchText: string;
};

export type VisitVitals = {
  height: string;
  weight: string;
  bloodPressure: string;
  heartRate: string;
  temperature: string;
};

export type VisitDiagnosis = {
  code: string;
  name: string;
  description: string;
  status: string;
};

export type Visit = {
  id: string;
  title: string;
  doctorId: string;
  facility: string;
  specialty: string;
  date: string;
  time: string;
  status: VisitStatus;
  summary: string;
  vitals: VisitVitals;
  diagnosis: VisitDiagnosis;
  medicationIds: string[];
  labIds: string[];
  imagingIds: string[];
  fileIds: string[];
  followUp: {
    recommendation: string;
    note: string;
  };
  reportId?: string;
};

export type Prescription = {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  startDate: string;
  endDate: string;
  refills: string;
  status: PrescriptionStatus;
  doctorId: string;
  facility: string;
  date: string;
  relatedVisitId?: string;
  instructions: string[];
  warning: string;
};

export type LabObservation = {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: LabStatus;
};

export type LabTrend = {
  label: string;
  unit: string;
  range: [number, number];
  points: { date: string; value: number }[];
};

export type LabResult = {
  id: string;
  name: string;
  date: string;
  facility: string;
  category: string;
  status: LabStatus;
  doctorId: string;
  relatedVisitId?: string;
  specimen: string;
  method: string;
  collectedAt: string;
  reportedAt: string;
  notes: string;
  results: LabObservation[];
  trends?: LabTrend[];
};

export type ImagingResult = {
  id: string;
  name: string;
  date: string;
  facility: string;
  modality: string;
  bodyPart: string;
  status: "Completed";
  doctorId: string;
  relatedVisitId?: string;
  accession: string;
  findings: string;
  impression: string;
  images: { id: string; label: string; src: string }[];
};

export type MedicalFile = {
  id: string;
  name: string;
  category: DocumentCategory;
  date: string;
  size: string;
  fileType: string;
  source: "patient" | "clinician";
  previewUrl?: string;
};

export type MedicalDocument = MedicalFile & {
  status: DocumentStatus;
  relatedVisitId?: string;
  doctorId?: string;
  deletable: boolean;
};

export type MedicalReport = {
  id: string;
  title: string;
  date: string;
  doctorId: string;
  specialty: string;
  facility: string;
  description: string;
  status: ReportStatus;
  relatedVisitId?: string;
  sections: { heading: string; body: string }[];
};

/* ------------------------------------------------------------------ */
/* Doctors                                                             */
/* ------------------------------------------------------------------ */

export const medicalDoctors: MedicalDoctor[] = [
  {
    id: "d-sarah",
    name: "Dr. Sarah Ahmed",
    specialty: "General Medicine",
    facility: "Medora Medical Center",
  },
  {
    id: "d-youssef",
    name: "Dr. Youssef Ali",
    specialty: "Cardiology",
    facility: "Medora Medical Center",
  },
  {
    id: "d-mona",
    name: "Dr. Mona Khaled",
    specialty: "Dermatology",
    facility: "Medora Medical Center",
  },
  {
    id: "d-karim",
    name: "Dr. Karim Mustafa",
    specialty: "Emergency Medicine",
    facility: "Medora Medical Center",
  },
  {
    id: "d-laila",
    name: "Dr. Laila Hassan",
    specialty: "Radiology",
    facility: "Cairo Radiology Center",
  },
];

export function getMedicalDoctor(id?: string | null): MedicalDoctor | undefined {
  if (!id) return undefined;
  return medicalDoctors.find((doctor) => doctor.id === id);
}

/* ------------------------------------------------------------------ */
/* Visits                                                              */
/* ------------------------------------------------------------------ */

export const visits: Visit[] = [
  {
    id: "v-general",
    title: "General Checkup Visit",
    doctorId: "d-sarah",
    facility: "Medora Medical Center",
    specialty: "General Medicine",
    date: "2026-10-20",
    time: "10:00 AM",
    status: "Completed",
    summary:
      "Routine general checkup. Patient is in good overall health. Advised to continue current lifestyle with regular exercise and balanced diet. Follow up in 6 months.",
    vitals: {
      height: "172 cm",
      weight: "72 kg",
      bloodPressure: "120/80 mmHg",
      heartRate: "78 bpm",
      temperature: "36.7 °C",
    },
    diagnosis: {
      code: "Z00.00",
      name: "General medical examination",
      description:
        "Routine checkup with no significant clinical findings. Continue preventive care and routine screening.",
      status: "Recorded",
    },
    medicationIds: ["rx-vitd", "rx-omega"],
    labIds: ["lab-cbc"],
    imagingIds: ["img-xray"],
    fileIds: ["f-general-summary", "f-cbc-report", "f-xray-report"],
    followUp: {
      recommendation: "Recommended follow up in 6 months.",
      note: "Routine checkup, no significant issues. No appointment confirmed yet.",
    },
    reportId: "rep-general",
  },
  {
    id: "v-followup",
    title: "Follow-up Visit",
    doctorId: "d-sarah",
    facility: "Medora Medical Center",
    specialty: "General Medicine",
    date: "2026-06-15",
    time: "09:30 AM",
    status: "Completed",
    summary:
      "Follow-up for blood pressure and lifestyle plan. Home readings remain stable. Continue the current plan and repeat a lipid panel before the next review.",
    vitals: {
      height: "172 cm",
      weight: "72 kg",
      bloodPressure: "118/78 mmHg",
      heartRate: "76 bpm",
      temperature: "36.6 °C",
    },
    diagnosis: {
      code: "I10",
      name: "Essential (primary) hypertension",
      description:
        "Blood pressure stable on the current plan. Continue lifestyle measures and home monitoring.",
      status: "Recorded",
    },
    medicationIds: ["rx-vitd"],
    labIds: ["lab-lipid"],
    imagingIds: ["img-ultrasound"],
    fileIds: ["f-followup-summary"],
    followUp: {
      recommendation: "Recheck blood pressure in 3 months.",
      note: "Home readings are stable. No appointment confirmed yet.",
    },
  },
  {
    id: "v-derm",
    title: "Dermatology Consultation",
    doctorId: "d-mona",
    facility: "Medora Medical Center",
    specialty: "Dermatology",
    date: "2026-06-05",
    time: "11:00 AM",
    status: "Completed",
    summary:
      "Evaluation of eczema on both hands with a small area of secondary infection. Skin is dry with mild erythema. Advised emollients, avoiding harsh soaps, and a 7-day antibiotic course.",
    vitals: {
      height: "172 cm",
      weight: "72 kg",
      bloodPressure: "120/80 mmHg",
      heartRate: "74 bpm",
      temperature: "36.5 °C",
    },
    diagnosis: {
      code: "L30.9",
      name: "Dermatitis, unspecified",
      description:
        "Mild hand eczema with a small area of secondary bacterial infection. No deep tissue involvement.",
      status: "Recorded",
    },
    medicationIds: ["rx-amox"],
    labIds: [],
    imagingIds: [],
    fileIds: ["f-derm-report"],
    followUp: {
      recommendation: "Review if the rash spreads or becomes painful.",
      note: "Continue emollients daily. No appointment confirmed yet.",
    },
    reportId: "rep-derm",
  },
  {
    id: "v-cardio",
    title: "Cardiology Consultation",
    doctorId: "d-youssef",
    facility: "Medora Medical Center",
    specialty: "Cardiology",
    date: "2026-04-18",
    time: "02:30 PM",
    status: "Completed",
    summary:
      "Cardiology review for intermittent palpitations. ECG showed normal sinus rhythm. Advised hydration, regular sleep, and reduced caffeine intake.",
    vitals: {
      height: "172 cm",
      weight: "72 kg",
      bloodPressure: "122/80 mmHg",
      heartRate: "72 bpm",
      temperature: "36.6 °C",
    },
    diagnosis: {
      code: "R00.2",
      name: "Palpitations",
      description:
        "No arrhythmia detected on the resting ECG. Symptoms are likely benign; return if they worsen.",
      status: "Recorded",
    },
    medicationIds: ["rx-omega"],
    labIds: ["lab-tsh"],
    imagingIds: [],
    fileIds: ["f-cardio-ecg", "f-cardio-summary"],
    followUp: {
      recommendation: "Repeat ECG if palpitations return.",
      note: "No appointment confirmed yet.",
    },
  },
  {
    id: "v-emergency",
    title: "Emergency Visit",
    doctorId: "d-karim",
    facility: "Medora Medical Center",
    specialty: "Emergency Medicine",
    date: "2026-06-12",
    time: "08:15 PM",
    status: "Completed",
    summary:
      "Minor laceration to the left wrist treated in the emergency department. Wound cleaned and closed with sutures. Tetanus status reviewed.",
    vitals: {
      height: "172 cm",
      weight: "72 kg",
      bloodPressure: "130/85 mmHg",
      heartRate: "88 bpm",
      temperature: "37.1 °C",
    },
    diagnosis: {
      code: "S61.9",
      name: "Open wound of wrist, unspecified",
      description:
        "Minor laceration, repaired. No tendon or nerve involvement. Tetanus cover is up to date.",
      status: "Recorded",
    },
    medicationIds: [],
    labIds: ["lab-lft"],
    imagingIds: [],
    fileIds: ["f-emergency-summary"],
    followUp: {
      recommendation: "Keep the wound clean and dry.",
      note: "Return if redness, swelling or fever develops. No appointment confirmed yet.",
    },
  },
];

export function getVisit(id?: string | null): Visit | undefined {
  if (!id) return undefined;
  return visits.find((visit) => visit.id === id);
}

/* ------------------------------------------------------------------ */
/* Prescriptions                                                       */
/* ------------------------------------------------------------------ */

export const prescriptions: Prescription[] = [
  {
    id: "rx-vitd",
    medication: "Vitamin D 5000 IU",
    dosage: "One tablet (5000 IU)",
    frequency: "Once daily",
    duration: "3 months",
    startDate: "2026-09-20",
    endDate: "2026-12-20",
    refills: "2 refills remaining",
    status: "Active",
    doctorId: "d-youssef",
    facility: "Medora Medical Center",
    date: "2026-09-20",
    relatedVisitId: "v-followup",
    instructions: [
      "Take one tablet daily after meals.",
      "Continue for 3 months.",
      "Maintain adequate hydration.",
      "Recheck vitamin D levels after 3 months.",
      "Contact your doctor if you experience any side effects.",
    ],
    warning:
      "This medication was prescribed based on your medical consultation. Do not change the dosage without consulting your doctor.",
  },
  {
    id: "rx-omega",
    medication: "Omega-3 1000 mg",
    dosage: "One capsule (1000 mg)",
    frequency: "Once daily",
    duration: "6 months",
    startDate: "2026-10-20",
    endDate: "2027-04-20",
    refills: "1 refill remaining",
    status: "Active",
    doctorId: "d-sarah",
    facility: "Medora Medical Center",
    date: "2026-10-20",
    relatedVisitId: "v-general",
    instructions: [
      "Take one capsule daily with food.",
      "Continue alongside a balanced diet.",
      "Report any unusual bruising or bleeding.",
    ],
    warning:
      "This supplement was recommended during your consultation. Do not exceed the stated dose without consulting your doctor.",
  },
  {
    id: "rx-amox",
    medication: "Amoxicillin 500 mg",
    dosage: "One capsule (500 mg)",
    frequency: "Three times daily",
    duration: "7 days",
    startDate: "2026-06-05",
    endDate: "2026-06-12",
    refills: "0 refills remaining",
    status: "Completed",
    doctorId: "d-mona",
    facility: "Medora Medical Center",
    date: "2026-06-05",
    relatedVisitId: "v-derm",
    instructions: [
      "Take one capsule every 8 hours with water.",
      "Complete the full 7-day course.",
      "Take with food if you experience stomach upset.",
    ],
    warning:
      "Finish the full course even if you feel better. Do not share this medication. Contact your doctor if you develop a rash or swelling.",
  },
];

export function getPrescription(id?: string | null): Prescription | undefined {
  if (!id) return undefined;
  return prescriptions.find((item) => item.id === id);
}

/* ------------------------------------------------------------------ */
/* Lab results                                                         */
/* ------------------------------------------------------------------ */

export const labResults: LabResult[] = [
  {
    id: "lab-cbc",
    name: "Complete Blood Count (CBC)",
    date: "2026-10-12",
    facility: "Medora Laboratory",
    category: "Hematology",
    status: "Normal",
    doctorId: "d-sarah",
    relatedVisitId: "v-general",
    specimen: "Whole blood (EDTA)",
    method: "Automated haematology analyser",
    collectedAt: "2026-10-12 08:40",
    reportedAt: "2026-10-12 12:10",
    notes:
      "All measured parameters fall within the laboratory reference ranges. Status reflects the laboratory flag, not a new diagnosis.",
    results: [
      {
        name: "WBC (White Blood Cells)",
        value: "6.2",
        unit: "× 10⁹/L",
        referenceRange: "4.0 – 10.0",
        status: "Normal",
      },
      {
        name: "RBC (Red Blood Cells)",
        value: "4.9",
        unit: "× 10¹²/L",
        referenceRange: "4.5 – 5.9",
        status: "Normal",
      },
      {
        name: "Hemoglobin (Hgb)",
        value: "13.8",
        unit: "g/dL",
        referenceRange: "13.5 – 17.5",
        status: "Normal",
      },
      {
        name: "Hematocrit (Hct)",
        value: "41.2",
        unit: "%",
        referenceRange: "41.0 – 53.0",
        status: "Normal",
      },
      {
        name: "Platelets",
        value: "250",
        unit: "× 10⁹/L",
        referenceRange: "150 – 400",
        status: "Normal",
      },
      {
        name: "MCV",
        value: "85",
        unit: "fL",
        referenceRange: "80 – 100",
        status: "Normal",
      },
      {
        name: "MCH",
        value: "28",
        unit: "pg",
        referenceRange: "27 – 33",
        status: "Normal",
      },
      {
        name: "MCHC",
        value: "33",
        unit: "g/dL",
        referenceRange: "32 – 36",
        status: "Normal",
      },
    ],
    trends: [
      {
        label: "White Blood Cells",
        unit: "× 10⁹/L",
        range: [4, 10],
        points: [
          { date: "2026-04-12", value: 5.8 },
          { date: "2026-07-10", value: 6.0 },
          { date: "2026-10-12", value: 6.2 },
        ],
      },
      {
        label: "Hemoglobin",
        unit: "g/dL",
        range: [13.5, 17.5],
        points: [
          { date: "2026-04-12", value: 13.5 },
          { date: "2026-07-10", value: 13.6 },
          { date: "2026-10-12", value: 13.8 },
        ],
      },
    ],
  },
  {
    id: "lab-lipid",
    name: "Lipid Panel",
    date: "2026-10-10",
    facility: "Medora Laboratory",
    category: "Biochemistry",
    status: "Abnormal",
    doctorId: "d-sarah",
    relatedVisitId: "v-followup",
    specimen: "Serum (fasting)",
    method: "Enzymatic colorimetric assay",
    collectedAt: "2026-10-10 09:05",
    reportedAt: "2026-10-10 14:20",
    notes:
      "Two values were flagged outside the laboratory reference range. Your doctor will discuss the results with you.",
    results: [
      {
        name: "Total Cholesterol",
        value: "210",
        unit: "mg/dL",
        referenceRange: "< 200",
        status: "Abnormal",
      },
      {
        name: "LDL Cholesterol",
        value: "130",
        unit: "mg/dL",
        referenceRange: "< 100",
        status: "Abnormal",
      },
      {
        name: "HDL Cholesterol",
        value: "52",
        unit: "mg/dL",
        referenceRange: "> 40",
        status: "Normal",
      },
      {
        name: "Triglycerides",
        value: "140",
        unit: "mg/dL",
        referenceRange: "< 150",
        status: "Normal",
      },
    ],
  },
  {
    id: "lab-lft",
    name: "Liver Function Test (LFT)",
    date: "2026-09-28",
    facility: "Medora Laboratory",
    category: "Biochemistry",
    status: "Normal",
    doctorId: "d-sarah",
    relatedVisitId: "v-emergency",
    specimen: "Serum",
    method: "Photometric assay",
    collectedAt: "2026-09-28 10:15",
    reportedAt: "2026-09-28 15:40",
    notes: "All measured liver enzymes are within the laboratory reference ranges.",
    results: [
      {
        name: "ALT",
        value: "24",
        unit: "U/L",
        referenceRange: "7 – 56",
        status: "Normal",
      },
      {
        name: "AST",
        value: "22",
        unit: "U/L",
        referenceRange: "10 – 40",
        status: "Normal",
      },
      {
        name: "ALP",
        value: "78",
        unit: "U/L",
        referenceRange: "44 – 147",
        status: "Normal",
      },
      {
        name: "Total Bilirubin",
        value: "0.8",
        unit: "mg/dL",
        referenceRange: "0.1 – 1.2",
        status: "Normal",
      },
      {
        name: "Albumin",
        value: "4.4",
        unit: "g/dL",
        referenceRange: "3.5 – 5.0",
        status: "Normal",
      },
    ],
  },
  {
    id: "lab-tsh",
    name: "Thyroid Function (TSH)",
    date: "2026-09-15",
    facility: "Medora Laboratory",
    category: "Endocrinology",
    status: "Normal",
    doctorId: "d-youssef",
    relatedVisitId: "v-cardio",
    specimen: "Serum",
    method: "Chemiluminescent immunoassay",
    collectedAt: "2026-09-15 08:25",
    reportedAt: "2026-09-15 13:00",
    notes:
      "Thyroid function is within the laboratory reference range. This test was ordered to rule out a thyroid cause for palpitations.",
    results: [
      {
        name: "TSH",
        value: "2.1",
        unit: "mIU/L",
        referenceRange: "0.4 – 4.0",
        status: "Normal",
      },
      {
        name: "Free T4",
        value: "1.2",
        unit: "ng/dL",
        referenceRange: "0.8 – 1.8",
        status: "Normal",
      },
    ],
  },
];

export function getLabResult(id?: string | null): LabResult | undefined {
  if (!id) return undefined;
  return labResults.find((item) => item.id === id);
}

/* ------------------------------------------------------------------ */
/* Imaging                                                             */
/* ------------------------------------------------------------------ */

const XRAY_SRC = "/images/medical/chest-xray-demo.png";
const ULTRASOUND_SRC = "/images/medical/ultrasound-demo.png";

export const imagingResults: ImagingResult[] = [
  {
    id: "img-xray",
    name: "Chest X-Ray",
    date: "2026-09-28",
    facility: "Cairo Radiology Center",
    modality: "X-Ray",
    bodyPart: "Chest",
    status: "Completed",
    doctorId: "d-laila",
    relatedVisitId: "v-general",
    accession: "XR-2026-09281",
    findings:
      "No acute cardiopulmonary abnormality. Lungs are clear. Heart size is within normal limits. No pleural effusion or pneumothorax is seen. Bony thorax is unremarkable.",
    impression: "Normal chest X-ray.",
    images: [
      { id: "xray-1", label: "PA view", src: XRAY_SRC },
      { id: "xray-2", label: "Lateral view", src: XRAY_SRC },
      { id: "xray-3", label: "Detail view", src: XRAY_SRC },
    ],
  },
  {
    id: "img-ultrasound",
    name: "Abdominal Ultrasound",
    date: "2026-08-12",
    facility: "Medora Imaging Center",
    modality: "Ultrasound",
    bodyPart: "Abdomen",
    status: "Completed",
    doctorId: "d-laila",
    relatedVisitId: "v-followup",
    accession: "US-2026-08122",
    findings:
      "Liver, gallbladder, pancreas, kidneys and spleen appear normal in size and echotexture. No free fluid or focal lesion is identified.",
    impression: "Normal abdominal ultrasound.",
    images: [
      { id: "us-1", label: "Transverse view", src: ULTRASOUND_SRC },
      { id: "us-2", label: "Sagittal view", src: ULTRASOUND_SRC },
    ],
  },
];

export function getImagingResult(id?: string | null): ImagingResult | undefined {
  if (!id) return undefined;
  return imagingResults.find((item) => item.id === id);
}

/* ------------------------------------------------------------------ */
/* Visit attachments                                                   */
/* ------------------------------------------------------------------ */

export const visitFiles: MedicalFile[] = [
  {
    id: "f-general-summary",
    name: "Visit Summary.pdf",
    category: "Medical Report",
    date: "2026-10-20",
    size: "2.4 MB",
    fileType: "PDF",
    source: "clinician",
  },
  {
    id: "f-cbc-report",
    name: "CBC Lab Report.pdf",
    category: "Lab Result",
    date: "2026-10-12",
    size: "480 KB",
    fileType: "PDF",
    source: "clinician",
  },
  {
    id: "f-xray-report",
    name: "Chest X-Ray Report.pdf",
    category: "Imaging",
    date: "2026-09-28",
    size: "1.2 MB",
    fileType: "PDF",
    source: "clinician",
  },
  {
    id: "f-followup-summary",
    name: "Follow-up Summary.pdf",
    category: "Medical Report",
    date: "2026-06-15",
    size: "1.1 MB",
    fileType: "PDF",
    source: "clinician",
  },
  {
    id: "f-derm-report",
    name: "Dermatology Report.pdf",
    category: "Medical Report",
    date: "2026-06-06",
    size: "860 KB",
    fileType: "PDF",
    source: "clinician",
  },
  {
    id: "f-cardio-ecg",
    name: "ECG Tracing.pdf",
    category: "Medical Report",
    date: "2026-04-18",
    size: "640 KB",
    fileType: "PDF",
    source: "clinician",
  },
  {
    id: "f-cardio-summary",
    name: "Cardiology Summary.pdf",
    category: "Medical Report",
    date: "2026-04-18",
    size: "520 KB",
    fileType: "PDF",
    source: "clinician",
  },
  {
    id: "f-emergency-summary",
    name: "Emergency Visit Summary.pdf",
    category: "Medical Report",
    date: "2026-06-12",
    size: "700 KB",
    fileType: "PDF",
    source: "clinician",
  },
];

export function getVisitFile(id?: string | null): MedicalFile | undefined {
  if (!id) return undefined;
  return visitFiles.find((file) => file.id === id);
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export const documents: MedicalDocument[] = [
  {
    id: "doc-visit-summary",
    name: "Visit Summary.pdf",
    category: "Medical Report",
    date: "2026-10-20",
    size: "2.4 MB",
    fileType: "PDF",
    source: "clinician",
    status: "Clinically Reviewed",
    relatedVisitId: "v-general",
    doctorId: "d-sarah",
    deletable: false,
  },
  {
    id: "doc-insurance",
    name: "Insurance Card.jpg",
    category: "Other",
    date: "2026-09-02",
    size: "1.1 MB",
    fileType: "JPG",
    source: "patient",
    status: "Patient Uploaded",
    deletable: true,
  },
];

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export const medicalReports: MedicalReport[] = [
  {
    id: "rep-general",
    title: "General Health Report",
    date: "2026-10-22",
    doctorId: "d-sarah",
    specialty: "General Medicine",
    facility: "Medora Medical Center",
    description:
      "Comprehensive summary of your consultation, diagnosis, treatment plan and follow-up instructions.",
    status: "Completed",
    relatedVisitId: "v-general",
    sections: [
      {
        heading: "Summary",
        body: "You attended a routine general checkup on October 20, 2026. Your examination was unremarkable and your vital signs were within normal limits.",
      },
      {
        heading: "Diagnosis",
        body: "Z00.00 — General medical examination. No significant clinical findings were recorded.",
      },
      {
        heading: "Medications",
        body: "Vitamin D 5000 IU once daily and Omega-3 1000 mg once daily. Continue the current plan unless your doctor advises otherwise.",
      },
      {
        heading: "Recommendations",
        body: "Maintain regular exercise, a balanced diet and adequate hydration. Continue routine preventive screening.",
      },
      {
        heading: "Follow-up",
        body: "A follow-up review is recommended in 6 months. No appointment has been confirmed yet.",
      },
    ],
  },
  {
    id: "rep-derm",
    title: "Dermatology Consultation Report",
    date: "2026-06-06",
    doctorId: "d-mona",
    specialty: "Dermatology",
    facility: "Medora Medical Center",
    description:
      "Detailed report of your skin consultation including diagnosis, treatment recommendations and care instructions.",
    status: "Completed",
    relatedVisitId: "v-derm",
    sections: [
      {
        heading: "Summary",
        body: "You were seen for dry, itchy skin on both hands. A small area of secondary infection was noted.",
      },
      {
        heading: "Diagnosis",
        body: "L30.9 — Dermatitis, unspecified, with a small area of secondary bacterial infection.",
      },
      {
        heading: "Treatment",
        body: "A 7-day course of Amoxicillin 500 mg was prescribed. Emollients and avoidance of harsh soaps were advised.",
      },
      {
        heading: "Recommendations",
        body: "Keep hands moisturised, avoid fragranced products, and complete the antibiotic course.",
      },
      {
        heading: "Follow-up",
        body: "Review if the rash spreads, becomes painful, or does not improve within 2 weeks.",
      },
    ],
  },
];

export function getMedicalReport(id?: string | null): MedicalReport | undefined {
  if (!id) return undefined;
  return medicalReports.find((report) => report.id === id);
}

/* ------------------------------------------------------------------ */
/* Record feed                                                         */
/* ------------------------------------------------------------------ */

function entryBase(
  type: RecordType,
  id: string,
  title: string,
  subtitle: string,
  facility: string,
  date: string,
  status: string,
  time?: string,
): MedicalRecordEntry {
  return {
    key: `${type}:${id}`,
    type,
    id,
    title,
    subtitle,
    facility,
    date,
    time,
    status,
    searchText: [title, subtitle, facility, status, date, time]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

/**
 * Builds the cross-category feed. `documentsState` is passed in so newly
 * uploaded demo documents appear immediately without mutating module data.
 */
export function buildRecordEntries(
  documentsState: MedicalDocument[] = documents,
): MedicalRecordEntry[] {
  const entries: MedicalRecordEntry[] = [];

  visits.forEach((visit) => {
    const doctor = getMedicalDoctor(visit.doctorId);
    entries.push(
      entryBase(
        "visit",
        visit.id,
        visit.title,
        `${doctor?.name ?? "Medora care team"} · ${visit.specialty} · ${visit.facility}`,
        visit.facility,
        visit.date,
        visit.status,
        visit.time,
      ),
    );
  });

  prescriptions.forEach((prescription) => {
    const doctor = getMedicalDoctor(prescription.doctorId);
    entries.push(
      entryBase(
        "prescription",
        prescription.id,
        prescription.medication,
        `${doctor?.name ?? "Medora care team"} · ${prescription.dosage}`,
        prescription.facility,
        prescription.date,
        prescription.status,
      ),
    );
  });

  labResults.forEach((lab) => {
    entries.push(
      entryBase(
        "lab",
        lab.id,
        lab.name,
        `${lab.facility} · ${lab.category}`,
        lab.facility,
        lab.date,
        lab.status,
      ),
    );
  });

  imagingResults.forEach((imaging) => {
    entries.push(
      entryBase(
        "imaging",
        imaging.id,
        imaging.name,
        `${imaging.facility} · ${imaging.modality}`,
        imaging.facility,
        imaging.date,
        imaging.status,
      ),
    );
  });

  documentsState.forEach((document) => {
    entries.push(
      entryBase(
        "document",
        document.id,
        document.name,
        `${document.category} · ${document.size}`,
        document.source === "patient" ? "Uploaded by you" : "Shared by your care team",
        document.date,
        document.status,
      ),
    );
  });

  medicalReports.forEach((report) => {
    const doctor = getMedicalDoctor(report.doctorId);
    entries.push(
      entryBase(
        "report",
        report.id,
        report.title,
        `${doctor?.name ?? "Medora care team"} · ${report.specialty}`,
        report.facility,
        report.date,
        report.status,
      ),
    );
  });

  return entries;
}

export function entriesForType(
  entries: MedicalRecordEntry[],
  type: RecordType,
): MedicalRecordEntry[] {
  return entries.filter((entry) => entry.type === type);
}

/* ------------------------------------------------------------------ */
/* Formatting and filtering helpers                                    */
/* ------------------------------------------------------------------ */

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatRecordDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return DATE_FORMATTER.format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatShortRecordDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return SHORT_DATE_FORMATTER.format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatRecordDateTime(iso: string, time?: string): string {
  const date = formatRecordDate(iso);
  return time ? `${date} • ${time}` : date;
}

/** Fixed demo "today" so date filters stay meaningful against 2026 fixtures. */
export const DEMO_TODAY = "2026-10-28";

export function isWithinRange(iso: string, range: "any" | "30" | "90" | "year"): boolean {
  if (range === "any") return true;
  if (range === "year") return iso.startsWith("2026");
  const today = new Date(`${DEMO_TODAY}T23:59:59Z`).getTime();
  const value = new Date(`${iso}T00:00:00Z`).getTime();
  const days = range === "30" ? 30 : 90;
  return value >= today - days * 24 * 60 * 60 * 1000 && value <= today;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "FILE";
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
