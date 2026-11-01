import React, { useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  Send,
  Settings,
  Square,
  Trash2,
  VolumeX,
  AlertCircle,
  Check,
  X,
} from "lucide-react";
import type {
  AssistantVisualState,
  ChatMessage,
  ContactItem,
  LanguageCode,
  PendingAction,
  ThemeId,
} from "../types/piya";
import type { LipSyncFrame, MicPermissionState } from "../services/voiceEngine";
import { UI_COPY } from "../constants/themesAndCopy";
import { OFFICIAL_PIYA_CHARACTER_IMAGE, PiyaCharacter3D } from "./PiyaCharacter3D";

interface AssistantFullScreenProps {
  language: LanguageCode;
  themeId: ThemeId;
  visualState: AssistantVisualState;
  micPermission: MicPermissionState;
  isOnline: boolean;
  lipSync: LipSyncFrame;
  micLevel: number;
  interimTranscript: string;
  messages: ChatMessage[];
  pendingAction: PendingAction | null;
  errorBanner: string | null;
  onDismissError: () => void;
  onBackToHome: () => void;
  onOpenSettings: () => void;
  onChangeLanguage: (lang: LanguageCode) => void;
  onToggleMic: () => void;
  onStopSpeaking: () => void;
  onSendTextCommand: (text: string) => void;
  onConfirmPendingAction: () => void;
  onCancelPendingAction: () => void;
  onSelectDisambiguatedContact: (contact: ContactItem) => void;
  onClearConversation: () => void;
}

export const AssistantFullScreen: React.FC<AssistantFullScreenProps> = ({
  language,
  themeId,
  visualState,
  micPermission,
  isOnline,
  lipSync,
  micLevel,
  interimTranscript,
  messages,
  pendingAction,
  errorBanner,
  onDismissError,
  onBackToHome,
  onOpenSettings,
  onChangeLanguage,
  onToggleMic,
  onStopSpeaking,
  onSendTextCommand,
  onConfirmPendingAction,
  onCancelPendingAction,
  onSelectDisambiguatedContact,
  onClearConversation,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [digitFilter, setDigitFilter] = useState("");

  const copy = UI_COPY[language];
  const latestAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");

  const statusLabel = !isOnline
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSendTextCommand(inputValue.trim());
    setInputValue("");
  };

  const handleDigitQuickMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAction?.matchedContacts || digitFilter.trim().length < 4) return;
    const target4 = digitFilter.replace(/\D/g, "").slice(-4);
    const found = pendingAction.matchedContacts.find((c) =>
      c.phone.replace(/\D/g, "").endsWith(target4)
    );
    if (found) {
      setDigitFilter("");
      onSelectDisambiguatedContact(found);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[var(--piya-bg)] text-slate-100 overflow-hidden">
      {/* Compact Top Bar (solid rgba surface over WebGL — zero backdrop-filter stall) */}
      <header className="relative z-30 flex items-center justify-between gap-4 px-4 h-14 border-b border-[var(--piya-border)] bg-[#060b18]/95">
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onBackToHome}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-200 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img
            src={OFFICIAL_PIYA_CHARACTER_IMAGE}
            alt="PIYA AI"
            className="w-8 h-8 rounded-lg object-cover object-[50%_16%] border border-[var(--piya-border)] shrink-0"
          />
          <span className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap">
            PIYA AI
          </span>
        </div>

        {/* Real-Time Voice Status Text (No decorative pulsing dots) */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-300 truncate">
          <span style={{ color: "var(--piya-accent-bright)" }}>{statusLabel}</span>
        </div>

        {/* Language Switch + History + Settings */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center p-0.5 rounded-lg bg-[#0d162c] border border-[var(--piya-border)]">
            <button
              type="button"
              onClick={() => onChangeLanguage("bn")}
              className={`min-h-[34px] px-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                language === "bn"
                  ? "bg-[var(--piya-accent)] text-[var(--piya-on-accent)]"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              বাংলা
            </button>
            <button
              type="button"
              onClick={() => onChangeLanguage("hi")}
              className={`min-h-[34px] px-2.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                language === "hi"
                  ? "bg-[var(--piya-accent)] text-[var(--piya-on-accent)]"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              हिन्दी
            </button>
          </div>

          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Open Conversation History"
          >
            <MessageSquare className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Open Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Error Notification Banner if Network / Gemini / Mic fails */}
      {errorBanner && (
        <div className="relative z-30 mx-auto mt-2 w-[min(680px,94vw)] rounded-xl border border-rose-500/40 bg-[#1f0b14]/95 px-4 py-2.5 flex items-start justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            className="min-h-[28px] min-w-[28px] flex items-center justify-center rounded-lg text-rose-300 hover:text-white"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Unobstructed Full-Body Character Stage (Head to Toe Never Cropped) */}
      <main className="relative flex-1 min-h-0 w-full">
        <PiyaCharacter3D
          visualState={visualState}
          themeId={themeId}
          lipSync={lipSync}
          micLevel={micLevel}
        />
      </main>

      {/* Collapsible Unified Bottom Control Dock */}
      <section className="relative z-30 mx-auto w-[min(860px,96vw)] pb-3">
        <div className="flex justify-center mb-1">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="min-h-[36px] px-3 py-1 rounded-t-xl border border-b-0 border-[var(--piya-border)] bg-[#081022]/95 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Hide Controls</span>
              </>
            )}
          </button>
        </div>

        {!dockCollapsed && (
          <div className="rounded-2xl border border-[var(--piya-border)] bg-[#081022]/95 p-3.5 sm:p-4 shadow-2xl space-y-3">
            {/* Action Confirmation / Disambiguation Card */}
            {pendingAction && (
              <div className="rounded-xl border border-[var(--piya-border)] bg-[#0d1830] p-3.5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{pendingAction.title}</h3>
                    <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                      {pendingAction.explanation}
                    </p>
                  </div>
                </div>

                {pendingAction.type === "call_disambiguate" && pendingAction.matchedContacts && (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {pendingAction.matchedContacts.map((cnt) => {
                        const digits = cnt.phone.replace(/\D/g, "");
                        const last4 = digits.slice(-4);
                        return (
                          <button
                            key={cnt.id}
                            type="button"
                            onClick={() => onSelectDisambiguatedContact(cnt)}
                            className="min-h-[48px] px-3 py-2 rounded-xl border border-[var(--piya-border)] bg-[#081022] hover:border-[var(--piya-accent)] flex items-center justify-between gap-2 text-left transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white truncate">
                                {cnt.name}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {cnt.label} · Last 4:{" "}
                                <span className="font-mono-tabular text-slate-200">{last4}</span>
                              </div>
                            </div>
                            <Phone
                              className="w-4 h-4 shrink-0"
                              style={{ color: "var(--piya-accent-bright)" }}
                            />
                          </button>
                        );
                      })}
                    </div>

                    <form onSubmit={handleDigitQuickMatch} className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={digitFilter}
                        onChange={(e) => setDigitFilter(e.target.value)}
                        placeholder={
                          language === "bn"
                            ? "শেষ ৪টি সংখ্যা লিখুন (যেমন 4821)"
                            : "आखिरी 4 अंक दर्ज करें (जैसे 4821)"
                        }
                        className="flex-1 min-h-[42px] px-3 rounded-lg bg-[#060b18] border border-[var(--piya-border)] text-xs text-white placeholder:text-slate-500 font-mono-tabular focus:outline-none focus:border-[var(--piya-accent)]"
                      />
                      <button
                        type="submit"
                        className="min-h-[42px] px-3.5 rounded-lg bg-[var(--piya-accent)] text-[var(--piya-on-accent)] text-xs font-semibold whitespace-nowrap shrink-0"
                      >
                        Select
                      </button>
                      <button
                        type="button"
                        onClick={onCancelPendingAction}
                        className="min-h-[42px] px-3 rounded-lg border border-slate-700 text-xs text-slate-300 hover:text-white whitespace-nowrap shrink-0"
                      >
                        {copy.cancelBtn}
                      </button>
                    </form>
                  </div>
                )}

                {pendingAction.type !== "call_disambiguate" && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    {pendingAction.intentHref ? (
                      <a
                        href={pendingAction.intentHref}
                        target={pendingAction.intentHref.startsWith("http") ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        onClick={() => onConfirmPendingAction()}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--piya-accent)] text-[var(--piya-on-accent)] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Check className="w-4 h-4" />
                        <span>{copy.confirmBtn}</span>
                        <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={onConfirmPendingAction}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--piya-accent)] text-[var(--piya-on-accent)] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Check className="w-4 h-4" />
                        <span>{copy.confirmBtn}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onCancelPendingAction}
                      className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-700 bg-[#070d1c] text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <X className="w-4 h-4" />
                      <span>{copy.cancelBtn}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Live Transcript or Latest Assistant Spoken Bubble */}
            <div className="rounded-xl bg-[#0b152b] border border-slate-800/80 px-3.5 py-2.5 max-h-24 overflow-y-auto">
              {visualState === "listening" && interimTranscript ? (
                <p className="text-sm text-cyan-200 leading-relaxed">{interimTranscript}</p>
              ) : latestAssistantMsg ? (
                <div className="space-y-1.5">
                  <p
                    className={`text-sm leading-relaxed ${
                      latestAssistantMsg.isError ? "text-rose-300" : "text-slate-100"
                    }`}
                  >
                    {latestAssistantMsg.text}
                  </p>
                  {latestAssistantMsg.sources && latestAssistantMsg.sources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      <span>Sources:</span>
                      {latestAssistantMsg.sources.slice(0, 3).map((src, i) => (
                        <a
                          key={i}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-white truncate max-w-[180px]"
                        >
                          {src.title || src.uri}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 leading-relaxed">{copy.welcomeGreeting}</p>
              )}
            </div>

            {/* Primary Voice & Text Controls */}
            <div className="flex items-center gap-2.5">
              {/* Explicit Microphone Activation Button */}
              <button
                type="button"
                onClick={onToggleMic}
                disabled={!isOnline}
                className={`min-h-[50px] px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 whitespace-nowrap shrink-0 ${
                  visualState === "listening"
                    ? "bg-rose-500 text-white"
                    : "bg-[var(--piya-accent)] text-[var(--piya-on-accent)] disabled:opacity-45"
                }`}
                aria-label={visualState === "listening" ? copy.stopListening : copy.tapToSpeak}
              >
                {visualState === "listening" ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    <span>{copy.stopListening}</span>
                  </>
                ) : micPermission === "denied" ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>Mic Blocked</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span className="hidden sm:inline">{copy.tapToSpeak}</span>
                  </>
                )}
              </button>

              {/* Stop Speaking Button */}
              {visualState === "speaking" && (
                <button
                  type="button"
                  onClick={onStopSpeaking}
                  className="min-h-[50px] px-3.5 rounded-xl border border-amber-400/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <VolumeX className="w-4 h-4" />
                  <span>{copy.stopSpeaking}</span>
                </button>
              )}

              {/* Conversational Text / Voice Command Input */}
              <form onSubmit={handleFormSubmit} className="flex-1 flex items-center gap-2 min-w-0">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={copy.typePlaceholder}
                  disabled={!isOnline || visualState === "thinking"}
                  className="w-full min-h-[50px] px-3.5 rounded-xl bg-[#050a16] border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[var(--piya-accent)] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!isOnline || !inputValue.trim() || visualState === "thinking"}
                  className="min-h-[50px] min-w-[50px] rounded-xl border border-[var(--piya-border)] bg-[#0d1830] text-slate-200 hover:text-white disabled:opacity-40 flex items-center justify-center shrink-0 transition-colors"
                  aria-label="Send Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </section>

      {/* Conversation History Drawer */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70">
          <div className="w-full max-w-md h-full bg-[#080f20] border-l border-[var(--piya-border)] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h2 className="font-display text-base font-semibold text-white">
                Conversation History
              </h2>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearConversation}
                    className="min-h-[40px] px-3 rounded-lg text-xs text-rose-300 hover:bg-rose-500/10 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-300 hover:text-white"
                  aria-label="Close History"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  No conversation messages yet. Tap the microphone or choose a prompt to begin.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-2xl p-3.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "ml-8 bg-[var(--piya-accent-soft)] border border-[var(--piya-border)] text-white"
                        : m.isError
                        ? "mr-8 bg-rose-950/50 border border-rose-500/30 text-rose-200"
                        : "mr-8 bg-[#0e1930] border border-slate-800 text-slate-100"
                    }`}
                  >
                    <div className="text-[11px] text-slate-400 mb-1">
                      <span>{m.role === "user" ? "You" : "PIYA AI"}</span>
                      <span className="mx-1.5">·</span>
                      <span>{m.language === "bn" ? "বাংলা" : "हिन्दी"}</span>
                      {m.actionBadge && (
                        <>
                          <span className="mx-1.5">·</span>
                          <span style={{ color: "var(--piya-accent-bright)" }}>
                            {m.actionBadge}
                          </span>
                        </>
                      )}
                    </div>
                    <p>{m.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
