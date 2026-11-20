// src/config/areas.ts
// Centralised configuration for city‑area mapping, multilingual names, and pricing.
// Prices are expressed in INR. `null` indicates price not yet confirmed.

export const AREA_CONFIG = {
  Mumbai: {
    colaba: {
      name: {
        en: "Colaba Causeway / Gateway of India",
        hi: "कोलाबा कैज़वे / गेटवे ऑफ इंडिया",
        mr: "कोलाबा कॅजवे / गेटवे ऑफ इंडिया"
      },
      price: { car: { day: 150, month: 3000 }, twoWheeler: { month: 1200 } }
    },
    fort: {
      name: {
        en: "CSMT / Flora Fountain",
        hi: "सीएसएमटी / फ़्लोरा फाउंटेन",
        mr: "सीएसएमटी / फ्लोरा फाउंटन"
      },
      price: { car: { day: 150, month: 3000 }, twoWheeler: { month: 1200 } }
    },
    churchgate: {
      name: {
        en: "Churchgate and Marine Drive",
        hi: "चर्चगेट और मरीन ड्राइव",
        mr: "चर्चगेट आणि मरीन ड्राइव"
      },
      price: { car: { day: 150, month: 3000 }, twoWheeler: { month: 1200 } }
    },
    bandra: {
      name: {
        en: "Bandra West, Bandstand / Linking Road",
        hi: "बांद्रा पश्चिम, बैंडस्टैंड / लिंकिंग रोड",
        mr: "बांद्रा पश्चिम, बँडस्टँड / लिंकिंग रोड"
      },
      price: { car: { day: 120, month: 2500 }, twoWheeler: { month: 1000 } }
    },
    juhu: {
      name: {
        en: "Juhu Beach",
        hi: "जुहू बीच",
        mr: "जुहू बीच"
      },
      price: { car: { day: 100, month: 2000 }, twoWheeler: { month: 800 } }
    },
    dadar: {
      name: {
        en: "Dadar station and Shivaji Park market",
        hi: "डादर स्टेशन और शिवाजी पार्क बाजार",
        mr: "डादर स्टेशन आणि शिवाजी पार्क बाजार"
      },
      price: { car: { day: 120, month: 2500 }, twoWheeler: { month: 1000 } }
    }
  },
  Pune: {
    hadapsar: {
      name: { en: "Hadapsar, Magarpatta Road", hi: "हडापसर, मगारपट्टा रोड", mr: "हडापसर, मागरपट्टा रोड" },
      price: null
    },
    koregaon_park: {
      name: { en: "Koregaon Park", hi: "कोरेगॉन पार्क", mr: "कोरेगॉन पार्क" },
      price: null
    },
    camp: {
      name: { en: "Camp, FC Road / JM Road", hi: "कैम्प, एफसी रोड / जेएम रोड", mr: "कॅम्प, एफसी रोड / जेएम रोड" },
      price: null
    },
    wakad: {
      name: { en: "Wakad, near metro station", hi: "वाकड, मेट्रो स्टेशन के पास", mr: "वाकड, मेट्रो स्टेशनजवळ" },
      price: null
    },
    karvenagar: {
      name: { en: "Karvenagar", hi: "करवे नगर", mr: "करवे नगर" },
      price: null
    }
  }
} as const;

export type City = keyof typeof AREA_CONFIG;
export type AreaKey = keyof typeof AREA_CONFIG[City];
