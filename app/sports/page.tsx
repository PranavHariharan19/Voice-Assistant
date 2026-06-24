"use client";

import { useEffect, useState } from "react";
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
  user_id: string;
  sport: string;
  entity_name: string;
};

const SPORTS_FILTERS = ["all", "football", "cricket", "f1", "kabaddi"];

function SortableItem({ entity, onClick, isSelected }: { entity: FavoriteEntity; onClick: () => void; isSelected: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative overflow-hidden rounded-2xl p-6 cursor-grab active:cursor-grabbing transition-all duration-300 ${
        isSelected
          ? "border-2 border-[#00A19B] bg-[#00A19B]/10 shadow-lg shadow-[#00A19B]/20 scale-[1.02]"
          : "bg-white/70 border border-white shadow-sm hover:-translate-y-1 hover:bg-white hover:shadow-xl hover:shadow-[#00A19B]/10"
      } ${isDragging ? "shadow-2xl ring-2 ring-[#00A19B] opacity-80 z-50" : ""}`}
      onClick={onClick}
    >
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-[#00A19B]/20 to-transparent blur-2xl transition-transform duration-500 group-hover:scale-150"></div>

      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center rounded-full bg-[#17211f]/5 px-2.5 py-0.5 text-xs font-semibold capitalize text-[#00A19B]">
            {entity.sport}
          </span>
          <svg
            className="w-5 h-5 text-[#17211f]/20 opacity-0 group-hover:opacity-100 transition-opacity"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
          </svg>
        </div>
        <h3 className="text-xl font-bold tracking-tight text-[#17211f] line-clamp-2">
          {entity.entity_name}
        </h3>
      </div>
    </div>
  );
}

export default function SportsPage() {
  const { user, loading: authLoading, initialized } = useAuth();
  const router = useRouter();
  const [entities, setEntities] = useState<FavoriteEntity[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [showPopup, setShowPopup] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Requires a 5px drag distance before activating to distinguish from clicks
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

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    async function loadEntities() {
      const { data, error } = await supabase
        .from("favorite_entities")
        .select("id, user_id, sport, entity_name")
        .eq("user_id", user?.id);

      if (!isMounted) return;

      if (error) {
        console.error("Could not load favorite entities:", error.message);
      } else {
        const withIds = (data || []).map((item) => ({
          ...item,
          // Use the real uuid for DB operations, keeping string id for DnD if needed or just use real id.
          // Wait, DndKit needs a string id. The real id is a UUID string.
          id: item.id,
        }));
        
        try {
          const savedOrderStr = localStorage.getItem("favoriteTeamsOrder");
          if (savedOrderStr) {
            const savedOrder = JSON.parse(savedOrderStr);
            withIds.sort((a, b) => {
              const indexA = savedOrder.indexOf(a.id);
              const indexB = savedOrder.indexOf(b.id);
              if (indexA === -1 && indexB === -1) return 0;
              if (indexA === -1) return 1;
              if (indexB === -1) return -1;
              return indexA - indexB;
            });
          }
        } catch(e) {
          console.error("Error reading order from localStorage", e);
        }

        setEntities(withIds);
      }
      setLoading(false);
    }

    loadEntities();
    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!selectedEntity) return;

    let isMounted = true;
    setTimeout(() => {
      if (isMounted) {
        setScheduleLoading(true);
        setScheduleError(null);
      }
    }, 0);

    async function loadSchedule() {
      try {
        const res = await fetch(`/api/sports/schedule?entityId=${selectedEntity?.id}`);
        if (!res.ok) {
          throw new Error("Failed to load schedule");
        }
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (isMounted) {
          setScheduleData(data.schedule || []);
        }
      } catch (e: unknown) {
        if (isMounted) {
          if (e instanceof Error) {
            setScheduleError(e.message);
          } else {
            setScheduleError("An error occurred");
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
    const matchesFilter = filter === "all" || entity.sport.toLowerCase() === filter;
    const matchesSearch = entity.entity_name.toLowerCase().includes(searchQuery.toLowerCase());
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
  if (selectedEntity?.entity_name.toLowerCase() === 'icc') {
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
        
        const payloads = matchesToAdd.map((match: any) => {
          const parsed = parseDateTime(match.date, match.time);
          const dKey = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
          
          let tStr = null;
          if (match.time) {
             tStr = `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
          }
          
          return {
             event_name: match.title,
             event_date: dKey,
             event_time: tStr,
             additional_info: match.venue || "",
             user_id: user?.id
          };
        });
        
        if (payloads.length > 0) {
          await supabase.from("events").insert(payloads);
        }
        
        setShowPopup(true);
        setTimeout(() => setShowPopup(false), 3000);
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
          <button
            onClick={() => router.push("/calendar")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/50 text-[#17211f] shadow-sm transition-all hover:bg-white"
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z" />
            </svg>
          </button>
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
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#00A19B] border-t-transparent"></div>
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
            <div className={`flex-1 transition-all duration-500 ${selectedEntity ? 'max-w-[55%]' : 'w-full'}`}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredEntities.map((e) => e.id)} strategy={rectSortingStrategy}>
                  <div className={`grid grid-cols-1 gap-6 ${selectedEntity ? 'sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                    {filteredEntities.map((entity) => (
                      <SortableItem 
                        key={entity.id} 
                        entity={entity} 
                        isSelected={selectedEntity?.id === entity.id}
                        onClick={() => setSelectedEntity(entity)} 
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
            
            {/* Right Side Window for Schedules */}
            {selectedEntity && (
              <div className="w-[40%] sticky top-24 bg-white/80 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-xl shadow-[#00A19B]/5 h-[calc(100vh-140px)] overflow-hidden hidden md:flex flex-col animate-in fade-in slide-in-from-right-8 duration-300">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-[#17211f]">Upcoming Schedule</h2>
                    {selectedEntity.entity_name.toLowerCase() === 'icc' && (
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
            )}
          </div>
        )}
      </div>
      
      {showPopup && (
        <div className="fixed bottom-6 right-6 bg-[#00A19B] text-white px-6 py-3 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 font-semibold flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
            <path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425a.247.247 0 0 1 .02-.022Z"/>
          </svg>
          Matches added to calendar
        </div>
      )}
    </main>
  );
}
