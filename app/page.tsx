"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase
        .from("test")
        .select("*");

      console.log("DATA:", data);
      console.log("ERROR:", error);
    }

    testConnection();
  }, []);

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold">
        Voice Assistant
      </h1>
    </main>
  );
}