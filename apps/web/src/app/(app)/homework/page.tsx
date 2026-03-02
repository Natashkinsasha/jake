"use client";

import { EmptyState } from "@/components/ui/EmptyState";

export default function HomeworkPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Homework</h1>
      <EmptyState
        icon="📚"
        title="No homework yet"
        description="Complete a lesson and Jake will create exercises just for you"
        action={{ label: "Start a lesson", href: "/lesson" }}
      />
    </div>
  );
}
