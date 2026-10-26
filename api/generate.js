export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, courseName, cardCount } = req.body;

  if (!text || !cardCount) {
    return res.status(400).json({ error: "Missing required fields: text, cardCount" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const prompt = `You are a flashcard generator. Given the following study material, generate exactly ${cardCount} high-quality flashcards.

Course: ${courseName || "General"}

Material:
${text}

Respond ONLY with a valid JSON array of exactly ${cardCount} items. No preamble, no markdown, no backticks. Format:
[
  { "question": "...", "answer": "..." }
]`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", JSON.stringify(data));
      return res.status(502).json({
        error: "Gemini API error",
        status: response.status,
        detail: data?.error?.message || JSON.stringify(data),
      });
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    console.log("Gemini raw response:", raw);

    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) {
      return res.status(502).json({ error: "Failed to parse Gemini response", raw });
    }
    const clean = raw.slice(start, end + 1).trim();

    let cards;
    try {
      cards = JSON.parse(clean);
    } catch (parseErr) {
      return res.status(502).json({ error: "Failed to parse Gemini response", raw, clean });
    }

    return res.status(200).json({ cards });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
