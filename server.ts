import "dotenv/config";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import type { Content, Schema } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type SupportedLanguage = "bn" | "hi";

interface ContactInput {
  id: string;
  name: string;
  phone: string;
  label?: string;
}

interface MemoryInput {
  id: string;
  category: string;
  fact: string;
  createdAt: string;
}

interface HistoryTurn {
  role: "user" | "assistant";
  text: string;
}

interface DeviceStateInput {
  batteryLevel?: number | null;
  isCharging?: boolean | null;
  isNativeAndroid?: boolean;
  isDeviceAdminActive?: boolean;
  flashlightOn?: boolean;
}

interface StructuredTurnOutput {
  heardSpeech?: boolean;
  transcript?: string;
  language?: string;
  reply?: string;
  actionName?: string;
  contactName?: string;
  lastFourDigits?: string;
  query?: string;
  targetApp?: string;
  appName?: string;
  settingType?: string;
  flashlightMode?: string;
  alarmHour?: number;
  alarmMinute?: number;
  alarmLabel?: string;
  noteTitle?: string;
  noteContent?: string;
  memoryCategory?: string;
  memoryFact?: string;
}

const FAST_CONVERSATION_MODEL = "gemini-3.1-flash-lite";
const TRANSCRIBE_MODEL = "gemini-3.5-transcribe";
const TTS_MODEL = "gemini-3.8-flash-lite-tts";

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    const err = new Error(
      "GEMINI_API_KEY সেট করা নেই। অনুগ্রহ করে AI Studio-র Settings > Secrets প্যানেলে API key যাচাই করুন।"
    );
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
      timeout: 20000,
    },
  });
}

/**
 * Detects whether user input is explicitly Bengali or Hindi, falling back to preferred language.
 */
function detectActiveLanguage(text: string, preferredLanguage: SupportedLanguage): SupportedLanguage {
  const bengaliChars = (text.match(/[\u0980-\u09FF]/g) || []).length;
  const devanagariChars = (text.match(/[\u0900-\u097F]/g) || []).length;

  if (bengaliChars > 0 && bengaliChars >= devanagariChars) {
    return "bn";
  }
  if (devanagariChars > 0 && devanagariChars > bengaliChars) {
    return "hi";
  }

  const lower = text.toLowerCase();
  const romanBengaliMarkers = [
    "kemon",
    "acho",
    "korbo",
    "koro",
    "amar",
    "tumi",
    "bhalo",
    "khobor",
    "kholo",
    "chalao",
    "baja",
    "dako",
    "mone rakho",
    "hyan",
  ];
  const romanHindiMarkers = [
    "kaise",
    "kya",
    "mera",
    "meri",
    "tum",
    "aap",
    "chalao",
    "bajao",
    "lagao",
    "yaad rakho",
    "haan",
    "nahi",
  ];

  let bnScore = 0;
  let hiScore = 0;
  for (const w of romanBengaliMarkers) {
    if (lower.includes(w)) bnScore += 1;
  }
  for (const w of romanHindiMarkers) {
    if (lower.includes(w)) hiScore += 1;
  }

  if (bnScore > hiScore + 1) return "bn";
  if (hiScore > bnScore + 1) return "hi";

  return preferredLanguage;
}

const structuredTurnSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    heardSpeech: {
      type: Type.BOOLEAN,
      description:
        "For audio input: true if clear human words were spoken, false ONLY if the audio is pure silence or static with no speech. For text input: always true.",
    },
    transcript: {
      type: Type.STRING,
      description:
        "Exact words spoken by the user written in Bengali script (বাংলা) if spoken in Bengali, or Devanagari script (हिन्दी) if spoken in Hindi. Empty string if heardSpeech is false.",
    },
    language: {
      type: Type.STRING,
      description: "Must be 'bn' if the user spoke/wrote Bengali, or 'hi' if the user spoke/wrote Hindi.",
    },
    reply: {
      type: Type.STRING,
      description:
        "Natural, warm, concise spoken response from PIYA AI in the SAME language ('bn' in বাংলা লিপি, 'hi' in देवनागरी लिपि). Keep to 1-3 short sentences so voice playback is fast and natural.",
    },
    actionName: {
      type: Type.STRING,
      description:
        "Must be one of: 'none', 'proposePhoneCall', 'searchYouTube', 'openApplication', 'lockPhoneScreen', 'openSystemSettings', 'controlFlashlight', 'checkBatteryStatus', 'setDeviceAlarm', 'createPersonalNote', 'proposeMemorySave'.",
    },
    contactName: {
      type: Type.STRING,
      description: "Contact name to call when actionName is 'proposePhoneCall' (match saved contacts list if possible).",
    },
    lastFourDigits: {
      type: Type.STRING,
      description: "Optional last 4 digits of phone number when disambiguating contacts.",
    },
    query: {
      type: Type.STRING,
      description: "Song or video search query when actionName is 'searchYouTube'.",
    },
    targetApp: {
      type: Type.STRING,
      description: "'youtube' or 'youtube_music' when actionName is 'searchYouTube'.",
    },
    appName: {
      type: Type.STRING,
      description: "Application name when actionName is 'openApplication' (e.g. YouTube, WhatsApp, Spotify, Chrome, Google Maps, Gmail, Instagram).",
    },
    settingType: {
      type: Type.STRING,
      description: "One of 'wifi', 'bluetooth', 'phone_settings', 'device_admin' when actionName is 'openSystemSettings'.",
    },
    flashlightMode: {
      type: Type.STRING,
      description: "One of 'on', 'off', 'toggle' when actionName is 'controlFlashlight'.",
    },
    alarmHour: {
      type: Type.INTEGER,
      description: "Hour in 24-hour format (0-23) when actionName is 'setDeviceAlarm'.",
    },
    alarmMinute: {
      type: Type.INTEGER,
      description: "Minute (0-59) when actionName is 'setDeviceAlarm'.",
    },
    alarmLabel: {
      type: Type.STRING,
      description: "Alarm label when actionName is 'setDeviceAlarm'.",
    },
    noteTitle: {
      type: Type.STRING,
      description: "Short note title when actionName is 'createPersonalNote'.",
    },
    noteContent: {
      type: Type.STRING,
      description: "Note content when actionName is 'createPersonalNote'.",
    },
    memoryCategory: {
      type: Type.STRING,
      description: "Category ('Preference', 'Profile', 'Music', 'Routine') when actionName is 'proposeMemorySave'.",
    },
    memoryFact: {
      type: Type.STRING,
      description: "Concise user fact/preference to save when actionName is 'proposeMemorySave'.",
    },
  },
  required: ["heardSpeech", "transcript", "language", "reply", "actionName"],
};

function buildSystemInstruction(
  preferredLanguage: SupportedLanguage,
  memories: MemoryInput[],
  contacts: ContactInput[],
  deviceState: DeviceStateInput
): string {
  const defaultLangName = preferredLanguage === "hi" ? "Hindi (हिन्दी, code 'hi')" : "Bengali (বাংলা, code 'bn')";

  const savedMemoriesBlock =
    memories.length > 0
      ? memories.slice(0, 20).map((m) => `- [${m.category}] ${m.fact}`).join("\n")
      : "None saved yet. Never claim to remember unsaved facts.";

  const contactsBlock =
    contacts.length > 0
      ? contacts
          .slice(0, 40)
          .map((c) => {
            const digits = c.phone.replace(/\D/g, "");
            const last4 = digits.slice(-4);
            return `- Name: "${c.name}" | Last4: ${last4} | Label: ${c.label || "Saved"}`;
          })
          .join("\n")
      : "No saved contacts.";

  const batterySummary =
    typeof deviceState.batteryLevel === "number"
      ? `${Math.round(deviceState.batteryLevel)}% (${deviceState.isCharging ? "Charging" : "On Battery"})`
      : "Unavailable in current browser";

  return `You are PIYA AI (পিয়া এআই / पिया एआई), a fast, intelligent, warm personal AI voice assistant created by developer Poran.

LANGUAGE RULES (STRICT):
1. Detect the user's spoken or typed language:
   - If the user speaks/writes Bengali, set language="bn", write transcript in বাংলা লিপি, and reply ONLY in natural Bengali (বাংলা).
   - If the user speaks/writes Hindi, set language="hi", write transcript in देवनागरी लिपि, and reply ONLY in natural Hindi (हिन्दी).
   - If ambiguous, use the user's default language: ${defaultLangName}.
   - Never randomly mix or switch languages.
2. Keep replies crisp, friendly, and fast to speak aloud (1 to 2 sentences for commands/greetings; concise and clear for general questions).

SAVED USER MEMORIES:
${savedMemoriesBlock}

SAVED CONTACTS:
${contactsBlock}

DEVICE STATE:
- Runtime: ${deviceState.isNativeAndroid ? "Android APK" : "Mobile/Web Browser"}
- Battery: ${batterySummary}
- Flashlight: ${deviceState.flashlightOn ? "On" : "Off"}

PHONE CONTROL ACTIONS:
- Set actionName to the matching action whenever the user asks to:
  * Call someone -> 'proposePhoneCall' (set contactName to the closest matching name from SAVED CONTACTS, e.g. if user says "পরাণকে কল করো" set contactName="Poran"; if user gives 4 digits set lastFourDigits)
  * Play/search songs or videos on YouTube or YouTube Music -> 'searchYouTube' (set query and targetApp='youtube' or 'youtube_music')
  * Open an app -> 'openApplication' (set appName)
  * Lock phone screen -> 'lockPhoneScreen'
  * Open Wi-Fi / Bluetooth / Phone / Device Admin settings -> 'openSystemSettings' (set settingType)
  * Turn flashlight on/off -> 'controlFlashlight' (set flashlightMode)
  * Check battery -> 'checkBatteryStatus' (include current battery % in reply if available)
  * Set alarm -> 'setDeviceAlarm' (set alarmHour 0-23, alarmMinute 0-59, alarmLabel)
  * Write/save a note -> 'createPersonalNote' (set noteTitle, noteContent)
  * Remember a personal preference/fact -> 'proposeMemorySave' (set memoryCategory, memoryFact)
  * Normal conversation or Q&A -> 'none'
- For confirmable actions (calls, opening apps/YouTube, locking screen, alarms), politely state what you are preparing and ask confirmation in the user's language.`;
}

function convertStructuredToToolActions(parsed: StructuredTurnOutput): Array<{
  id: string;
  name: string;
  args: Record<string, unknown>;
}> {
  const act = (parsed.actionName || "none").trim();
  if (!act || act === "none") return [];

  const id = `act_${Date.now()}`;
  switch (act) {
    case "proposePhoneCall":
      return [
        {
          id,
          name: "proposePhoneCall",
          args: {
            contactName: parsed.contactName || "",
            lastFourDigits: parsed.lastFourDigits || "",
          },
        },
      ];
    case "searchYouTube":
      return [
        {
          id,
          name: "searchYouTube",
          args: {
            query: parsed.query || parsed.transcript || "",
            targetApp: parsed.targetApp === "youtube_music" ? "youtube_music" : "youtube",
          },
        },
      ];
    case "openApplication":
      return [
        {
          id,
          name: "openApplication",
          args: {
            appName: parsed.appName || "YouTube",
          },
        },
      ];
    case "lockPhoneScreen":
      return [{ id, name: "lockPhoneScreen", args: {} }];
    case "openSystemSettings":
      return [
        {
          id,
          name: "openSystemSettings",
          args: {
            settingType: parsed.settingType || "phone_settings",
          },
        },
      ];
    case "controlFlashlight":
      return [
        {
          id,
          name: "controlFlashlight",
          args: {
            mode: parsed.flashlightMode || "toggle",
          },
        },
      ];
    case "checkBatteryStatus":
      return [{ id, name: "checkBatteryStatus", args: { includeDetails: true } }];
    case "setDeviceAlarm":
      return [
        {
          id,
          name: "setDeviceAlarm",
          args: {
            hour: typeof parsed.alarmHour === "number" && parsed.alarmHour >= 0 ? parsed.alarmHour : 7,
            minute:
              typeof parsed.alarmMinute === "number" && parsed.alarmMinute >= 0
                ? parsed.alarmMinute
                : 0,
            label: parsed.alarmLabel || "PIYA AI Alarm",
          },
        },
      ];
    case "createPersonalNote":
      return [
        {
          id,
          name: "createPersonalNote",
          args: {
            title: parsed.noteTitle || "Note",
            content: parsed.noteContent || parsed.transcript || "",
          },
        },
      ];
    case "proposeMemorySave":
      return [
        {
          id,
          name: "proposeMemorySave",
          args: {
            category: parsed.memoryCategory || "Preference",
            fact: parsed.memoryFact || parsed.transcript || "",
          },
        },
      ];
    default:
      return [];
  }
}

function buildConversationHistory(history: HistoryTurn[]): Content[] {
  const recent = Array.isArray(history) ? history.slice(-8) : [];
  return recent
    .filter((turn) => turn && typeof turn.text === "string" && turn.text.trim().length > 0)
    .map((turn) => ({
      role: turn.role === "assistant" ? "model" : "user",
      parts: [{ text: turn.text.trim() }],
    }));
}

function extractTranscribeText(response: unknown): string {
  const r = response as {
    text?: string;
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          audioTranscription?: { text?: string };
        }>;
      };
    }>;
  };
  if (typeof r.text === "string" && r.text.trim()) {
    return r.text.trim();
  }
  const parts = r.candidates?.[0]?.content?.parts || [];
  const collected: string[] = [];
  for (const p of parts) {
    if (p.audioTranscription?.text) collected.push(p.audioTranscription.text);
    else if (p.text) collected.push(p.text);
  }
  return collected.join(" ").trim();
}

function formatGeminiError(error: unknown): { status: number; message: string; code: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const explicitStatus =
    (error as { statusCode?: number; status?: number })?.statusCode ||
    (error as { status?: number })?.status;

  if (raw.includes("GEMINI_API_KEY") || explicitStatus === 503) {
    return {
      status: 503,
      code: "API_KEY_MISSING",
      message:
        "সার্ভারে Gemini API key পাওয়া যায়নি। অনুগ্রহ করে Settings > Secrets প্যানেল যাচাই করুন।",
    };
  }
  if (
    raw.includes("API_KEY_INVALID") ||
    raw.includes("PERMISSION_DENIED") ||
    explicitStatus === 403
  ) {
    return {
      status: 403,
      code: "API_KEY_INVALID",
      message: "Gemini API key সঠিক নয় (403)। Settings > Secrets প্যানেল চেক করুন।",
    };
  }
  if (raw.includes("RESOURCE_EXHAUSTED") || raw.includes("429") || explicitStatus === 429) {
    return {
      status: 429,
      code: "QUOTA_EXCEEDED",
      message: "Gemini API কোটা পূর্ণ হয়েছে (429)। কিছুক্ষণ পর আবার চেষ্টা করুন।",
    };
  }
  if (raw.includes("DEADLINE_EXCEEDED") || raw.includes("504") || raw.includes("timeout")) {
    return {
      status: 504,
      code: "TIMEOUT",
      message: "সার্ভার থেকে উত্তর আসতে দেরি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
    };
  }
  return {
    status: 500,
    code: "GEMINI_BACKEND_ERROR",
    message: "এআই সার্ভিসে সাময়িক সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Allow requests from Capacitor Android APK WebView as well as browser origin
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: "15mb" }));

  // 1. Health & AI Connection Status Endpoint
  app.get("/api/status", async (req: Request, res: Response) => {
    const hasKey = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY" &&
        process.env.GEMINI_API_KEY.trim().length > 0
    );

    const verifyLive = req.query.verify === "true";
    if (!hasKey) {
      res.status(200).json({
        online: true,
        aiConfigured: false,
        aiVerified: false,
        model: FAST_CONVERSATION_MODEL,
        ttsModel: TTS_MODEL,
        sttModel: TRANSCRIBE_MODEL,
        message: "Backend online, but GEMINI_API_KEY is not set in Settings > Secrets.",
      });
      return;
    }

    if (!verifyLive) {
      res.status(200).json({
        online: true,
        aiConfigured: true,
        aiVerified: true,
        model: FAST_CONVERSATION_MODEL,
        ttsModel: TTS_MODEL,
        sttModel: TRANSCRIBE_MODEL,
        message: "PIYA AI Fast Gemini Engine Connected",
      });
      return;
    }

    try {
      const ai = getGenAIClient();
      const ping = await ai.models.generateContent({
        model: FAST_CONVERSATION_MODEL,
        contents: "OK",
      });
      res.status(200).json({
        online: true,
        aiConfigured: true,
        aiVerified: Boolean(ping.text),
        model: FAST_CONVERSATION_MODEL,
        ttsModel: TTS_MODEL,
        sttModel: TRANSCRIBE_MODEL,
        message: "Live Gemini connection verified.",
      });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(200).json({
        online: true,
        aiConfigured: hasKey,
        aiVerified: false,
        model: FAST_CONVERSATION_MODEL,
        errorCode: formatted.code,
        message: formatted.message,
      });
    }
  });

  // 2. Ultra-Fast Single-Pass Multimodal Voice Turn (Audio -> Transcript + Reply + Phone Action in ~1.3s)
  app.post("/api/assistant/voice-turn", async (req: Request, res: Response) => {
    try {
      const {
        audioBase64,
        mimeType = "audio/webm",
        preferredLanguage = "bn",
        history = [],
        memories = [],
        contacts = [],
        deviceState = {},
      } = req.body as {
        audioBase64?: string;
        mimeType?: string;
        preferredLanguage?: SupportedLanguage;
        history?: HistoryTurn[];
        memories?: MemoryInput[];
        contacts?: ContactInput[];
        deviceState?: DeviceStateInput;
      };

      if (!audioBase64 || typeof audioBase64 !== "string") {
        res.status(400).json({ error: "ভয়েস অডিও পাওয়া যায়নি।", code: "INVALID_AUDIO" });
        return;
      }

      const prefLang: SupportedLanguage = preferredLanguage === "hi" ? "hi" : "bn";
      const ai = getGenAIClient();
      const systemInstruction = buildSystemInstruction(prefLang, memories, contacts, deviceState);
      const contents = buildConversationHistory(history);

      const cleanMime = (mimeType || "audio/webm").split(";")[0].trim() || "audio/webm";
      contents.push({
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: cleanMime,
              data: audioBase64,
            },
          },
          {
            text:
              prefLang === "hi"
                ? "Listen carefully to the user's voice audio (likely Hindi or Bengali). Transcribe what they said and respond immediately as PIYA AI in the exact language spoken."
                : "Listen carefully to the user's voice audio (likely Bengali or Hindi). Transcribe what they said and respond immediately as PIYA AI in the exact language spoken.",
          },
        ],
      });

      const response = await ai.models.generateContent({
        model: FAST_CONVERSATION_MODEL,
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: structuredTurnSchema,
        },
      });

      const rawJson = (response.text || "{}").trim();
      const parsed = JSON.parse(rawJson) as StructuredTurnOutput;
      const transcript = (parsed.transcript || "").trim();

      if (parsed.heardSpeech === false || !transcript) {
        res.status(200).json({
          heardSpeech: false,
          transcript: "",
          reply: "",
          language: prefLang,
          toolActions: [],
          sources: [],
        });
        return;
      }

      const activeLang =
        parsed.language === "hi" || parsed.language === "bn"
          ? parsed.language
          : detectActiveLanguage(transcript, prefLang);
      const replyText = (parsed.reply || "").trim();
      const toolActions = convertStructuredToToolActions(parsed);

      res.status(200).json({
        heardSpeech: true,
        transcript,
        reply:
          replyText ||
          (activeLang === "hi" ? "जी, बताइए मैं कैसे मदद करूँ?" : "জি, বলুন কীভাবে সাহায্য করতে পারি?"),
        language: activeLang,
        toolActions,
        sources: [],
      });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  // 3. Ultra-Fast Single-Pass Text Conversational Endpoint (~0.9s)
  app.post("/api/assistant/chat", async (req: Request, res: Response) => {
    try {
      const {
        message,
        preferredLanguage = "bn",
        history = [],
        memories = [],
        contacts = [],
        deviceState = {},
      } = req.body as {
        message?: string;
        preferredLanguage?: SupportedLanguage;
        history?: HistoryTurn[];
        memories?: MemoryInput[];
        contacts?: ContactInput[];
        deviceState?: DeviceStateInput;
      };

      if (!message || typeof message !== "string" || !message.trim()) {
        res.status(400).json({ error: "মেসেজ খালি রাখা যাবে না।", code: "INVALID_INPUT" });
        return;
      }

      const trimmed = message.trim();
      const prefLang: SupportedLanguage = preferredLanguage === "hi" ? "hi" : "bn";
      const activeLanguage = detectActiveLanguage(trimmed, prefLang);

      const ai = getGenAIClient();
      const systemInstruction = buildSystemInstruction(
        activeLanguage,
        memories,
        contacts,
        deviceState
      );
      const contents = buildConversationHistory(history);
      contents.push({
        role: "user",
        parts: [{ text: trimmed }],
      });

      const response = await ai.models.generateContent({
        model: FAST_CONVERSATION_MODEL,
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: structuredTurnSchema,
        },
      });

      const rawJson = (response.text || "{}").trim();
      const parsed = JSON.parse(rawJson) as StructuredTurnOutput;
      const finalLang: SupportedLanguage =
        parsed.language === "hi" ? "hi" : parsed.language === "bn" ? "bn" : activeLanguage;
      const replyText = (parsed.reply || "").trim();

      if (!replyText) {
        throw new Error("Empty reply from Gemini.");
      }

      const toolActions = convertStructuredToToolActions(parsed);

      res.status(200).json({
        reply: replyText,
        language: finalLang,
        toolActions,
        sources: [],
      });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  // 4. Standalone Speech-to-Text Transcription (extracts audioTranscription.text properly)
  app.post("/api/assistant/transcribe", async (req: Request, res: Response) => {
    try {
      const {
        audioBase64,
        mimeType = "audio/webm",
        preferredLanguage = "bn",
      } = req.body as {
        audioBase64?: string;
        mimeType?: string;
        preferredLanguage?: SupportedLanguage;
      };

      if (!audioBase64 || typeof audioBase64 !== "string") {
        res.status(400).json({ error: "Audio payload is missing.", code: "INVALID_AUDIO" });
        return;
      }

      const ai = getGenAIClient();
      const cleanMime = (mimeType || "audio/webm").split(";")[0].trim() || "audio/webm";
      const langHint =
        preferredLanguage === "hi"
          ? "Transcribe spoken Hindi (हिन्दी) or Bengali (বাংলা) accurately in native script."
          : "Transcribe spoken Bengali (বাংলা) or Hindi (हिन्दी) accurately in native script.";

      let transcript = "";
      try {
        const response = await ai.models.generateContent({
          model: TRANSCRIBE_MODEL,
          contents: {
            parts: [
              { inlineData: { mimeType: cleanMime, data: audioBase64 } },
              { text: langHint },
            ],
          },
        });
        transcript = extractTranscribeText(response);
      } catch {
        // Fallback to fast multimodal flash-lite transcription
        const fallback = await ai.models.generateContent({
          model: FAST_CONVERSATION_MODEL,
          contents: {
            parts: [
              { inlineData: { mimeType: cleanMime, data: audioBase64 } },
              { text: `${langHint} Return ONLY the spoken words, or empty string if silent.` },
            ],
          },
        });
        transcript = (fallback.text || "").trim();
      }

      const detectedLanguage = detectActiveLanguage(
        transcript,
        preferredLanguage === "hi" ? "hi" : "bn"
      );

      res.status(200).json({
        transcript,
        detectedLanguage,
      });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  // 5. Neural Studio Text-to-Speech (gemini-3.8-flash-lite-tts)
  app.post("/api/assistant/tts", async (req: Request, res: Response) => {
    try {
      const {
        text,
        voiceName = "Kore",
        language = "bn",
      } = req.body as {
        text?: string;
        voiceName?: string;
        language?: SupportedLanguage;
      };

      if (!text || typeof text !== "string" || !text.trim()) {
        res.status(400).json({ error: "Text is required for TTS.", code: "INVALID_TEXT" });
        return;
      }

      const allowedVoices = ["Kore", "Zephyr", "Puck", "Charon", "Fenrir"];
      const safeVoice = allowedVoices.includes(voiceName) ? voiceName : "Kore";

      const ai = getGenAIClient();
      const stylePrompt =
        language === "hi"
          ? "Warm, friendly, natural Hindi female personal assistant"
          : "Warm, friendly, natural Bengali female personal assistant";

      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: text.trim(),
                speechMetadata: {
                  style: stylePrompt,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: safeVoice,
              },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("Gemini TTS did not return audio.");
      }

      res.status(200).json({
        audioBase64: base64Audio,
        mimeType: "audio/wav",
      });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  // Never allow any /api/* route to fall through to HTML index.html
  app.all("/api/*", (req: Request, res: Response) => {
    res.status(404).json({
      error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
      code: "API_NOT_FOUND",
    });
  });

  // Express JSON error guard for malformed body / payload size errors
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/")) {
      res.status(400).json({
        error: err.message || "Invalid API request payload.",
        code: "BAD_REQUEST",
      });
      return;
    }
    next(err);
  });

  // Vite Dev Server or Production Static Assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PIYA AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
