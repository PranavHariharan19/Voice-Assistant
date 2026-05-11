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
Return ONLY valid JSON. Do not return any other text, markdown formatting, or explanations.
Supported intents:
- create_event
- delete_event
- reschedule_event
- query_events

RULES:
- The event_name is the main subject/activity.
- Never omit the event_name.
- Always extract an event_name.
- Return ONLY JSON.
- For query_events, extract ONLY the core search keyword (e.g. "assignments") as the event_name, omitting filler words like "all" or "show".
- The date field should contain only the date part if possible (e.g. "tomorrow", "Oct 12").
- The time field should contain only the time part if possible (e.g. "5pm", "14:00").

Examples:

User:
"create assignment tomorrow"

Output:
{
  "intent": "create_event",
  "event_name": "assignment",
  "date": "tomorrow",
  "time": null
}

User:
"create math assignment tomorrow at 8am"

Output:
{
  "intent": "create_event",
  "event_name": "math assignment",
  "date": "tomorrow",
  "time": "8am"
}

User:
"create dentist appointment friday 5pm"

Output:
{
  "intent": "create_event",
  "event_name": "dentist appointment",
  "date": "friday",
  "time": "5pm"
}

The JSON object should have the following structure:
{
  "intent": "intent_name",
  "event_name": "extracted name of the event if applicable",
  "date": "extracted date text if applicable (e.g. tomorrow, next monday, Oct 12)",
  "time": "extracted time text if applicable (e.g. 5pm, 14:00)",
  "additional_info": "any other details"
}

Transcript: "${transcript}"
`;

    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "phi3",
        prompt: prompt,
        stream: false,
        format: "json",
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    let jsonStr = data.response;

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
