/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BellRing,
  Brain,
  Mic,
  Play,
  Settings,
  Smartphone,
  Sparkles,
  User,
  Wrench,
  X,
} from "lucide-react";
import type {
  AlarmItem,
  AppSettings,
  AssistantVisualState,
  BatteryInfo,
  ChatMessage,
  ContactItem,
  GroundingSource,
  LanguageCode,
  MemoryItem,
  NoteItem,
  PendingAction,
  SystemConnectionStatus,
  ThemeId,
  UserProfile,
} from "./types/piya";
import {
  applyThemeCssVariables,
  DEFAULT_CONTACTS,
  parseVoiceConfirmationIntent,
  PIYA_THEMES,
  UI_COPY,
} from "./constants/themesAndCopy";
import {
  buildTelHref,
  buildYouTubeSearchUrl,
  checkDeviceAdminStatus,
  executeDeviceLock,
  executeSystemSettingsOpen,
  isNativeAndroidRuntime,
  matchContactsFromDirectory,
  PiyaNativePlugin,
  playAlarmChime,
  readLiveBatteryStatus,
  resolveAppLaunchTarget,
  setHardwareFlashlight,
} from "./services/androidBridge";
import {
  PiyaVoiceEngine,
  queryMicrophonePermission,
  requestExplicitMicrophoneAccess,
} from "./services/voiceEngine";
import type { LipSyncFrame, MicPermissionState } from "./services/voiceEngine";
import { PiyaCharacter3D } from "./components/PiyaCharacter3D";
import { AssistantFullScreen } from "./components/AssistantFullScreen";
import { PhoneActionsPanel } from "./components/PhoneActionsPanel";
import { MemoryVaultPanel } from "./components/MemoryVaultPanel";
import { SettingsModal } from "./components/SettingsModal";
import { ProfileModal } from "./components/ProfileModal";
import { AndroidArchitecturePanel } from "./components/AndroidArchitecturePanel";

type ActiveTab = "home" | "actions" | "memory" | "android";

const STORAGE_KEYS = {
  settings: "piya_ai_settings_v1",
  profile: "piya_ai_profile_v1",
  contacts: "piya_ai_contacts_v1",
  memories: "piya_ai_memories_v1",
  notes: "piya_ai_notes_v1",
  alarms: "piya_ai_alarms_v1",
  history: "piya_ai_history_v1",
};

const DEFAULT_SETTINGS: AppSettings = {
  language: "bn",
  voiceName: "Kore",
  speechSpeed: 1.0,
  theme: "classic-cyan",
  characterMode: "3d-rig",
  memoryEnabled: true,
  autoConfirmMemory: false,
  preferNeuralTts: true,
};

const DEFAULT_PROFILE: UserProfile = {
  displayName: "Poran",
  email: "",
  signedIn: true,
};

function loadStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("home");
  const [fullScreenAssistant, setFullScreenAssistant] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [settings, setSettings] = useState<AppSettings>(() =>
    loadStoredJson<AppSettings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS)
  );
  const [profile, setProfile] = useState<UserProfile>(() =>
    loadStoredJson<UserProfile>(STORAGE_KEYS.profile, DEFAULT_PROFILE)
  );
  const [contacts, setContacts] = useState<ContactItem[]>(() =>
    loadStoredJson<ContactItem[]>(STORAGE_KEYS.contacts, DEFAULT_CONTACTS)
  );
  const [memories, setMemories] = useState<MemoryItem[]>(() =>
    loadStoredJson<MemoryItem[]>(STORAGE_KEYS.memories, [])
  );
  const [notes, setNotes] = useState<NoteItem[]>(() =>
    loadStoredJson<NoteItem[]>(STORAGE_KEYS.notes, [])
  );
  const [alarms, setAlarms] = useState<AlarmItem[]>(() =>
    loadStoredJson<AlarmItem[]>(STORAGE_KEYS.alarms, [])
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadStoredJson<ChatMessage[]>(STORAGE_KEYS.history, [])
  );

  const [visualState, setVisualState] = useState<AssistantVisualState>("idle");
  const [micPermission, setMicPermission] = useState<MicPermissionState>("prompt");
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [connectionStatus, setConnectionStatus] = useState<SystemConnectionStatus>({
    online: true,
    aiConfigured: true,
    aiVerified: false,
    checking: false,
    message: "Checking secure backend...",
  });

  const [lipSync, setLipSync] = useState<LipSyncFrame>({
    mouthOpen: 0,
    mouthSpread: 0.35,
    energy: 0,
  });
  const [micLevel, setMicLevel] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [actionStatusToast, setActionStatusToast] = useState<string | null>(null);
  const [ringingAlarm, setRingingAlarm] = useState<AlarmItem | null>(null);

  const [battery, setBattery] = useState<BatteryInfo>({
    supported: false,
    level: null,
    charging: null,
  });
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [deviceAdminActive, setDeviceAdminActive] = useState(false);

  const voiceEngineRef = useRef<PiyaVoiceEngine | null>(null);
  if (!voiceEngineRef.current) {
    voiceEngineRef.current = new PiyaVoiceEngine();
  }

  // Sync CSS theme variables and document lang
  useEffect(() => {
    applyThemeCssVariables(settings.theme);
    document.documentElement.lang = settings.language;
    window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.contacts, JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.memories, JSON.stringify(memories));
  }, [memories]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.alarms, JSON.stringify(alarms));
  }, [alarms]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(messages.slice(-40)));
  }, [messages]);

  const checkBackendStatus = useCallback(async (verifyLive = false) => {
    setConnectionStatus((prev) => ({ ...prev, checking: true }));
    try {
      const resp = await fetch(`/api/status${verifyLive ? "?verify=true" : ""}`);
      if (!resp.ok) {
        throw new Error(`Backend status returned ${resp.status}`);
      }
      const data = (await resp.json()) as {
        online: boolean;
        aiConfigured: boolean;
        aiVerified: boolean;
        message: string;
        errorCode?: string;
      };
      setConnectionStatus({
        online: data.online,
        aiConfigured: data.aiConfigured,
        aiVerified: data.aiVerified,
        checking: false,
        message: data.message,
        errorCode: data.errorCode,
      });
    } catch (err) {
      setConnectionStatus({
        online: false,
        aiConfigured: false,
        aiVerified: false,
        checking: false,
        message:
          err instanceof Error ? err.message : "Unable to reach PIYA AI backend server.",
      });
    }
  }, []);

  const refreshDeviceTelemetry = useCallback(async () => {
    const bat = await readLiveBatteryStatus();
    setBattery(bat);
    const admin = await checkDeviceAdminStatus();
    setDeviceAdminActive(admin);
  }, []);

  // Initial mount checks + Android/Browser lifecycle safety
  useEffect(() => {
    queryMicrophonePermission().then(setMicPermission);
    checkBackendStatus(false);
    refreshDeviceTelemetry();

    const handleOnline = () => {
      setIsOnline(true);
      checkBackendStatus(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setErrorBanner(
        settings.language === "bn"
          ? "ইন্টারনেট সংযোগ বিচ্ছিন্ন হয়েছে। পিয়া এআই অনলাইন সংযোগ ছাড়া উত্তর তৈরি করতে পারে না।"
          : "इंटरनेट कनेक्शन टूट गया है। पिया एआई ऑनलाइन कनेक्शन के बिना उत्तर नहीं दे सकती।"
      );
    };
    const handleVisibilityChange = () => {
      // Never continuously listen in the background when app/tab is hidden
      if (document.hidden) {
        voiceEngineRef.current?.cancelListening();
        setVisualState((s) => (s === "listening" ? "idle" : s));
        setMicLevel(0);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      voiceEngineRef.current?.cancelListening();
      voiceEngineRef.current?.stopSpeaking();
    };
  }, [checkBackendStatus, refreshDeviceTelemetry, settings.language]);

  // Active In-App Alarm Scheduler
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      const curH = now.getHours();
      const curM = now.getMinutes();
      const curS = now.getSeconds();
      if (curS > 2) return;

      setAlarms((prev) =>
        prev.map((al) => {
          if (al.enabled && !al.triggeredToday && al.hour === curH && al.minute === curM) {
            playAlarmChime();
            setRingingAlarm(al);
            return { ...al, triggeredToday: true };
          }
          return al;
        })
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const speakAssistantReply = useCallback(
    async (text: string, lang: LanguageCode) => {
      if (!voiceEngineRef.current) return;
      setVisualState("speaking");
      await voiceEngineRef.current.speakResponse({
        text,
        language: lang,
        voiceName: settings.voiceName,
        speechSpeed: settings.speechSpeed,
        preferNeuralTts: settings.preferNeuralTts,
        onStart: () => setVisualState("speaking"),
        onLipSyncFrame: (frame) => setLipSync(frame),
        onEnd: () => {
          setLipSync({ mouthOpen: 0, mouthSpread: 0.35, energy: 0 });
          setVisualState("idle");
        },
        onError: (msg) => {
          setErrorBanner(`Voice synthesis notice: ${msg}`);
        },
      });
    },
    [settings.preferNeuralTts, settings.speechSpeed, settings.voiceName]
  );

  const appendMessage = useCallback(
    (
      role: "user" | "assistant",
      text: string,
      language: LanguageCode,
      extra?: { sources?: GroundingSource[]; actionBadge?: string; isError?: boolean }
    ) => {
      const entry: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role,
        text,
        language,
        timestamp: new Date().toISOString(),
        sources: extra?.sources,
        actionBadge: extra?.actionBadge,
        isError: extra?.isError,
      };
      setMessages((prev) => [...prev, entry]);
    },
    []
  );

  // =========================================================================
  // PHONE ACTION CONFIRMATION & EXECUTION HANDLERS
  // =========================================================================
  const prepareCallAction = useCallback(
    (
      contactName?: string,
      lastFourDigits?: string,
      activeLang: LanguageCode = settings.language
    ): { pending: PendingAction | null; spokenOverride?: string } => {
      const matches = matchContactsFromDirectory(contacts, contactName, lastFourDigits);

      if (matches.length === 0) {
        const notFoundMsg =
          activeLang === "bn"
            ? `দুঃখিত, "${contactName || lastFourDigits || ""}" নামে কোনো সেভ করা কন্টাক্ট পাওয়া যায়নি।`
            : `क्षमा करें, "${contactName || lastFourDigits || ""}" नाम का कोई सेव किया गया कॉन्टैक्ट नहीं मिला।`;
        return { pending: null, spokenOverride: notFoundMsg };
      }

      if (matches.length === 1) {
        const target = matches[0];
        const explain =
          activeLang === "bn"
            ? `আমি ${target.name}-এর নম্বর (${target.phone}) পেয়েছি। আপনি কি কল করতে চান?`
            : `मुझे ${target.name} का कॉन्टैक्ट (${target.phone}) मिल गया है। क्या मैं कॉल लगाऊँ?`;
        return {
          pending: {
            id: `pa_${Date.now()}`,
            type: "call_confirm",
            title: activeLang === "bn" ? `কল নিশ্চিতকরণ: ${target.name}` : `कॉल पुष्टि: ${target.name}`,
            explanation: explain,
            selectedContact: target,
            intentHref: isNativeAndroidRuntime() ? undefined : buildTelHref(target.phone),
          },
          spokenOverride: explain,
        };
      }

      const namesSummary = matches
        .map((m) => `${m.name} (${m.phone.replace(/\D/g, "").slice(-4)})`)
        .join(", ");
      const disambiguateMsg =
        activeLang === "bn"
          ? `একাধিক কন্টাক্ট পাওয়া গেছে: ${namesSummary}। অনুগ্রহ করে নাম অথবা নম্বরের শেষ চারটি ডিজিট বলুন।`
          : `एक से अधिक कॉन्टैक्ट मिले हैं: ${namesSummary}। कृपया सही कॉन्टैक्ट चुनें या नंबर के आखिरी चार अंक बताएँ।`;

      return {
        pending: {
          id: `pa_${Date.now()}`,
          type: "call_disambiguate",
          title:
            activeLang === "bn"
              ? `${matches.length}টি মিল পাওয়া গেছে — কন্টাক্ট বেছে নিন`
              : `${matches.length} कॉन्टैक्ट मिले — सही कॉन्टैक्ट चुनें`,
          explanation: disambiguateMsg,
          matchedContacts: matches,
        },
        spokenOverride: disambiguateMsg,
      };
    },
    [contacts, settings.language]
  );

  const handleSelectDisambiguatedContact = useCallback(
    async (contact: ContactItem) => {
      const lang = settings.language;
      const explain =
        lang === "bn"
          ? `${contact.name} (${contact.phone}) নির্বাচন করা হয়েছে। এখন কি কল করব?`
          : `${contact.name} (${contact.phone}) चुना गया है। क्या अब कॉल करूँ?`;

      setPendingAction({
        id: `pa_${Date.now()}`,
        type: "call_confirm",
        title: lang === "bn" ? `কল নিশ্চিতকরণ: ${contact.name}` : `कॉल पुष्टि: ${contact.name}`,
        explanation: explain,
        selectedContact: contact,
        intentHref: isNativeAndroidRuntime() ? undefined : buildTelHref(contact.phone),
      });
      appendMessage("assistant", explain, lang, { actionBadge: "Confirm Call" });
      await speakAssistantReply(explain, lang);
    },
    [appendMessage, settings.language, speakAssistantReply]
  );

  const handleConfirmPendingAction = useCallback(async () => {
    if (!pendingAction) return;
    const act = pendingAction;
    setPendingAction(null);
    const lang = settings.language;

    if (act.type === "call_confirm" && act.selectedContact) {
      if (isNativeAndroidRuntime()) {
        try {
          await PiyaNativePlugin.placeCall({ phoneNumber: act.selectedContact.phone });
        } catch (err) {
          setErrorBanner(err instanceof Error ? err.message : "Failed to initiate Android call.");
          return;
        }
      }
      const msg =
        lang === "bn"
          ? `${act.selectedContact.name}-কে এখন কল করা হচ্ছে।`
          : `अब ${act.selectedContact.name} को कॉल लगाया जा रहा है।`;
      appendMessage("assistant", msg, lang, { actionBadge: "Calling" });
      await speakAssistantReply(msg, lang);
      return;
    }

    if (act.type === "youtube_search" && act.youtubeQuery) {
      if (isNativeAndroidRuntime()) {
        await PiyaNativePlugin.openYoutubeSearch({
          query: act.youtubeQuery,
          musicOnly: act.youtubePlatform === "youtube_music",
        }).catch(() => {});
      }
      const msg =
        lang === "bn"
          ? `ইউটিউবে "${act.youtubeQuery}" খোলা হচ্ছে।`
          : `YouTube पर "${act.youtubeQuery}" खोला जा रहा है।`;
      appendMessage("assistant", msg, lang, { actionBadge: "YouTube" });
      await speakAssistantReply(msg, lang);
      return;
    }

    if (act.type === "open_app" && act.appName) {
      if (isNativeAndroidRuntime()) {
        const target = resolveAppLaunchTarget(act.appName);
        await PiyaNativePlugin.openApp({
          packageName: target.packageName,
          appName: act.appName,
          fallbackUrl: target.href,
        }).catch(() => {});
      }
      const msg =
        lang === "bn"
          ? `${act.appName} খোলা হচ্ছে।`
          : `${act.appName} खोला जा रहा है।`;
      appendMessage("assistant", msg, lang, { actionBadge: "Open App" });
      await speakAssistantReply(msg, lang);
      return;
    }

    if (act.type === "lock_phone") {
      const lockRes = await executeDeviceLock();
      setActionStatusToast(lockRes.message);
      const msg = lockRes.locked
        ? lang === "bn"
          ? "ফোন লক করা হয়েছে।"
          : "फ़ोन लॉक कर दिया गया है।"
        : lang === "bn"
        ? `ফোন লক করতে হলে ইনস্টল করা Android APK-তে Device Administrator অনুমতি সক্রিয় করতে হবে। (${lockRes.message})`
        : `फ़ोन लॉक करने के लिए इंस्टॉल किए गए Android APK में Device Administrator अनुमति सक्रिय होनी चाहिए। (${lockRes.message})`;
      appendMessage("assistant", msg, lang, {
        actionBadge: lockRes.locked ? "Phone Locked" : "Device Admin Required",
      });
      await speakAssistantReply(msg, lang);
      return;
    }

    if (act.type === "open_settings" && act.settingSection) {
      const res = await executeSystemSettingsOpen(act.settingSection);
      setActionStatusToast(res.message);
      appendMessage("assistant", res.message, lang, { actionBadge: "Settings" });
      return;
    }

    if (act.type === "set_alarm" && act.alarmData) {
      const { hour, minute, label } = act.alarmData;
      const newAlarm: AlarmItem = {
        id: `alm_${Date.now()}`,
        hour,
        minute,
        label,
        enabled: true,
      };
      setAlarms((prev) => [newAlarm, ...prev]);
      if (isNativeAndroidRuntime()) {
        await PiyaNativePlugin.setAlarm({ hour, minute, label }).catch(() => {});
      }
      const formattedTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      const msg =
        lang === "bn"
          ? `${formattedTime} সময়ের জন্য "${label}" অ্যালার্ম সেট করা হয়েছে।`
          : `${formattedTime} बजे के लिए "${label}" अलार्म सेट कर दिया गया है।`;
      appendMessage("assistant", msg, lang, { actionBadge: "Alarm Set" });
      await speakAssistantReply(msg, lang);
      return;
    }

    if (act.type === "save_memory" && act.memoryData) {
      const item: MemoryItem = {
        id: `mem_${Date.now()}`,
        category: act.memoryData.category,
        fact: act.memoryData.fact,
        createdAt: new Date().toISOString(),
      };
      setMemories((prev) => [item, ...prev]);
      const msg =
        lang === "bn"
          ? "আপনার পছন্দটি নিরাপদে মেমরিতে সংরক্ষণ করা হয়েছে।"
          : "आपकी पसंद सुरक्षित रूप से मेमोरी में सहेज ली गई है।";
      appendMessage("assistant", msg, lang, { actionBadge: "Memory Saved" });
      await speakAssistantReply(msg, lang);
    }
  }, [appendMessage, pendingAction, settings.language, speakAssistantReply]);

  const handleCancelPendingAction = useCallback(async () => {
    setPendingAction(null);
    const lang = settings.language;
    const msg =
      lang === "bn"
        ? "ঠিক আছে, কাজটি বাতিল করা হয়েছে।"
        : "ठीक है, यह कार्य रद्द कर दिया गया है।";
    appendMessage("assistant", msg, lang, { actionBadge: "Cancelled" });
    await speakAssistantReply(msg, lang);
  }, [appendMessage, settings.language, speakAssistantReply]);

  // =========================================================================
  // CORE CONVERSATIONAL AI TURN PROCESSOR
  // =========================================================================
  const processUserUtterance = useCallback(
    async (rawText: string, detectedLangHint?: LanguageCode) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;

      if (!isOnline) {
        setErrorBanner(UI_COPY[settings.language].offlineMode);
        return;
      }

      setErrorBanner(null);
      const turnLang = detectedLangHint || settings.language;

      // 1. Check if user is answering an active PendingAction confirmation or 4-digit contact selection!
      if (pendingAction) {
        const parsed = parseVoiceConfirmationIntent(trimmed);

        if (pendingAction.type === "call_disambiguate" && pendingAction.matchedContacts) {
          if (parsed.fourDigits) {
            const matchedBy4 = pendingAction.matchedContacts.find((c) =>
              c.phone.replace(/\D/g, "").endsWith(parsed.fourDigits!)
            );
            if (matchedBy4) {
              appendMessage("user", trimmed, turnLang);
              await handleSelectDisambiguatedContact(matchedBy4);
              return;
            }
          }
          // Check if user spoke the full name of one of the candidates
          const matchedByName = pendingAction.matchedContacts.find((c) =>
            c.name.toLowerCase().includes(trimmed.toLowerCase())
          );
          if (matchedByName) {
            appendMessage("user", trimmed, turnLang);
            await handleSelectDisambiguatedContact(matchedByName);
            return;
          }
          if (parsed.decision === "cancel") {
            appendMessage("user", trimmed, turnLang);
            await handleCancelPendingAction();
            return;
          }
        } else {
          if (parsed.decision === "confirm") {
            appendMessage("user", trimmed, turnLang);
            // If it's a web link intent (e.g. tel: or https://youtube), keep an actionable launch card if not native, or execute directly!
            if (pendingAction.intentHref && !isNativeAndroidRuntime()) {
              // Trigger safe anchor navigation for tel: URI; for http keep clickable or navigate
              if (pendingAction.intentHref.startsWith("tel:")) {
                window.location.href = pendingAction.intentHref;
              }
            }
            await handleConfirmPendingAction();
            return;
          }
          if (parsed.decision === "cancel") {
            appendMessage("user", trimmed, turnLang);
            await handleCancelPendingAction();
            return;
          }
        }
      }

      appendMessage("user", trimmed, turnLang);
      setVisualState("thinking");

      try {
        const freshBattery = await readLiveBatteryStatus();
        setBattery(freshBattery);

        const resp = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            preferredLanguage: settings.language,
            history: messages.slice(-12).map((m) => ({
              role: m.role,
              text: m.text,
            })),
            memories: settings.memoryEnabled ? memories : [],
            contacts,
            deviceState: {
              batteryLevel: freshBattery.level,
              isCharging: freshBattery.charging,
              isNativeAndroid: isNativeAndroidRuntime(),
              isDeviceAdminActive: deviceAdminActive,
              flashlightOn,
            },
          }),
        });

        const data = (await resp.json()) as {
          reply?: string;
          language?: LanguageCode;
          toolActions?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
          sources?: GroundingSource[];
          error?: string;
        };

        if (!resp.ok || !data.reply) {
          throw new Error(data.error || `Gemini service error (${resp.status})`);
        }

        const replyLang: LanguageCode = data.language === "hi" ? "hi" : "bn";
        if (replyLang !== settings.language) {
          updateSettings({ language: replyLang });
        }

        let finalSpokenReply = data.reply;
        let actionBadge: string | undefined;

        // Process structured tool calls returned by Gemini
        if (data.toolActions && data.toolActions.length > 0) {
          for (const tool of data.toolActions) {
            const args = tool.args || {};

            if (tool.name === "proposePhoneCall") {
              const callPrep = prepareCallAction(
                typeof args.contactName === "string" ? args.contactName : undefined,
                typeof args.lastFourDigits === "string" ? args.lastFourDigits : undefined,
                replyLang
              );
              setPendingAction(callPrep.pending);
              if (callPrep.spokenOverride) {
                finalSpokenReply = callPrep.spokenOverride;
              }
              actionBadge = "Phone Call";
            } else if (tool.name === "searchYouTube") {
              const q = String(args.query || "").trim() || trimmed;
              const platform =
                args.targetApp === "youtube_music" ? "youtube_music" : "youtube";
              const url = buildYouTubeSearchUrl(q, platform);
              setPendingAction({
                id: `pa_${Date.now()}`,
                type: "youtube_search",
                title:
                  platform === "youtube_music"
                    ? `YouTube Music: ${q}`
                    : `YouTube Search: ${q}`,
                explanation:
                  replyLang === "bn"
                    ? `"${q}" এর জন্য ইউটিউব খোলার জন্য নিশ্চিত করুন।`
                    : `"${q}" को YouTube पर खोलने के लिए पुष्टि करें।`,
                youtubeQuery: q,
                youtubePlatform: platform,
                intentHref: isNativeAndroidRuntime() ? undefined : url,
              });
              actionBadge = "YouTube Search";
            } else if (tool.name === "openApplication") {
              const appName = String(args.appName || "App");
              const target = resolveAppLaunchTarget(appName);
              setPendingAction({
                id: `pa_${Date.now()}`,
                type: "open_app",
                title: `Open ${target.label}`,
                explanation:
                  replyLang === "bn"
                    ? `${target.label} অ্যাপটি খুলতে চান?`
                    : `क्या आप ${target.label} ऐप खोलना चाहते हैं?`,
                appName: target.label,
                intentHref: isNativeAndroidRuntime() || !target.href ? undefined : target.href,
              });
              actionBadge = `Open ${target.label}`;
            } else if (tool.name === "lockPhoneScreen") {
              setPendingAction({
                id: `pa_${Date.now()}`,
                type: "lock_phone",
                title: replyLang === "bn" ? "ফোন স্ক্রিন লক নিশ্চিতকরণ" : "फ़ोन स्क्रीन लॉक पुष्टि",
                explanation:
                  replyLang === "bn"
                    ? "পিয়া এআই Android DevicePolicyManager ব্যবহার করে ফোন লক করবে। আপনি কি নিশ্চিত?"
                    : "पिया एआई Android DevicePolicyManager का उपयोग करके फ़ोन लॉक करेगी। क्या आप पुष्टि करते हैं?",
              });
              actionBadge = "Lock Screen";
            } else if (tool.name === "openSystemSettings") {
              const rawSec = String(args.settingType || "phone_settings");
              const sec: "wifi" | "bluetooth" | "phone_settings" | "device_admin" =
                rawSec === "wifi" || rawSec === "bluetooth" || rawSec === "device_admin"
                  ? rawSec
                  : "phone_settings";
              const sysPreview = await executeSystemSettingsOpen(sec);
              setPendingAction({
                id: `pa_${Date.now()}`,
                type: "open_settings",
                title: `Open ${sec.replace("_", " ").toUpperCase()}`,
                explanation: sysPreview.message,
                settingSection: sec,
                intentHref: sysPreview.intentHref,
              });
              actionBadge = "System Settings";
            } else if (tool.name === "controlFlashlight") {
              const mode = String(args.mode || "toggle");
              const nextEnable = mode === "on" ? true : mode === "off" ? false : !flashlightOn;
              const torchRes = await setHardwareFlashlight(nextEnable);
              setFlashlightOn(torchRes.enabled);
              if (!torchRes.success) {
                finalSpokenReply =
                  replyLang === "bn"
                    ? `এই ব্রাউজার বা ডিভাইসে ফ্ল্যাশলাইট হার্ডওয়্যার পাওয়া যায়নি। (${torchRes.message})`
                    : `इस ब्राउज़र या डिवाइस पर फ़्लैशलाइट हार्डवेयर उपलब्ध नहीं है। (${torchRes.message})`;
              }
              actionBadge = "Flashlight";
            } else if (tool.name === "checkBatteryStatus") {
              if (!freshBattery.supported || freshBattery.level === null) {
                finalSpokenReply =
                  replyLang === "bn"
                    ? "দুঃখিত, আপনার বর্তমান ব্রাউজার ব্যাটারির তথ্য প্রদান করছে না। Android APK-তে এটি সরাসরি কাজ করে।"
                    : "क्षमा करें, आपका वर्तमान ब्राउज़र बैटरी की जानकारी प्रदान नहीं कर रहा है। Android APK में यह सीधे काम करता है।";
              }
              actionBadge = "Battery Readout";
            } else if (tool.name === "setDeviceAlarm") {
              const hour = Math.max(0, Math.min(23, Number(args.hour ?? 7)));
              const minute = Math.max(0, Math.min(59, Number(args.minute ?? 0)));
              const label = String(args.label || "PIYA AI Alarm");
              const tStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
              setPendingAction({
                id: `pa_${Date.now()}`,
                type: "set_alarm",
                title: `Set Alarm · ${tStr}`,
                explanation:
                  replyLang === "bn"
                    ? `${tStr} সময়ে "${label}" অ্যালার্ম সেট করতে চান?`
                    : `क्या आप ${tStr} बजे के लिए "${label}" अलार्म सेट करना चाहते हैं?`,
                alarmData: { hour, minute, label },
              });
              actionBadge = `Alarm ${tStr}`;
            } else if (tool.name === "createPersonalNote") {
              const title = String(args.title || "Voice Note");
              const content = String(args.content || trimmed);
              const newNote: NoteItem = {
                id: `nt_${Date.now()}`,
                title,
                content,
                createdAt: new Date().toISOString(),
              };
              setNotes((prev) => [newNote, ...prev]);
              actionBadge = "Note Saved";
            } else if (tool.name === "proposeMemorySave" && settings.memoryEnabled) {
              const category = String(args.category || "Preference");
              const fact = String(args.fact || "");
              if (fact) {
                if (settings.autoConfirmMemory) {
                  setMemories((prev) => [
                    {
                      id: `mem_${Date.now()}`,
                      category,
                      fact,
                      createdAt: new Date().toISOString(),
                    },
                    ...prev,
                  ]);
                  actionBadge = "Memory Saved";
                } else {
                  setPendingAction({
                    id: `pa_${Date.now()}`,
                    type: "save_memory",
                    title:
                      replyLang === "bn"
                        ? "মেমরিতে সংরক্ষণের অনুমতি"
                        : "मेमोरी में सहेजने की अनुमति",
                    explanation:
                      replyLang === "bn"
                        ? `পিয়া এআই কি এই তথ্যটি মনে রাখবে: "${fact}"?`
                        : `क्या पिया एआई यह जानकारी याद रखे: "${fact}"?`,
                    memoryData: { category, fact },
                  });
                  actionBadge = "Approve Memory";
                }
              }
            }
          }
        }

        appendMessage("assistant", finalSpokenReply, replyLang, {
          sources: data.sources,
          actionBadge,
        });
        await speakAssistantReply(finalSpokenReply, replyLang);
      } catch (err) {
        setVisualState("idle");
        const errMsg =
          err instanceof Error
            ? err.message
            : "Failed to generate response from Gemini backend.";
        setErrorBanner(errMsg);
        appendMessage("assistant", errMsg, turnLang, { isError: true });
      }
    },
    [
      appendMessage,
      contacts,
      deviceAdminActive,
      flashlightOn,
      handleCancelPendingAction,
      handleConfirmPendingAction,
      handleSelectDisambiguatedContact,
      isOnline,
      memories,
      messages,
      pendingAction,
      prepareCallAction,
      settings.autoConfirmMemory,
      settings.language,
      settings.memoryEnabled,
      speakAssistantReply,
    ]
  );

  // =========================================================================
  // EXPLICIT MICROPHONE ACTIVATION & TRANSCRIPTION
  // =========================================================================
  const finishActiveMicCapture = useCallback(async () => {
    if (!voiceEngineRef.current) return;
    setVisualState("thinking");
    setMicLevel(0);
    try {
      const { transcript, detectedLanguage } =
        await voiceEngineRef.current.finishListeningAndTranscribe(settings.language);
      setInterimTranscript("");
      if (!transcript.trim()) {
        setVisualState("idle");
        setErrorBanner(
          settings.language === "bn"
            ? "কোনো স্পষ্ট কথা শোনা যায়নি। অনুগ্রহ করে আবার মাইক্রোফোন ট্যাপ করে বলুন।"
            : "कोई स्पष्ट आवाज़ सुनाई नहीं दी। कृपया माइक्रोफ़ोन टैप करके फिर से बोलें।"
        );
        return;
      }
      await processUserUtterance(transcript, detectedLanguage);
    } catch (err) {
      setVisualState("idle");
      setInterimTranscript("");
      setErrorBanner(
        err instanceof Error ? err.message : "Speech recognition encountered an error."
      );
    }
  }, [processUserUtterance, settings.language]);

  const handleToggleMic = useCallback(async () => {
    if (!voiceEngineRef.current) return;

    if (visualState === "listening") {
      await finishActiveMicCapture();
      return;
    }

    setErrorBanner(null);
    const perm = await requestExplicitMicrophoneAccess();
    setMicPermission(perm.state);
    if (perm.state !== "granted") {
      setErrorBanner(
        perm.error ||
          (settings.language === "bn"
            ? "মাইক্রোফোন অনুমতি প্রত্যাখ্যান করা হয়েছে।"
            : "माइक्रोफ़ोन अनुमति अस्वीकार कर दी गई है।")
      );
      return;
    }

    try {
      setInterimTranscript("");
      setVisualState("listening");
      await voiceEngineRef.current.startListeningSession({
        language: settings.language,
        onInterimTranscript: (txt) => setInterimTranscript(txt),
        onInputLevel: (lvl) => setMicLevel(lvl),
        onAutoSilenceStop: () => {
          finishActiveMicCapture();
        },
      });
    } catch (err) {
      setVisualState("idle");
      setErrorBanner(err instanceof Error ? err.message : "Could not start microphone.");
    }
  }, [finishActiveMicCapture, settings.language, visualState]);

  const handleStopSpeaking = useCallback(() => {
    voiceEngineRef.current?.stopSpeaking();
    setLipSync({ mouthOpen: 0, mouthSpread: 0.35, energy: 0 });
    setVisualState("idle");
  }, []);

  const handleResetAllData = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach((k) => window.localStorage.removeItem(k));
    setMemories([]);
    setMessages([]);
    setNotes([]);
    setAlarms([]);
    setContacts(DEFAULT_CONTACTS);
    setSettings(DEFAULT_SETTINGS);
    setActionStatusToast("All saved conversations, memories, notes, and custom data cleared.");
  }, []);

  const copy = UI_COPY[settings.language];
  const currentTheme = PIYA_THEMES[settings.theme];

  const voiceStatusText = !isOnline
    ? copy.offlineMode
    : micPermission === "denied"
    ? copy.micDenied
    : visualState === "listening"
    ? copy.voiceListening
    : visualState === "thinking"
    ? copy.voiceThinking
    : visualState === "speaking"
    ? copy.voiceSpeaking
    : copy.voiceReady;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--piya-bg)] text-slate-100">
      {/* Active Ringing Alarm Banner */}
      {ringingAlarm && (
        <div className="sticky top-0 z-50 bg-amber-500 text-slate-950 px-4 py-3 flex items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-2.5 text-sm font-semibold">
            <BellRing className="w-5 h-5" />
            <span>
              Alarm Ringing: {String(ringingAlarm.hour).padStart(2, "0")}:
              {String(ringingAlarm.minute).padStart(2, "0")} — {ringingAlarm.label}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setRingingAlarm(null)}
            className="min-h-[38px] px-4 rounded-lg bg-slate-950 text-white text-xs font-semibold whitespace-nowrap shrink-0"
          >
            Dismiss Alarm
          </button>
        </div>
      )}

      {/* Top Navigation Bar (Strict 3-Zone Contract: Brand — Nav Links — Primary Action) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-5 sm:px-8 h-16 border-b border-[var(--piya-border)] bg-[#060b18]/95">
        <button
          type="button"
          onClick={() => setActiveTab("home")}
          className="font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 text-left"
        >
          PIYA AI
        </button>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          {(
            [
              { id: "home" as ActiveTab, label: "Main Stage" },
              { id: "actions" as ActiveTab, label: "Phone Actions" },
              { id: "memory" as ActiveTab, label: "Memory Vault" },
              { id: "android" as ActiveTab, label: "Android APK" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === item.id
                  ? "text-white border-[var(--piya-accent)]"
                  : "text-slate-400 hover:text-white border-transparent"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFullScreenAssistant(true)}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[var(--piya-accent)] text-[var(--piya-on-accent)] text-xs font-semibold hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
          >
            {copy.startAssistant}
          </button>
        </div>
      </header>

      {/* Main Content Container (Full 1440px Desktop Presence + Mobile Ergonomics) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 pb-24 md:pb-10">
        {activeTab === "home" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Column: PIYA AI Main Screen Controls, Profile, Settings, Language, & Start CTA */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-6 rounded-3xl border border-[var(--piya-border)] bg-[var(--piya-surface)] p-6 sm:p-8">
              <div className="space-y-5">
                {/* Unboxed Clean Voice Status & Developer Metadata */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                  <div>
                    <span style={{ color: "var(--piya-accent-bright)" }} className="font-semibold">
                      {voiceStatusText}
                    </span>
                    <span className="mx-2" aria-hidden="true">
                      ·
                    </span>
                    <span>{currentTheme.name}</span>
                    <span className="mx-2" aria-hidden="true">
                      ·
                    </span>
                    <span>Developer: Poran</span>
                  </div>

                  {/* Profile & Settings Triggers on Main Screen (Section 7) */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileOpen(true)}
                      className="min-h-[44px] px-3 rounded-xl border border-slate-800 bg-[#060c1a] text-xs font-medium text-slate-200 hover:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                    >
                      <User className="w-4 h-4" style={{ color: "var(--piya-accent-bright)" }} />
                      <span>{profile.signedIn ? profile.displayName : "Profile"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="min-h-[44px] px-3 rounded-xl border border-slate-800 bg-[#060c1a] text-xs font-medium text-slate-200 hover:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Settings className="w-4 h-4" style={{ color: "var(--piya-accent-bright)" }} />
                      <span>Settings</span>
                    </button>
                  </div>
                </div>

                {/* Expressive Display Headline */}
                <div className="space-y-3">
                  <h1
                    className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.12]"
                    style={{ textWrap: "balance" }}
                  >
                    Natural Voice Intelligence in Bengali &amp; Hindi
                  </h1>
                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
                    {copy.subtitle}. Converse naturally with PIYA AI, ask real-world questions
                    powered by Gemini, and execute confirmed actions on your Android phone.
                  </p>
                </div>

                {/* Language Selector & Theme Quick Switch */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[#060c1a] border border-slate-800">
                    <button
                      type="button"
                      onClick={() => updateSettings({ language: "bn" })}
                      className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        settings.language === "bn"
                          ? "bg-[var(--piya-accent)] text-[var(--piya-on-accent)]"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      বাংলা (Bengali)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSettings({ language: "hi" })}
                      className={`min-h-[40px] px-4 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        settings.language === "hi"
                          ? "bg-[var(--piya-accent)] text-[var(--piya-on-accent)]"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      हिन्दी (Hindi)
                    </button>
                  </div>

                  {/* 5 Theme Swatches */}
                  <div className="flex items-center gap-2">
                    {(Object.keys(PIYA_THEMES) as ThemeId[]).map((tId) => {
                      const t = PIYA_THEMES[tId];
                      const active = settings.theme === tId;
                      return (
                        <button
                          key={tId}
                          type="button"
                          onClick={() => updateSettings({ theme: tId })}
                          className={`min-h-[36px] min-w-[36px] rounded-xl flex items-center justify-center border transition-transform ${
                            active
                              ? "border-white scale-105 bg-white/10"
                              : "border-slate-800 bg-[#060c1a] hover:border-slate-600"
                          }`}
                          title={t.name}
                          aria-label={`Switch theme to ${t.name}`}
                        >
                          <span
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: t.accent }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Primary Start Assistant CTA */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setFullScreenAssistant(true)}
                    className="min-h-[54px] px-7 py-3 rounded-2xl bg-[var(--piya-accent)] text-[var(--piya-on-accent)] font-semibold text-sm flex items-center justify-center gap-2.5 shadow-lg transition-transform active:scale-[0.98] whitespace-nowrap shrink-0"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{copy.startAssistant}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFullScreenAssistant(true);
                      setTimeout(() => {
                        handleToggleMic();
                      }, 120);
                    }}
                    className="min-h-[54px] px-5 py-3 rounded-2xl border border-[var(--piya-border)] bg-[#060c1a] text-slate-100 hover:text-white font-medium text-sm flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <Mic className="w-4 h-4" style={{ color: "var(--piya-accent-bright)" }} />
                    <span>{copy.tapToSpeak}</span>
                  </button>
                </div>
              </div>

              {/* Try Instant Voice/Command Prompts */}
              <div className="pt-5 border-t border-slate-800/80 space-y-2.5">
                <div className="text-xs font-medium text-slate-400">
                  Try a command in {settings.language === "bn" ? "বাংলা" : "हिन्दी"}:
                </div>
                <div className="flex flex-wrap gap-2">
                  {copy.samplePrompts.map((promptText) => (
                    <button
                      key={promptText}
                      type="button"
                      onClick={() => {
                        setFullScreenAssistant(true);
                        processUserUtterance(promptText, settings.language);
                      }}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-800 bg-[#060c1a] hover:border-[var(--piya-accent)] text-xs text-slate-200 hover:text-white text-left transition-colors"
                    >
                      {promptText}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Official PIYA AI Main Character Stage (Head-to-Toe Uncropped) */}
            <div className="lg:col-span-6 rounded-3xl border border-[var(--piya-border)] bg-[#02050d] min-h-[520px] lg:min-h-[620px] flex flex-col overflow-hidden relative">
              <div className="flex-1 min-h-0">
                <PiyaCharacter3D
                  visualState={visualState}
                  themeId={settings.theme}
                  lipSync={lipSync}
                  micLevel={micLevel}
                  compactPreview
                />
              </div>

              <div className="px-5 py-3 border-t border-slate-800/80 bg-[#081022] flex items-center justify-between gap-3 text-xs text-slate-400">
                <span>PIYA AI Official Main Character · Full head-to-toe view</span>
                <button
                  type="button"
                  onClick={() => setFullScreenAssistant(true)}
                  className="font-semibold hover:underline whitespace-nowrap shrink-0"
                  style={{ color: "var(--piya-accent-bright)" }}
                >
                  Open Full Screen
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "actions" && (
          <PhoneActionsPanel
            language={settings.language}
            contacts={contacts}
            notes={notes}
            alarms={alarms}
            battery={battery}
            flashlightOn={flashlightOn}
            statusToast={actionStatusToast}
            onAddContact={(c) =>
              setContacts((prev) => [
                ...prev,
                { ...c, id: `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}` },
              ])
            }
            onImportContacts={(imported) => setContacts((prev) => [...imported, ...prev])}
            onDeleteContact={(id) => setContacts((prev) => prev.filter((c) => c.id !== id))}
            onRequestCallByQuery={(q) => {
              const callPrep = prepareCallAction(q, undefined, settings.language);
              setPendingAction(callPrep.pending);
              setFullScreenAssistant(true);
              if (callPrep.spokenOverride) {
                appendMessage("assistant", callPrep.spokenOverride, settings.language, {
                  actionBadge: "Phone Call",
                });
                speakAssistantReply(callPrep.spokenOverride, settings.language);
              }
            }}
            onAddNote={(title, content) => {
              setNotes((prev) => [
                {
                  id: `nt_${Date.now()}`,
                  title,
                  content,
                  createdAt: new Date().toISOString(),
                },
                ...prev,
              ]);
              setActionStatusToast(`Saved note: "${title}"`);
            }}
            onDeleteNote={(id) => setNotes((prev) => prev.filter((n) => n.id !== id))}
            onAddAlarm={(hour, minute, label) => {
              const tStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
              setPendingAction({
                id: `pa_${Date.now()}`,
                type: "set_alarm",
                title: `Confirm Alarm · ${tStr}`,
                explanation:
                  settings.language === "bn"
                    ? `${tStr} সময়ে "${label}" অ্যালার্ম সেট করতে চান?`
                    : `क्या आप ${tStr} बजे के लिए "${label}" अलार्म सेट करना चाहते हैं?`,
                alarmData: { hour, minute, label },
              });
              setFullScreenAssistant(true);
            }}
            onToggleAlarm={(id) =>
              setAlarms((prev) =>
                prev.map((a) =>
                  a.id === id ? { ...a, enabled: !a.enabled, triggeredToday: false } : a
                )
              )
            }
            onDeleteAlarm={(id) => setAlarms((prev) => prev.filter((a) => a.id !== id))}
            onRefreshBattery={async () => {
              const bat = await readLiveBatteryStatus();
              setBattery(bat);
              setActionStatusToast(
                bat.supported && bat.level !== null
                  ? `Live Battery: ${bat.level}% (${bat.charging ? "Charging" : "On Battery"})`
                  : "Web Battery API is unavailable on this browser; supported in Android WebView & Capacitor APK."
              );
            }}
            onToggleFlashlight={async () => {
              const res = await setHardwareFlashlight(!flashlightOn);
              setFlashlightOn(res.enabled);
              setActionStatusToast(res.message);
            }}
            onOpenSettingsSection={async (sec) => {
              const res = await executeSystemSettingsOpen(sec);
              setActionStatusToast(res.message);
              if (res.intentHref) {
                setPendingAction({
                  id: `pa_${Date.now()}`,
                  type: "open_settings",
                  title: `Open Android ${sec.replace("_", " ")}`,
                  explanation: res.message,
                  settingSection: sec,
                  intentHref: res.intentHref,
                });
                setFullScreenAssistant(true);
              }
            }}
            onRequestPhoneLock={() => {
              setPendingAction({
                id: `pa_${Date.now()}`,
                type: "lock_phone",
                title:
                  settings.language === "bn"
                    ? "ফোন স্ক্রিন লক নিশ্চিতকরণ"
                    : "फ़ोन स्क्रीन लॉक पुष्टि",
                explanation:
                  settings.language === "bn"
                    ? "পিয়া এআই Android DevicePolicyManager ব্যবহার করে ফোন লক করবে। নিশ্চিত করতে চান?"
                    : "पिया एआई Android DevicePolicyManager से फ़ोन लॉक करेगी। क्या आप पुष्टि करते हैं?",
              });
              setFullScreenAssistant(true);
            }}
            onReportStatus={(msg) => setActionStatusToast(msg)}
          />
        )}

        {activeTab === "memory" && (
          <MemoryVaultPanel
            memories={memories}
            messages={messages}
            memoryEnabled={settings.memoryEnabled}
            autoConfirmMemory={settings.autoConfirmMemory}
            onToggleMemoryEnabled={(enabled) => updateSettings({ memoryEnabled: enabled })}
            onToggleAutoConfirmMemory={(auto) => updateSettings({ autoConfirmMemory: auto })}
            onAddMemory={(category, fact) =>
              setMemories((prev) => [
                {
                  id: `mem_${Date.now()}`,
                  category,
                  fact,
                  createdAt: new Date().toISOString(),
                },
                ...prev,
              ])
            }
            onDeleteMemory={(id) => setMemories((prev) => prev.filter((m) => m.id !== id))}
            onClearAllMemories={() => setMemories([])}
            onClearHistory={() => setMessages([])}
          />
        )}

        {activeTab === "android" && <AndroidArchitecturePanel />}
      </main>

      {/* Mobile Ergonomic Bottom Navigation Bar (< 15% Viewport Height Cap) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 border-t border-[var(--piya-border)] bg-[#060b18]/95 grid grid-cols-4 items-center">
        {(
          [
            { id: "home" as ActiveTab, label: "Assistant", Icon: Sparkles },
            { id: "actions" as ActiveTab, label: "Actions", Icon: Wrench },
            { id: "memory" as ActiveTab, label: "Memory", Icon: Brain },
            { id: "android" as ActiveTab, label: "Android", Icon: Smartphone },
          ] as const
        ).map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`min-h-[48px] flex flex-col items-center justify-center transition-colors ${
                active ? "text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon
                className="w-5 h-5"
                style={active ? { color: "var(--piya-accent-bright)" } : undefined}
              />
              <span className="text-[10px] font-medium mt-1 whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Full-Screen Assistant Character Interface */}
      {fullScreenAssistant && (
        <AssistantFullScreen
          language={settings.language}
          themeId={settings.theme}
          visualState={visualState}
          micPermission={micPermission}
          isOnline={isOnline}
          lipSync={lipSync}
          micLevel={micLevel}
          interimTranscript={interimTranscript}
          messages={messages}
          pendingAction={pendingAction}
          errorBanner={errorBanner}
          onDismissError={() => setErrorBanner(null)}
          onBackToHome={() => {
            voiceEngineRef.current?.cancelListening();
            setVisualState((s) => (s === "listening" ? "idle" : s));
            setFullScreenAssistant(false);
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onChangeLanguage={(lang) => updateSettings({ language: lang })}
          onToggleMic={handleToggleMic}
          onStopSpeaking={handleStopSpeaking}
          onSendTextCommand={(txt) => processUserUtterance(txt)}
          onConfirmPendingAction={handleConfirmPendingAction}
          onCancelPendingAction={handleCancelPendingAction}
          onSelectDisambiguatedContact={handleSelectDisambiguatedContact}
          onClearConversation={() => setMessages([])}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        open={settingsOpen}
        settings={settings}
        micPermission={micPermission}
        connectionStatus={connectionStatus}
        memoriesCount={memories.length}
        onClose={() => setSettingsOpen(false)}
        onUpdateSettings={updateSettings}
        onRequestMicPermission={async () => {
          const res = await requestExplicitMicrophoneAccess();
          setMicPermission(res.state);
          if (res.error) setErrorBanner(res.error);
        }}
        onVerifyConnection={() => checkBackendStatus(true)}
        onTestVoiceSample={() => {
          const sample =
            settings.language === "bn"
              ? "নমস্কার, আমি পিয়া এআই। আমি আপনার কথা শুনতে এবং সাহায্য করতে প্রস্তুত।"
              : "नमस्ते, मैं पिया एआई हूँ। मैं आपकी सहायता करने के लिए तैयार हूँ।";
          speakAssistantReply(sample, settings.language);
        }}
        onClearMemories={() => setMemories([])}
        onResetAllData={handleResetAllData}
      />

      {/* Profile Modal */}
      <ProfileModal
        open={profileOpen}
        profile={profile}
        onClose={() => setProfileOpen(false)}
        onSaveProfile={(next) => setProfile(next)}
        onLogoutSession={() =>
          setProfile({
            displayName: "Guest",
            email: "",
            signedIn: false,
          })
        }
        onDeleteAllUserData={handleResetAllData}
      />

      {/* Dismissible Status Toast when on non-fullscreen tabs */}
      {actionStatusToast && activeTab !== "actions" && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-40 max-w-sm rounded-xl border border-[var(--piya-border)] bg-[#0b1428] px-4 py-3 shadow-xl flex items-start gap-3 text-xs text-slate-200">
          <span className="flex-1">{actionStatusToast}</span>
          <button
            type="button"
            onClick={() => setActionStatusToast(null)}
            className="text-slate-400 hover:text-white"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
