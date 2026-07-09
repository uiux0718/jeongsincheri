import React, { useState, useEffect } from "react";
import { X, Calendar, Loader2, Sparkles, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { collection, addDoc, query, where, getDocs, doc, updateDoc, limit } from "firebase/firestore";
import { DailyMoodLog } from "../types";

interface DailyMoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  theme: "cherry" | "midnight";
  onSuccess: (log: DailyMoodLog) => void;
}

const MOOD_OPTIONS = [
  { emoji: "🍒", label: "정신체리", desc: "활기차고 행복해요" },
  { emoji: "😊", label: "차분안정", desc: "평온하고 편안해요" },
  { emoji: "😐", label: "무덤덤", desc: "평화롭고 평범해요" },
  { emoji: "⚡", label: "마음과열", desc: "생각이 너무 복잡해요" },
  { emoji: "😢", label: "눈물속상", desc: "울적하고 위로가 필요해요" },
  { emoji: "🔥", label: "완전소진", desc: "무기력하고 지쳤어요" }
];

export function DailyMoodModal({ isOpen, onClose, userId, theme, onSuccess }: DailyMoodModalProps) {
  const [selectedMood, setSelectedMood] = useState<string>("");
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [noteInput, setNoteInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [existingLog, setExistingLog] = useState<DailyMoodLog | null>(null);

  // Get local date string YYYY-MM-DD in user timezone
  const getTodayDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayDateStr();

  // Check if user already wrote a log today
  useEffect(() => {
    if (!isOpen) return;

    const checkTodayLog = async () => {
      setIsChecking(true);
      if (!db) {
        setIsChecking(false);
        return;
      }

      try {
        const path = "dailyLogs";
        const q = query(
          collection(db, path),
          where("userId", "==", userId || "guest"),
          where("dateStr", "==", todayStr),
          limit(1)
        );
        let snapshot;
        try {
          snapshot = await getDocs(q);
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, path);
          throw err;
        }

        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          const data = docSnap.data() as DailyMoodLog;
          setExistingLog({ id: docSnap.id, ...data });
          setSelectedMood(data.mood);
          setSelectedLabel(data.moodLabel);
          setNoteInput(data.note);
        } else {
          setExistingLog(null);
          setSelectedMood("");
          setSelectedLabel("");
          setNoteInput("");
        }
      } catch (err) {
        console.error("Error checking today log:", err);
      } finally {
        setIsChecking(false);
      }
    };

    checkTodayLog();
  }, [isOpen, userId, todayStr]);

  const handleSubmit = async () => {
    if (!selectedMood) return;
    setIsLoading(true);

    const logData: Omit<DailyMoodLog, "id"> = {
      userId: userId || "guest",
      mood: selectedMood,
      moodLabel: selectedLabel,
      note: noteInput.trim() || "말없이 마음을 다독였습니다.",
      dateStr: todayStr,
      createdAt: new Date().toISOString()
    };

    try {
      if (db) {
        const path = "dailyLogs";
        if (existingLog?.id) {
          // Update existing log
          try {
            await updateDoc(doc(db, path, existingLog.id), {
              mood: selectedMood,
              moodLabel: selectedLabel,
              note: logData.note,
              createdAt: logData.createdAt
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `${path}/${existingLog.id}`);
            throw err;
          }
          onSuccess({ id: existingLog.id, ...logData });
        } else {
          // Create new log
          let docRef;
          try {
            docRef = await addDoc(collection(db, path), logData);
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, path);
            throw err;
          }
          onSuccess({ id: docRef.id, ...logData });
        }
      } else {
        // Fallback for non-firestore env
        onSuccess(logData);
      }
      onClose();
    } catch (err) {
      console.error("Error saving daily mood log:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className={`w-full max-w-lg rounded-3xl border p-6 overflow-hidden relative shadow-2xl ${
            theme === "midnight"
              ? "bg-[#181822] border-[#2d2d3a] text-neutral-100"
              : "bg-white border-[#ebeaee] text-neutral-800"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-dashed border-rose-200/20 pb-4 mb-5">
            <div className="flex items-center gap-2">
              <span className="text-2xl animate-bounce">🍒</span>
              <div>
                <h3 className="text-base font-black tracking-tight flex items-center gap-1.5">
                  오늘의 마음 기록하기
                </h3>
                <p className="text-[10px] text-neutral-400 font-bold flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3 h-3 text-rose-500" />
                  {todayStr} {existingLog ? "(이미 기록 완료)" : "(하루 한 번 소중한 기록)"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isChecking ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
              <span className="text-xs font-semibold">오늘의 마음 상태를 불러오는 중...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Info Banner */}
              {existingLog && (
                <div className="p-3 bg-rose-500/5 border border-rose-500/15 rounded-xl text-[11px] text-rose-500 font-bold flex items-center gap-1.5 leading-relaxed">
                  <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                  <span>오늘 이미 마음을 기록하셨네요! 원하신다면 지금 수정도 가능합니다.</span>
                </div>
              )}

              {/* Step 1: Mood options */}
              <div>
                <label className="text-[11px] font-bold text-neutral-400 block mb-2.5">
                  1. 오늘 나의 지배적인 기분/상태를 선택해주세요
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {MOOD_OPTIONS.map((opt) => {
                    const isSelected = selectedMood === opt.emoji;
                    return (
                      <button
                        key={opt.emoji}
                        type="button"
                        onClick={() => {
                          setSelectedMood(opt.emoji);
                          setSelectedLabel(opt.label);
                        }}
                        className={`p-2.5 rounded-2xl border transition-all flex flex-col items-center gap-1.5 cursor-pointer relative ${
                          isSelected
                            ? "bg-rose-500/10 border-rose-500/40 scale-105"
                            : theme === "midnight"
                              ? "bg-neutral-900/40 border-[#2b2b35] hover:border-neutral-700"
                              : "bg-white border-neutral-100 hover:bg-neutral-50/50"
                        }`}
                      >
                        <span className="text-2xl">{opt.emoji}</span>
                        <span className={`text-[10px] font-black ${isSelected ? "text-rose-500" : "text-neutral-500"}`}>
                          {opt.label}
                        </span>
                        
                        {isSelected && (
                          <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-rose-500 flex items-center justify-center text-white p-0.5">
                            <Check className="w-2 h-2 stroke-[3]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedMood && (
                  <p className="text-[10px] text-rose-500 font-bold text-center mt-2.5 bg-rose-500/5 py-1 px-3 rounded-full inline-block mx-auto">
                    선택됨: {selectedMood} {MOOD_OPTIONS.find(o => o.emoji === selectedMood)?.desc}
                  </p>
                )}
              </div>

              {/* Step 2: Mind short statement */}
              <div>
                <label className="text-[11px] font-bold text-neutral-400 block mb-2">
                  2. 지금 마음의 상태를 아주 짧게 기록해주세요 (한 마디만)
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="예) 오늘 발표를 무사히 마쳤다. 약간 긴장했지만 끝내고 나니 안도감이 든다."
                  className={`w-full p-3 rounded-xl text-xs sm:text-sm font-semibold outline-none border transition-all ${
                    theme === "midnight"
                      ? "bg-neutral-950 border-neutral-850 text-neutral-100 focus:border-rose-500/70"
                      : "bg-[#faf9fb] border-neutral-200 text-[#1c1c24] focus:border-rose-400"
                  }`}
                />
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[9px] text-neutral-400 font-medium">※ 최대 100자까지 작성할 수 있습니다.</span>
                  <span className="text-[9px] text-neutral-400 font-bold font-mono">{noteInput.length}/100</span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    theme === "midnight"
                      ? "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-850"
                      : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={!selectedMood || isLoading}
                  onClick={handleSubmit}
                  className={`flex-1 py-3 rounded-xl text-xs font-extrabold tracking-wide transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                    !selectedMood || isLoading
                      ? "bg-neutral-200 dark:bg-[#282835] text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
                      : "bg-rose-600 hover:bg-rose-500 text-white active:scale-98"
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>저장 중...</span>
                    </>
                  ) : (
                    <>
                      <span>{existingLog ? "기록 수정하기" : "오늘의 마음 저장하기 🍒"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
