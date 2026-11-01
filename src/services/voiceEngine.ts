import type { LanguageCode, VoiceOption } from "../types/piya";

export type MicPermissionState = "prompt" | "granted" | "denied" | "unsupported";

export interface LipSyncFrame {
  mouthOpen: number; // 0.0 to 1.0
  mouthSpread: number; // 0.0 to 1.0 (vowel brightness)
  energy: number; // 0.0 to 1.0
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
  length: number;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export async function queryMicrophonePermission(): Promise<MicPermissionState> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unsupported";
  }
  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
      if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
        return status.state;
      }
    }
  } catch {
    // Fallback if Permissions API doesn't support 'microphone' query in WebView
  }
  return "prompt";
}

export async function requestExplicitMicrophoneAccess(): Promise<{
  state: MicPermissionState;
  error?: string;
}> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return {
      state: "unsupported",
      error: "Microphone capture is not supported in this browser/WebView.",
    };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return { state: "granted" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Microphone permission denied.";
    const isDenied = /denied|notallowed|permission/i.test(msg);
    return {
      state: isDenied ? "denied" : "prompt",
      error: isDenied
        ? "Microphone permission was denied. Please grant Microphone access in browser or Android App Settings."
        : msg,
    };
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const commaIdx = result.indexOf(",");
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error("Failed to read recorded audio."));
    reader.readAsDataURL(blob);
  });
}

export class PiyaVoiceEngine {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recognition: SpeechRecognitionInstance | null = null;
  private interimWebTranscript = "";
  private finalWebTranscript = "";

  private inputAudioCtx: AudioContext | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private inputMonitorFrame = 0;

  private outputAudioCtx: AudioContext | null = null;
  private outputAudioEl: HTMLAudioElement | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private outputAnimFrame = 0;
  private synthFallbackInterval = 0;
  private activeTtsAbort: AbortController | null = null;

  private isRecording = false;
  private speechDetectedAt = 0;
  private lastLoudFrameAt = 0;

  public async startListeningSession(options: {
    language: LanguageCode;
    onInterimTranscript?: (text: string) => void;
    onInputLevel?: (level: number) => void;
    onAutoSilenceStop?: () => void;
  }): Promise<void> {
    if (this.isRecording) {
      await this.cancelListening();
    }

    this.stopSpeaking();

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone access is not supported in this environment.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.mediaStream = stream;
    this.audioChunks = [];
    this.interimWebTranscript = "";
    this.finalWebTranscript = "";
    this.isRecording = true;
    this.speechDetectedAt = 0;
    this.lastLoudFrameAt = performance.now();

    // Setup input level analyser + gentle auto-silence detection
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.inputAudioCtx = new AudioCtx();
    const source = this.inputAudioCtx.createMediaStreamSource(stream);
    this.inputAnalyser = this.inputAudioCtx.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    source.connect(this.inputAnalyser);

    const freqData = new Uint8Array(this.inputAnalyser.frequencyBinCount);
    const sessionStartedAt = performance.now();

    const monitorInput = () => {
      if (!this.isRecording || !this.inputAnalyser) return;
      this.inputAnalyser.getByteFrequencyData(freqData);
      let sum = 0;
      for (let i = 0; i < freqData.length; i++) {
        sum += freqData[i];
      }
      const avg = sum / (freqData.length * 255);
      const normalized = Math.min(1, avg * 3.2);
      options.onInputLevel?.(normalized);

      const now = performance.now();
      if (normalized > 0.14) {
        if (!this.speechDetectedAt) this.speechDetectedAt = now;
        this.lastLoudFrameAt = now;
      }

      // Auto-finish after user has spoken for >=400ms and paused for 1650ms, or max 16s cap
      if (
        (this.speechDetectedAt > 0 &&
          now - this.speechDetectedAt > 450 &&
          now - this.lastLoudFrameAt > 1650) ||
        now - sessionStartedAt > 16000
      ) {
        options.onAutoSilenceStop?.();
        return;
      }

      this.inputMonitorFrame = requestAnimationFrame(monitorInput);
    };
    this.inputMonitorFrame = requestAnimationFrame(monitorInput);

    // Start MediaRecorder for reliable Gemini server-side transcription
    const preferredMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "";

    this.mediaRecorder = preferredMime
      ? new MediaRecorder(stream, { mimeType: preferredMime })
      : new MediaRecorder(stream);

    this.mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        this.audioChunks.push(ev.data);
      }
    };
    this.mediaRecorder.start(250);

    // Also start live Web Speech Recognition in parallel for instant live preview if supported
    const SpeechRecConstructor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition;

    if (SpeechRecConstructor) {
      try {
        const rec = new SpeechRecConstructor();
        rec.lang = options.language === "hi" ? "hi-IN" : "bn-BD";
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (event: SpeechRecognitionEventLike) => {
          let finalPart = "";
          let interimPart = "";
          for (let i = 0; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) {
              finalPart += res[0].transcript + " ";
            } else {
              interimPart += res[0].transcript;
            }
          }
          if (finalPart.trim()) this.finalWebTranscript = finalPart.trim();
          this.interimWebTranscript = (finalPart + interimPart).trim();
          if (this.interimWebTranscript) {
            options.onInterimTranscript?.(this.interimWebTranscript);
          }
        };
        rec.onerror = () => {
          // Non-fatal: MediaRecorder + Gemini /api/assistant/transcribe serves as authoritative fallback
        };
        rec.start();
        this.recognition = rec;
      } catch {
        this.recognition = null;
      }
    }
  }

  public async finishListeningAndTranscribe(preferredLanguage: LanguageCode): Promise<{
    transcript: string;
    detectedLanguage: LanguageCode;
  }> {
    if (!this.isRecording) {
      return { transcript: "", detectedLanguage: preferredLanguage };
    }
    this.isRecording = false;
    cancelAnimationFrame(this.inputMonitorFrame);

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore
      }
      this.recognition = null;
    }

    const recordedBlob = await new Promise<Blob | null>((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        resolve(this.audioChunks.length > 0 ? new Blob(this.audioChunks) : null);
        return;
      }
      const mimeType = this.mediaRecorder.mimeType || "audio/webm";
      this.mediaRecorder.onstop = () => {
        const blob =
          this.audioChunks.length > 0 ? new Blob(this.audioChunks, { type: mimeType }) : null;
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });

    this.cleanupInputHardware();

    const webCandidate = (this.finalWebTranscript || this.interimWebTranscript).trim();

    // Prefer Gemini server-side transcription whenever audio was recorded so Bengali & Hindi script accuracy is crisp,
    // falling back to Web Speech transcript if offline or if audio blob is empty.
    if (recordedBlob && recordedBlob.size > 800) {
      try {
        const audioBase64 = await blobToBase64(recordedBlob);
        const cleanMime = (recordedBlob.type || "audio/webm").split(";")[0];
        const resp = await fetch("/api/assistant/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64,
            mimeType: cleanMime,
            preferredLanguage,
          }),
        });

        if (resp.ok) {
          const data = (await resp.json()) as {
            transcript?: string;
            detectedLanguage?: LanguageCode;
          };
          const serverText = (data.transcript || "").trim();
          if (serverText) {
            return {
              transcript: serverText,
              detectedLanguage: data.detectedLanguage || preferredLanguage,
            };
          }
        } else if (!webCandidate) {
          const errData = (await resp.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error || "Speech transcription request failed.");
        }
      } catch (err) {
        if (!webCandidate) {
          throw err;
        }
      }
    }

    return {
      transcript: webCandidate,
      detectedLanguage: preferredLanguage,
    };
  }

  public async cancelListening(): Promise<void> {
    this.isRecording = false;
    cancelAnimationFrame(this.inputMonitorFrame);
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignore
      }
      this.recognition = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignore
      }
    }
    this.cleanupInputHardware();
  }

  private cleanupInputHardware(): void {
    this.mediaRecorder = null;
    this.audioChunks = [];
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
      this.inputAnalyser = null;
    }
  }

  public async speakResponse(options: {
    text: string;
    language: LanguageCode;
    voiceName: VoiceOption;
    speechSpeed: number;
    preferNeuralTts: boolean;
    onStart?: () => void;
    onLipSyncFrame?: (frame: LipSyncFrame) => void;
    onEnd?: () => void;
    onError?: (message: string) => void;
  }): Promise<void> {
    this.stopSpeaking();

    const cleanText = options.text.replace(/[*#_`~]/g, "").trim();
    if (!cleanText) {
      options.onEnd?.();
      return;
    }

    if (options.preferNeuralTts) {
      const abortCtrl = new AbortController();
      this.activeTtsAbort = abortCtrl;
      try {
        const resp = await fetch("/api/assistant/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: cleanText,
            voiceName: options.voiceName,
            language: options.language,
          }),
          signal: abortCtrl.signal,
        });

        if (!resp.ok) {
          const errJson = (await resp.json().catch(() => ({}))) as { error?: string };
          throw new Error(errJson.error || `Neural TTS failed (${resp.status})`);
        }

        const data = (await resp.json()) as { audioBase64?: string; mimeType?: string };
        if (!data.audioBase64) {
          throw new Error("Empty audio returned from TTS service.");
        }

        await this.playBase64WavWithLipSync(data.audioBase64, options);
        return;
      } catch (err) {
        if (abortCtrl.signal.aborted) {
          options.onEnd?.();
          return;
        }
        // Attempt local Web Speech synthesis fallback if available, otherwise report error cleanly
        const fallbackWorked = this.speakWithBrowserSynthesis(cleanText, options);
        if (!fallbackWorked) {
          options.onError?.(
            err instanceof Error ? err.message : "Text-to-speech playback failed."
          );
          options.onEnd?.();
        }
        return;
      }
    }

    const ok = this.speakWithBrowserSynthesis(cleanText, options);
    if (!ok) {
      options.onError?.(
        "Device speech synthesis is unavailable for this language. Enable Neural Gemini TTS in Settings."
      );
      options.onEnd?.();
    }
  }

  private async playBase64WavWithLipSync(
    audioBase64: string,
    options: {
      speechSpeed: number;
      onStart?: () => void;
      onLipSyncFrame?: (frame: LipSyncFrame) => void;
      onEnd?: () => void;
      onError?: (message: string) => void;
    }
  ): Promise<void> {
    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "audio/wav" });
    const objectUrl = URL.createObjectURL(blob);

    const audio = new Audio(objectUrl);
    audio.playbackRate = Math.min(1.5, Math.max(0.7, options.speechSpeed || 1.0));
    this.outputAudioEl = audio;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    this.outputAudioCtx = ctx;
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => {});
    }

    const mediaSource = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.65;
    mediaSource.connect(analyser);
    analyser.connect(ctx.destination);
    this.outputAnalyser = analyser;

    const bins = new Uint8Array(analyser.frequencyBinCount);

    const sampleLipSync = () => {
      if (!this.outputAnalyser || !this.outputAudioEl || this.outputAudioEl.paused) {
        return;
      }
      this.outputAnalyser.getByteFrequencyData(bins);

      // Low-mid formant band (mouth jaw open) vs mid-high band (lip spread)
      let lowSum = 0;
      let midSum = 0;
      const lowCount = Math.min(20, bins.length);
      const midCount = Math.min(50, bins.length);

      for (let i = 1; i < lowCount; i++) lowSum += bins[i];
      for (let i = lowCount; i < midCount; i++) midSum += bins[i];

      const lowAvg = lowSum / (Math.max(1, lowCount - 1) * 255);
      const midAvg = midSum / (Math.max(1, midCount - lowCount) * 255);

      const mouthOpen = Math.min(1, Math.max(0, (lowAvg - 0.04) * 2.7));
      const mouthSpread = Math.min(1, Math.max(0.2, midAvg * 2.4));
      const energy = Math.min(1, (lowAvg + midAvg) * 1.6);

      options.onLipSyncFrame?.({ mouthOpen, mouthSpread, energy });
      this.outputAnimFrame = requestAnimationFrame(sampleLipSync);
    };

    return new Promise<void>((resolve) => {
      const cleanup = () => {
        cancelAnimationFrame(this.outputAnimFrame);
        options.onLipSyncFrame?.({ mouthOpen: 0, mouthSpread: 0.35, energy: 0 });
        URL.revokeObjectURL(objectUrl);
        if (this.outputAudioEl === audio) {
          this.outputAudioEl = null;
        }
        if (this.outputAudioCtx === ctx) {
          ctx.close().catch(() => {});
          this.outputAudioCtx = null;
          this.outputAnalyser = null;
        }
        options.onEnd?.();
        resolve();
      };

      audio.onplay = () => {
        options.onStart?.();
        this.outputAnimFrame = requestAnimationFrame(sampleLipSync);
      };
      audio.onended = cleanup;
      audio.onerror = () => {
        options.onError?.("Audio stream playback encountered an error.");
        cleanup();
      };

      audio.play().catch((playErr) => {
        options.onError?.(
          playErr instanceof Error ? playErr.message : "Browser blocked audio autoplay."
        );
        cleanup();
      });
    });
  }

  private speakWithBrowserSynthesis(
    text: string,
    options: {
      language: LanguageCode;
      speechSpeed: number;
      onStart?: () => void;
      onLipSyncFrame?: (frame: LipSyncFrame) => void;
      onEnd?: () => void;
    }
  ): boolean {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return false;
    }
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const targetLang = options.language === "hi" ? "hi-IN" : "bn-BD";
      utter.lang = targetLang;
      utter.rate = Math.min(1.5, Math.max(0.7, options.speechSpeed || 1.0));

      const voices = window.speechSynthesis.getVoices();
      const matchedVoice = voices.find((v) =>
        v.lang.toLowerCase().startsWith(options.language === "hi" ? "hi" : "bn")
      );
      if (matchedVoice) {
        utter.voice = matchedVoice;
      }

      utter.onstart = () => {
        options.onStart?.();
        let phase = 0;
        this.synthFallbackInterval = window.setInterval(() => {
          phase += 0.45;
          const open = Math.max(0.08, Math.abs(Math.sin(phase)) * 0.72);
          const spread = 0.35 + Math.abs(Math.cos(phase * 0.7)) * 0.4;
          options.onLipSyncFrame?.({ mouthOpen: open, mouthSpread: spread, energy: open });
        }, 55);
      };

      const finish = () => {
        window.clearInterval(this.synthFallbackInterval);
        options.onLipSyncFrame?.({ mouthOpen: 0, mouthSpread: 0.35, energy: 0 });
        options.onEnd?.();
      };

      utter.onend = finish;
      utter.onerror = finish;
      window.speechSynthesis.speak(utter);
      return true;
    } catch {
      return false;
    }
  }

  public stopSpeaking(): void {
    if (this.activeTtsAbort) {
      this.activeTtsAbort.abort();
      this.activeTtsAbort = null;
    }
    cancelAnimationFrame(this.outputAnimFrame);
    window.clearInterval(this.synthFallbackInterval);

    if (this.outputAudioEl) {
      this.outputAudioEl.pause();
      this.outputAudioEl.currentTime = 0;
      this.outputAudioEl = null;
    }
    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
      this.outputAnalyser = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}
