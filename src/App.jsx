import { useState, useRef, useEffect } from "react";

// ── PDF.js loader ─────────────────────────────────────────────────────
const PDFJS_VERSION = "3.11.174";
const PDFJS_URL = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

function loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const script = document.createElement("script");
    script.src = PDFJS_URL;
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      resolve(window.pdfjsLib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function extractTextFromPdf(file) {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += "\n" + content.items.map((item) => item.str).join(" ");
  }
  return fullText.trim();
}

// ── Supabase config ───────────────────────────────────────────────────
const SUPABASE_URL = "https://mtlpoqemyjbzqnsoaemw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10bHBvcWVteWpienFuc29hZW13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5NjgyNTEsImV4cCI6MjEwODU0NDI1MX0.AwdogVuXvOQbM-Ig820R_nx9EqRpLbhxOA5roG7TAnQ";

const db = {
  async query(table, method, body) {
    const url = `${SUPABASE_URL}/rest/v1/${table}`;
    const headers = {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Prefer": "return=representation",
    };
    const res = await fetch(method === "GET" ? `${url}?${body}` : url, {
      method,
      headers,
      body: method !== "GET" ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getCourses(deviceId) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/courses?device_id=eq.${deviceId}&order=created_at.asc`,
      { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    return res.json();
  },

  async addCourse(deviceId, name) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Prefer": "return=representation" },
      body: JSON.stringify({ device_id: deviceId, name }),
    });
    const data = await res.json();
    return data[0];
  },

  async deleteCourse(deviceId, name) {
    await fetch(`${SUPABASE_URL}/rest/v1/courses?device_id=eq.${deviceId}&name=eq.${encodeURIComponent(name)}`, {
      method: "DELETE",
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    });
  },

  async getCards(deviceId, course) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/flashcards?device_id=eq.${deviceId}&course=eq.${encodeURIComponent(course)}&order=created_at.asc`,
      { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    return res.json();
  },

  async getAllCards(deviceId) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/flashcards?device_id=eq.${deviceId}&order=created_at.asc`,
      { headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    return res.json();
  },

  async addCards(deviceId, course, cards) {
    const rows = cards.map((c) => ({ device_id: deviceId, course, question: c.question, answer: c.answer }));
    const res = await fetch(`${SUPABASE_URL}/rest/v1/flashcards`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}`, "Prefer": "return=representation" },
      body: JSON.stringify(rows),
    });
    return res.json();
  },

  async deleteCard(id) {
    await fetch(`${SUPABASE_URL}/rest/v1/flashcards?id=eq.${id}`, {
      method: "DELETE",
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    });
  },

  async deleteCourseCards(deviceId, course) {
    await fetch(`${SUPABASE_URL}/rest/v1/flashcards?device_id=eq.${deviceId}&course=eq.${encodeURIComponent(course)}`, {
      method: "DELETE",
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    });
  },
};

// ── Device ID ─────────────────────────────────────────────────────────
function getDeviceId() {
  let id = localStorage.getItem("mneme_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("mneme_device_id", id);
  }
  return id;
}

// ── Colors ────────────────────────────────────────────────────────────
const COLORS = [
  { bg: "#1a1a2e", accent: "#e94560", light: "#16213e" },
  { bg: "#0f3460", accent: "#e94560", light: "#1a1a2e" },
  { bg: "#16213e", accent: "#0f3460", light: "#1a1a2e" },
  { bg: "#1b262c", accent: "#bbe1fa", light: "#0f4c75" },
  { bg: "#2d132c", accent: "#ee4540", light: "#c72c41" },
  { bg: "#1b4332", accent: "#52b788", light: "#2d6a4f" },
];
function getCourseColor(i) { return COLORS[i % COLORS.length]; }

// ── Gemini via backend ────────────────────────────────────────────────
async function generateFlashcards(text, courseName, cardCount) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, courseName, cardCount }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Generation failed");
  }
  const data = await res.json();
  return data.cards;
}

// ── FlashCard ─────────────────────────────────────────────────────────
function FlashCard({ card, index }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div onClick={() => setFlipped((f) => !f)} style={{ cursor: "pointer", perspective: "1000px", height: "180px", userSelect: "none" }}>
      <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", transition: "transform 0.5s cubic-bezier(0.4,0,0.2,1)", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span style={{ fontSize: "10px", letterSpacing: "2px", opacity: 0.4, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase" }}>Question #{index + 1}</span>
          <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.5, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic" }}>{card.question}</p>
          <span style={{ fontSize: "10px", opacity: 0.3, fontFamily: "'DM Sans', sans-serif" }}>tap to reveal →</span>
        </div>
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span style={{ fontSize: "10px", letterSpacing: "2px", opacity: 0.4, fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase" }}>Answer</span>
          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>{card.answer}</p>
          <span style={{ fontSize: "10px", opacity: 0.3, fontFamily: "'DM Sans', sans-serif" }}>tap to flip back ←</span>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────
export default function App() {
  const deviceId = getDeviceId();
  const [courses, setCourses] = useState([]);
  const [cardsByCourse, setCardsByCourse] = useState({});
  const [activeCourse, setActiveCourse] = useState(null);
  const [view, setView] = useState("home");
  const [inputText, setInputText] = useState("");
  const [targetCourse, setTargetCourse] = useState("");
  const [newCourseName, setNewCourseName] = useState("");
  const [cardCount, setCardCount] = useState(10);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appLoading, setAppLoading] = useState(true);
  const [error, setError] = useState("");
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyMode, setStudyMode] = useState(false);
  const fileRef = useRef();

  // Load courses and cards from Supabase on mount
  useEffect(() => {
    async function loadData() {
      setAppLoading(true);
      try {
        const [fetchedCourses, allCards] = await Promise.all([
          db.getCourses(deviceId),
          db.getAllCards(deviceId),
        ]);

        // Always ensure Uncategorized exists
        const courseNames = fetchedCourses.map((c) => c.name);
        if (!courseNames.includes("Uncategorized")) {
          await db.addCourse(deviceId, "Uncategorized");
          courseNames.unshift("Uncategorized");
        }

        setCourses(courseNames);
        setTargetCourse(courseNames[0]);

        const grouped = {};
        courseNames.forEach((name) => { grouped[name] = []; });
        allCards.forEach((card) => {
          if (grouped[card.course]) grouped[card.course].push(card);
          else grouped[card.course] = [card];
        });
        setCardsByCourse(grouped);
      } catch (e) {
        console.error("Load error:", e);
      } finally {
        setAppLoading(false);
      }
    }
    loadData();
  }, []);

  const totalCards = Object.values(cardsByCourse).reduce((s, c) => s + c.length, 0);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      setPdfLoading(true); setError("");
      try {
        const text = await extractTextFromPdf(file);
        if (!text) { setError("Could not extract text. This PDF may be a scanned image."); return; }
        setInputText(text);
      } catch { setError("Failed to read PDF. Try a different file."); }
      finally { setPdfLoading(false); }
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => setInputText(ev.target.result);
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  const addCourse = async () => {
    const name = newCourseName.trim();
    if (!name || courses.includes(name)) return;
    await db.addCourse(deviceId, name);
    setCourses((c) => [...c, name]);
    setCardsByCourse((prev) => ({ ...prev, [name]: [] }));
    setNewCourseName("");
    setTargetCourse(name);
  };

  const handleGenerate = async () => {
    if (!inputText.trim()) { setError("Paste or upload study material first."); return; }
    setError(""); setLoading(true);
    try {
      const cards = await generateFlashcards(inputText, targetCourse, cardCount);
      const saved = await db.addCards(deviceId, targetCourse, cards);
      setCardsByCourse((prev) => ({ ...prev, [targetCourse]: [...(prev[targetCourse] || []), ...saved] }));
      setView("course"); setActiveCourse(targetCourse); setInputText("");
    } catch (e) {
      setError(e.message || "Something went wrong. Try again.");
    } finally { setLoading(false); }
  };

  const deleteCard = async (card) => {
    await db.deleteCard(card.id);
    setCardsByCourse((prev) => ({
      ...prev,
      [card.course]: prev[card.course].filter((c) => c.id !== card.id),
    }));
  };

  const deleteCourse = async (name) => {
    if (name === "Uncategorized") return;
    await Promise.all([db.deleteCourse(deviceId, name), db.deleteCourseCards(deviceId, name)]);
    setCourses((c) => c.filter((x) => x !== name));
    setCardsByCourse((prev) => { const next = { ...prev }; delete next[name]; return next; });
    setActiveCourse(null); setView("home");
  };

  if (appLoading) return (
    <div style={{ minHeight: "100vh", background: "#080b14", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "28px", color: "#f0ede8" }}>Mneme</div>
      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "2px" }}>LOADING YOUR CARDS…</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#080b14", color: "#f0ede8", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#080b14", zIndex: 10 }}>
        <div style={{ cursor: "pointer" }} onClick={() => { setView("home"); setStudyMode(false); }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "20px", fontWeight: 600 }}>Mneme</div>
          <div style={{ fontSize: "10px", opacity: 0.4, letterSpacing: "2px", textTransform: "uppercase" }}>AI Flashcard Studio</div>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <span style={{ fontSize: "12px", opacity: 0.4 }}>{totalCards} cards · {courses.length} courses</span>
          <button onClick={() => { setView("generate"); setStudyMode(false); }} style={{ background: "#e94560", border: "none", color: "#fff", padding: "8px 16px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            + Generate
          </button>
        </div>
      </div>

      <div style={{ padding: "24px", maxWidth: "760px", margin: "0 auto" }}>

        {/* HOME */}
        {view === "home" && (
          <>
            <div style={{ marginBottom: "28px" }}>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "28px", fontWeight: 400, margin: "0 0 6px" }}>Your Courses</h2>
              <p style={{ opacity: 0.4, fontSize: "13px", margin: 0 }}>Select a course to study, or generate new cards.</p>
            </div>
            <div style={{ display: "flex", gap: "10px", marginBottom: "28px" }}>
              <input value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCourse()} placeholder="New course name…" style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0ede8", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
              <button onClick={addCourse} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#f0ede8", padding: "10px 18px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Add Course</button>
            </div>
            <div style={{ display: "grid", gap: "14px" }}>
              {courses.map((name, idx) => {
                const col = getCourseColor(idx);
                const count = (cardsByCourse[name] || []).length;
                return (
                  <div key={name} onClick={() => { setActiveCourse(name); setView("course"); setStudyIndex(0); setStudyMode(false); }}
                    style={{ background: `linear-gradient(135deg, ${col.bg} 0%, ${col.light} 100%)`, border: `1px solid ${col.accent}22`, borderRadius: "14px", padding: "20px 24px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "transform 0.2s, box-shadow 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 30px ${col.accent}33`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div>
                      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "20px", fontWeight: 600 }}>{name}</div>
                      <div style={{ fontSize: "11px", opacity: 0.6, marginTop: "4px" }}>{count} {count === 1 ? "card" : "cards"}</div>
                    </div>
                    <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: `${col.accent}33`, border: `1px solid ${col.accent}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, color: col.accent }}>{count}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* GENERATE */}
        {view === "generate" && (
          <>
            <div style={{ marginBottom: "24px" }}>
              <button onClick={() => setView("home")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "12px", padding: 0, marginBottom: "16px" }}>← Back</button>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "28px", fontWeight: 400, margin: "0 0 6px" }}>Generate Flashcards</h2>
              <p style={{ opacity: 0.4, fontSize: "13px", margin: 0 }}>Paste notes, upload a file, pick your course and card count.</p>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "11px", letterSpacing: "1.5px", opacity: 0.5, textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Assign to Course</label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {courses.map((name) => (
                  <button key={name} onClick={() => setTargetCourse(name)} style={{ padding: "7px 14px", borderRadius: "8px", border: targetCourse === name ? "1px solid #e94560" : "1px solid rgba(255,255,255,0.1)", background: targetCourse === name ? "#e9456022" : "rgba(255,255,255,0.04)", color: targetCourse === name ? "#e94560" : "rgba(255,255,255,0.6)", fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <label style={{ fontSize: "11px", letterSpacing: "1.5px", opacity: 0.5, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>Cards to Generate</label>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "22px", fontWeight: 600, color: "#e94560" }}>{cardCount}</span>
              </div>
              <div style={{ position: "relative", height: "20px", display: "flex", alignItems: "center" }}>
                <div style={{ position: "absolute", left: 0, right: 0, height: "3px", background: "rgba(255,255,255,0.1)", borderRadius: "2px" }} />
                <div style={{ position: "absolute", left: 0, height: "3px", borderRadius: "2px", background: "#e94560", width: `${((cardCount - 5) / 45) * 100}%`, transition: "width 0.05s" }} />
                <input type="range" min={5} max={50} step={1} value={cardCount} onChange={(e) => setCardCount(Number(e.target.value))} style={{ position: "relative", width: "100%", appearance: "none", background: "transparent", cursor: "pointer", zIndex: 1, margin: 0, padding: 0 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                <span style={{ fontSize: "10px", opacity: 0.3 }}>5</span>
                <span style={{ fontSize: "10px", opacity: 0.3 }}>50</span>
              </div>
              <style>{`
                input[type=range]::-webkit-slider-thumb { appearance:none; width:18px; height:18px; border-radius:50%; background:#e94560; border:2px solid #080b14; box-shadow:0 0 8px #e9456066; cursor:pointer; transition:transform 0.15s; }
                input[type=range]::-webkit-slider-thumb:hover { transform:scale(1.2); }
                input[type=range]::-moz-range-thumb { width:18px; height:18px; border-radius:50%; background:#e94560; border:2px solid #080b14; box-shadow:0 0 8px #e9456066; cursor:pointer; }
              `}</style>
            </div>

            <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Paste your lecture notes, textbook excerpt, or study material here…" rows={10} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", color: "#f0ede8", padding: "16px", fontSize: "13px", fontFamily: "'DM Sans', sans-serif", resize: "vertical", outline: "none", lineHeight: 1.7, boxSizing: "border-box" }} />

            <div style={{ display: "flex", gap: "12px", marginTop: "14px", alignItems: "center" }}>
              <button onClick={() => fileRef.current.click()} disabled={pdfLoading} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: pdfLoading ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)", padding: "10px 16px", borderRadius: "8px", fontSize: "12px", cursor: pdfLoading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
                {pdfLoading ? "Reading PDF…" : "📄 Upload .txt or PDF"}
              </button>
              <input ref={fileRef} type="file" accept=".txt,.md,.pdf" style={{ display: "none" }} onChange={handleFileUpload} />
              <button onClick={handleGenerate} disabled={loading} style={{ flex: 1, background: loading ? "rgba(233,69,96,0.3)" : "#e94560", border: "none", color: "#fff", padding: "11px 20px", borderRadius: "8px", fontSize: "13px", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                {loading ? "Generating…" : "✦ Generate with AI"}
              </button>
            </div>
            {error && <p style={{ color: "#e94560", fontSize: "12px", marginTop: "10px" }}>{error}</p>}
          </>
        )}

        {/* COURSE */}
        {view === "course" && activeCourse && (
          <>
            <div style={{ marginBottom: "24px" }}>
              <button onClick={() => { setView("home"); setStudyMode(false); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "12px", padding: 0, marginBottom: "16px" }}>← All Courses</button>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "30px", fontWeight: 600, margin: "0 0 4px" }}>{activeCourse}</h2>
                  <span style={{ opacity: 0.4, fontSize: "12px" }}>{(cardsByCourse[activeCourse] || []).length} flashcards</span>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  {(cardsByCourse[activeCourse] || []).length > 0 && (
                    <button onClick={() => { setStudyMode((s) => !s); setStudyIndex(0); }} style={{ background: studyMode ? "rgba(255,255,255,0.1)" : "#e94560", border: "none", color: "#fff", padding: "9px 16px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      {studyMode ? "Exit Study" : "▶ Study Mode"}
                    </button>
                  )}
                  {activeCourse !== "Uncategorized" && (
                    <button onClick={() => deleteCourse(activeCourse)} style={{ background: "rgba(233,69,96,0.1)", border: "1px solid rgba(233,69,96,0.3)", color: "#e94560", padding: "9px 14px", borderRadius: "8px", fontSize: "12px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Delete</button>
                  )}
                </div>
              </div>
            </div>

            {(cardsByCourse[activeCourse] || []).length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", opacity: 0.4 }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "22px", marginBottom: "8px" }}>No cards yet</div>
                <p style={{ fontSize: "13px" }}>Generate cards and assign them to this course.</p>
                <button onClick={() => { setTargetCourse(activeCourse); setView("generate"); }} style={{ marginTop: "16px", background: "#e94560", border: "none", color: "#fff", padding: "10px 20px", borderRadius: "8px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Generate Cards</button>
              </div>
            ) : studyMode ? (
              <div>
                <div style={{ textAlign: "center", marginBottom: "20px", opacity: 0.5, fontSize: "12px" }}>Card {studyIndex + 1} of {(cardsByCourse[activeCourse] || []).length}</div>
                <FlashCard card={(cardsByCourse[activeCourse] || [])[studyIndex]} index={studyIndex} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px" }}>
                  <button onClick={() => setStudyIndex((i) => Math.max(0, i - 1))} disabled={studyIndex === 0} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: studyIndex === 0 ? "rgba(255,255,255,0.2)" : "#f0ede8", padding: "10px 24px", borderRadius: "8px", cursor: studyIndex === 0 ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Prev</button>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    {(cardsByCourse[activeCourse] || []).map((_, i) => (
                      <div key={i} onClick={() => setStudyIndex(i)} style={{ width: i === studyIndex ? "20px" : "6px", height: "6px", borderRadius: "3px", background: i === studyIndex ? "#e94560" : "rgba(255,255,255,0.2)", cursor: "pointer", transition: "width 0.2s" }} />
                    ))}
                  </div>
                  <button onClick={() => setStudyIndex((i) => Math.min((cardsByCourse[activeCourse] || []).length - 1, i + 1))} disabled={studyIndex === (cardsByCourse[activeCourse] || []).length - 1} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: studyIndex === (cardsByCourse[activeCourse] || []).length - 1 ? "rgba(255,255,255,0.2)" : "#f0ede8", padding: "10px 24px", borderRadius: "8px", cursor: studyIndex === (cardsByCourse[activeCourse] || []).length - 1 ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif" }}>Next →</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                {(cardsByCourse[activeCourse] || []).map((card, idx) => (
                  <div key={card.id} style={{ position: "relative" }}>
                    <FlashCard card={card} index={idx} />
                    <button onClick={(e) => { e.stopPropagation(); deleteCard(card); }} style={{ position: "absolute", top: "10px", right: "10px", background: "rgba(233,69,96,0.2)", border: "none", color: "#e94560", width: "22px", height: "22px", borderRadius: "50%", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                ))}
                <div onClick={() => { setTargetCourse(activeCourse); setView("generate"); }} style={{ height: "180px", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: "14px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: 0.5, gap: "8px", transition: "opacity 0.2s" }} onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")} onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}>
                  <span style={{ fontSize: "24px" }}>+</span>
                  <span style={{ fontSize: "12px" }}>Add more cards</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
