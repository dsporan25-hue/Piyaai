import React from "react";
import {
  Check,
  Mic,
  RefreshCw,
  Shield,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import type {
  AppSettings,
  LanguageCode,
  SystemConnectionStatus,
  ThemeId,
  VoiceOption,
} from "../types/piya";
import type { MicPermissionState } from "../services/voiceEngine";
import { PIYA_THEMES, VOICE_OPTIONS } from "../constants/themesAndCopy";

interface SettingsModalProps {
  open: boolean;
  settings: AppSettings;
  micPermission: MicPermissionState;
  connectionStatus: SystemConnectionStatus;
  memoriesCount: number;
  onClose: () => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onRequestMicPermission: () => void;
  onVerifyConnection: () => void;
  onTestVoiceSample: () => void;
  onClearMemories: () => void;
  onResetAllData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  settings,
  micPermission,
  connectionStatus,
  memoriesCount,
  onClose,
  onUpdateSettings,
  onRequestMicPermission,
  onVerifyConnection,
  onTestVoiceSample,
  onClearMemories,
  onResetAllData,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-3xl border border-[var(--piya-border)] bg-[#080f20] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-white">PIYA AI Settings</h2>
            <p className="text-xs text-slate-400">
              Language · Voice · Theme · Permissions · Privacy
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/5"
            aria-label="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. Language Selection */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-semibold text-white">1. Assistant Language</h3>
            <p className="text-xs text-slate-400">
              PIYA AI automatically replies in Bengali when you speak Bengali and in Hindi when you
              speak Hindi. Choose your default primary language:
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { code: "bn" as LanguageCode, title: "বাংলা (Bengali)", sub: "Primary Language" },
                  {
                    code: "hi" as LanguageCode,
                    title: "हिन्दी (Hindi)",
                    sub: "Secondary Language",
                  },
                ] as const
              ).map((item) => {
                const active = settings.language === item.code;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => onUpdateSettings({ language: item.code })}
                    className={`min-h-[56px] p-3.5 rounded-xl border text-left transition-colors flex items-center justify-between ${
                      active
                        ? "border-[var(--piya-accent)] bg-[var(--piya-accent-soft)] text-white"
                        : "border-slate-800 bg-[#050a16] text-slate-300 hover:text-white"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold">{item.title}</div>
                      <div className="text-[11px] text-slate-400">{item.sub}</div>
                    </div>
                    {active && (
                      <Check
                        className="w-4 h-4 shrink-0"
                        style={{ color: "var(--piya-accent-bright)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. Voice Selection & Speech Speed */}
          <section className="space-y-3 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">2. Voice & Speech Speed</h3>
              <button
                type="button"
                onClick={onTestVoiceSample}
                className="min-h-[38px] px-3 rounded-lg border border-[var(--piya-border)] bg-[#050a16] text-xs font-medium text-slate-200 hover:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Preview Voice</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {VOICE_OPTIONS.map((v) => {
                const active = settings.voiceName === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onUpdateSettings({ voiceName: v.id as VoiceOption })}
                    className={`min-h-[52px] px-3.5 py-2.5 rounded-xl border text-left transition-colors ${
                      active
                        ? "border-[var(--piya-accent)] bg-[var(--piya-accent-soft)]"
                        : "border-slate-800 bg-[#050a16] hover:border-slate-700"
                    }`}
                  >
                    <div className="text-xs font-semibold text-white">{v.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {settings.language === "bn" ? v.bnDesc : v.hiDesc}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#050a16] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Speech Speed</span>
                <span className="font-mono-tabular text-white font-semibold">
                  {settings.speechSpeed.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={0.75}
                max={1.4}
                step={0.05}
                value={settings.speechSpeed}
                onChange={(e) => onUpdateSettings({ speechSpeed: Number(e.target.value) })}
                className="w-full accent-[var(--piya-accent)]"
              />
              <div className="flex justify-between text-[11px] text-slate-500 font-mono-tabular">
                <span>0.75x Calm</span>
                <span>1.00x Natural</span>
                <span>1.40x Brisk</span>
              </div>
            </div>
          </section>

          {/* 3. Five Signature Themes */}
          <section className="space-y-2.5 pt-4 border-t border-slate-800/80">
            <h3 className="text-sm font-semibold text-white">3. Interface & Dress Accent Theme</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(Object.keys(PIYA_THEMES) as ThemeId[]).map((id) => {
                const t = PIYA_THEMES[id];
                const selected = settings.theme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onUpdateSettings({ theme: id })}
                    className={`min-h-[56px] p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors ${
                      selected
                        ? "border-white/50 bg-[#0e1830]"
                        : "border-slate-800 bg-[#050a16] hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-5 h-5 rounded-full shrink-0 border border-white/20"
                        style={{ backgroundColor: t.accent }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{t.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {settings.language === "bn" ? t.bnName : t.hiName}
                        </div>
                      </div>
                    </div>
                    {selected && <Check className="w-4 h-4 text-white shrink-0" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 4. Microphone Permissions & AI Connection Status */}
          <section className="space-y-3 pt-4 border-t border-slate-800/80">
            <h3 className="text-sm font-semibold text-white">
              4. Microphone Permission & AI Connection
            </h3>

            <div className="rounded-xl border border-slate-800 bg-[#050a16] p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-white">Microphone Permission</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Status: <span className="uppercase text-slate-200">{micPermission}</span> · PIYA
                  AI never listens secretly in the background.
                </div>
              </div>
              {micPermission !== "granted" && (
                <button
                  type="button"
                  onClick={onRequestMicPermission}
                  className="min-h-[40px] px-3.5 rounded-lg bg-[var(--piya-accent)] text-[var(--piya-on-accent)] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Grant Microphone</span>
                </button>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#050a16] p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white">
                  Secure Gemini Backend Connection
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {connectionStatus.message}
                </div>
              </div>
              <button
                type="button"
                onClick={onVerifyConnection}
                disabled={connectionStatus.checking}
                className="min-h-[40px] px-3.5 rounded-lg border border-[var(--piya-border)] text-xs font-medium text-slate-200 hover:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${connectionStatus.checking ? "animate-spin" : ""}`}
                />
                <span>{connectionStatus.checking ? "Checking..." : "Verify Live"}</span>
              </button>
            </div>
          </section>

          {/* 5. Memory & Privacy Controls */}
          <section className="space-y-3 pt-4 border-t border-slate-800/80">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4" style={{ color: "var(--piya-accent-bright)" }} />
              <span>5. Memory & Privacy Controls</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              API keys are protected exclusively on the backend server and never embedded inside
              frontend code or the Android APK. Sensitive permissions (Microphone, Contacts, Call,
              Device Admin lock) are requested only when you invoke those features.
            </p>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onClearMemories}
                className="min-h-[42px] px-3.5 rounded-xl border border-slate-700 text-xs font-medium text-slate-200 hover:text-white whitespace-nowrap shrink-0"
              >
                Clear Saved Memories ({memoriesCount})
              </button>
              <button
                type="button"
                onClick={onResetAllData}
                className="min-h-[42px] px-3.5 rounded-xl border border-rose-500/40 bg-rose-950/40 text-xs font-semibold text-rose-200 hover:bg-rose-900/50 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete All App Data</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
