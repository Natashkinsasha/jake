"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTeacherTts } from "./_hooks/useTeacherTts";
import { useStudentStt } from "@/hooks/useStudentStt";
import { useTabFocus } from "@/hooks/useTabFocus";
import { phrases } from "@/data/phrases";
import { TeacherCard } from "./_components/TeacherCard";
import { StudentCard } from "./_components/StudentCard";

function getRandomPhrase(exclude?: string): string {
  const available = exclude ? phrases.filter((p) => p !== exclude) : phrases;
  return available[Math.floor(Math.random() * available.length)] ?? "";
}

export default function PrototypePage() {
  const teacher = useTeacherTts();
  const student = useStudentStt({
    onSpeechStart: () => {
      teacherRef.current.stop();
    },
  });
  const [currentPhrase, setCurrentPhrase] = useState("");
  const [hasStarted, setHasStarted] = useState(false);

  // Stable refs to avoid stale closures
  const teacherRef = useRef(teacher);
  teacherRef.current = teacher;
  const studentRef = useRef(student);
  studentRef.current = student;

  useTabFocus({
    onBlur: () => {
      if (teacherRef.current.isPlaying && !teacherRef.current.isPaused) {
        teacherRef.current.pause();
      }
    },
    onFocus: () => {
      if (teacherRef.current.isPaused) {
        teacherRef.current.resume();
      }
    },
  });

  const handleStart = useCallback(() => {
    setHasStarted(true);
    void teacherRef.current.speak(currentPhrase);
    // Enable mic right away so student can speak after teacher finishes
    if (!studentRef.current.isEnabled) {
      studentRef.current.enable();
    }
  }, [currentPhrase]);

  const handleNextPhrase = useCallback(() => {
    setHasStarted(true);
    setCurrentPhrase((prev) => {
      const phrase = getRandomPhrase(prev);
      void teacherRef.current.speak(phrase);
      return phrase;
    });
  }, []);

  // Pick initial phrase on mount (no autoplay — browser blocks it)
  useEffect(() => {
    setCurrentPhrase(getRandomPhrase());
  }, []);

  const handleToggleMic = useCallback(() => {
    if (studentRef.current.isEnabled) {
      studentRef.current.disable();
    } else {
      studentRef.current.enable();
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold text-center text-gray-400">
          Jake Prototype
        </h1>

        <TeacherCard
          visibleText={teacher.visibleText}
          currentPhrase={currentPhrase}
          isLoading={teacher.isLoading}
          isPlaying={teacher.isPlaying}
          isPaused={teacher.isPaused}
          hasStarted={hasStarted}
          onStart={handleStart}
          onNextPhrase={handleNextPhrase}
        />

        <StudentCard
          finalText={student.finalText}
          isEnabled={student.isEnabled}
          isListening={student.isListening}
          isProcessing={student.isProcessing}
          isSupported={student.isSupported}
          error={student.error}
          onToggleMic={handleToggleMic}
        />

        <p className="text-center text-xs text-gray-600">
          Tab away to pause teacher audio. Toggle mic to speak.
        </p>
      </div>
    </div>
  );
}
