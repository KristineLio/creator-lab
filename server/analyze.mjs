/**
 * Server-only Creator Lab source analysis.
 * No credential may ever be returned to the client.
 */

export async function analyzeSource(body = {}) {
  const token = process.env.SKYCASTLE_LLM_TOKEN;

  if (!token) {
    return {
      ok: false,
      error: "SERVER_ANALYSIS_NOT_CONFIGURED"
    };
  }

  const title =
    typeof body.title === "string"
      ? body.title.slice(0, 200)
      : "Untitled";

  const duration =
    Number.isFinite(Number(body.duration))
      ? Math.max(0, Number(body.duration))
      : 0;

  const transcript =
    Array.isArray(body.transcript)
      ? body.transcript
          .slice(0, 500)
          .map(item => ({
            t: Number(item?.t) || 0,
            text: String(item?.text || "").slice(0, 1000)
          }))
          .filter(item => item.text.trim())
      : [];

  if (!transcript.length) {
    return {
      ok: false,
      error: "TRANSCRIPT_REQUIRED"
    };
  }

  const systemPrompt = [
    "You analyze a timestamped creator transcript.",
    "Extract 5-8 content-strategy moments.",
    "Return JSON only.",
    "",
    "Schema:",
    "{",
    ' "summary": string,',
    ' "moments": [',
    " {",
    ' "id": string,',
    ' "start": number,',
    ' "end": number,',
    ' "type": "reveal|failure|mistake|surprise|insight|before/after|emotion|statement|explanation|conflict|payoff|curiosity",',
    ' "description": string,',
    ' "evidence": string,',
    ' "why": string,',
    ' "narrativeStrength": number,',
    ' "hookPotential": number,',
    ' "informationDensity": number',
    " }",
    " ]",
    "}",
    "",
    "Do not claim to see visuals.",
    "Do not output visualStrength.",
    "Ground evidence only in the supplied transcript."
  ].join("\n");

  const response = await fetch(
    "https://skycastle.ai/api/capabilities/llm",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: JSON.stringify({
              title,
              duration,
              transcript
            })
          }
        ]
      })
    }
  );

  if (!response.ok) {
    return {
      ok: false,
      error: "LLM_REQUEST_FAILED"
    };
  }

  const data = await response.json();
  const raw = data?.choices?.[0]?.message?.content;

  if (!raw) {
    return {
      ok: false,
      error: "EMPTY_LLM_RESPONSE"
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(
      String(raw)
        .replace(/^```json\s*/i, "")
        .replace(/```$/i, "")
        .trim()
    );
  } catch {
    return {
      ok: false,
      error: "INVALID_LLM_JSON"
    };
  }

  const moments =
    Array.isArray(parsed?.moments)
      ? parsed.moments.slice(0, 8).map((moment, index) => ({
          id: String(moment?.id || "") || "M" + String(index + 1).padStart(2, "0"),
          start: Math.max(0, Number(moment?.start) || 0),
          end: Math.max(Number(moment?.start) || 0, Number(moment?.end) || 0),
          type: String(moment?.type || "statement"),
          description: String(moment?.description || "").slice(0, 300),
          evidence: String(moment?.evidence || "").slice(0, 500),
          why: String(moment?.why || "").slice(0, 500),
          narrativeStrength: Number(moment?.narrativeStrength) || 0,
          hookPotential: Number(moment?.hookPotential) || 0,
          informationDensity: Number(moment?.informationDensity) || 0
        }))
      : [];

  if (!moments.length) {
    return {
      ok: false,
      error: "NO_MOMENTS"
    };
  }

  return {
    ok: true,
    summary: String(parsed?.summary || "").slice(0, 1000),
    moments
  };
}
