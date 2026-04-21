/**
 * Hardcoded list of major Malaysian clinics & hospitals (Klang Valley + key MY cities).
 * Coordinates are real lat/lng pulled from public listings; phone/address are best-effort.
 * In a future phase, this can be swapped for a Google Places query without UI changes.
 */
export interface Clinic {
  id: string;
  name: string;
  state: string;
  area: string;
  address: string;
  phone: string | null;
  lat: number;
  lng: number;
  type: "hospital" | "clinic" | "klinik_kesihatan";
}

export const MY_CLINICS: Clinic[] = [
  // Kuala Lumpur
  { id: "hkl", name: "Hospital Kuala Lumpur (HKL)", state: "Kuala Lumpur", area: "Jalan Pahang", address: "Jalan Pahang, 50586 Kuala Lumpur", phone: "+60326155555", lat: 3.1729, lng: 101.7028, type: "hospital" },
  { id: "ppum", name: "Pusat Perubatan Universiti Malaya (PPUM)", state: "Kuala Lumpur", area: "Lembah Pantai", address: "Jalan Profesor Diraja Ungku Aziz, 59100 Kuala Lumpur", phone: "+60379494422", lat: 3.1133, lng: 101.6555, type: "hospital" },
  { id: "gleneagles-kl", name: "Gleneagles Hospital Kuala Lumpur", state: "Kuala Lumpur", area: "Ampang", address: "286 & 288, Jalan Ampang, 50450 Kuala Lumpur", phone: "+60342579333", lat: 3.1612, lng: 101.7322, type: "hospital" },
  { id: "pantai-kl", name: "Pantai Hospital Kuala Lumpur", state: "Kuala Lumpur", area: "Bangsar", address: "8, Jalan Bukit Pantai, 59100 Kuala Lumpur", phone: "+60322960888", lat: 3.1247, lng: 101.6692, type: "hospital" },
  { id: "kk-kl", name: "Klinik Kesihatan Tanglin", state: "Kuala Lumpur", area: "Tanglin", address: "Jalan Cenderasari, 50480 Kuala Lumpur", phone: "+60326938033", lat: 3.1471, lng: 101.6905, type: "klinik_kesihatan" },

  // Selangor
  { id: "shah-alam", name: "Hospital Shah Alam", state: "Selangor", area: "Shah Alam", address: "Persiaran Kayangan, Seksyen 7, 40000 Shah Alam", phone: "+60355261000", lat: 3.0707, lng: 101.4990, type: "hospital" },
  { id: "subang-jaya", name: "Subang Jaya Medical Centre (SJMC)", state: "Selangor", area: "Subang Jaya", address: "1, Jalan SS 12/1A, 47500 Subang Jaya", phone: "+60356391212", lat: 3.0795, lng: 101.5853, type: "hospital" },
  { id: "sunway-medical", name: "Sunway Medical Centre", state: "Selangor", area: "Bandar Sunway", address: "5, Jalan Lagoon Selatan, 47500 Subang Jaya", phone: "+60374919191", lat: 3.0668, lng: 101.6049, type: "hospital" },
  { id: "kpj-damansara", name: "KPJ Damansara Specialist Hospital", state: "Selangor", area: "Petaling Jaya", address: "119, Jalan SS 20/10, Damansara Utama, 47400 Petaling Jaya", phone: "+60377182000", lat: 3.1339, lng: 101.6213, type: "hospital" },
  { id: "kk-pj", name: "Klinik Kesihatan Petaling Jaya", state: "Selangor", area: "Petaling Jaya", address: "Jalan Othman, 46000 Petaling Jaya", phone: "+60377823433", lat: 3.0962, lng: 101.6446, type: "klinik_kesihatan" },

  // Penang
  { id: "hpp", name: "Hospital Pulau Pinang", state: "Penang", area: "George Town", address: "Jalan Residensi, 10990 George Town, Penang", phone: "+6042225333", lat: 5.4156, lng: 100.3098, type: "hospital" },
  { id: "penang-adventist", name: "Penang Adventist Hospital", state: "Penang", area: "George Town", address: "465, Jalan Burma, 10350 George Town, Penang", phone: "+6042227200", lat: 5.4242, lng: 100.3192, type: "hospital" },
  { id: "island-hospital", name: "Island Hospital", state: "Penang", area: "George Town", address: "308, Macalister Road, 10450 George Town, Penang", phone: "+6042288222", lat: 5.4196, lng: 100.3147, type: "hospital" },

  // Johor
  { id: "hsa-jb", name: "Hospital Sultanah Aminah", state: "Johor", area: "Johor Bahru", address: "Jalan Persiaran Abu Bakar Sultan, 80100 Johor Bahru", phone: "+6072257000", lat: 1.4628, lng: 103.7558, type: "hospital" },
  { id: "kpj-jb", name: "KPJ Johor Specialist Hospital", state: "Johor", area: "Johor Bahru", address: "39-B, Jalan Abdul Samad, 80100 Johor Bahru", phone: "+6072251000", lat: 1.4691, lng: 103.7537, type: "hospital" },
  { id: "kk-skudai", name: "Klinik Kesihatan Skudai", state: "Johor", area: "Skudai", address: "Jalan Kebudayaan, 81300 Skudai, Johor", phone: "+6075562777", lat: 1.5341, lng: 103.6608, type: "klinik_kesihatan" },

  // Sabah
  { id: "qe-kk", name: "Hospital Queen Elizabeth", state: "Sabah", area: "Kota Kinabalu", address: "Jalan Penampang, 88200 Kota Kinabalu, Sabah", phone: "+6088517555", lat: 5.9676, lng: 116.0775, type: "hospital" },
  { id: "kk-likas", name: "Klinik Kesihatan Luyang", state: "Sabah", area: "Kota Kinabalu", address: "Jalan Lintas, Luyang, 88300 Kota Kinabalu", phone: "+6088234727", lat: 5.9623, lng: 116.0835, type: "klinik_kesihatan" },

  // Sarawak
  { id: "hus-kuching", name: "Hospital Umum Sarawak", state: "Sarawak", area: "Kuching", address: "Jalan Hospital, 93586 Kuching, Sarawak", phone: "+6082276666", lat: 1.5384, lng: 110.3469, type: "hospital" },
  { id: "normah", name: "Normah Medical Specialist Centre", state: "Sarawak", area: "Kuching", address: "Lot 937, Jalan Tun Datuk Patinggi Hj Abdul Rahman Yakub, 93050 Kuching", phone: "+6082440055", lat: 1.5489, lng: 110.3262, type: "hospital" },

  // Perak
  { id: "hraja-permaisuri-bainun", name: "Hospital Raja Permaisuri Bainun", state: "Perak", area: "Ipoh", address: "Jalan Raja Ashman Shah, 30450 Ipoh, Perak", phone: "+6052085000", lat: 4.5841, lng: 101.0901, type: "hospital" },
  { id: "kpj-ipoh", name: "KPJ Ipoh Specialist Hospital", state: "Perak", area: "Ipoh", address: "26, Jalan Raja Dihilir, 30350 Ipoh, Perak", phone: "+6052408777", lat: 4.5884, lng: 101.0826, type: "hospital" },
];

export const MY_STATES = Array.from(new Set(MY_CLINICS.map((c) => c.state))).sort();

export function wazeUrl(c: Clinic) {
  return `https://waze.com/ul?ll=${c.lat}%2C${c.lng}&navigate=yes`;
}
export function gmapsUrl(c: Clinic) {
  return `https://www.google.com/maps/search/?api=1&query=${c.lat}%2C${c.lng}`;
}
export function telUrl(phone: string | null) {
  return phone ? `tel:${phone.replace(/\s+/g, "")}` : null;
}