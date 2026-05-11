"use client";

import { FormEvent, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import * as chrono from "chrono-node";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

type CalendarEvent = {
  id: number | string;
  title: string;
  time: string;
  location: string;
  date: string;
  additionalInformation: string;
  tone: "mint" | "amber" | "rose" | "ink";
};

type EventFormValues = {
  name: string;
  date: string;
  time: string;
  additionalInformation: string;
};

type EventFormMode = "add" | "reschedule" | null;

type EventRow = {
  event_id: number | string;
  event_name: string;
  event_date: string;
  event_time: string | null;
  additional_info: string | null;
};

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function sameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function getMonthDays(activeDate: Date) {
  const year = activeDate.getFullYear();
  const month = activeDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = Array.from({ length: firstDay.getDay() }, (_, index) => ({
    type: "blank" as const,
    id: `blank-${index}`,
  }));
  const days = Array.from({ length: daysInMonth }, (_, index) => ({
    type: "day" as const,
    date: new Date(year, month, index + 1),
    id: `day-${index + 1}`,
  }));

  return [...blanks, ...days];
}

function buildEvents() {
  const eventDates: { date: Date; events: CalendarEvent[] }[] = [];

  return eventDates.reduce<Record<string, CalendarEvent[]>>((events, item) => {
    events[dateKey(item.date)] = item.events;
    return events;
  }, {});
}

function createEmptyForm(date: string): EventFormValues {
  return {
    name: "",
    date,
    time: "",
    additionalInformation: "",
  };
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function toDateKeyFromDisplay(value: string) {
  const [day, month, year] = value.split("/");

  if (!day || !month || !year) {
    return "";
  }

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function isDisplayDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);

  if (!match) {
    return false;
  }

  const [, day, month, year] = match;
  const parsed = parseDateKey(`${year}-${month}-${day}`);

  return (
    parsed.getFullYear() === Number(year) &&
    parsed.getMonth() === Number(month) - 1 &&
    parsed.getDate() === Number(day)
  );
}

function mapEventRow(row: EventRow): CalendarEvent {
  return {
    id: row.event_id,
    title: row.event_name,
    time: row.event_time?.slice(0, 5) ?? "",
    location: row.additional_info ?? "",
    date: row.event_date,
    additionalInformation: row.additional_info ?? "",
    tone: "mint",
  };
}

function groupEvents(events: CalendarEvent[]) {
  return events.reduce<Record<string, CalendarEvent[]>>((grouped, event) => {
    grouped[event.date] = [...(grouped[event.date] ?? []), event];
    return grouped;
  }, {});
}

export default function Home() {
  const { user, loading: authLoading, initialized, signOut } = useAuth();
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [activeMonth, setActiveMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(today);
  const [eventsByDate, setEventsByDate] = useState(() => buildEvents());
  const [selectedEventId, setSelectedEventId] = useState<number | string | null>(
    null,
  );
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [formMode, setFormMode] = useState<EventFormMode>(null);
  const [formValues, setFormValues] = useState(() =>
    createEmptyForm(displayDate(dateKey(today))),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMonthSelectorOpen, setIsMonthSelectorOpen] = useState(false);
  const [isYearSelectorOpen, setIsYearSelectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isClarifyingRef = useRef(false);

  type ChatMessage = { role: "user" | "system", text: string, timestamp: Date };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInputText, setChatInputText] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isChatOpen && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [isChatOpen]);
                        
  type FilterTab = 'quiz' | 'assignment' | 'other' | null;
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>(null);                                                
                                                              
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQuery = searchQuery.toLowerCase();
    const singularQuery = lowerQuery.endsWith('s') ? lowerQuery.slice(0, -1) : lowerQuery;
    const allEvents = Object.values(eventsByDate).flat();
    
    return allEvents.filter((event) => {
      const titleLower = event.title.toLowerCase();
      const infoLower = event.additionalInformation ? event.additionalInformation.toLowerCase() : "";
      const matchesQuery =
        titleLower.includes(lowerQuery) ||
        titleLower.includes(singularQuery) ||
        infoLower.includes(lowerQuery) ||
        infoLower.includes(singularQuery);

      if (!matchesQuery) return false;

      if (filterFromDate && event.date < filterFromDate) return false;
      if (filterToDate && event.date > filterToDate) return false;

      return true;
    });
  }, [searchQuery, filterFromDate, filterToDate, eventsByDate]);
  const monthDays = useMemo(() => getMonthDays(activeMonth), [activeMonth]);

  const selectedEvents = eventsByDate[dateKey(selectedDate)] ?? [];
  const selectedEvent =
    Object.values(eventsByDate)
      .flat()
      .find((event) => event.id === selectedEventId) ?? null;
  const todayEvents = eventsByDate[dateKey(today)] ?? [];
  const isCurrentMonth =
    activeMonth.getFullYear() === today.getFullYear() &&
    activeMonth.getMonth() === today.getMonth();

  useEffect(() => {
    if (initialized && !user) {
      router.push("/login");
    }
  }, [user, initialized, router]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    async function loadEvents() {
      const { data, error } = await supabase
        .from("events")
        .select("event_id,event_name,event_date,event_time,additional_info")
        .eq("user_id", user?.id)
        .order("event_date", { ascending: true });

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error("Could not load events:", error.message);
        return;
      }

      const events = (data ?? []).map((row) => mapEventRow(row as EventRow));
      setEventsByDate(groupEvents(events));
    }

    loadEvents();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = async (event: any) => {
        setIsListening(false);
        const transcript = event.results[0][0].transcript;
        setChatMessages(prev => [...prev, { role: "user", text: transcript, timestamp: new Date() }]);
        await processVoiceCommand(transcript);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [eventsByDate]);

  const systemReply = (text: string, expectReply = false) => {
    setChatMessages(prev => [...prev, { role: "system", text, timestamp: new Date() }]);
    const utterance = new SpeechSynthesisUtterance(text);
    if (expectReply) {
      isClarifyingRef.current = true;
      utterance.onend = () => {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error(e);
          }
        }
      };
    }
    window.speechSynthesis.speak(utterance);
  };

  const pendingContextRef = useRef<{ intent: string; data: any; missing: string } | null>(null);

  const processVoiceCommand = async (transcript: string) => {
    isClarifyingRef.current = false;
    
    if (pendingContextRef.current) {
      const ctx = pendingContextRef.current;

      if (ctx.intent === "confirm_delete_all_today") {
        const lower = transcript.toLowerCase();
        if (lower.includes("yes") || lower.includes("yeah") || lower.includes("sure") || lower.includes("yep")) {
          const tKey = dateKey(today);
          const { error } = await supabase
            .from("events")
            .delete()
            .eq("event_date", tKey)
            .eq("user_id", user?.id);

          if (error) {
             systemReply("Failed to delete events.");
          } else {
             setEventsByDate((current) => ({
               ...current,
               [tKey]: []
             }));
             if (selectedEventId && todayEvents.find(e => e.id === selectedEventId)) {
               setSelectedEventId(null);
               setIsDetailOpen(false);
             }
             systemReply("All events for today have been deleted.");
          }
        } else {
          systemReply("Deletion cancelled.");
        }
        pendingContextRef.current = null;
        return;
      }

      if (ctx.intent === "confirm_delete") {
        const lower = transcript.toLowerCase();
        if (lower.includes("yes") || lower.includes("yeah") || lower.includes("sure") || lower.includes("yep")) {
          deleteEvent(ctx.data.eventId, ctx.data.eventDate);
          systemReply("Event deleted successfully.");
        } else {
          systemReply("Deletion cancelled.");
        }
        pendingContextRef.current = null;
        return;
      }

      if (ctx.missing === "disambiguate_date") {
        const parsed = chrono.parse(transcript);
        if (parsed.length > 0) {
          const d = dateKey(parsed[0].start.date());
          const allEvents = Object.values(eventsByDate).flat();
          const matches = allEvents.filter(e => 
            (e.title.toLowerCase().includes(ctx.data.event_name.toLowerCase())) && 
            e.date === d
          );
          if (matches.length === 1) {
            const target = matches[0];
            pendingContextRef.current = null;
            if (ctx.intent === "disambiguate_delete") {
              await handleIntent("delete_event", { ...ctx.data, targetId: target.id, targetDate: target.date, forceTarget: true });
            } else {
              await handleIntent("reschedule_event", { ...ctx.data, targetId: target.id, targetDate: target.date, forceTarget: true });
            }
            return;
          } else {
            systemReply(`I couldn't find a unique event named "${ctx.data.event_name}" on that date.`);
            pendingContextRef.current = null;
            return;
          }
        }
      }
      if (ctx.missing === "event_name") {
        ctx.data.event_name = transcript;
      } else if (ctx.missing === "date") {
        ctx.data.date = transcript;
      } else if (ctx.missing === "time") {
        ctx.data.time = transcript;
      }
      pendingContextRef.current = null;
      await handleIntent(ctx.intent, ctx.data);
      return;
    }

    setIsChatLoading(true);

    try {
      const textLower = transcript.toLowerCase().replace("'", "");

      const readPhrases = ["roll out", "list all", "what are my", "what is my", "whats my", "read my", "show my", "show all", "show me"];
      if (readPhrases.some(phrase => textLower.includes(phrase)) && textLower.includes("today")) {
        setIsChatLoading(false);
        await handleIntent("read_todays_events", {});
        return;
      }

      const deletePhrases = ["delete all", "remove all", "cancel all", "clear all"];
      if (deletePhrases.some(phrase => textLower.includes(phrase)) && textLower.includes("today")) {
        setIsChatLoading(false);
        await handleIntent("delete_all_events_today", {});
        return;
      }

      let intent = null;
      let data: any = {};

      if (textLower.includes("reschedule") || textLower.includes("move") || textLower.includes("shift")) {
        intent = "reschedule_event";
      } else if (textLower.includes("delete") || textLower.includes("remove") || textLower.includes("cancel")) {
        intent = "delete_event";
      } else if (textLower.includes("create") || textLower.includes("schedule") || textLower.includes("add")) {
        intent = "create_event";
      } else if (textLower.includes("find") || textLower.includes("search") || textLower.includes("show")) {
        intent = "query_events";
      }

      if (intent) {
        const parsed = chrono.parse(transcript);
        let remainingText = transcript;
        
        if (parsed.length > 0) {
          const lastResult = parsed[parsed.length - 1];
          data.date = lastResult.text;
          
          // If time was explicitly specified in the text, we can help the handler
          if (lastResult.start.isCertain('hour')) {
             const h = lastResult.start.get('hour')!;
             const m = lastResult.start.get('minute') || 0;
             data.time = h.toString().padStart(2, '0') + ":" + m.toString().padStart(2, '0');
          }

          parsed.forEach(p => {
            remainingText = remainingText.replace(p.text, "");
          });
        }
        
        const keywords = [
          "create", "schedule", "add", "delete", "remove", "cancel", "reschedule", "move", "shift", "find", "search", "show",
          "an event", "the event", "event", "events", "called", "named", "all", "my"
        ];
        // Only strip these if they are likely separators at the beginning or end
        const separators = ["for", "to", "on", "at", "from", "is", "are", "a", "an", "the"];
        
        let eventName = remainingText;
        keywords.forEach(kw => {
          const regex = new RegExp(`\\b${kw}\\b`, "gi");
          eventName = eventName.replace(regex, "");
        });

        separators.forEach(sep => {
          const startRegex = new RegExp(`^\\s*${sep}\\b`, "gi");
          const endRegex = new RegExp(`\\b${sep}\\s*$`, "gi");
          eventName = eventName.replace(startRegex, "").replace(endRegex, "");
        });
        
        data.event_name = eventName.trim().replace(/\s+/g, ' ');
        if (data.event_name.length < 2) data.event_name = "";

        setIsChatLoading(false);
        await handleIntent(intent, data);
        return;
      }

      const res = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (!res.ok) throw new Error("Failed to parse intent");
      const llmData = await res.json();
      setIsChatLoading(false);
      await handleIntent(llmData.intent, llmData);
    } catch (e) {
      console.error(e);
      setIsChatLoading(false);
      systemReply("Sorry, there was an error processing your command.");
    }
  };

  const handleIntent = async (intent: string, data: any) => {
    try {

      if (intent === "create_event") {
        if (!data.event_name) {
          pendingContextRef.current = { intent, data, missing: "event_name" };
          systemReply("What is the name of the event?", true);
          return;
        }
        if (!data.date) {
          pendingContextRef.current = { intent, data, missing: "date" };
          systemReply(`When is ${data.event_name} happening?`, true);
          return;
        }
        const parsedDateStr = data.date + (data.time ? " at " + data.time : "");
        const parsedResults = chrono.parse(parsedDateStr);
        const parsedResult = parsedResults[0];

        if (!parsedResult) {
          pendingContextRef.current = { intent, data: { ...data, date: null, time: null }, missing: "date" };
          systemReply("I couldn't understand the date. Could you please repeat?", true);
          return;
        }

        const parsedDate = parsedResult.start.date();
        const dKey = dateKey(parsedDate);
        const hasTime = parsedResult.start.isCertain('hour');
        const tStr = hasTime ? parsedDate.getHours().toString().padStart(2, '0') + ":" + parsedDate.getMinutes().toString().padStart(2, '0') : null;

        const payload = {
          event_name: data.event_name,
          event_date: dKey,
          event_time: tStr,
          additional_info: data.additional_info || "",
          user_id: user?.id,
        };

        const { data: inserted, error } = await supabase
          .from("events")
          .insert([payload])
          .select("event_id,event_name,event_date,event_time,additional_info")
          .single();

        if (error) {
          systemReply("Sorry, I could not create the event.");
          return;
        }

        const newEvent = mapEventRow(inserted as EventRow);
        setEventsByDate((current) => ({
          ...current,
          [newEvent.date]: [...(current[newEvent.date] ?? []), newEvent],
        }));
        
        systemReply(`Created event ${data.event_name}.`);

      } else if (intent === "delete_event") {
        if (!data.event_name) {
          pendingContextRef.current = { intent, data, missing: "event_name" };
          systemReply("Which event do you want to delete?", true);
          return;
        }
        const allEvents = Object.values(eventsByDate).flat();
        const lowerName = data.event_name.toLowerCase();
        const singularName = lowerName.endsWith('s') ? lowerName.slice(0, -1) : lowerName;
        const matches = allEvents.filter(e => {
          const titleLower = e.title.toLowerCase();
          return titleLower.includes(lowerName) || titleLower.includes(singularName);
        });

        if (matches.length === 0) {
          systemReply(`I couldn't find an event named ${data.event_name}.`);
          return;
        } else if (matches.length > 1) {
          pendingContextRef.current = { intent: "disambiguate_delete", data, missing: "disambiguate_date" };
          systemReply(`I found multiple events named "${data.event_name}". When is the one you want to delete happening?`, true);
          return;
        }

        const toDelete = data.forceTarget ? Object.values(eventsByDate).flat().find(e => e.id === data.targetId) : matches[0];
        if (!toDelete) return;
        
        pendingContextRef.current = { intent: "confirm_delete", data: { eventId: toDelete.id, eventDate: toDelete.date }, missing: "" };
        const parsedToDate = parseDateKey(toDelete.date);
        
        // Use monthNames to format date
        const monthStr = monthNames[parsedToDate.getMonth()].slice(0,3);
        const dayStr = parsedToDate.getDate();
        
        const timeStr = toDelete.time ? ` at ${toDelete.time}` : "";
        systemReply(`Are you sure you want to remove "${toDelete.title}" scheduled on ${dayStr} ${monthStr}${timeStr}?`, true);

      } else if (intent === "reschedule_event") {
        if (!data.event_name) {
          pendingContextRef.current = { intent, data, missing: "event_name" };
          systemReply("Which event do you want to reschedule?", true);
          return;
        }
        if (!data.date && !data.time) {
          pendingContextRef.current = { intent, data, missing: "date" };
          systemReply("To what date or time should I reschedule it?", true);
          return;
        }

        const allEvents = Object.values(eventsByDate).flat();
        const lowerName = data.event_name.toLowerCase();
        const singularName = lowerName.endsWith('s') ? lowerName.slice(0, -1) : lowerName;
        const matches = allEvents.filter(e => {
          const titleLower = e.title.toLowerCase();
          return titleLower.includes(lowerName) || titleLower.includes(singularName);
        });

        if (matches.length === 0) {
          systemReply(`I couldn't find an event named ${data.event_name}.`);
          return;
        } else if (matches.length > 1) {
          pendingContextRef.current = { intent: "disambiguate_reschedule", data, missing: "disambiguate_date" };
          systemReply(`I found multiple events named "${data.event_name}". When is the one you want to reschedule happening?`, true);
          return;
        }

        const toReschedule = data.forceTarget ? Object.values(eventsByDate).flat().find(e => e.id === data.targetId) : matches[0];
        if (!toReschedule) return;
        const parsedDateStr = (data.date || "") + " " + (data.time || "");
        const parsedResults = chrono.parse(parsedDateStr);
        const parsedResult = parsedResults[0];

        if (!parsedResult) {
          pendingContextRef.current = { intent, data: { ...data, date: null, time: null }, missing: "date" };
          systemReply("I couldn't understand the new date. Could you please repeat?", true);
          return;
        }
        
        const parsedDate = parsedResult.start.date();
        const newDKey = dateKey(parsedDate);
        const hasTime = parsedResult.start.isCertain('hour');
        const newTStr = hasTime ? parsedDate.getHours().toString().padStart(2, '0') + ":" + parsedDate.getMinutes().toString().padStart(2, '0') : null;

        const payload = {
          event_name: toReschedule.title,
          event_date: newDKey,
          event_time: newTStr || null,
          additional_info: toReschedule.additionalInformation || "",
          user_id: user?.id,
        };

        const { data: updated, error } = await supabase
          .from("events")
          .update(payload)
          .eq("event_id", toReschedule.id)
          .select("event_id,event_name,event_date,event_time,additional_info")
          .single();

        if (error) {
          systemReply("Sorry, I could not reschedule the event.");
          return;
        }

        const updatedEvent = mapEventRow(updated as EventRow);
        setEventsByDate((current) => ({
          ...current,
          [toReschedule.date]: (current[toReschedule.date] ?? []).filter(item => item.id !== updatedEvent.id),
          [updatedEvent.date]: [...(current[updatedEvent.date] ?? []).filter(item => item.id !== updatedEvent.id), updatedEvent],
        }));

        systemReply(`Rescheduled ${toReschedule.title}.`);

      } else if (intent === "query_events") {
        if (data.event_name || data.additional_info || data.date) {
           const queryTerm = data.event_name || data.additional_info || data.date;
           setSearchQuery(queryTerm);
           systemReply(`Here are the events matching ${queryTerm}.`);
           setTimeout(() => setIsChatOpen(false), 2000);
        } else {
           pendingContextRef.current = { intent, data, missing: "event_name" };
           systemReply("What kind of events are you looking for?", true);
        }
      } else if (intent === "delete_all_events_today") {
        if (todayEvents.length === 0) {
          systemReply("You have no events for today to delete.");
          return;
        }
        
        pendingContextRef.current = { intent: "confirm_delete_all_today", data: {}, missing: "" };
        systemReply(`Are you sure you want to delete all ${todayEvents.length} events scheduled for today?`, true);
      } else if (intent === "read_todays_events") {
        if (todayEvents.length === 0) {
           systemReply("You have no events for today.");
        } else {
           const eventNames = todayEvents.map(e => e.title).join(", ");
           systemReply(`Your events for today are: ${eventNames}.`);
        }
      } else {
        systemReply("I didn't quite catch that.");
      }

    } catch (e) {
      console.error(e);
      systemReply("Sorry, there was an error processing your command.");
    }
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setFormMode(null);
      setIsDetailOpen(false);
      setIsChatOpen(true);
      try { recognitionRef.current.start(); } catch (e) { console.error(e) }
    }
  };

  function selectDate(date: Date) {
    setSelectedDate(date);
    setSelectedEventId(null);
    setIsDetailOpen(false);
    setIsMonthSelectorOpen(false);
    setIsYearSelectorOpen(false);
    setFormValues((current) => ({
      ...current,
      date: displayDate(dateKey(date)),
    }));
  }

  function selectEvent(event: CalendarEvent) {
    const eventDate = parseDateKey(event.date);

    setSelectedDate(eventDate);
    setActiveMonth(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1));
    setSelectedEventId(event.id);
    setIsDetailOpen(true);
    setIsChatOpen(false);
  }

  function openAddForm() {
    setFormMode("add");
    setFormValues(createEmptyForm(displayDate(dateKey(selectedDate))));
    setIsChatOpen(false);
  }

  function openRescheduleForm() {
    if (!selectedEvent) {
      return;
    }

    setFormMode("reschedule");
    setFormValues({
      name: selectedEvent.title,
      date: displayDate(selectedEvent.date),
      time: selectedEvent.time,
      additionalInformation: selectedEvent.additionalInformation,
    });
  }

  function clearForm() {
    setFormValues(
      formMode === "reschedule" && selectedEvent
        ? {
            name: selectedEvent.title,
            date: displayDate(selectedEvent.date),
            time: selectedEvent.time,
            additionalInformation: selectedEvent.additionalInformation,
          }
        : createEmptyForm(displayDate(dateKey(selectedDate))),
    );
  }

  function closeForm() {
    setFormMode(null);
  }

  async function removeEvent() {
    if (!selectedEvent) {
      return;
    }

    const key = dateKey(selectedDate);
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("event_id", selectedEvent.id)
      .eq("user_id", user?.id);

    if (error) {
      console.error("Could not remove event:", error.message);
      return;
    }

    setEventsByDate((current) => ({
      ...current,
      [key]: (current[key] ?? []).filter(
        (event) => event.id !== selectedEvent.id,
      ),
    }));
    setSelectedEventId(null);
    setIsDetailOpen(false);
  }

  async function deleteEvent(eventId: string | number, eventDate: string) {
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", user?.id);

    if (error) {
      console.error("Could not delete event:", error.message);
      return;
    }

    setEventsByDate((current) => ({
      ...current,
      [eventDate]: (current[eventDate] ?? []).filter(
        (event) => event.id !== eventId,
      ),
    }));
    
    if (selectedEventId === eventId) {
      setSelectedEventId(null);
      setIsDetailOpen(false);
    }
  }

  async function updateEventDate(eventId: string | number, oldDate: string, newDate: string) {
    if (oldDate === newDate) return;
    
    const { data, error } = await supabase
      .from("events")
      .update({ event_date: newDate })
      .eq("event_id", eventId)
      .eq("user_id", user?.id)
      .select("event_id,event_name,event_date,event_time,additional_info")
      .single();

    if (error) {
      console.error("Could not move event:", error.message);
      return;
    }

    const updatedEvent = mapEventRow(data as EventRow);

    setEventsByDate((current) => ({
      ...current,
      [oldDate]: (current[oldDate] ?? []).filter(
        (item) => item.id !== updatedEvent.id,
      ),
      [newDate]: [
        ...(current[newDate] ?? []).filter(
          (item) => item.id !== updatedEvent.id,
        ),
        updatedEvent,
      ],
    }));
  }

  async function submitEventForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formMode || isSubmitting) {
      return;
    }

    if (formMode === "add" && !formValues.name.trim()) {
      window.alert("Event name is required.");
      return;
    }

    if (!isDisplayDate(formValues.date)) {
      window.alert("Enter the date as dd/mm/yyyy.");
      return;
    }

    setIsSubmitting(true);

    const eventDate = toDateKeyFromDisplay(formValues.date);
    const payload = {
      event_name:
        formMode === "reschedule" && selectedEvent
          ? selectedEvent.title
          : formValues.name.trim(),
      event_date: eventDate,
      event_time: formValues.time || null,
      additional_info: formValues.additionalInformation.trim() || null,
      user_id: user?.id,
    };

    if (formMode === "add") {
      const { data, error } = await supabase
        .from("events")
        .insert(payload)
        .select("event_id,event_name,event_date,event_time,additional_info")
        .single();

      setIsSubmitting(false);

      if (error) {
        console.error("Could not add event:", error.message);
        return;
      }

      const nextEvent = mapEventRow(data as EventRow);

      setEventsByDate((current) => ({
        ...current,
        [nextEvent.date]: [...(current[nextEvent.date] ?? []), nextEvent],
      }));
      setSelectedDate(parseDateKey(nextEvent.date));
      setActiveMonth(
        new Date(
          parseDateKey(nextEvent.date).getFullYear(),
          parseDateKey(nextEvent.date).getMonth(),
          1,
        ),
      );
      setSelectedEventId(nextEvent.id);
      setFormMode(null);
      return;
    }

    if (!selectedEvent) {
      setIsSubmitting(false);
      window.alert("Select an event to reschedule.");
      return;
    }

    const { data, error } = await supabase
      .from("events")
      .update(payload)
      .eq("event_id", selectedEvent.id)
      .eq("user_id", user?.id)
      .select("event_id,event_name,event_date,event_time,additional_info")
      .single();

    setIsSubmitting(false);

    if (error) {
      console.error("Could not reschedule event:", error.message);
      return;
    }

    const updatedEvent = mapEventRow(data as EventRow);
    const previousKey = selectedEvent.date;

    setEventsByDate((current) => ({
      ...current,
      [previousKey]: (current[previousKey] ?? []).filter(
        (item) => item.id !== updatedEvent.id,
      ),
      [updatedEvent.date]: [
        ...(current[updatedEvent.date] ?? []).filter(
          (item) => item.id !== updatedEvent.id,
        ),
        updatedEvent,
      ],
    }));

    const nextDate = parseDateKey(updatedEvent.date);
    setSelectedDate(nextDate);
    setActiveMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    setSelectedEventId(updatedEvent.id);
    setFormMode(null);
  }

  const ChatInputComponent = (
    <div className="flex gap-2 items-center w-full">
      <input
        ref={chatInputRef}
        type="text"
        placeholder="Message Assistant..."
        className="flex-1 bg-white/50 border border-[#17211f]/10 rounded-full px-5 py-3 text-sm font-medium text-[#17211f] focus:outline-none focus:border-[#00A19B] focus:ring-1 focus:ring-[#00A19B] transition-all placeholder:text-[#17211f]/40"
        value={chatInputText}
        onChange={(e) => setChatInputText(e.target.value)}
        onFocus={() => {
          if (!isChatOpen) {
            setFormMode(null);
            setIsDetailOpen(false);
            setIsChatOpen(true);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && chatInputText.trim()) {
            const text = chatInputText.trim();
            setChatInputText("");
            setChatMessages(prev => [...prev, { role: "user", text, timestamp: new Date() }]);
            processVoiceCommand(text);
          }
        }}
      />
      <button
        type="button"
        onClick={toggleListen}
        className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full shadow-sm transition-all ${
          isListening 
            ? "bg-[#00A19B] text-white animate-pulse shadow-[0_0_20px_rgba(0,161,155,0.6)]" 
            : "bg-[#f7f2ea] border border-[#17211f]/10 text-[#00A19B] hover:bg-[#00A19B]/10 hover:border-[#00A19B]/30"
        }`}
        aria-label="Voice Command"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
          <path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z"/>
          <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5"/>
        </svg>
      </button>
    </div>
  );

  if (authLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#E4DDD3]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#00A19B] border-t-transparent"></div>
          <p className="font-bold text-[#17211F]/60">Syncing your calendar...</p>
        </div>
      </div>
    );
  }
  return (
    <main className="min-h-screen overflow-hidden bg-[#E4DDD3] text-[#17211f]">
      <section className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-5 py-6 sm:px-8 lg:px-10">
        <div className="calendar-ambient" />

        <div className="relative z-10 flex flex-wrap xl:flex-nowrap flex-1 gap-5 py-2">
          <section className="calendar-shell animate-rise w-full xl:flex-1 xl:min-w-[600px]">
            <div className="flex flex-col gap-4 border-b border-[#17211f]/10 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  className="text-3xl font-semibold hover:text-[#00A19B] transition-colors"
                  onClick={() => {
                    setIsMonthSelectorOpen(!isMonthSelectorOpen);
                    setIsYearSelectorOpen(false);
                  }}
                >
                  {monthNames[activeMonth.getMonth()]}
                </button>
                <button
                  type="button"
                  className="text-3xl font-semibold hover:text-[#00A19B] transition-colors"
                  onClick={() => {
                    setIsYearSelectorOpen(!isYearSelectorOpen);
                    setIsMonthSelectorOpen(false);
                  }}
                >
                  {activeMonth.getFullYear()}
                </button>

                {isMonthSelectorOpen && (
                  <div className="absolute left-0 top-full mt-2 z-50 grid w-[300px] grid-cols-3 gap-2 rounded-2xl bg-[#f7f2ea] p-3 shadow-xl border border-[#17211f]/10 animate-rise">
                    {monthNames.map((month, index) => (
                      <button
                        key={month}
                        type="button"
                        className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                          index === activeMonth.getMonth()
                            ? "bg-[#00A19B] text-white"
                            : "hover:bg-[#00A19B]/10"
                        }`}
                        onClick={() => {
                          setActiveMonth(
                            new Date(activeMonth.getFullYear(), index, 1),
                          );
                          setIsMonthSelectorOpen(false);
                        }}
                      >
                        {month.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                )}

                {isYearSelectorOpen && (
                  <div className="absolute left-16 top-full mt-2 z-50 grid w-[300px] max-h-64 overflow-y-auto grid-cols-3 gap-2 rounded-2xl bg-[#f7f2ea] p-3 shadow-xl border border-[#17211f]/10 animate-rise">
                    {Array.from(
                      { length: 21 },
                      (_, i) => today.getFullYear() - 10 + i,
                    ).map((year) => (
                      <button
                        key={year}
                        type="button"
                        className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                          year === activeMonth.getFullYear()
                            ? "bg-[#00A19B] text-white"
                            : "hover:bg-[#00A19B]/10"
                        }`}
                        onClick={() => {
                          setActiveMonth(
                            new Date(year, activeMonth.getMonth(), 1),
                          );
                          setIsYearSelectorOpen(false);
                        }}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-1 items-center justify-center gap-2 px-4">
                {(['quiz', 'assignment', 'other'] as FilterTab[]).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveFilterTab(activeFilterTab === tab ? null : tab)}
                    className={`rounded-full border border-transparent px-4 py-2 text-sm font-semibold capitalize transition-all hover:-translate-y-0.5 ${
                      activeFilterTab === tab 
                        ? 'border-[#00A19B]/40 bg-[#00A19B] text-white shadow-[0_12px_28px_rgba(0,161,155,0.28)]' 
                        : 'bg-[#00A19B]/10 text-[#00A19B] hover:bg-[#00A19B]/20'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="rounded-full border border-[#00A19B]/40 bg-[#00A19B] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(0,161,155,0.28)] transition hover:-translate-y-0.5"
                  type="button"
                  onClick={() => {
                    setActiveMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                    selectDate(today);
                    setIsMonthSelectorOpen(false);
                    setIsYearSelectorOpen(false);
                  }}
                >
                  Today
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-[#17211f]/10 bg-[#f7f2ea]/60">
              {weekdayLabels.map((day) => (
                <div
                  className="px-2 py-3 text-center text-xs font-bold uppercase text-[#17211f]/55"
                  key={day}
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthDays.map((item) => {
                if (item.type === "blank") {
                  return <div className="calendar-cell empty" key={item.id} />;
                }

                const key = dateKey(item.date);
                const events = eventsByDate[key] ?? [];
                const isToday = sameDay(item.date, today);
                const isSelected = sameDay(item.date, selectedDate);

                return (
                  <div
                    className={`calendar-cell ${isToday ? "is-today" : ""} ${
                      isSelected ? "is-selected" : ""
                    }`}
                    key={item.id}
                    onClick={() => selectDate(item.date)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const eventId = e.dataTransfer.getData("eventId");
                      const oldDate = e.dataTransfer.getData("oldDate");
                      if (eventId && oldDate) {
                        updateEventDate(eventId, oldDate, key);
                      }
                    }}
                  >
                    <span className="day-number">{item.date.getDate()}</span>
                    {events.length > 0 && (
                      <div className="event-chips" aria-label="Events">
                        {events.slice(0, 3).map((event) => {
                          const titleLower = event.title.toLowerCase();
                          const infoLower = event.additionalInformation?.toLowerCase() || "";
                          
                          const isQuiz = titleLower.includes("quiz") || infoLower.includes("quiz");
                          const isAssignment = titleLower.includes("assignment") || infoLower.includes("assignment");
                          const isOther = !isQuiz && !isAssignment;
                          
                          let isDimmer = false;
                          if (activeFilterTab === 'quiz' && !isQuiz) isDimmer = true;
                          if (activeFilterTab === 'assignment' && !isAssignment) isDimmer = true;
                          if (activeFilterTab === 'other' && !isOther) isDimmer = true;

                          return (
                          <div
                            className={`event-chip ${event.tone} ${isDimmer ? 'opacity-30' : 'opacity-100'}`}
                            key={event.id}
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              e.dataTransfer.setData("eventId", String(event.id));
                              e.dataTransfer.setData("oldDate", event.date);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              selectEvent(event);
                            }}
                          >
                            <span className="event-chip-name">{event.title}</span>
                            <button
                              type="button"
                              className="event-chip-delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteEvent(event.id, event.date);
                              }}
                              aria-label="Delete event"
                            >
                              ×
                            </button>
                          </div>
                          );
                        })}
                      </div>
                    )}
                    {isToday && <span className="today-marker">Today</span>}
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="flex flex-col gap-5 w-full xl:w-[560px] shrink-0 h-[calc(100vh-80px)]">
            <div className="flex flex-col flex-1 gap-5 overflow-hidden">
              <section className="side-panel animate-rise delay-100 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#00A19B]">
                    Selected date
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">
                    {selectedDate.toLocaleDateString("en-GB")}
                  </h2>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-[#17211f] px-3 py-1 text-xs font-bold text-[#E4DDD3]">
                    {selectedEvents.length} event
                    {selectedEvents.length === 1 ? "" : "s"}
                  </span>
                  <button
                    className="rounded-full border border-[#D56B68]/30 bg-[#D56B68]/10 px-3 py-1.5 text-xs font-bold text-[#D56B68] transition-all hover:bg-[#D56B68] hover:text-white"
                    type="button"
                    onClick={() => signOut()}
                  >
                    Logout
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {selectedEvents.length > 0 ? (
                  selectedEvents.map((event) => (
                    <EventCard
                      event={event}
                      isSelected={event.id === selectedEventId}
                      key={event.id}
                      onSelect={() => selectEvent(event)}
                    />
                  ))
                ) : (
                  <div className="empty-state">
                    <p className="text-sm font-semibold">No Events Scheduled</p>
                  </div>
                )}
              </div>
            </section>

            <section className="side-panel today-panel animate-rise delay-200 flex flex-col overflow-hidden min-h-0">
              <div className="flex items-center justify-between gap-3 shrink-0">
                <div>
                  <p className="text-sm font-semibold text-[#00A19B]">
                    Today&apos;s events
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3 overflow-y-auto">
                {todayEvents.length > 0 ? (
                  todayEvents.map((event) => (
                    <EventCard
                      event={event}
                      isSelected={event.id === selectedEventId}
                      key={event.id}
                      onSelect={() => selectEvent(event)}
                    />
                  ))
                ) : (
                  <div className="empty-state">
                    <p className="text-sm font-semibold">No Events Scheduled</p>
                  </div>
                )}
              </div>
            </section>
            
            {!isChatOpen && (
              <section className="side-panel shrink-0 animate-rise delay-200 mt-auto">
                {ChatInputComponent}
              </section>
            )}
            </div>
          </aside>

          {((selectedEvent && isDetailOpen) || formMode || searchQuery.trim().length > 0 || isChatOpen) && (
            <div className="flex flex-col gap-5 w-full xl:w-[360px] shrink-0 content-start">
              {isChatOpen && (
                <section className="side-panel flex flex-col h-[calc(100vh-80px)] animate-rise">
                  <div className="flex items-center justify-between border-b border-[#17211f]/10 pb-4 mb-4 shrink-0">
                    <p className="text-sm font-semibold text-[#00A19B]">Chat Assistant</p>
                    <button onClick={() => setIsChatOpen(false)} className="text-[#17211f]/40 hover:text-[#17211f] transition-colors" aria-label="Close Chat">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {chatMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center opacity-50 space-y-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z"/>
                          <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5"/>
                        </svg>
                        <p className="text-sm font-medium">I'm listening.<br/>Ask me to create, delete, reschedule, or find an event.</p>
                      </div>
                    ) : (
                      chatMessages.map((msg, i) => (
                        <div key={`${msg.role}-${msg.timestamp.getTime()}-${i}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === "user" ? "bg-[#00A19B] text-white rounded-br-none" : "bg-[#f7f2ea] border border-[#17211f]/10 text-[#17211f] rounded-bl-none"}`}>
                            {msg.text}
                          </div>
                        </div>
                      ))
                    )}
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm bg-[#f7f2ea] border border-[#17211f]/10 text-[#17211f] rounded-bl-none flex gap-1 items-center h-[44px]">
                          <span className="w-1.5 h-1.5 bg-[#17211f]/50 rounded-full animate-bounce" style={{ animationDelay: '-0.3s' }}></span>
                          <span className="w-1.5 h-1.5 bg-[#17211f]/50 rounded-full animate-bounce" style={{ animationDelay: '-0.15s' }}></span>
                          <span className="w-1.5 h-1.5 bg-[#17211f]/50 rounded-full animate-bounce"></span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  {isChatOpen && (
                    <div className="mt-auto pt-5 shrink-0">
                      {ChatInputComponent}
                    </div>
                  )}
                </section>
              )}

              {searchQuery.trim().length > 0 && !isDetailOpen && !formMode && !isChatOpen && (
                <section className="side-panel animate-rise delay-100">
                  <div className="flex items-center justify-between gap-3 border-b border-[#17211f]/10 pb-4 mb-4">
                    <p className="text-sm font-semibold text-[#00A19B]">
                      Search Results
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#17211f] px-3 py-1 text-xs font-bold text-[#E4DDD3]">
                        {searchResults.length}
                      </span>
                      <button onClick={() => setSearchQuery("")} className="text-[#17211f]/40 hover:text-[#17211f] transition-colors" aria-label="Close Search">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3 mb-4">
                    <div className="flex flex-col flex-1 gap-1">
                      <label className="text-xs font-semibold text-[#17211f]/70">From Date</label>
                      <input
                        type="date"
                        className="w-full rounded-lg border border-[#17211f]/20 bg-white/50 px-3 py-2 text-sm text-[#17211f] focus:border-[#00A19B] focus:outline-none"
                        value={filterFromDate}
                        onChange={(e) => setFilterFromDate(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col flex-1 gap-1">
                      <label className="text-xs font-semibold text-[#17211f]/70">To Date</label>
                      <input
                        type="date"
                        className="w-full rounded-lg border border-[#17211f]/20 bg-white/50 px-3 py-2 text-sm text-[#17211f] focus:border-[#00A19B] focus:outline-none"
                        value={filterToDate}
                        onChange={(e) => setFilterToDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto pr-2 space-y-3">
                    {searchResults.length > 0 ? (
                      searchResults.map((event) => (
                        <EventCard
                          event={event}
                          isSelected={event.id === selectedEventId}
                          key={event.id}
                          onSelect={() => selectEvent(event)}
                        />
                      ))
                    ) : (
                      <p className="text-sm font-semibold text-[#17211f]/60 text-center py-4">
                        No matching events found.
                      </p>
                    )}
                  </div>
                </section>
              )}

              {selectedEvent && isDetailOpen && !formMode && !isChatOpen && (
                <EventDetailsPanel
                  event={selectedEvent}
                  onClose={() => setIsDetailOpen(false)}
                />
              )}

              {formMode && !isChatOpen && (
                <section className="side-panel form-panel animate-rise delay-100">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#00A19B]">
                        {formMode === "add" ? "Add event" : "Reschedule event"}
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold">
                        {formMode === "add" ? "Schedule details" : selectedEvent?.title}
                      </h2>
                    </div>
                    <button className="form-close" type="button" onClick={closeForm}>
                      Close
                    </button>
                  </div>

                  <form className="event-form" onSubmit={submitEventForm}>
                    {formMode === "add" && (
                      <label>
                        <span>Event name</span>
                        <input
                          required
                          type="text"
                          value={formValues.name}
                          onChange={(event) =>
                            setFormValues((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}

                    <label>
                      <span>Date</span>
                      <input
                        required
                        inputMode="numeric"
                        pattern="\d{2}/\d{2}/\d{4}"
                        placeholder="dd/mm/yyyy"
                        type="text"
                        value={formValues.date}
                        onChange={(event) =>
                          setFormValues((current) => ({
                            ...current,
                            date: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label>
                      <span>Time</span>
                      <input
                        type="time"
                        value={formValues.time}
                        onChange={(event) =>
                          setFormValues((current) => ({
                            ...current,
                            time: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="event-form-wide">
                      <span>Additional information</span>
                      <textarea
                        rows={3}
                        value={formValues.additionalInformation}
                        onChange={(event) =>
                          setFormValues((current) => ({
                            ...current,
                            additionalInformation: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <div className="form-buttons">
                      <button
                        className="action-button primary"
                        type="submit"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Saving..." : "Submit"}
                      </button>
                      <button
                        className="action-button"
                        type="button"
                        onClick={clearForm}
                        disabled={isSubmitting}
                      >
                        Clear
                      </button>
                    </div>
                  </form>
                </section>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function EventDetailsPanel({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  return (
    <section className="side-panel detail-panel animate-rise delay-100">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#00A19B]">Event details</p>
          <h2 className="mt-1 text-xl font-semibold">{event.title}</h2>
        </div>
        <button className="form-close" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <dl className="detail-list">
        <div>
          <dt className="sr-only">Date</dt>
          <dd>{displayDate(event.date)}</dd>
        </div>
        {event.time && (
          <div>
            <dt className="sr-only">Time</dt>
            <dd>{event.time}</dd>
          </div>
        )}
        {event.additionalInformation && (
          <div>
            <dt className="sr-only">Notes</dt>
            <dd>{event.additionalInformation}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function EventCard({
  event,
  inverted = false,
  isSelected = false,
  onSelect,
}: {
  event: CalendarEvent;
  inverted?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const content = (
    <>
      <div>
        {event.time && <p className="text-sm font-bold">{event.time}</p>}
        <h3 className="mt-1 text-base font-semibold">{event.title}</h3>
      </div>
      {event.location && <p className="text-sm opacity-70">{event.location}</p>}
    </>
  );

  if (onSelect) {
    return (
      <button
        className={`event-card ${event.tone} ${isSelected ? "selected" : ""}`}
        type="button"
        onClick={onSelect}
      >
        {content}
      </button>
    );
  }

  return (
    <article className={`event-card ${event.tone} ${inverted ? "inverted" : ""}`}>
      {content}
    </article>
  );
}
