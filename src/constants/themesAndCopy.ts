import type { ContactItem, LanguageCode, ThemeDefinition, ThemeId, VoiceOption } from "../types/piya";

export const PIYA_THEMES: Record<ThemeId, ThemeDefinition> = {
  "classic-cyan": {
    id: "classic-cyan",
    name: "Classic Cyan",
    bnName: "ক্লাসিক সায়ান",
    hiName: "क्लासिक सियान",
    description: "Signature deep navy obsidian paired with luminous cyan circuitry.",
    bg: "#050914",
    surface: "#0b1224",
    surfaceElevated: "#111b34",
    border: "rgba(34, 211, 238, 0.20)",
    accent: "#06b6d4",
    accentBright: "#22d3ee",
    accentSoft: "rgba(6, 182, 212, 0.14)",
    accentGlow: "rgba(6, 182, 212, 0.36)",
    onAccent: "#031219",
    threeAccentHex: 0x06b6d4,
    threeSecondaryHex: 0x38bdf8,
  },
  "mark-gold": {
    id: "mark-gold",
    name: "Mark L Gold",
    bnName: "মার্ক এল গোল্ড",
    hiName: "मार्क एल गोल्ड",
    description: "Titanium obsidian armor aesthetic with warm brushed gold trim.",
    bg: "#090806",
    surface: "#15110c",
    surfaceElevated: "#211b13",
    border: "rgba(245, 158, 11, 0.22)",
    accent: "#f59e0b",
    accentBright: "#fbbf24",
    accentSoft: "rgba(245, 158, 11, 0.14)",
    accentGlow: "rgba(245, 158, 11, 0.36)",
    onAccent: "#180f02",
    threeAccentHex: 0xf59e0b,
    threeSecondaryHex: 0xfbbf24,
  },
  "stealth-violet": {
    id: "stealth-violet",
    name: "Stealth Violet",
    bnName: "স্টেলথ ভায়োলেট",
    hiName: "स्टेल्थ वायलेट",
    description: "Low-signature midnight slate illuminated by ultraviolet seams.",
    bg: "#070612",
    surface: "#110e24",
    surfaceElevated: "#1a1536",
    border: "rgba(139, 92, 246, 0.24)",
    accent: "#8b5cf6",
    accentBright: "#a78bfa",
    accentSoft: "rgba(139, 92, 246, 0.15)",
    accentGlow: "rgba(139, 92, 246, 0.36)",
    onAccent: "#ffffff",
    threeAccentHex: 0x8b5cf6,
    threeSecondaryHex: 0xc084fc,
  },
  "veronica-emerald": {
    id: "veronica-emerald",
    name: "Veronica Emerald",
    bnName: "ভেরোনিকা এমারেল্ড",
    hiName: "वेरोनिका एमराल्ड",
    description: "Tactical orbital matrix palette in deep carbon and precision emerald.",
    bg: "#040d0a",
    surface: "#091a15",
    surfaceElevated: "#102720",
    border: "rgba(16, 185, 129, 0.22)",
    accent: "#10b981",
    accentBright: "#34d399",
    accentSoft: "rgba(16, 185, 129, 0.14)",
    accentGlow: "rgba(16, 185, 129, 0.35)",
    onAccent: "#021810",
    threeAccentHex: 0x10b981,
    threeSecondaryHex: 0x34d399,
  },
  "solar-amber": {
    id: "solar-amber",
    name: "Solar Amber",
    bnName: "সোলার অ্যাম্বার",
    hiName: "सोलर एम्बर",
    description: "High-contrast warm carbon canvas with radiant solar flare highlights.",
    bg: "#0d0705",
    surface: "#190f0a",
    surfaceElevated: "#251610",
    border: "rgba(249, 115, 22, 0.24)",
    accent: "#f97316",
    accentBright: "#fb923c",
    accentSoft: "rgba(249, 115, 22, 0.15)",
    accentGlow: "rgba(249, 115, 22, 0.36)",
    onAccent: "#1c0902",
    threeAccentHex: 0xf97316,
    threeSecondaryHex: 0xfb923c,
  },
};

export const VOICE_OPTIONS: Array<{
  id: VoiceOption;
  label: string;
  bnDesc: string;
  hiDesc: string;
}> = [
  {
    id: "Kore",
    label: "Kore (PIYA Signature)",
    bnDesc: "নরম, স্পষ্ট এবং বন্ধুত্বপূর্ণ কণ্ঠস্বর",
    hiDesc: "मधुर, स्पष्ट और मैत्रीपूर्ण आवाज़",
  },
  {
    id: "Zephyr",
    label: "Zephyr (Bright & Airy)",
    bnDesc: "প্রাণবন্ত ও আধুনিক সহকারী কণ্ঠ",
    hiDesc: "जीवंत और आधुनिक सहायक आवाज़",
  },
  {
    id: "Puck",
    label: "Puck (Expressive)",
    bnDesc: "দ্রুত ও প্রাণবন্ত কথোপকথন শৈলী",
    hiDesc: "तेज़ और अभिव्यक्तिपूर्ण संवाद शैली",
  },
  {
    id: "Charon",
    label: "Charon (Calm Studio)",
    bnDesc: "শান্ত এবং স্থির উপস্থাপনা",
    hiDesc: "शांत और संतुलित प्रस्तुति",
  },
  {
    id: "Fenrir",
    label: "Fenrir (Deep Resonant)",
    bnDesc: "গভীর ও স্পষ্ট উচ্চারণ",
    hiDesc: "गहरी और स्पष्ट उच्चारण शैली",
  },
];

export const DEFAULT_CONTACTS: ContactItem[] = [
  {
    id: "cnt_poran",
    name: "Poran",
    phone: "+880 1711-442910",
    label: "Developer",
  },
  {
    id: "cnt_rahim_1",
    name: "Rahim Uddin",
    phone: "+880 1812-554821",
    label: "Office",
  },
  {
    id: "cnt_rahim_2",
    name: "Rahim Sheikh",
    phone: "+880 1915-779034",
    label: "Friend",
  },
  {
    id: "cnt_ananya",
    name: "Ananya Roy",
    phone: "+91 98301-662109",
    label: "Colleague",
  },
  {
    id: "cnt_home",
    name: "Maa (Home)",
    phone: "+880 1715-883205",
    label: "Family",
  },
];

export const UI_COPY: Record<
  LanguageCode,
  {
    subtitle: string;
    startAssistant: string;
    voiceReady: string;
    voiceListening: string;
    voiceThinking: string;
    voiceSpeaking: string;
    micDenied: string;
    offlineMode: string;
    tapToSpeak: string;
    stopListening: string;
    stopSpeaking: string;
    typePlaceholder: string;
    confirmBtn: string;
    cancelBtn: string;
    welcomeGreeting: string;
    samplePrompts: string[];
  }
> = {
  bn: {
    subtitle: "ব্যক্তিগত এআই ভয়েস অ্যাসিস্ট্যান্ট · বাংলা ও হিন্দি",
    startAssistant: "Start Assistant",
    voiceReady: "কণ্ঠস্বর প্রস্তুত",
    voiceListening: "পিয়া শুনছে...",
    voiceThinking: "পিয়া চিন্তা করছে...",
    voiceSpeaking: "পিয়া কথা বলছে...",
    micDenied: "মাইক্রোফোন অনুমতি প্রয়োজন",
    offlineMode: "ইন্টারনেট সংযোগ নেই",
    tapToSpeak: "কথা বলতে ট্যাপ করুন",
    stopListening: "শোনা শেষ করুন",
    stopSpeaking: "কথা থামান",
    typePlaceholder: "বাংলায় বলুন বা লিখুন (যেমন: পরাণকে কল করো)...",
    confirmBtn: "নিশ্চিত করুন",
    cancelBtn: "বাতিল করুন",
    welcomeGreeting:
      "নমস্কার! আমি পিয়া এআই। আপনি বাংলায় বা হিন্দিতে আমার সাথে কথা বলতে পারেন, প্রশ্ন করতে পারেন বা ফোনের কাজ করতে বলতে পারেন।",
    samplePrompts: [
      "পরাণকে কল করো",
      "রহিমকে ফোন লাগাও",
      "ফোনের ব্যাটারি কত শতাংশ আছে?",
      "ইউটিউবে রবীন্দ্রসংগীত সার্চ করো",
      "সকাল ৭টা ৩০ মিনিটে অ্যালার্ম সেট করো",
      "মনে রাখো আমার প্রিয় রঙ নীল",
    ],
  },
  hi: {
    subtitle: "व्यक्तिगत एआई वॉयस असिस्टेंट · बंगाली और हिन्दी",
    startAssistant: "Start Assistant",
    voiceReady: "आवाज़ तैयार है",
    voiceListening: "पिया सुन रही है...",
    voiceThinking: "पिया सोच रही है...",
    voiceSpeaking: "पिया बोल रही है...",
    micDenied: "माइक्रोफ़ोन अनुमति आवश्यक है",
    offlineMode: "इंटरनेट कनेक्शन नहीं है",
    tapToSpeak: "बोलने के लिए टैप करें",
    stopListening: "सुनना समाप्त करें",
    stopSpeaking: "बोलना रोकें",
    typePlaceholder: "हिन्दी में बोलें या लिखें (जैसे: Poran को कॉल करो)...",
    confirmBtn: "पुष्टि करें",
    cancelBtn: "रद्द करें",
    welcomeGreeting:
      "नमस्ते! मैं पिया एआई हूँ। आप मुझसे हिन्दी या बंगाली में बात कर सकते हैं, सवाल पूछ सकते हैं या फ़ोन के कार्य करवा सकते हैं।",
    samplePrompts: [
      "Poran को कॉल करो",
      "Rahim को फ़ोन लगाओ",
      "फ़ोन की बैटरी कितनी बची है?",
      "YouTube पर Arijit Singh के गाने खोजो",
      "सुबह 7 बजकर 30 मिनट का अलार्म लगाओ",
      "याद रखो मुझे मसाला चाय पसंद है",
    ],
  },
};

export function applyThemeCssVariables(themeId: ThemeId): void {
  const theme = PIYA_THEMES[themeId] || PIYA_THEMES["classic-cyan"];
  const root = document.documentElement;
  root.style.setProperty("--piya-bg", theme.bg);
  root.style.setProperty("--piya-surface", theme.surface);
  root.style.setProperty("--piya-surface-elevated", theme.surfaceElevated);
  root.style.setProperty("--piya-border", theme.border);
  root.style.setProperty("--piya-accent", theme.accent);
  root.style.setProperty("--piya-accent-bright", theme.accentBright);
  root.style.setProperty("--piya-accent-soft", theme.accentSoft);
  root.style.setProperty("--piya-accent-glow", theme.accentGlow);
  root.style.setProperty("--piya-on-accent", theme.onAccent);
}

/**
 * Checks if spoken/typed input is an affirmative or negative confirmation in Bengali, Hindi, or English,
 * or contains a 4-digit contact selector.
 */
export function parseVoiceConfirmationIntent(input: string): {
  decision: "confirm" | "cancel" | null;
  fourDigits: string | null;
} {
  // Normalize Bengali & Devanagari numerals to ASCII digits so "৪৮২১" or "४८२१" matches "4821"!
  const normalizedDigits = input
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));

  const digitMatch = normalizedDigits.match(/\b(\d{4})\b/);
  if (digitMatch) {
    return { decision: null, fourDigits: digitMatch[1] };
  }

  const cleaned = input.trim().toLowerCase().replace(/[।.,!?]/g, "");

  const yesWords = [
    "হ্যাঁ",
    "হাঁ",
    "জি",
    "জী",
    "করো",
    "কল করো",
    "ঠিক আছে",
    "অবশ্যই",
    "हाँ",
    "हां",
    "जी",
    "जी हाँ",
    "करो",
    "कॉल करो",
    "ठीक है",
    "बिल्कुल",
    "yes",
    "yeah",
    "yep",
    "sure",
    "confirm",
    "ok",
    "okay",
    "hyan",
    "haan",
  ];

  const noWords = [
    "না",
    "দরকার নেই",
    "বাতিল",
    "থাক",
    "নাহ",
    "नहीं",
    "ना",
    "मत करो",
    "रद्द",
    "रहने दो",
    "no",
    "nope",
    "cancel",
    "stop",
    "nahi",
  ];

  for (const w of noWords) {
    if (cleaned === w || cleaned.startsWith(w + " ") || cleaned.endsWith(" " + w)) {
      return { decision: "cancel", fourDigits: null };
    }
  }

  for (const w of yesWords) {
    if (cleaned === w || cleaned.startsWith(w + " ") || cleaned.endsWith(" " + w)) {
      return { decision: "confirm", fourDigits: null };
    }
  }

  return { decision: null, fourDigits: null };
}
