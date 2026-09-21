/**
 * Optional SkyCastle-side handler for POST /api/analyze-source.
 * Reads SKYCASTLE_LLM_TOKEN from the environment only — never commit a token.
 * GitHub Pages does not run this file.
 */
export async function analyzeSource(body) {
  const token = process.env.SKYCASTLE_LLM_TOKEN;
  if (!token) {
    return { error: "Server analysis is not configured." };
  }
  const title = body.title || "Untitled";
  const duration = body.duration || 0;
  const transcript = body.transcript || [];
  const systemPrompt = "Extract 5-8 content-strategy moments from a transcript. Return ONLY JSON: {summary,moments:[{id,start,end,type,description,evidence,why,narrativeStrength,hookPotential,informationDensity}]}. No visualStrength. Types: reveal, failure, mistake, surprise, insight, before/after, emotion, statement, explanation, conflict, payoff, curiosity.";
  const res = await fetch("https://skycastle.ai/api/capabilities/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify({ title, duration, transcript }) }
      ]
    })
  });
  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error("empty");
  const json = JSON.parse(String(reply).replace(/^```json\s*|```$/g, "").trim());
  json.moments = (json.moments || []).slice(0, 8).map((m) => {
    const { visualStrength, ...rest } = m;
    return rest;
  });
  return json;
}
