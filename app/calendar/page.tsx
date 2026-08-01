"use client";

import { FormEvent, useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import * as chrono from "chrono-node";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type CalendarEvent = {
  id: number | string;
  title: string;
  time: string;
  location: string;
  date: string;
  additionalInformation: string;
  tone: "mint" | "amber" | "rose" | "ink";
  status: "pending" | "completed";
};

type EventFormValues = {
  name: string;
  date: string;
  time: string;
  additionalInformation: string;
};

type EventFormMode = "add" | "reschedule" | null;

type PopupState = {
  eventId: number | string;
  event: CalendarEvent;
  x: number;
  y: number;
} | null;

type EventRow = {
  event_id: number | string;
  event_name: string;
  event_date: string;
  event_time: string | null;
  additional_info: string | null;
  status?: string | null;
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
  let savedStatus: "pending" | "completed" = "pending";
  if (row.status === "completed" || row.status === "pending") {
    savedStatus = row.status;
  } else if (typeof window !== "undefined") {
    const local = localStorage.getItem(`event_status_${row.event_id}`);
    if (local === "completed") savedStatus = "completed";
  }

  return {
    id: row.event_id,
    title: row.event_name,
    time: row.event_time?.slice(0, 5) ?? "",
    location: row.additional_info ?? "",
    date: row.event_date,
    additionalInformation: row.additional_info ?? "",
    tone: "mint",
    status: savedStatus,
  };
}

function groupEvents(events: CalendarEvent[]) {
  return events.reduce<Record<string, CalendarEvent[]>>((grouped, event) => {
    grouped[event.date] = [...(grouped[event.date] ?? []), event];
    return grouped;
  }, {});
}

type RoutineTask = { id: string; text: string; time?: string; completed?: boolean; lastCompletedDate?: string };

function SortableRoutineItem({
  task,
  onToggle,
  onRemove,
}: {
  task: RoutineTask;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform ? { ...transform, x: 0 } : null),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center justify-between gap-2 rounded-2xl border p-3 text-sm transition-colors duration-150 ${
        task.completed
          ? "border-[#17211f]/10 bg-[#f7f2ea]/50 text-[#17211f]/50 line-through"
          : "border-[#17211f]/15 bg-white/70 text-[#17211f] shadow-sm hover:border-[#00A19B]/40"
      } ${isDragging ? "shadow-xl ring-2 ring-[#00A19B] bg-white opacity-95 scale-[1.01] z-50" : ""}`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-[#17211f]/40 hover:text-[#00A19B] p-1 rounded transition-colors shrink-0 touch-none select-none"
          title="Drag to reorder"
          aria-label="Drag to reorder task"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
            <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 14a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onToggle(task.id)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
            task.completed
              ? "border-[#00A19B] bg-[#00A19B] text-white"
              : "border-[#17211f]/30 bg-white hover:border-[#00A19B]"
          }`}
        >
          {task.completed && (
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
          )}
        </button>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-medium truncate">{task.text}</span>
          {task.time && (
            <span className="text-[11px] font-semibold text-[#00A19B] opacity-90">{task.time}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(task.id)}
        className="opacity-60 hover:opacity-100 text-red-500 transition-opacity p-1 cursor-pointer shrink-0"
        title="Delete task"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
          <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
        </svg>
      </button>
    </div>
  );
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
  const [popupState, setPopupState] = useState<PopupState>(null);
  const [copiedEventId, setCopiedEventId] = useState<number | string | null>(null);

  useEffect(() => {
    if (!popupState) return;

    const handleClickOutside = () => {
      setPopupState(null);
    };

    window.addEventListener("click", handleClickOutside);
    return () => {
      window.removeEventListener("click", handleClickOutside);
    };
  }, [popupState]);

  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isClarifyingRef = useRef(false);

  type ChatMessage = { role: "user" | "system", text: string, timestamp: Date };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInputText, setChatInputText] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [isRoutineOpen, setIsRoutineOpen] = useState(false);

  const routineSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleRoutineDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = routineTasks.findIndex((t) => t.id === active.id);
      const newIndex = routineTasks.findIndex((t) => t.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(routineTasks, oldIndex, newIndex);
        saveRoutineTasks(reordered);
      }
    }
  };
  const [routineTasks, setRoutineTasks] = useState<RoutineTask[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");

  const ROUTINE_STORAGE_KEY = "daily_routine_tasks";

  useEffect(() => {
    try {
      const key = user ? `${ROUTINE_STORAGE_KEY}_${user.id}` : ROUTINE_STORAGE_KEY;
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed: RoutineTask[] = JSON.parse(stored);
        const todayKey = dateKey(new Date());
        let hasReset = false;
        const updated = parsed.map((t) => {
          if (t.completed && t.lastCompletedDate && t.lastCompletedDate !== todayKey) {
            hasReset = true;
            return { ...t, completed: false, lastCompletedDate: undefined };
          }
          return t;
        });
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRoutineTasks(updated);
        if (hasReset) {
          localStorage.setItem(key, JSON.stringify(updated));
        }
      }
    } catch (err) {
      console.error("Failed to load routine tasks from localStorage:", err);
    }
  }, [user]);

  const saveRoutineTasks = (tasks: RoutineTask[]) => {
    setRoutineTasks(tasks);
    try {
      const key = user ? `${ROUTINE_STORAGE_KEY}_${user.id}` : ROUTINE_STORAGE_KEY;
      localStorage.setItem(key, JSON.stringify(tasks));
    } catch (err) {
      console.error("Failed to save routine tasks to localStorage:", err);
    }
  };

  const handleAddRoutineTask = (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskText.trim()) return;
    const newTask: RoutineTask = {
      id: `routine_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      text: newTaskText.trim(),
      time: newTaskTime.trim() || undefined,
      completed: false,
    };
    const updated = [...routineTasks, newTask];
    saveRoutineTasks(updated);
    setNewTaskText("");
    setNewTaskTime("");
  };

  const handleRemoveRoutineTask = (id: string) => {
    const updated = routineTasks.filter((t) => t.id !== id);
    saveRoutineTasks(updated);
  };

  const handleToggleRoutineTask = (id: string) => {
    const todayKey = dateKey(new Date());
    const updated = routineTasks.map((t) => {
      if (t.id === id) {
        const nextCompleted = !t.completed;
        return {
          ...t,
          completed: nextCompleted,
          lastCompletedDate: nextCompleted ? todayKey : undefined,
        };
      }
      return t;
    });
    saveRoutineTasks(updated);
  };

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

  const selectedEvents = useMemo(() => {
    const events = eventsByDate[dateKey(selectedDate)] ?? [];
    return [...events].sort((a, b) => a.time.localeCompare(b.time));
  }, [eventsByDate, selectedDate]);

  const selectedEvent =
    Object.values(eventsByDate)
      .flat()
      .find((event) => event.id === selectedEventId) ?? null;

  const todayEvents = useMemo(() => {
    const events = eventsByDate[dateKey(today)] ?? [];
    return [...events].sort((a, b) => a.time.localeCompare(b.time));
  }, [eventsByDate, today]);

  useEffect(() => {
    if (initialized && !user) {
      router.push("/");
    }
  }, [user, initialized, router]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    async function loadEvents() {
      let data: any[] | null = null;
      let error: any = null;

      const res = await supabase
        .from("events")
        .select("event_id,event_name,event_date,event_time,additional_info,status")
        .eq("user_id", user?.id)
        .order("event_date", { ascending: true });

      if (res.error) {
        const fallbackRes = await supabase
          .from("events")
          .select("event_id,event_name,event_date,event_time,additional_info")
          .eq("user_id", user?.id)
          .order("event_date", { ascending: true });
        data = fallbackRes.data;
        error = fallbackRes.error;
      } else {
        data = res.data;
        error = res.error;
      }

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      const data: any = {};

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  async function copyEvent(eventToCopy: CalendarEvent) {
    setPopupState(null);

    const payload = {
      event_name: eventToCopy.title,
      event_date: eventToCopy.date,
      event_time: eventToCopy.time || null,
      additional_info: eventToCopy.additionalInformation || null,
      user_id: user?.id,
    };

    const { data, error } = await supabase
      .from("events")
      .insert([payload])
      .select("event_id,event_name,event_date,event_time,additional_info")
      .single();

    if (error) {
      console.error("Could not duplicate event:", error.message);
      return;
    }

    const newEvent = mapEventRow(data as EventRow);

    setEventsByDate((current) => ({
      ...current,
      [newEvent.date]: [...(current[newEvent.date] ?? []), newEvent],
    }));

    setCopiedEventId(newEvent.id);
    setTimeout(() => {
      setCopiedEventId(null);
    }, 3000);
  }

  async function updateEventStatus(eventId: string | number, eventDate: string, newStatus: "pending" | "completed") {
    if (typeof window !== "undefined") {
      localStorage.setItem(`event_status_${eventId}`, newStatus);
    }

    setEventsByDate((current) => ({
      ...current,
      [eventDate]: (current[eventDate] ?? []).map((ev) =>
        ev.id === eventId ? { ...ev, status: newStatus } : ev
      ),
    }));

    try {
      await supabase
        .from("events")
        .update({ status: newStatus })
        .eq("event_id", eventId)
        .eq("user_id", user?.id);
    } catch (err) {
      console.error("Could not update status in DB:", err);
    }
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
            setIsRoutineOpen(false);
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

  if (authLoading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#E4DDD3]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#00A19B] border-t-transparent"></div>
          <p className="font-bold text-[#17211F]/60">
            {authLoading ? "Syncing your calendar..." : "Redirecting to login..."}
          </p>
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
                  onClick={() => setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1))}
                  className="p-1.5 hover:bg-[#17211f]/5 rounded-full transition-colors text-[#17211f]/60 hover:text-[#17211f]"
                  aria-label="Previous month"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/></svg>
                </button>
                
                <div className="flex items-center gap-2">
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
                </div>

                <button 
                  type="button"
                  onClick={() => setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1))}
                  className="p-1.5 hover:bg-[#17211f]/5 rounded-full transition-colors text-[#17211f]/60 hover:text-[#17211f]"
                  aria-label="Next month"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>
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
                    className={`group calendar-cell ${isToday ? "is-today" : ""} ${
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
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectDate(item.date);
                        setFormValues(createEmptyForm(displayDate(key)));
                        setIsDetailOpen(false);
                        setIsRoutineOpen(false);
                        setIsChatOpen(false);
                        setFormMode("add");
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-all duration-150 absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#00A19B] text-white hover:bg-[#008984] hover:scale-110 shadow-md cursor-pointer z-10"
                      title={`Add event on ${displayDate(key)}`}
                      aria-label={`Add event on ${displayDate(key)}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                      </svg>
                    </button>
                    <span className="day-number">{item.date.getDate()}</span>
                    {events.length > 0 && (
                      <div className="event-chips" aria-label="Events">
                        {events.slice(0, 5).map((event) => {
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
                            className={`event-chip ${event.tone} ${isDimmer ? 'opacity-30' : 'opacity-100'} ${
                              event.id === copiedEventId ? 'ring-2 ring-[#00A19B] animate-bounce shadow-md' : ''
                            }`}
                            key={event.id}
                            draggable
                            onDragStart={(e) => {
                              e.stopPropagation();
                              e.dataTransfer.setData("eventId", String(event.id));
                              e.dataTransfer.setData("oldDate", event.date);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setPopupState({
                                eventId: event.id,
                                event,
                                x: rect.left + rect.width / 2,
                                y: rect.top,
                              });
                            }}
                          >
                            {event.status === "completed" && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="currentColor" viewBox="0 0 16 16" className="shrink-0 mr-1 text-white opacity-95">
                                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                              </svg>
                            )}
                            <span className="event-chip-name">{event.title}</span>
                            {event.id === copiedEventId && (
                              <span className="ml-1 rounded bg-white/30 px-1 py-0.2 text-[9px] font-extrabold uppercase text-white shrink-0">
                                Copied
                              </span>
                            )}
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

          <aside className="flex flex-col gap-5 w-full xl:w-[480px] shrink-0 h-auto xl:h-[calc(100vh-80px)]">
            {isRoutineOpen ? (
              <section className="side-panel flex flex-col h-full animate-rise">
                <div className="flex items-center justify-between border-b border-[#17211f]/10 pb-4 mb-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#00A19B]">Daily Routine</p>
                    <span className="rounded-full bg-[#17211f] px-2.5 py-0.5 text-xs font-bold text-[#E4DDD3]">
                      {routineTasks.length}
                    </span>
                  </div>
                  <button onClick={() => setIsRoutineOpen(false)} className="text-[#17211f]/40 hover:text-[#17211f] transition-colors cursor-pointer" aria-label="Close Daily Routine">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                  </button>
                </div>

                <form onSubmit={handleAddRoutineTask} className="mb-4 space-y-2 shrink-0">
                  <div className="flex gap-2 items-center min-w-0">
                    <input
                      type="text"
                      placeholder="New routine task..."
                      value={newTaskText}
                      onChange={(e) => setNewTaskText(e.target.value)}
                      className="flex-1 min-w-0 rounded-xl border border-[#17211f]/20 bg-white/60 px-3 py-2 text-sm text-[#17211f] focus:border-[#00A19B] focus:outline-none placeholder:text-[#17211f]/40"
                    />
                    <input
                      type="time"
                      value={newTaskTime}
                      onChange={(e) => setNewTaskTime(e.target.value)}
                      className="w-24 shrink-0 rounded-xl border border-[#17211f]/20 bg-white/60 px-2 py-2 text-xs font-semibold text-[#17211f] focus:border-[#00A19B] focus:outline-none cursor-pointer"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!newTaskText.trim()}
                    className="w-full rounded-xl bg-[#00A19B] py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#008984] disabled:opacity-40 transition-all cursor-pointer"
                  >
                    + Add Routine Task
                  </button>
                </form>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 relative">
                  {routineTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-50 space-y-3 py-8">
                      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M14 5.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5h12zm-3-4a.5.5 0 0 1 .5.5v1h1a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H2A1.5 1.5 0 0 1 .5 14.5v-9A1.5 1.5 0 0 1 2 4h1V3a.5.5 0 0 1 1 0v1h8V3a.5.5 0 0 1 .5-.5zM4.5 8a.5.5 0 0 0 0 1h7a.5.5 0 0 1 0-1h-7zm0 2.5a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7z"/>
                      </svg>
                      <p className="text-sm font-medium">Your daily routine is empty.<br/>Add daily tasks above to get started!</p>
                    </div>
                  ) : (
                    <DndContext
                      sensors={routineSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleRoutineDragEnd}
                    >
                      <SortableContext
                        items={routineTasks.map((t) => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {routineTasks.map((task) => (
                          <SortableRoutineItem
                            key={task.id}
                            task={task}
                            onToggle={handleToggleRoutineTask}
                            onRemove={handleRemoveRoutineTask}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
                </div>

                <div className="mt-auto pt-4 shrink-0">
                  {ChatInputComponent}
                </div>
              </section>
            ) : isChatOpen ? (
              <section className="side-panel flex flex-col h-full animate-rise">
                <div className="flex items-center justify-between border-b border-[#17211f]/10 pb-4 mb-4 shrink-0">
                  <p className="text-sm font-semibold text-[#00A19B]">Chat Assistant</p>
                  <button onClick={() => setIsChatOpen(false)} className="text-[#17211f]/40 hover:text-[#17211f] transition-colors cursor-pointer" aria-label="Close Chat">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 min-h-0">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center opacity-50 space-y-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z"/>
                        <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5"/>
                      </svg>
                      <p className="text-sm font-medium">I&apos;m listening.<br/>Ask me to create, delete, reschedule, or find an event.</p>
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
                <div className="mt-auto pt-4 shrink-0">
                  {ChatInputComponent}
                </div>
              </section>
            ) : formMode ? (
              <section className="side-panel form-panel animate-rise delay-100 flex flex-col h-full overflow-y-auto">
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

                <form className="event-form mt-4" onSubmit={submitEventForm}>
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
                      type="text"
                      placeholder="e.g. 09:00 AM"
                      value={formValues.time}
                      onChange={(event) =>
                        setFormValues((current) => ({
                          ...current,
                          time: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    <span>Notes</span>
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

                  <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[#17211f]/10 form-buttons">
                    <button
                      type="button"
                      onClick={closeForm}
                      disabled={isSubmitting}
                      className="flex-1 rounded-xl border border-[#17211f]/20 bg-white/80 py-3.5 px-4 text-sm md:text-base font-bold text-[#17211f] hover:bg-white hover:border-[#17211f]/40 transition-all cursor-pointer shadow-sm active:scale-[0.98] disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 rounded-xl bg-[#00A19B] py-3.5 px-4 text-sm md:text-base font-bold !text-white text-white shadow-md shadow-[#00A19B]/30 hover:bg-[#008984] hover:shadow-lg transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <span className="!text-white text-white font-bold">Saving...</span>
                      ) : formMode === "add" ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 16 16" className="text-white shrink-0">
                            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                          </svg>
                          <span className="!text-white text-white font-bold">Add Event</span>
                        </>
                      ) : (
                        <span className="!text-white text-white font-bold">Save Changes</span>
                      )}
                    </button>
                  </div>
                </form>
              </section>
            ) : selectedEvent && isDetailOpen ? (
              <EventDetailsPanel
                event={selectedEvent}
                onClose={() => setIsDetailOpen(false)}
              />
            ) : searchQuery.trim().length > 0 ? (
              <section className="side-panel animate-rise delay-100 flex flex-col h-full">
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

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 min-h-0">
                  {searchResults.length > 0 ? (
                    searchResults.map((event) => (
                      <EventCard
                        event={event}
                        isSelected={event.id === selectedEventId}
                        key={event.id}
                        onSelect={() => selectEvent(event)}
                        showTickButton={true}
                        onToggleStatus={() => {
                          const nextStatus = event.status === "completed" ? "pending" : "completed";
                          updateEventStatus(event.id, event.date, nextStatus);
                        }}
                      />
                    ))
                  ) : (
                    <p className="text-sm font-semibold text-[#17211f]/60 text-center py-4">
                      No matching events found.
                    </p>
                  )}
                </div>
              </section>
            ) : (
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
                        className="rounded-full border border-[#D56B68]/30 bg-[#D56B68]/10 px-3 py-1.5 text-xs font-bold text-[#D56B68] transition-all hover:bg-[#D56B68] hover:text-white cursor-pointer"
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
                          showTickButton={true}
                          onToggleStatus={() => {
                            const nextStatus = event.status === "completed" ? "pending" : "completed";
                            updateEventStatus(event.id, event.date, nextStatus);
                          }}
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
                          showTickButton={true}
                          onToggleStatus={() => {
                            const nextStatus = event.status === "completed" ? "pending" : "completed";
                            updateEventStatus(event.id, event.date, nextStatus);
                          }}
                        />
                      ))
                    ) : (
                      <div className="empty-state">
                        <p className="text-sm font-semibold">No Events Scheduled</p>
                      </div>
                    )}
                  </div>
                </section>

                <section className="side-panel animate-rise delay-200 shrink-0">
                  <div className="flex items-center justify-between border-b border-[#17211f]/10 pb-3 mb-3">
                    <p className="text-sm font-semibold text-[#00A19B]">Features</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isRoutineOpen) {
                          setFormMode(null);
                          setIsDetailOpen(false);
                          setIsChatOpen(false);
                          setIsRoutineOpen(true);
                        } else {
                          setIsRoutineOpen(false);
                        }
                      }}
                      className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border transition-all text-xs font-semibold cursor-pointer ${
                        isRoutineOpen
                          ? "bg-[#00A19B] text-white border-[#00A19B] shadow-md shadow-[#00A19B]/30"
                          : "bg-white/60 border-[#17211f]/10 text-[#17211f] hover:bg-white hover:border-[#00A19B]/40 shadow-sm"
                      }`}
                      title="Daily Routine"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M14 5.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5h12zm-3-4a.5.5 0 0 1 .5.5v1h1a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H2A1.5 1.5 0 0 1 .5 14.5v-9A1.5 1.5 0 0 1 2 4h1V3a.5.5 0 0 1 1 0v1h8V3a.5.5 0 0 1 .5-.5zM4.5 8a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7zm0 2.5a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7z"/>
                      </svg>
                      <span>Routine</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push('/vault')}
                      className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border border-[#17211f]/10 bg-white/60 text-[#17211f] hover:bg-white hover:border-[#00A19B]/40 transition-all text-xs font-semibold shadow-sm cursor-pointer"
                      title="Vault"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM5 8h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>
                      </svg>
                      <span>Vault</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push('/sports')}
                      className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl border border-[#17211f]/10 bg-white/60 text-[#17211f] hover:bg-white hover:border-[#00A19B]/40 transition-all text-xs font-semibold shadow-sm cursor-pointer"
                      title="Sports"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M8 0C3.584 0 0 3.584 0 8s3.584 8 8 8c4.408 0 8-3.584 8-8s-3.584-8-8-8m4.015 2.505c.611.576 1.123 1.271 1.506 2.046-.574-.271-1.226-.45-1.921-.518a21 21 0 0 0-1.782-2.585q.412-.047.83-.047c.48 0 .943.037 1.367.104zM5.564 1.346c.38-.184.786-.328 1.21-.428a22 22 0 0 1 1.636 2.552q-.912.18-1.801.442a23 23 0 0 0-1.045-2.566zm-1.576.993c.404-.37.854-.691 1.341-.955a24 24 0 0 1 1.056 2.583q-.991.31-1.942.715a20 20 0 0 1-.455-2.343zM1.085 8.163q.983-.178 1.954-.265a22 22 0 0 1 1.706-2.571 20 20 0 0 1-.952-2.02 6.9 6.9 0 0 0-2.708 4.856zm1.182 2.656q.952-.394 1.867-.88a21 21 0 0 0 1.278 2.041 6.9 6.9 0 0 0-3.145-1.161zm4.846 4.095q-.89-.92-1.636-1.961a22 22 0 0 0-1.39-2.124 23 23 0 0 0 1.968-.908q.95 2.106 1.952 4.062a6.9 6.9 0 0 0-.894.931M8.91 14.881q-.958-1.996-1.87-4.108c.55-.246 1.135-.461 1.758-.638q1.493 2.193 2.764 4.542a6.9 6.9 0 0 0-2.652.204zm3.435-.78q-1.222-2.28-2.668-4.425a23 23 0 0 1 2.378-.456 21 21 0 0 0 1.892 3.659 6.9 6.9 0 0 0-1.602 1.222z"/>
                      </svg>
                      <span>Sports</span>
                    </button>
                  </div>
                </section>

                <section className="side-panel shrink-0 animate-rise delay-200 mt-auto">
                  {ChatInputComponent}
                </section>
              </div>
            )}
          </aside>
        </div>
      </section>

      {popupState && (
        <div
          className="fixed z-50 animate-rise"
          style={{
            left: `${popupState.x}px`,
            top: `${popupState.y - 8}px`,
            transform: "translate(-50%, -100%)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1 rounded-xl border border-[#17211f]/15 bg-[#f7f2ea] p-1.5 shadow-2xl backdrop-blur-md min-w-[120px]">
            <button
              type="button"
              onClick={() => copyEvent(popupState.event)}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold text-[#17211f] hover:bg-[#00A19B] hover:text-white transition-all cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M4 1.5H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v1H4zM3 3h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm6 0V2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-1V4a1 1 0 0 0-1-1H9z"/>
              </svg>
              <span>Copy</span>
            </button>
            <button
              type="button"
              onClick={() => {
                selectEvent(popupState.event);
                setPopupState(null);
              }}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#17211f]/80 hover:bg-[#17211f]/10 transition-colors cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
              </svg>
              <span>Details</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const nextStatus = popupState.event.status === "completed" ? "pending" : "completed";
                updateEventStatus(popupState.event.id, popupState.event.date, nextStatus);
                setPopupState(null);
              }}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold text-[#00A19B] hover:bg-[#00A19B] hover:text-white transition-all cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
              </svg>
              <span>{popupState.event.status === "completed" ? "Mark as pending" : "Mark as completed"}</span>
            </button>
          </div>
          <div className="mx-auto -mt-1 h-2 w-2 rotate-45 border-b border-r border-[#17211f]/15 bg-[#f7f2ea]" />
        </div>
      )}
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
          <dt className="sr-only">Status</dt>
          <dd className="capitalize flex items-center justify-between">
            <span>Status</span>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                event.status === "completed"
                  ? "bg-[#00A19B] text-white border border-[#00A19B]"
                  : "bg-[#00A19B]/10 text-[#00A19B] border border-[#00A19B]/20"
              }`}
            >
              {event.status || "pending"}
            </span>
          </dd>
        </div>
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
  onToggleStatus,
  showTickButton = false,
}: {
  event: CalendarEvent;
  inverted?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onToggleStatus?: (e: React.MouseEvent) => void;
  showTickButton?: boolean;
}) {
  const isCompleted = event.status === "completed";

  const content = (
    <div className="flex items-center justify-between w-full gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {event.time && <p className="text-xs font-bold text-[#17211f]/80 shrink-0">{event.time}</p>}
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${
              isCompleted
                ? "bg-[#00A19B] text-white flex items-center gap-1 font-semibold"
                : "bg-[#00A19B]/10 text-[#00A19B] border border-[#00A19B]/20 font-bold"
            }`}
          >
            {event.status || "pending"}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 min-w-0">
          {isCompleted && (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#00A19B] text-white shadow-sm">
              <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 16 16">
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
              </svg>
            </span>
          )}
          <h3 className={`text-base truncate ${isCompleted ? "text-[#17211f]/80 font-medium" : "font-bold text-[#17211f]"}`}>
            {event.title}
          </h3>
        </div>

        {event.location && <p className="text-xs opacity-70 truncate mt-0.5">{event.location}</p>}
      </div>

      {showTickButton && onToggleStatus && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(e);
          }}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all cursor-pointer ${
            isCompleted
              ? "border-[#00A19B] bg-[#00A19B] text-white shadow-md hover:bg-[#008984]"
              : "border-[#00A19B]/30 bg-white/80 text-[#00A19B]/50 hover:border-[#00A19B] hover:bg-[#00A19B]/10 hover:text-[#00A19B]"
          }`}
          title={isCompleted ? "Completed (click to toggle)" : "Mark as completed"}
          aria-label={isCompleted ? "Completed" : "Mark as completed"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
          </svg>
        </button>
      )}
    </div>
  );

  const cardClasses = `event-card ${event.tone} ${isSelected ? "selected" : ""} ${
    isCompleted ? "completed bg-[#00A19B]/10 border-[#00A19B]/30 opacity-85" : "opacity-100"
  } ${inverted ? "inverted" : ""}`;

  if (onSelect) {
    return (
      <div
        className={`${cardClasses} cursor-pointer`}
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        {content}
      </div>
    );
  }

  return <article className={cardClasses}>{content}</article>;
}
