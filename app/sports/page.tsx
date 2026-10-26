"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type FavoriteEntity = {
  id: string;
  user_id?: string | null;
  sport: string;
  entity_name: string;
};

const SPORTS_FILTERS = ["all", "football", "cricket", "f1", "kabaddi"];

function getSportMeta(sport: string) {
  switch (sport.toLowerCase()) {
    case "football":
      return {
        label: "Football",
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="m4.93 4.93 4.24 4.24m5.66 0 4.24-4.24m-14.14 14.14 4.24-4.24m5.66 0 4.24 4.24"/>
            <polygon points="12,7 16,10 14.5,15 9.5,15 8,10"/>
          </svg>
        ),
        badgeClass: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
        glowGradient: "from-emerald-500/20 via-[#00A19B]/10 to-transparent",
      };
    case "cricket":
      return {
        label: "Cricket",
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9"/>
            <path d="M7 7l10 10M17 7L7 17" strokeDasharray="2 2"/>
          </svg>
        ),
        badgeClass: "bg-amber-500/10 text-amber-800 border-amber-500/20",
        glowGradient: "from-amber-500/20 via-[#00A19B]/10 to-transparent",
      };
    case "f1":
      return {
        label: "Formula 1",
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" y1="22" x2="4" y2="15"/>
          </svg>
        ),
        badgeClass: "bg-rose-500/10 text-rose-700 border-rose-500/20",
        glowGradient: "from-rose-500/20 via-[#00A19B]/10 to-transparent",
      };
    case "kabaddi":
      return {
        label: "Kabaddi",
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="5" r="3"/>
            <path d="M7 21l3-7 4 3 3-7"/>
            <path d="M4 11h7l4-4"/>
          </svg>
        ),
        badgeClass: "bg-purple-500/10 text-purple-700 border-purple-500/20",
        glowGradient: "from-purple-500/20 via-[#00A19B]/10 to-transparent",
      };
    default:
      return {
        label: sport,
        icon: null,
        badgeClass: "bg-[#00A19B]/10 text-[#00A19B] border-[#00A19B]/20",
        glowGradient: "from-[#00A19B]/20 to-transparent",
      };
  }
}

function SortableItem({
  entity,
  index = 0,
  onClick,
  isSelected,
}: {
  entity: FavoriteEntity;
  index?: number;
  onClick: () => void;
  isSelected: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entity.id });

  // Only apply transform and transition when actively dragging or displaced by another item
  // Keeping them undefined when resting prevents dnd-kit from triggering a glitchy layout animation on mount
  const style: React.CSSProperties = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition: transform ? transition : undefined,
    zIndex: isDragging ? 50 : 1,
  };

  const meta = getSportMeta(entity.sport);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative select-none ${isDragging ? "z-50 opacity-90 scale-[1.03]" : ""}`}
    >
      <div
        style={{
          animationDelay: `${Math.min(index * 50, 450)}ms`,
        }}
        onClick={onClick}
        className={`animate-premium-reveal group relative overflow-hidden rounded-2xl p-6 cursor-pointer border transition-all duration-300 ${
          isSelected
            ? "border-[#00A19B] bg-gradient-to-br from-[#00A19B]/15 via-white/90 to-[#00A19B]/5 shadow-xl shadow-[#00A19B]/20 scale-[1.02] ring-2 ring-[#00A19B]/40"
            : "bg-white/75 backdrop-blur-md border-white/80 shadow-[0_4px_20px_-4px_rgba(23,33,31,0.06)] hover:-translate-y-1.5 hover:bg-white/95 hover:border-[#00A19B]/30 hover:shadow-[0_20px_40px_-15px_rgba(0,161,155,0.18)]"
        } ${isDragging ? "shadow-2xl ring-2 ring-[#00A19B] cursor-grabbing" : ""}`}
      >
        {/* Subtle ambient light orb */}
        <div
          className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${meta.glowGradient} blur-2xl transition-all duration-500 group-hover:scale-150 group-hover:opacity-100 opacity-60 pointer-events-none`}
        />

        <div className="relative z-10 flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border capitalize shadow-2xs ${meta.badgeClass}`}
            >
              {meta.icon}
              <span>{meta.label}</span>
            </span>

            {/* Tactile drag grip */}
            <div
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 -mr-1.5 rounded-lg text-[#17211f]/30 hover:text-[#17211f]/80 hover:bg-[#17211f]/5 transition-colors cursor-grab active:cursor-grabbing"
              title="Drag to reorder"
              aria-label="Drag to reorder"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="5" cy="4" r="1.5" />
                <circle cx="11" cy="4" r="1.5" />
                <circle cx="5" cy="8" r="1.5" />
                <circle cx="11" cy="8" r="1.5" />
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="11" cy="12" r="1.5" />
              </svg>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold tracking-tight text-[#17211f] line-clamp-2 group-hover:text-[#00A19B] transition-colors">
              {entity.entity_name}
            </h3>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[#17211f]/5 mt-1">
            <span className="text-[11px] font-semibold text-[#17211f]/50 group-hover:text-[#00A19B] transition-colors flex items-center gap-1">
              <span>View schedule</span>
              <svg
                className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </span>

            {isSelected && (
              <span className="flex h-2 w-2 rounded-full bg-[#00A19B] animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


export default function SportsPage() {
  const { user, loading: authLoading, initialized } = useAuth();
  const router = useRouter();

  const [entities, setEntities] = useState<FavoriteEntity[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("cachedFavoriteEntities");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("cachedFavoriteEntities");
        if (cached && JSON.parse(cached).length > 0) return false;
      } catch {}
    }
    return true;
  });

  useEffect(() => {
    try {
      const cached = localStorage.getItem("cachedFavoriteEntities");
      if (cached && entities.length === 0) {
        setEntities(JSON.parse(cached));
        setLoading(false);
      }
    } catch {}
  }, [entities.length]);

  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<FavoriteEntity | null>(null);
  type ScheduleItem = { id?: string; title?: string; date?: string; time?: string; venue?: string };
  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [iccGender, setIccGender] = useState<'men' | 'women'>('men');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'this_week'>('all');
  const [isAddMode, setIsAddMode] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ success?: string; error?: string } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // In-memory + sessionStorage cache for instant match schedule display
  const scheduleCacheRef = useRef<Record<string, ScheduleItem[]>>({});

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("sportsScheduleCache");
      if (stored) {
        scheduleCacheRef.current = JSON.parse(stored);
      }
    } catch {}
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (initialized && !user) {
      router.push("/");
    }
  }, [user, initialized, router]);

  // Warm-up calendar route in background
  useEffect(() => {
    router.prefetch("/calendar");
  }, [router]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    async function loadEntities() {
      // 1. Try querying entities matching the user or global entities (user_id IS NULL)
      let { data, error } = await supabase
        .from("favorite_entities")
        .select("id, user_id, sport, entity_name")
        .or(`user_id.eq.${user?.id},user_id.is.null`);

      // 2. If no entities returned or error occurred, fallback to fetching all entities
      if (error || !data || data.length === 0) {
        const fallback = await supabase
          .from("favorite_entities")
          .select("id, user_id, sport, entity_name");
        
        if (!fallback.error && fallback.data && fallback.data.length > 0) {
          data = fallback.data;
          error = null;
        }
      }

      if (!isMounted) return;

      if (error) {
        console.error("Could not load favorite entities:", error.message);
      } else {
        const withIds = (data || []).map((item) => ({
          ...item,
          id: String(item.id),
        }));
        
        try {
          const savedOrderStr = localStorage.getItem("favoriteTeamsOrder");
          if (savedOrderStr) {
            const savedOrder = JSON.parse(savedOrderStr);
            if (Array.isArray(savedOrder)) {
              withIds.sort((a, b) => {
                const indexA = savedOrder.indexOf(a.id);
                const indexB = savedOrder.indexOf(b.id);
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
              });
            }
          }
          localStorage.setItem("cachedFavoriteEntities", JSON.stringify(withIds));
        } catch(e) {
          console.error("Error saving entities cache", e);
        }

        setEntities((current) => {
          if (
            current.length === withIds.length &&
            current.every((item, i) => item.id === withIds[i].id && item.entity_name === withIds[i].entity_name)
          ) {
            return current;
          }
          return withIds;
        });
      }
      setLoading(false);
    }

    loadEntities();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Pre-fetch top entities in background for instant 0ms responses on click
  useEffect(() => {
    if (entities.length === 0) return;
    const topEntities = entities.slice(0, 5);
    const timeout = setTimeout(() => {
      topEntities.forEach((ent) => {
        if (!scheduleCacheRef.current[ent.id]) {
          fetch(`/api/sports/schedule?entityId=${ent.id}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data?.schedule) {
                scheduleCacheRef.current[ent.id] = data.schedule;
                try {
                  sessionStorage.setItem("sportsScheduleCache", JSON.stringify(scheduleCacheRef.current));
                } catch {}
              }
            })
            .catch(() => {});
        }
      });
    }, 150);
    return () => clearTimeout(timeout);
  }, [entities]);

  // Instant selection handler
  function handleSelectEntity(entity: FavoriteEntity) {
    setSelectedEntity(entity);
    const cached = scheduleCacheRef.current[entity.id];
    if (cached && cached.length > 0) {
      setScheduleData(cached);
      setScheduleLoading(false);
      setScheduleError(null);
    } else {
      setScheduleData([]);
      setScheduleLoading(true);
      setScheduleError(null);
    }
  }

  useEffect(() => {
    if (!selectedEntity) return;

    let isMounted = true;
    const cached = scheduleCacheRef.current[selectedEntity.id];
    if (!cached || cached.length === 0) {
      setScheduleLoading(true);
      setScheduleError(null);
    }

    async function loadSchedule() {
      try {
        const res = await fetch(`/api/sports/schedule?entityId=${selectedEntity?.id}`);
        if (!res.ok) {
          throw new Error("Failed to load schedule");
        }
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const newSchedule = data.schedule || [];
        scheduleCacheRef.current[selectedEntity!.id] = newSchedule;
        try {
          sessionStorage.setItem("sportsScheduleCache", JSON.stringify(scheduleCacheRef.current));
        } catch {}

        if (isMounted) {
          setScheduleData(newSchedule);
        }
      } catch (e: unknown) {
        if (isMounted) {
          if (!cached || cached.length === 0) {
            if (e instanceof Error) {
              setScheduleError(e.message);
            } else {
              setScheduleError("An error occurred");
            }
          }
        }
      } finally {
        if (isMounted) {
          setScheduleLoading(false);
        }
      }
    }

    loadSchedule();

    return () => {
      isMounted = false;
    };
  }, [selectedEntity]);

  const filteredEntities = entities.filter((entity) => {
    const matchesFilter = filter === "all" || entity.sport?.toLowerCase() === filter;
    const matchesSearch = (entity.entity_name || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setEntities((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);

        const newArray = arrayMove(items, oldIndex, newIndex);
        try {
          localStorage.setItem("favoriteTeamsOrder", JSON.stringify(newArray.map(item => item.id)));
        } catch(e) {
          console.error("Error saving order to localStorage", e);
        }
        return newArray;
      });
    }
  }

  if (authLoading || (!user && initialized)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#E4DDD3]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#00A19B] border-t-transparent"></div>
          <p className="font-bold text-[#17211F]/60">Loading...</p>
        </div>
      </div>
    );
  }

  function isThisWeek(dateStr: string | undefined) {
    if (!dateStr) return false;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return false;
    const matchDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = matchDate.getTime() - today.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  }

  function isToday(dateStr: string | undefined) {
    if (!dateStr) return false;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return false;
    const matchDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = matchDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 0;
  }

  function parseDateTime(dateStr: string | undefined, timeStr: string | undefined): Date {
    if (!dateStr) return new Date(9999, 11, 31);
    const parts = dateStr.split('/');
    if (parts.length !== 3) return new Date(9999, 11, 31);
    
    let hours = 0;
    let minutes = 0;
    
    if (timeStr) {
      const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        if (timeMatch[3]) {
          const isPM = timeMatch[3].toUpperCase() === 'PM';
          if (isPM && hours < 12) hours += 12;
          if (!isPM && hours === 12) hours = 0;
        }
      }
    }

    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), hours, minutes);
  }

  let filteredSchedule = scheduleData || [];
  if (selectedEntity?.entity_name?.toLowerCase() === 'icc') {
    filteredSchedule = filteredSchedule.filter((match: any) => {
      const isWomen = match.title.toLowerCase().includes('women');
      return iccGender === 'women' ? isWomen : !isWomen;
    });
  }

  if (timeFilter === 'today') {
    filteredSchedule = filteredSchedule.filter(match => isToday(match.date));
  } else if (timeFilter === 'this_week') {
    filteredSchedule = filteredSchedule.filter(match => isThisWeek(match.date));
  }

  filteredSchedule.sort((a, b) => {
    return parseDateTime(a.date, a.time).getTime() - parseDateTime(b.date, b.time).getTime();
  });

  async function handleAddModeToggle() {
    if (!isAddMode) {
      setIsAddMode(true);
      setSelectedMatches(new Set());
    } else {
      if (selectedMatches.size > 0) {
        setIsAdding(true);
        const matchesToAdd = filteredSchedule.filter((m: any) => selectedMatches.has(m.id || m.title));
        
        const dateKeys = Array.from(new Set(matchesToAdd.map((match: any) => {
          const parsed = parseDateTime(match.date, match.time);
          return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
        })));

        const { data: existingEvents } = await supabase
          .from("events")
          .select("event_name, event_date")
          .eq("user_id", user?.id)
          .in("event_date", dateKeys);

        const payloads: any[] = [];
        const duplicateTitles: string[] = [];
        const existingList = existingEvents || [];

        for (const match of matchesToAdd) {
          const parsed = parseDateTime(match.date, match.time);
          const dKey = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
          
          const isDuplicate = existingList.some(
            (ev) => ev.event_name?.trim().toLowerCase() === match.title?.trim().toLowerCase() && ev.event_date === dKey
          );

          if (isDuplicate) {
            if (match.title) duplicateTitles.push(match.title);
          } else {
            let tStr = null;
            if (match.time) {
               tStr = `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
            }
            payloads.push({
               event_name: match.title,
               event_date: dKey,
               event_time: tStr,
               additional_info: match.venue || "",
               user_id: user?.id
            });
            existingList.push({ event_name: match.title, event_date: dKey });
          }
        }
        
        if (payloads.length > 0) {
          await supabase.from("events").insert(payloads);
        }
        
        const uniqueDupes = Array.from(new Set(duplicateTitles));
        let successMsg: string | undefined = undefined;
        let errorMsg: string | undefined = undefined;

        if (payloads.length > 0) {
          successMsg = "Matches added to calendar";
        }
        if (uniqueDupes.length > 0) {
          const formattedNames = uniqueDupes.map(t => `'${t}'`).join(", ");
          errorMsg = `${formattedNames} had already been added to the calendar.`;
        }

        setToast({ success: successMsg, error: errorMsg });
        setTimeout(() => setToast(null), 4000);
        setIsAdding(false);
      }
      setIsAddMode(false);
      setSelectedMatches(new Set());
    }
  }

  function handleSelectAll() {
    if (selectedMatches.size === filteredSchedule.length) {
      setSelectedMatches(new Set());
    } else {
      setSelectedMatches(new Set(filteredSchedule.map(m => String(m.id || m.title))));
    }
  }

  return (
    <main className="min-h-screen bg-[#E4DDD3] text-[#17211f]">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-[#E4DDD3]/80 px-6 py-4 backdrop-blur-md border-b border-[#17211f]/5">
        <div className="flex items-center gap-4">
          <Link
            href="/calendar"
            prefetch={true}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/50 text-[#17211f] shadow-sm transition-all hover:bg-white active:scale-95 cursor-pointer"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Favorite Teams</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1600px] px-6 py-8">
        {/* Search and Filters */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            {SPORTS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full px-5 py-2 text-sm font-semibold capitalize transition-all duration-300 ${
                  filter === s
                    ? "bg-[#00A19B] text-white shadow-md shadow-[#00A19B]/30"
                    : "bg-white/60 text-[#17211f]/70 hover:bg-white hover:text-[#17211f] shadow-sm"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-[#17211f]/40">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border-none bg-white/60 py-2.5 pl-10 pr-4 text-sm font-medium text-[#17211f] shadow-sm backdrop-blur-sm transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00A19B]/50 placeholder:text-[#17211f]/40"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-6 bg-white/40 border border-white/60 shadow-sm backdrop-blur-sm animate-pulse flex flex-col gap-4"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="h-5 w-20 bg-[#17211f]/10 rounded-full" />
                  <div className="h-5 w-5 bg-[#17211f]/10 rounded-md" />
                </div>
                <div className="space-y-2 pt-1">
                  <div className="h-6 w-3/4 bg-[#17211f]/10 rounded-lg" />
                  <div className="h-4 w-1/2 bg-[#17211f]/5 rounded-md" />
                </div>
                <div className="pt-3 border-t border-[#17211f]/5 flex justify-between items-center">
                  <div className="h-3 w-24 bg-[#17211f]/10 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEntities.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-white/40 py-20 text-center shadow-sm backdrop-blur-sm border border-white/50">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#00A19B]/10 text-[#00A19B]">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold">No teams found</h3>
            <p className="mt-2 text-[#17211f]/60 max-w-sm">
              {filter === "all"
                ? "You haven't added any favorite teams yet."
                : `You don't have any favorite ${filter} teams.`}
            </p>
          </div>
        ) : (
          <div className="flex justify-between gap-8 items-start h-full pb-10">
            <div className={`flex-1 transition-[max-width,width] duration-500 ${selectedEntity ? 'w-full lg:max-w-[55%]' : 'w-full'}`}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredEntities.map((e) => e.id)} strategy={rectSortingStrategy}>
                  <div className={`grid grid-cols-1 gap-6 ${selectedEntity ? 'sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                    {filteredEntities.map((entity, index) => (
                      <SortableItem 
                        key={entity.id} 
                        index={index}
                        entity={entity} 
                        isSelected={selectedEntity?.id === entity.id}
                        onClick={() => handleSelectEntity(entity)} 
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
            
            {/* Right Side Window for Schedules */}
            {selectedEntity && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 backdrop-blur-sm lg:relative lg:inset-auto lg:z-0 lg:flex lg:w-[40%] lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
                <div className="w-full max-h-[85vh] sm:max-w-xl rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 lg:sticky lg:top-24 lg:h-[calc(100vh-140px)] lg:max-h-none lg:w-full lg:rounded-3xl lg:bg-white/80 lg:backdrop-blur-xl lg:border lg:border-white lg:shadow-xl lg:shadow-[#00A19B]/5">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-[#17211f]">Upcoming Schedule</h2>
                    {selectedEntity?.entity_name?.toLowerCase() === 'icc' && (
                       <div className="flex items-center gap-2 mt-3 bg-[#17211f]/5 p-1 rounded-lg w-fit">
                         <button 
                           onClick={() => setIccGender('men')}
                           className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${iccGender === 'men' ? 'bg-white text-[#00A19B] shadow-sm' : 'text-[#17211f]/60 hover:text-[#17211f]'}`}
                         >
                           Men
                         </button>
                         <button 
                           onClick={() => setIccGender('women')}
                           className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${iccGender === 'women' ? 'bg-white text-[#00A19B] shadow-sm' : 'text-[#17211f]/60 hover:text-[#17211f]'}`}
                         >
                           Women
                         </button>
                       </div>
                    )}
                    {isAddMode && filteredSchedule.length > 0 && (
                       <label className="flex items-center gap-2 mt-3 text-sm font-medium text-[#17211f]/80 cursor-pointer">
                         <input 
                           type="checkbox" 
                           checked={selectedMatches.size === filteredSchedule.length}
                           onChange={handleSelectAll}
                           className="w-4 h-4 rounded border-[#17211f]/20 text-[#00A19B] focus:ring-[#00A19B]"
                         />
                         Select All
                       </label>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddModeToggle}
                        disabled={isAdding}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${isAddMode ? 'bg-[#00A19B] text-white shadow-sm' : 'bg-[#17211f]/5 text-[#17211f]/60 hover:bg-[#17211f]/10 hover:text-[#17211f]'} ${isAdding ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isAdding ? 'Adding...' : isAddMode ? 'Save to Calendar' : 'Add to Calendar'}
                      </button>
                      <button onClick={() => setSelectedEntity(null)} className="h-8 w-8 flex items-center justify-center rounded-full bg-[#17211f]/5 hover:bg-[#17211f]/10 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-1 bg-[#17211f]/5 p-1 rounded-lg">
                      <button
                        onClick={() => setTimeFilter(timeFilter === 'today' ? 'all' : 'today')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${timeFilter === 'today' ? 'bg-white text-[#00A19B] shadow-sm' : 'text-[#17211f]/60 hover:text-[#17211f]'}`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => setTimeFilter(timeFilter === 'this_week' ? 'all' : 'this_week')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${timeFilter === 'this_week' ? 'bg-white text-[#00A19B] shadow-sm' : 'text-[#17211f]/60 hover:text-[#17211f]'}`}
                      >
                        This Week
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2">
                  {(() => {
                    return scheduleLoading ? (
                      <div className="flex-1 flex items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#00A19B] border-t-transparent"></div>
                      </div>
                    ) : scheduleError ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-red-50 rounded-2xl">
                        <p className="text-red-600 font-medium">{scheduleError}</p>
                      </div>
                    ) : filteredSchedule.length > 0 ? (
                      filteredSchedule.map((match: any, i: number) => (
                        <div key={match.id || i} onClick={() => {
                            if (!isAddMode) return;
                            const key = match.id || match.title;
                            setSelectedMatches(prev => {
                               const next = new Set(prev);
                               if (next.has(key)) next.delete(key);
                               else next.add(key);
                               return next;
                            });
                        }} className={`relative bg-white rounded-2xl p-5 shadow-sm border ${selectedMatches.has(match.id || match.title) ? 'border-[#00A19B] bg-[#00A19B]/5' : 'border-[#17211f]/5'} hover:shadow-md transition-shadow flex items-start gap-4 ${isAddMode ? 'cursor-pointer' : ''}`}>
                          {isAddMode && (
                            <div className="pt-1">
                              <input 
                                type="checkbox"
                                checked={selectedMatches.has(match.id || match.title)}
                                onChange={() => {}} 
                                className="w-5 h-5 rounded border-[#17211f]/20 text-[#00A19B] focus:ring-[#00A19B] pointer-events-none"
                              />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <h4 className="font-bold text-[#17211f] pr-16">{match.title}</h4>
                              {isToday(match.date) ? (
                                <span className="absolute top-4 right-4 inline-flex items-center rounded-full bg-yellow-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-600">
                                  Today
                                </span>
                              ) : isThisWeek(match.date) ? (
                                <span className="absolute top-4 right-4 inline-flex items-center rounded-full bg-[#00A19B]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#00A19B]">
                                  This week
                                </span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-[#17211f]/60 mb-2">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z"/>
                              </svg>
                              <span>{match.date} at {match.time}</span>
                            </div>
                            {match.venue && (
                              <div className="flex items-center gap-2 text-sm text-[#17211f]/60">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                  <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6"/>
                                </svg>
                                <span>{match.venue}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-white/50 rounded-2xl">
                        <p className="text-[#17211f]/60">No upcoming schedule found.</p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
          </div>
        )}
      </div>
      
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-lg">
          {toast.success && (
            <div className="bg-[#00A19B] text-white px-6 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300 font-semibold flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022Z"/>
              </svg>
              <span>{toast.success}</span>
            </div>
          )}
          {toast.error && (
            <div className="bg-red-600 text-white px-6 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300 font-semibold flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{toast.error}</span>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
