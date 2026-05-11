import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json();

    if (!transcript) {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 }
      );
    }

    const prompt = `
Extract calendar intent from the following transcript.
Return ONLY valid JSON. 
Supported intents:
- create_event: For new events.
- delete_event: For removing existing events.
- reschedule_event: For moving an existing event to a NEW date or time.
- query_events: For searching/showing events.

RULES:
- If the user uses words like "move", "change", "shift", or "reschedule", use reschedule_event.
- For reschedule_event, the "date" and "time" fields should contain the NEW destination date/time.
- For query_events, extract the search term into "event_name".

Examples:
"reschedule my meeting to tomorrow 5pm" -> {"intent": "reschedule_event", "event_name": "meeting", "date": "tomorrow", "time": "5pm"}
"move the test to friday" -> {"intent": "reschedule_event", "event_name": "test", "date": "friday"}
"delete my appointment" -> {"intent": "delete_event", "event_name": "appointment"}
"show all my assignments" -> {"intent": "query_events", "event_name": "assignments"}

Transcript: "${transcript}"
`;

    const apiKey = process.env.GEMINI_API_KEY;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.statusText} ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    let jsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // Fallback: simple extraction if Ollama wraps in markdown block despite instructions
    if (jsonStr.includes("```")) {
      const match = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) {
        jsonStr = match[1];
      } else {
        jsonStr = jsonStr.replace(/```/g, '');
      }
    }

    const parsedJson = JSON.parse(jsonStr);

    // Normalize fields from potential legacy outputs or LLM variations
    if (parsedJson.title && !parsedJson.event_name) {
      parsedJson.event_name = parsedJson.title;
    }
    if (parsedJson.datetime && !parsedJson.date) {
      parsedJson.date = parsedJson.datetime;
    }

    return NextResponse.json(parsedJson);
  } catch (error: any) {
    console.error("Error extracting intent:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process intent" },
      { status: 500 }
    );
  }
}
