import React, { useState, useEffect, useRef } from "react";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const MODELS = [
  "gemini-2.5-flash",
  "gemini-3.8-flash",
  "gemini-3.8-flash-lite-preview",
  "gemini-2.5-pro",
  "gemini-2.0-flash"
];

export default function App() {
  const [handsFree, setHandsFree] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("Click the Arc Reactor and speak, Sir...");
  const [jarvisReply, setJarvisReply] = useState("Mark IV HUD & Telemetry Online, Sir.");
  const [textInput, setTextInput] = useState("");

  const [stats, setStats] = useState({
    cpu: 18,
    ramPercent: 45,
    ramDetail: "Scanning...",
    processes: 140,
    uptime: "0h 0m",
    battery: 100,
    charging: true,
  });

  const handsFreeRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef(null);
  const speakTimeoutRef = useRef(null);

  // 1. Live C# Telemetry Polling
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/jarvis/stats");
        const data = await res.json();

        let batLevel = 100;
        let isCharging = true;
        if (navigator.getBattery) {
          const bat = await navigator.getBattery();
          batLevel = Math.round(bat.level * 100);
          isCharging = bat.charging;
        }

        setStats({ ...data, battery: batLevel, charging: isCharging });
      } catch {}
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, []);

  // 2. Rock-Solid Speech Recognition
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Please use Google Chrome or Microsoft Edge!");
      return;
    }

    // Agar pehle se koi instance chal raha ho toh use band karein
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }

    // Agar Jarvis bol raha tha aur aapne click kiya, toh bolna rok kar sunna shuru kare
    window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    setIsSpeaking(false);

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-IN";
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = async (event) => {
      const rawText = event.results[0][0].transcript.trim();
      if (!rawText) return;

      // "hey jarvis" ya "jarvis" bolne par bhi chalega aur bina bole bhi!
      const cleanCmd = rawText.replace(/hey jarvis|jarvis/gi, "").trim() || rawText;
      setTranscript(rawText);
      setIsListening(false);
      await handleCommand(cleanCmd);
    };

    recognition.onerror = (e) => {
      console.warn("Mic status:", e.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Agar Hands-Free ON hai aur Jarvis bol nahi raha, toh mic wapas chalu karein
      if (handsFreeRef.current && !isSpeakingRef.current) {
        setTimeout(() => {
          if (handsFreeRef.current && !isSpeakingRef.current) {
            startListening();
          }
        }, 600);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.warn("Start error:", err);
    }
  };

  const toggleHandsFree = () => {
    const nextState = !handsFree;
    setHandsFree(nextState);
    handsFreeRef.current = nextState;

    if (nextState) {
      startListening();
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      setIsListening(false);
    }
  };

  // Offline Smart Fallback Brain
 const getOfflineSmartReply = (cmd) => {
    if (cmd.includes("roast") || cmd.includes("coding skills")) {
      return "Your code is like ancient Egyptian hieroglyphics, Sir. Nobody understands it, it is full of bugs, and yet somehow it miraculously works.";
    }
    if (cmd.includes("name") || cmd.includes("who are you")) {
      return "I am J.A.R.V.I.S., your personal artificial intelligence assistant, Sir.";
    }
    if (cmd.includes("boss") || cmd.includes("creator") || cmd.includes("made you")) {
      return "My creator and boss is Mayur Piprewar, a brilliant .NET Developer.";
    }
    if (cmd.includes("how are you") || cmd.includes("kaise ho")) {
      return "All systems are operating at peak efficiency, Mayur. Ready for your next deployment.";
    }
    if (cmd.includes("hello") || cmd.includes("hey") || cmd.includes("hi")) {
      return "Hello Mayur! Good to hear your voice, Sir. What are we building today?";
    }
    return "All local systems are nominal, Sir. How shall we proceed?";
  };

const handleCommand = async (text) => {
    const cmd = text.toLowerCase().trim();

    // 1. sabse pehle Local PC Control & Time Commands check honge (Fast & Direct)
    const isSystemCommand =
      cmd.includes("open ") ||
      cmd.includes("vs code") ||
      cmd.includes("play music") ||
      cmd.includes("coding protocol") ||
      cmd.includes("work protocol") ||
      cmd.includes("time");
      cmd.includes("clock");

    if (isSystemCommand) {
      try {
        const res = await fetch("http://localhost:5000/api/jarvis/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cmd }),
        });
        const data = await res.json();
        setJarvisReply(data.reply);
        speakJarvis(data.reply);
        return;
      } catch {
        const msg = "Sir, please ensure the C# Backend is running on port 5000.";
        setJarvisReply(msg);
        speakJarvis(msg);
        return;
      }
    }
    // ... baaki ka AI / Fallback code waisa hi rahega

    // 2. Baaki general sawaalon ke liye AI Brain ya Smart Fallback
    setJarvisReply("Processing neural query...");
    
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are J.A.R.V.I.S., Tony Stark's witty AI assistant, now working for Mayur, a .NET Developer. Reply in 1 short sentence without asterisks. User says: ${text}` }] }]
        }),
      });
      const data = await response.json();

      if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const aiReply = data.candidates[0].content.parts[0].text.trim();
        setJarvisReply(aiReply);
        speakJarvis(aiReply);
        return;
      }
    } catch {}

    // 3. Agar AI fail ho toh Smart Offline Brain
    const fallback = getOfflineSmartReply(cmd);
    setJarvisReply(fallback);
    speakJarvis(fallback);
  };

  // 3. Bug-Free Speech Synthesis (Kabhi "SPEAKING" par nahi atkega!)
  const speakJarvis = (text) => {
    const synth = window.speechSynthesis;
    synth.cancel();

    if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);

    isSpeakingRef.current = true;
    setIsSpeaking(true);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const britishVoice = voices.find(
      (v) => v.name.includes("UK English Male") || v.name.includes("Ryan") || v.lang === "en-GB"
    );
    if (britishVoice) utterance.voice = britishVoice;

    utterance.pitch = 0.9;
    utterance.rate = 1.05;

    const finishSpeaking = () => {
      if (speakTimeoutRef.current) clearTimeout(speakTimeoutRef.current);
      isSpeakingRef.current = false;
      setIsSpeaking(false);

      if (handsFreeRef.current) {
        setTimeout(() => {
          startListening();
        }, 500);
      }
    };

    utterance.onend = finishSpeaking;
    utterance.onerror = finishSpeaking;

    // Safety Watchdog Timer: Agar Chrome onend bhool jaye, toh 6 second mein khud unlock kar dega!
    const estimatedMs = Math.max(3000, text.length * 85);
    speakTimeoutRef.current = setTimeout(finishSpeaking, estimatedMs);

    synth.speak(utterance);
  };

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    const cmd = textInput.trim();
    setTextInput("");
    setTranscript(cmd);
    await handleCommand(cmd);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>J.A.R.V.I.S. OS // MARK IV HUD</h1>

      <div style={styles.mainGrid}>
        {/* LEFT PANEL */}
        <div style={styles.sidePanel}>
          <h3 style={styles.panelHeader}>SYSTEM TELEMETRY</h3>

          <div style={styles.statBlock}>
            <div style={styles.statLabel}>
              <span>CPU CORE LOAD</span>
              <span>{stats.cpu}%</span>
            </div>
            <div style={styles.barBg}>
              <div style={{ ...styles.barFill, width: `${stats.cpu}%` }} />
            </div>
          </div>

          <div style={styles.statBlock}>
            <div style={styles.statLabel}>
              <span>MEMORY (RAM)</span>
              <span>{stats.ramPercent}%</span>
            </div>
            <div style={styles.barBg}>
              <div style={{ ...styles.barFill, width: `${stats.ramPercent}%` }} />
            </div>
            <small style={styles.subDetail}>{stats.ramDetail}</small>
          </div>

          <div style={styles.statBlock}>
            <div style={styles.statLabel}>
              <span>POWER CELL</span>
              <span>{stats.battery}% {stats.charging ? "⚡" : ""}</span>
            </div>
            <div style={styles.barBg}>
              <div style={{ ...styles.barFill, width: `${stats.battery}%` }} />
            </div>
          </div>
        </div>

        {/* CENTER: Glowing Arc Reactor */}
        <div style={styles.centerCol}>
          <div
            onClick={startListening}
            style={{
              ...styles.arcReactor,
              boxShadow: isListening
                ? "0 0 65px #ff3333, inset 0 0 30px #ff3333"
                : isSpeaking
                ? "0 0 85px #00f7ff, inset 0 0 45px #00f7ff"
                : "0 0 35px #00bcd4, inset 0 0 20px #00bcd4",
              borderColor: isListening ? "#ff3333" : "#00f7ff",
              transform: isSpeaking ? "scale(1.08)" : "scale(1)",
            }}
          >
            <div style={styles.innerCore}>
              {isListening ? "LISTENING..." : isSpeaking ? "SPEAKING" : "CLICK TO SPEAK"}
            </div>
          </div>

          <button
            onClick={toggleHandsFree}
            style={{
              ...styles.wakeBtn,
              backgroundColor: handsFree ? "#00f7ff" : "transparent",
              color: handsFree ? "#050b14" : "#00f7ff",
            }}
          >
            {handsFree ? "● HANDS-FREE AUTO-LISTEN : ON" : "○ ENABLE CONTINUOUS LISTEN"}
          </button>
        </div>

        {/* RIGHT PANEL */}
        <div style={styles.sidePanel}>
          <h3 style={styles.panelHeader}>DIAGNOSTICS</h3>
          <p style={styles.diagItem}><strong>UPTIME:</strong> {stats.uptime}</p>
          <p style={styles.diagItem}><strong>ACTIVE PROCESSES:</strong> {stats.processes}</p>
          <p style={styles.diagItem}><strong>MIC STATUS:</strong> {isListening ? "ACTIVE (RED)" : "STANDBY"}</p>
          <hr style={styles.divider} />
          <p style={styles.protocolHint}>VOICE COMMANDS:</p>
          <p style={styles.cmdTag}>"Activate coding protocol"</p>
          <p style={styles.cmdTag}>"Open YouTube / VS Code"</p>
        </div>
      </div>

      {/* BOTTOM CONSOLE LOGS + MANUAL INPUT */}
      <div style={styles.hudPanel}>
        <p style={styles.userText}><strong>MAYUR:</strong> "{transcript}"</p>
        <p style={styles.jarvisText}><strong>J.A.R.V.I.S.:</strong> {jarvisReply}</p>

        <form onSubmit={handleTextSubmit} style={styles.inputRow}>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Or type a command here for J.A.R.V.I.S. and press Enter..."
            style={styles.textBox}
          />
          <button type="submit" style={styles.sendBtn}>SEND</button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: "#040911",
    color: "#00f7ff",
    width: "100vw",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
    fontFamily: "'Courier New', monospace",
    padding: "25px 20px",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  title: { letterSpacing: "6px", fontSize: "22px", textShadow: "0 0 12px #00f7ff", margin: 0 },
  mainGrid: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    maxWidth: "1150px",
    flexWrap: "wrap",
    gap: "20px",
  },
  sidePanel: {
    width: "280px",
    border: "1px solid rgba(0, 247, 255, 0.35)",
    backgroundColor: "rgba(0, 247, 255, 0.04)",
    padding: "18px",
    borderRadius: "8px",
    boxShadow: "0 0 20px rgba(0, 247, 255, 0.08)",
  },
  panelHeader: {
    fontSize: "15px",
    letterSpacing: "3px",
    borderBottom: "1px solid rgba(0, 247, 255, 0.3)",
    paddingBottom: "8px",
    marginBottom: "15px",
  },
  statBlock: { marginBottom: "16px" },
  statLabel: { display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "5px" },
  barBg: { width: "100%", height: "8px", backgroundColor: "rgba(0, 247, 255, 0.15)", borderRadius: "4px" },
  barFill: { height: "100%", backgroundColor: "#00f7ff", borderRadius: "4px", boxShadow: "0 0 8px #00f7ff", transition: "width 0.5s ease" },
  subDetail: { fontSize: "11px", color: "#8ae9ff" },
  centerCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" },
  arcReactor: {
    width: "200px",
    height: "200px",
    borderRadius: "50%",
    border: "6px solid #00f7ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.3s ease-in-out",
  },
  innerCore: {
    width: "135px",
    height: "135px",
    borderRadius: "50%",
    border: "2px dashed #00f7ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: "13px",
    textAlign: "center",
    letterSpacing: "1px",
  },
  wakeBtn: {
    padding: "10px 18px",
    border: "1px solid #00f7ff",
    borderRadius: "4px",
    cursor: "pointer",
    fontFamily: "'Courier New', monospace",
    fontWeight: "bold",
    fontSize: "12px",
    letterSpacing: "1px",
  },
  diagItem: { fontSize: "13px", margin: "8px 0", color: "#d0faff" },
  divider: { borderColor: "rgba(0, 247, 255, 0.2)", margin: "12px 0" },
  protocolHint: { fontSize: "11px", color: "#8ae9ff", marginBottom: "6px" },
  cmdTag: { fontSize: "12px", color: "#00f7ff", margin: "4px 0" },
  hudPanel: {
    width: "90%",
    maxWidth: "850px",
    border: "1px solid rgba(0, 247, 255, 0.4)",
    padding: "14px 20px",
    borderRadius: "8px",
    backgroundColor: "rgba(0, 247, 255, 0.05)",
  },
  userText: { color: "#8ae9ff", marginBottom: "6px", fontSize: "14px" },
  jarvisText: { color: "#ffffff", fontSize: "16px", textShadow: "0 0 5px #00f7ff", marginBottom: "10px" },
  inputRow: { display: "flex", gap: "10px", marginTop: "8px" },
  textBox: {
    flex: 1,
    backgroundColor: "rgba(0, 247, 255, 0.08)",
    border: "1px solid rgba(0, 247, 255, 0.4)",
    color: "#ffffff",
    padding: "8px 12px",
    borderRadius: "4px",
    fontFamily: "'Courier New', monospace",
    outline: "none",
  },
  sendBtn: {
    backgroundColor: "#00f7ff",
    color: "#040911",
    border: "none",
    padding: "8px 18px",
    borderRadius: "4px",
    fontWeight: "bold",
    cursor: "pointer",
    fontFamily: "'Courier New', monospace",
  },
};