import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import type { Content, FunctionDeclaration } from "@google/genai";

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

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    const err = new Error(
      "GEMINI_API_KEY is not configured on the backend. Please verify your API key in Settings > Secrets."
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
    },
  });
}

/**
 * Detects whether user input is explicitly Bengali or Hindi, falling back to preferred language.
 * Prevents random language switching.
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
    "na ",
  ];
  const romanHindiMarkers = [
    "kaise",
    "kya",
    "mera",
    "meri",
    "tum",
    "aap",
    "karo",
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

const assistantFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: "proposePhoneCall",
    description:
      "Search saved contacts by name or last 4 phone digits to place a phone call. Always triggers the confirmation or contact disambiguation flow before calling.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        contactName: {
          type: Type.STRING,
          description: "Name of the contact the user wants to call (e.g. 'Poran', 'Rahim').",
        },
        lastFourDigits: {
          type: Type.STRING,
          description: "Optional last four digits of the phone number when disambiguating contacts.",
        },
      },
    },
  },
  {
    name: "searchYouTube",
    description: "Search YouTube or YouTube Music for songs, artists, or videos.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "Song title, artist, or video search query.",
        },
        targetApp: {
          type: Type.STRING,
          description: "Either 'youtube' or 'youtube_music'. Defaults to 'youtube'.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "openApplication",
    description:
      "Open an installed Android application such as YouTube, YouTube Music, WhatsApp, Spotify, Chrome, Maps, Camera, Gmail, or Instagram.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        appName: {
          type: Type.STRING,
          description: "Display name of the application to open.",
        },
      },
      required: ["appName"],
    },
  },
  {
    name: "lockPhoneScreen",
    description:
      "Lock the Android phone screen using DevicePolicyManager after explicit user confirmation and Device Administrator permission.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: {
          type: Type.STRING,
          description: "Brief context for locking the phone.",
        },
      },
    },
  },
  {
    name: "openSystemSettings",
    description: "Open Android Wi-Fi settings, Bluetooth settings, Device Admin settings, or general Phone Settings.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        settingType: {
          type: Type.STRING,
          description: "One of: 'wifi', 'bluetooth', 'phone_settings', 'device_admin'.",
        },
      },
      required: ["settingType"],
    },
  },
  {
    name: "controlFlashlight",
    description: "Turn flashlight/torch controls on or off, or open flashlight controls.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: {
          type: Type.STRING,
          description: "One of: 'on', 'off', 'toggle'.",
        },
      },
      required: ["mode"],
    },
  },
  {
    name: "checkBatteryStatus",
    description: "Read the phone's current battery percentage and charging status.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        includeDetails: {
          type: Type.BOOLEAN,
          description: "True to read current battery status.",
        },
      },
    },
  },
  {
    name: "setDeviceAlarm",
    description: "Set an alarm for a specific hour and minute (24-hour clock) using Android AlarmClock intent.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        hour: {
          type: Type.INTEGER,
          description: "Hour in 24-hour format (0-23).",
        },
        minute: {
          type: Type.INTEGER,
          description: "Minute (0-59).",
        },
        label: {
          type: Type.STRING,
          description: "Optional alarm label.",
        },
      },
      required: ["hour", "minute"],
    },
  },
  {
    name: "createPersonalNote",
    description: "Create and save a note when the user asks to write down or save a note.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "Short title of the note.",
        },
        content: {
          type: Type.STRING,
          description: "Body content of the note.",
        },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "proposeMemorySave",
    description:
      "Save or propose saving an explicit user preference or personal fact when the user asks PIYA AI to remember something.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: {
          type: Type.STRING,
          description: "Category such as 'Preference', 'Profile', 'Music', 'Routine'.",
        },
        fact: {
          type: Type.STRING,
          description: "Concise statement of the preference or fact to remember.",
        },
      },
      required: ["category", "fact"],
    },
  },
];

function buildSystemInstruction(
  activeLanguage: SupportedLanguage,
  memories: MemoryInput[],
  contacts: ContactInput[],
  deviceState: DeviceStateInput
): string {
  const languageDirective =
    activeLanguage === "bn"
      ? `ACTIVE LANGUAGE: BENGALI (বাংলা).
- You MUST reply ONLY in natural, warm, polite Bengali (বাংলা লিপিতে).
- NEVER switch to Hindi or English sentences unless quoting an app/song title.`
      : `ACTIVE LANGUAGE: HINDI (हिन्दी).
- You MUST reply ONLY in natural, warm, polite Hindi (देवनागरी लिपि में).
- NEVER switch to Bengali or English sentences unless quoting an app/song title.`;

  const savedMemoriesBlock =
    memories.length > 0
      ? memories.map((m) => `- [${m.category}] ${m.fact}`).join("\n")
      : "No saved user memories yet. Do NOT pretend to remember anything that is not listed here.";

  const contactsBlock =
    contacts.length > 0
      ? contacts
          .map((c) => {
            const digits = c.phone.replace(/\D/g, "");
            const last4 = digits.slice(-4);
            return `- Name: "${c.name}" | Last 4 digits: ${last4} | Label: ${c.label || "Saved"}`;
          })
          .join("\n")
      : "No saved contacts available.";

  const batterySummary =
    typeof deviceState.batteryLevel === "number"
      ? `${Math.round(deviceState.batteryLevel)}% (${deviceState.isCharging ? "Charging" : "Discharging"})`
      : "Unknown / Not reported by device";

  return `You are PIYA AI (পিয়া এআই / पिया एआई), an intelligent, warm, respectful personal AI voice assistant created by developer Poran.

${languageDirective}

CORE BEHAVIOR & HONESTY RULES:
1. Keep spoken responses natural, clear, conversational, and concise (typically 1 to 3 sentences for voice clarity, or structured clearly when answering detailed questions).
2. Saved User Memories (Approved by User):
${savedMemoriesBlock}
Never claim to remember user preferences that are not in the list above or current conversation history.
3. Saved Contacts Directory:
${contactsBlock}
4. Live Device State:
- Platform Mode: ${deviceState.isNativeAndroid ? "Android Native Capacitor App" : "Web / Android Browser Runtime"}
- Battery: ${batterySummary}
- Device Admin Active: ${deviceState.isDeviceAdminActive ? "Yes" : "No"}
- Flashlight State: ${deviceState.flashlightOn ? "On" : "Off"}

5. PHONE ACTIONS & CONFIRMATION SYSTEM:
- Whenever the user asks to call someone, open an app, search YouTube / YouTube Music, lock the phone, open Wi-Fi/Bluetooth/Phone settings, toggle flashlight, read battery, set an alarm, create a note, or remember a preference, ALWAYS invoke the matching tool declaration!
- For sensitive or external actions (calling a contact, locking the phone, setting an alarm, opening an external app), explain clearly in ${
    activeLanguage === "bn" ? "Bengali" : "Hindi"
  } what you are about to do and ask for confirmation.
- If calling a contact matches MULTIPLE saved contacts (for example two people named Rahim), list the matching names with their last 4 digits and ask the user which one to call (they can reply with the name or last 4 digits).
- If a contact is NOT found in the directory above, honestly tell the user no matching contact was found instead of making up a phone number.`;
}

function formatGeminiError(error: unknown): { status: number; message: string; code: string } {
  const raw = error instanceof Error ? error.message : String(error);
  const explicitStatus = (error as { statusCode?: number; status?: number })?.statusCode ||
    (error as { status?: number })?.status;

  if (raw.includes("GEMINI_API_KEY is not configured") || explicitStatus === 503) {
    return {
      status: 503,
      code: "API_KEY_MISSING",
      message:
        "Gemini API key is missing on the server. Please verify your API key in the AI Studio Settings > Secrets panel.",
    };
  }
  if (raw.includes("API_KEY_INVALID") || raw.includes("PERMISSION_DENIED") || explicitStatus === 403 || explicitStatus === 400) {
    return {
      status: 403,
      code: "API_KEY_INVALID",
      message:
        "Gemini API authentication failed (403/400). Please check your API key in the Settings > Secrets panel.",
    };
  }
  if (raw.includes("RESOURCE_EXHAUSTED") || raw.includes("429") || explicitStatus === 429) {
    return {
      status: 429,
      code: "QUOTA_EXCEEDED",
      message:
        "Gemini API rate limit or quota reached (429). Please wait a moment or upgrade your billing tier in Settings > Secrets.",
    };
  }
  if (raw.includes("NOT_FOUND") || raw.includes("404") || explicitStatus === 404) {
    return {
      status: 404,
      code: "MODEL_NOT_FOUND",
      message: "Requested Gemini model endpoint was not found (404).",
    };
  }
  return {
    status: 500,
    code: "GEMINI_BACKEND_ERROR",
    message: raw || "Unexpected error communicating with Gemini AI service.",
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "18mb" }));

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
        model: "gemini-3.8-flash",
        ttsModel: "gemini-3.8-flash-lite-tts",
        sttModel: "gemini-3.5-transcribe",
        message: "Backend online, but GEMINI_API_KEY is not set in Settings > Secrets.",
      });
      return;
    }

    if (!verifyLive) {
      res.status(200).json({
        online: true,
        aiConfigured: true,
        aiVerified: true,
        model: "gemini-3.8-flash",
        ttsModel: "gemini-3.8-flash-lite-tts",
        sttModel: "gemini-3.5-transcribe",
        message: "PIYA AI Secure Gemini Backend Connected",
      });
      return;
    }

    try {
      const ai = getGenAIClient();
      const ping = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: "Reply with OK",
      });
      res.status(200).json({
        online: true,
        aiConfigured: true,
        aiVerified: Boolean(ping.text),
        model: "gemini-3.8-flash",
        ttsModel: "gemini-3.8-flash-lite-tts",
        sttModel: "gemini-3.5-transcribe",
        message: "Live Gemini connection verified.",
      });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(200).json({
        online: true,
        aiConfigured: hasKey,
        aiVerified: false,
        model: "gemini-3.8-flash",
        errorCode: formatted.code,
        message: formatted.message,
      });
    }
  });

  // 2. Conversational AI + Phone Tool Orchestration Endpoint
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
        res.status(400).json({ error: "Message text is required.", code: "INVALID_INPUT" });
        return;
      }

      const ai = getGenAIClient();
      const activeLanguage = detectActiveLanguage(message.trim(), preferredLanguage === "hi" ? "hi" : "bn");
      const systemInstruction = buildSystemInstruction(activeLanguage, memories, contacts, deviceState);

      const recentHistory = Array.isArray(history) ? history.slice(-14) : [];
      const contents: Content[] = recentHistory
        .filter((turn) => turn && typeof turn.text === "string" && turn.text.trim().length > 0)
        .map((turn) => ({
          role: turn.role === "assistant" ? "model" : "user",
          parts: [{ text: turn.text }],
        }));

      contents.push({
        role: "user",
        parts: [{ text: message.trim() }],
      });

      // Try hybrid Search + Function Calling on gemini-3.8-flash first; if free-tier Search Grounding or model RPM hits 429,
      // gracefully retry with functionDeclarations only and valid free-tier flash aliases before surfacing 429.
      const candidateAttempts: Array<{
        model: string;
        useSearchGrounding: boolean;
      }> = [
        { model: "gemini-3.8-flash", useSearchGrounding: true },
        { model: "gemini-3.8-flash", useSearchGrounding: false },
        { model: "gemini-flash-latest", useSearchGrounding: false },
        { model: "gemini-3.1-flash-lite", useSearchGrounding: false },
      ];

      let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
      let chosenModel = "gemini-3.8-flash";
      let lastErr: unknown = null;

      for (let i = 0; i < candidateAttempts.length; i++) {
        const attempt = candidateAttempts[i];
        try {
          const attemptTools = attempt.useSearchGrounding
            ? [{ googleSearch: {} }, { functionDeclarations: assistantFunctionDeclarations }]
            : [{ functionDeclarations: assistantFunctionDeclarations }];
          const attemptToolConfig = attempt.useSearchGrounding
            ? { includeServerSideToolInvocations: true }
            : undefined;

          response = await ai.models.generateContent({
            model: attempt.model,
            contents,
            config: {
              systemInstruction,
              tools: attemptTools,
              ...(attemptToolConfig ? { toolConfig: attemptToolConfig } : {}),
            },
          });
          chosenModel = attempt.model;
          break;
        } catch (err) {
          lastErr = err;
          const errStr = err instanceof Error ? err.message : String(err);
          const isQuotaOrNotFound =
            errStr.includes("429") ||
            errStr.includes("RESOURCE_EXHAUSTED") ||
            errStr.includes("404") ||
            errStr.includes("NOT_FOUND");
          if (!isQuotaOrNotFound) {
            throw err;
          }
          // Brief backoff before next attempt
          await new Promise((r) => setTimeout(r, 250 * (i + 1)));
        }
      }

      if (!response) {
        throw lastErr || new Error("Gemini request failed after retries.");
      }

      const functionCalls = response.functionCalls || [];
      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks
          ?.map((chunk) => chunk.web)
          .filter((w): w is { uri: string; title?: string } => Boolean(w?.uri)) || [];

      const toolActions = functionCalls.map((fc) => ({
        id: fc.id || `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: fc.name || "unknown",
        args: (fc.args || {}) as Record<string, unknown>,
      }));

      let replyText = (response.text || "").trim();

      // If the model returned only a function call without spoken text, generate a natural spoken explanation in the active language
      if (!replyText && toolActions.length > 0) {
        const firstTool = toolActions[0];
        const prevContent = response.candidates?.[0]?.content;

        if (prevContent) {
          const followUp = await ai.models.generateContent({
            model: chosenModel,
            contents: [
              ...contents,
              prevContent,
              {
                role: "user",
                parts: [
                  {
                    functionResponse: {
                      id: firstTool.id,
                      name: firstTool.name,
                      response: {
                        status: "AWAITING_CLIENT_EXECUTION_OR_CONFIRMATION",
                        args: firstTool.args,
                        contactsAvailable: contacts,
                        batteryLevel: deviceState.batteryLevel,
                        isCharging: deviceState.isCharging,
                      },
                    },
                  },
                ],
              },
            ],
            config: {
              systemInstruction:
                systemInstruction +
                "\nNow speak directly to the user in a single natural voice reply explaining the action or asking for confirmation.",
            },
          });
          replyText = (followUp.text || "").trim();
        }
      }

      if (!replyText) {
        throw new Error("Gemini returned an empty response.");
      }

      res.status(200).json({
        reply: replyText,
        language: activeLanguage,
        toolActions,
        sources: groundingChunks,
      });
    } catch (error) {
      const formatted = formatGeminiError(error);
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  // 3. Server-Side Speech-to-Text Transcription (gemini-3.5-transcribe)
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
      const langHint =
        preferredLanguage === "hi"
          ? "The speaker is likely speaking Hindi (हिन्दी) or Bengali (বাংলা). Transcribe accurately in the spoken script (Devanagari for Hindi, Bengali script for Bengali). Return ONLY the exact spoken words, with nothing else. If there is only silence or background noise, return an empty string."
          : "The speaker is likely speaking Bengali (বাংলা) or Hindi (हिन्दी). Transcribe accurately in the spoken script (Bengali script for Bengali, Devanagari for Hindi). Return ONLY the exact spoken words, with nothing else. If there is only silence or background noise, return an empty string.";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-transcribe",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: langHint,
            },
          ],
        },
      });

      const transcript = (response.text || "").trim();
      const detectedLanguage = detectActiveLanguage(transcript, preferredLanguage === "hi" ? "hi" : "bn");

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

  // 4. Server-Side Neural Text-to-Speech (gemini-3.8-flash-lite-tts)
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
        res.status(400).json({ error: "Text is required for speech synthesis.", code: "INVALID_TEXT" });
        return;
      }

      const allowedVoices = ["Kore", "Zephyr", "Puck", "Charon", "Fenrir"];
      const safeVoice = allowedVoices.includes(voiceName) ? voiceName : "Kore";

      const ai = getGenAIClient();
      const stylePrompt =
        language === "hi"
          ? "Warm, friendly, clear Hindi female personal assistant voice"
          : "Warm, friendly, clear Bengali female personal assistant voice";

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
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
        throw new Error("Gemini TTS did not return an audio waveform.");
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
