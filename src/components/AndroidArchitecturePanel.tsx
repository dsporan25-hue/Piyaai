import React from "react";
import { CheckCircle2, Smartphone, ShieldAlert, Terminal } from "lucide-react";
import { isAndroidBrowser, isNativeAndroidRuntime } from "../services/androidBridge";

export const AndroidArchitecturePanel: React.FC = () => {
  const nativeCap = isNativeAndroidRuntime();
  const androidWeb = isAndroidBrowser();

  const matrix = [
    {
      feature: "Gemini Online Brain (Bengali & Hindi)",
      webStatus: "Working Live (Server-Side /api/assistant/chat)",
      apkStatus: "Working Live (HTTPS Backend — Zero Key in APK)",
    },
    {
      feature: "Speech-to-Text & Neural Text-to-Speech",
      webStatus: "Working Live (MediaRecorder + Gemini STT & Neural WAV TTS)",
      apkStatus: "Working Live (RECORD_AUDIO Permission + Lifecycle Safe)",
    },
    {
      feature: "Official PIYA AI Main Character & Voice Stage",
      webStatus: "Working Live (Official Character Image + 60fps Audio-Reactive Stage)",
      apkStatus: "Working Live (Bundled in /public/assets + Hardware Accelerated WebView)",
    },
    {
      feature: "YouTube & YouTube Music Search / Launch",
      webStatus: "Working Live (Direct Search URLs & Deep Links)",
      apkStatus: "Working Live (Native Intent.ACTION_SEARCH / Package Launch)",
    },
    {
      feature: "Confirmed Calling & Multi-Contact Last-4-Digit Selection",
      webStatus: "Working Live (Confirmation Flow + tel: Dialer Intent)",
      apkStatus: "Working Live (READ_CONTACTS + CALL_PHONE / ACTION_DIAL)",
    },
    {
      feature: "Battery Percentage & Notes & Alarms",
      webStatus: "Working Live (navigator.getBattery, Local Vault, Audio Alarm)",
      apkStatus: "Working Live (BatteryManager + AlarmClock.ACTION_SET_ALARM)",
    },
    {
      feature: "Flashlight, Wi-Fi/Bluetooth Settings & Phone Lock",
      webStatus: "Torch via Camera API where supported; OS Lock requires APK",
      apkStatus: "PiyaDeviceControlPlugin.java + DevicePolicyManager.lockNow()",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--piya-border)] bg-[var(--piya-surface)] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5" style={{ color: "var(--piya-accent-bright)" }} />
              <span>Capacitor Android Architecture & Signed APK Configuration</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Current Runtime:{" "}
              <span className="text-slate-200 font-medium">
                {nativeCap
                  ? "Capacitor Native Android APK"
                  : androidWeb
                  ? "Android Mobile Browser"
                  : "Web Studio Preview"}
              </span>{" "}
              · Package ID: <span className="font-mono-tabular text-slate-200">com.poran.piyaai</span>
            </p>
          </div>
        </div>

        {/* Feature Truth Matrix */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-[#060c1a] text-slate-300">
                <th className="py-3 px-4 font-semibold">Capability</th>
                <th className="py-3 px-4 font-semibold">Current Web / Browser Status</th>
                <th className="py-3 px-4 font-semibold">Android Capacitor APK Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 bg-[#070d1b]">
              {matrix.map((row) => (
                <tr key={row.feature}>
                  <td className="py-3 px-4 font-medium text-white">{row.feature}</td>
                  <td className="py-3 px-4 text-slate-300">{row.webStatus}</td>
                  <td className="py-3 px-4 text-slate-300">{row.apkStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Signed APK Build Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-[var(--piya-border)] bg-[var(--piya-surface)] p-5 space-y-3">
          <h3 className="font-display text-base font-semibold text-white flex items-center gap-2">
            <Terminal className="w-4 h-4" style={{ color: "var(--piya-accent-bright)" }} />
            <span>Included Android Source Files</span>
          </h3>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <code className="font-mono-tabular text-slate-100">capacitor.config.ts</code> —
                Configured for <code className="font-mono-tabular">com.poran.piyaai</code> &amp;
                secure HTTPS backend URL.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <code className="font-mono-tabular text-slate-100">
                  android/app/src/main/AndroidManifest.xml
                </code>{" "}
                — Declares <code className="font-mono-tabular">RECORD_AUDIO</code>,{" "}
                <code className="font-mono-tabular">READ_CONTACTS</code>,{" "}
                <code className="font-mono-tabular">CALL_PHONE</code>,{" "}
                <code className="font-mono-tabular">SET_ALARM</code>, package visibility{" "}
                <code className="font-mono-tabular">&lt;queries&gt;</code>, and{" "}
                <code className="font-mono-tabular">PiyaDeviceAdminReceiver</code>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <code className="font-mono-tabular text-slate-100">
                  PiyaDeviceControlPlugin.java
                </code>{" "}
                — Native Android Capacitor bridge executing{" "}
                <code className="font-mono-tabular">DevicePolicyManager.lockNow()</code>,{" "}
                <code className="font-mono-tabular">CameraManager.setTorchMode</code>,{" "}
                <code className="font-mono-tabular">AlarmClock</code>, and package launch intents.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <code className="font-mono-tabular text-slate-100">android/app/build.gradle</code> —
                Includes production <code className="font-mono-tabular">signingConfigs.release</code>{" "}
                reading from <code className="font-mono-tabular">keystore.properties</code>.
              </span>
            </li>
          </ul>
        </section>

        <section className="rounded-2xl border border-[var(--piya-border)] bg-[var(--piya-surface)] p-5 space-y-3">
          <h3 className="font-display text-base font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>Building the Signed Release APK</span>
          </h3>
          <div className="rounded-xl bg-[#050a16] border border-slate-800 p-3.5 font-mono-tabular text-xs text-slate-200 space-y-1.5 overflow-x-auto">
            <div>1. npm run build</div>
            <div>2. npx cap sync android</div>
            <div>
              3. keytool -genkey -v -keystore piya-release.jks -keyalg RSA -keysize 2048 -validity
              10000 -alias piya
            </div>
            <div>4. ./gradlew assembleRelease (inside /android)</div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Sensitive Android permissions (Contacts, Call Phone, Microphone, and Device
            Administrator for screen lock) require explicit runtime approval on the physical
            Android phone before PIYA AI executes those actions.
          </p>
        </section>
      </div>
    </div>
  );
};
