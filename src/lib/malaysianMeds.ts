/**
 * Common medications encountered in Malaysian primary care (Klinik Kesihatan,
 * GP clinics, hospital outpatient pharmacies). Curated from MOH formulary
 * categories — used to populate the "Add medication" searchable dropdown
 * so supervisors/patients don't have to type free-text every time.
 */
export interface MedSuggestion {
  /** Display name with strength */
  name: string;
  /** Default dosage hint for the picker */
  dosage: string;
  /** Suggested unit */
  unit: string;
  /** Therapeutic group, used as section header in the picker */
  group: string;
}

export const MY_MEDS: MedSuggestion[] = [
  // Cardio / Hypertension
  { name: "Amlodipine 5mg", dosage: "5mg", unit: "pills", group: "Cardiovascular" },
  { name: "Amlodipine 10mg", dosage: "10mg", unit: "pills", group: "Cardiovascular" },
  { name: "Atenolol 50mg", dosage: "50mg", unit: "pills", group: "Cardiovascular" },
  { name: "Bisoprolol 5mg", dosage: "5mg", unit: "pills", group: "Cardiovascular" },
  { name: "Losartan 50mg", dosage: "50mg", unit: "pills", group: "Cardiovascular" },
  { name: "Perindopril 4mg", dosage: "4mg", unit: "pills", group: "Cardiovascular" },
  { name: "Hydrochlorothiazide 25mg", dosage: "25mg", unit: "pills", group: "Cardiovascular" },
  { name: "Simvastatin 20mg", dosage: "20mg", unit: "pills", group: "Cardiovascular" },
  { name: "Atorvastatin 20mg", dosage: "20mg", unit: "pills", group: "Cardiovascular" },
  { name: "Aspirin 100mg (cardio)", dosage: "100mg", unit: "pills", group: "Cardiovascular" },
  { name: "Clopidogrel 75mg", dosage: "75mg", unit: "pills", group: "Cardiovascular" },

  // Diabetes
  { name: "Metformin 500mg", dosage: "500mg", unit: "pills", group: "Diabetes" },
  { name: "Metformin 850mg", dosage: "850mg", unit: "pills", group: "Diabetes" },
  { name: "Gliclazide 80mg", dosage: "80mg", unit: "pills", group: "Diabetes" },
  { name: "Glibenclamide 5mg", dosage: "5mg", unit: "pills", group: "Diabetes" },
  { name: "Sitagliptin 100mg", dosage: "100mg", unit: "pills", group: "Diabetes" },
  { name: "Insulin (Mixtard) 30/70", dosage: "as prescribed", unit: "units", group: "Diabetes" },

  // Pain / Fever
  { name: "Paracetamol 500mg", dosage: "500mg", unit: "pills", group: "Pain & Fever" },
  { name: "Paracetamol 650mg", dosage: "650mg", unit: "pills", group: "Pain & Fever" },
  { name: "Ibuprofen 400mg", dosage: "400mg", unit: "pills", group: "Pain & Fever" },
  { name: "Diclofenac 50mg", dosage: "50mg", unit: "pills", group: "Pain & Fever" },
  { name: "Tramadol 50mg", dosage: "50mg", unit: "pills", group: "Pain & Fever" },

  // Gastric
  { name: "Omeprazole 20mg", dosage: "20mg", unit: "pills", group: "Gastric" },
  { name: "Pantoprazole 40mg", dosage: "40mg", unit: "pills", group: "Gastric" },
  { name: "Ranitidine 150mg", dosage: "150mg", unit: "pills", group: "Gastric" },
  { name: "MMT (Magnesium trisilicate)", dosage: "10ml", unit: "ml", group: "Gastric" },

  // Cholesterol / metabolism
  { name: "Allopurinol 100mg", dosage: "100mg", unit: "pills", group: "Metabolic" },
  { name: "Allopurinol 300mg", dosage: "300mg", unit: "pills", group: "Metabolic" },
  { name: "Levothyroxine 50mcg", dosage: "50mcg", unit: "pills", group: "Metabolic" },

  // Antibiotics (short courses)
  { name: "Amoxicillin 500mg", dosage: "500mg", unit: "pills", group: "Antibiotic" },
  { name: "Augmentin 625mg", dosage: "625mg", unit: "pills", group: "Antibiotic" },
  { name: "Cloxacillin 500mg", dosage: "500mg", unit: "pills", group: "Antibiotic" },
  { name: "Cephalexin 500mg", dosage: "500mg", unit: "pills", group: "Antibiotic" },

  // Respiratory
  { name: "Salbutamol inhaler", dosage: "2 puffs", unit: "puffs", group: "Respiratory" },
  { name: "Budesonide inhaler", dosage: "1 puff", unit: "puffs", group: "Respiratory" },
  { name: "Loratadine 10mg", dosage: "10mg", unit: "pills", group: "Respiratory" },
  { name: "Cetirizine 10mg", dosage: "10mg", unit: "pills", group: "Respiratory" },

  // Vitamins / supplements common at KK
  { name: "Folic acid 5mg", dosage: "5mg", unit: "pills", group: "Vitamins" },
  { name: "Vitamin B-Complex", dosage: "1 tab", unit: "pills", group: "Vitamins" },
  { name: "Calcium carbonate 500mg", dosage: "500mg", unit: "pills", group: "Vitamins" },
  { name: "Ferrous fumarate 200mg", dosage: "200mg", unit: "pills", group: "Vitamins" },
];

export const FREQUENCIES = [
  "Once daily",
  "Twice daily",
  "Three times daily",
  "Four times daily",
  "Every other day",
  "As needed",
];

export const UNITS = ["pills", "ml", "puffs", "units", "drops", "sachets"];