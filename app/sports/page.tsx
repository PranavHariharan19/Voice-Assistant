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

function SortableItem({ entity }: { entity: FavoriteEntity }) {
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
      className={`group relative overflow-hidden rounded-2xl bg-white/70 p-6 shadow-sm border border-white cursor-grab active:cursor-grabbing ${
        isDragging
          ? "shadow-2xl ring-2 ring-[#00A19B] opacity-80"
          : "hover:-translate-y-1 hover:bg-white hover:shadow-xl hover:shadow-[#00A19B]/10 transition-colors transition-shadow"
      }`}
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
      router.push("/login");
    }
  }, [user, initialized, router]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    async function loadEntities() {
      const { data, error } = await supabase
        .from("favorite_entities")
        .select("user_id, sport, entity_name")
        .eq("user_id", user?.id);

      if (!isMounted) return;

      if (error) {
        console.error("Could not load favorite entities:", error.message);
      } else {
        const withIds = (data || []).map((item) => ({
          ...item,
          id: `${item.sport}-${item.entity_name}`,
        }));
        setEntities(withIds);
      }
      setLoading(false);
    }

    loadEntities();
    return () => {
      isMounted = false;
    };
  }, [user]);

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

        return arrayMove(items, oldIndex, newIndex);
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

  return (
    <main className="min-h-screen bg-[#E4DDD3] text-[#17211f]">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-[#E4DDD3]/80 px-6 py-4 backdrop-blur-md border-b border-[#17211f]/5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
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

      <div className="mx-auto max-w-6xl px-6 py-8">
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredEntities.map((e) => e.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredEntities.map((entity) => (
                  <SortableItem key={entity.id} entity={entity} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </main>
  );
}
