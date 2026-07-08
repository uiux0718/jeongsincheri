import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Flame, Calendar, Trophy, Sparkles, HelpCircle, ArrowRight, Check, Heart, Plus } from "lucide-react";

interface WeeklyConsistencyTrackerProps {
  // Mapping of date strings "YYYY-MM-DD" to the number of completed missions on that day
  completionHistory: Record<string, number>;
  onAddManualCompletion?: (dateString: string) => void;
  onClearHistory?: () => void;
  theme: "cherry" | "midnight";
}

// Format Date as local "YYYY-MM-DD" without timezone shift
const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const WeeklyConsistencyTracker: React.FC<WeeklyConsistencyTrackerProps> = ({
  completionHistory,
  onAddManualCompletion,
  onClearHistory,
  theme,
}) => {
  const isDark = theme === "midnight";
  const [hoveredDate, setHoveredDate] = useState<{ date: string; count: number; x: number; y: number } | null>(null);

  // Get current date string
  const todayStr = useMemo(() => formatDateKey(new Date()), []);

  // 1. Calculate the last 12 weeks of days (84 days)
  // To keep it clean and aligned like GitHub, let's start from the Sunday of the week 11 weeks ago.
  const heatmapDays = useMemo(() => {
    const days: Date[] = [];
    const now = new Date();
    
    // Find the current day of the week (0 = Sunday, 1 = Monday, etc.)
    const currentDayOfWeek = now.getDay();
    
    // Start of the current week (Sunday)
    const startOfCurrentWeek = new Date(now);
    startOfCurrentWeek.setDate(now.getDate() - currentDayOfWeek);
    
    // Go back 11 full weeks to start the 12-week grid (Sunday of that week)
    const startDate = new Date(startOfCurrentWeek);
    startDate.setDate(startOfCurrentWeek.getDate() - 11 * 7);
    
    // Generate exactly 84 days (12 weeks * 7 days)
    for (let i = 0; i < 84; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      days.push(d);
    }
    
    return days;
  }, []);

  // Group days by week (each week is an array of 7 days)
  const weeks = useMemo(() => {
    const grouped: Date[][] = [];
    for (let i = 0; i < 12; i++) {
      grouped.push(heatmapDays.slice(i * 7, (i + 1) * 7));
    }
    return grouped;
  }, [heatmapDays]);

  // 2. Calculate current streak and max streak
  const streakStats = useMemo(() => {
    // Collect all unique completed dates from history (where count > 0) sorted in descending order
    const completedDates = Object.entries(completionHistory)
      .filter(([_, count]) => (count as number) > 0)
      .map(([date, _]) => date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    if (completedDates.length === 0) {
      return { currentStreak: 0, maxStreak: 0, totalActiveDays: 0 };
    }

    // A helper to subtract days from a date string
    const subtractDays = (dateStr: string, numDays: number): string => {
      const d = new Date(dateStr);
      d.setDate(d.getDate() - numDays);
      return formatDateKey(d);
    };

    // Calculate current streak
    let currentStreak = 0;
    let checkDate = todayStr;
    const hasToday = completionHistory[todayStr] && (completionHistory[todayStr] as number) > 0;
    const yesterdayStr = subtractDays(todayStr, 1);
    const hasYesterday = completionHistory[yesterdayStr] && (completionHistory[yesterdayStr] as number) > 0;

    if (hasToday) {
      currentStreak = 1;
      checkDate = yesterdayStr;
      while (completionHistory[checkDate] && (completionHistory[checkDate] as number) > 0) {
        currentStreak++;
        checkDate = subtractDays(checkDate, 1);
      }
    } else if (hasYesterday) {
      currentStreak = 1;
      checkDate = subtractDays(yesterdayStr, 1);
      while (completionHistory[checkDate] && (completionHistory[checkDate] as number) > 0) {
        currentStreak++;
        checkDate = subtractDays(checkDate, 1);
      }
    }

    // Calculate max streak across all history
    // First, let's get all dates that have at least 1 completion as a sorted ascending array of time values
    const sortedActiveTimes = Object.entries(completionHistory)
      .filter(([_, count]) => (count as number) > 0)
      .map(([date, _]) => new Date(date).getTime())
      .sort((a, b) => a - b);

    let maxStreak = 0;
    let tempStreak = 0;
    let lastTime: number | null = null;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    // Build unique day times to avoid multiple entries on the same day causing issues
    const uniqueSortedTimes = Array.from(new Set(sortedActiveTimes));

    for (const time of uniqueSortedTimes) {
      if (lastTime === null) {
        tempStreak = 1;
      } else {
        const diff = Math.round((time - lastTime) / ONE_DAY_MS);
        if (diff === 1) {
          tempStreak++;
        } else if (diff > 1) {
          maxStreak = Math.max(maxStreak, tempStreak);
          tempStreak = 1;
        }
      }
      lastTime = time;
    }
    maxStreak = Math.max(maxStreak, tempStreak);

    // Make sure maxStreak is at least as large as currentStreak
    maxStreak = Math.max(maxStreak, currentStreak);

    const totalActiveDays = Object.values(completionHistory).filter(c => (c as number) > 0).length;

    return { currentStreak, maxStreak, totalActiveDays };
  }, [completionHistory, todayStr]);

  // Determine cell background color class based on completion count
  const getCellColorClass = (count: number) => {
    if (count === 0) {
      return isDark 
        ? "bg-neutral-800/40 border-neutral-700/30 hover:bg-neutral-750" 
        : "bg-neutral-50/70 border-neutral-100 hover:bg-neutral-100";
    }
    if (count === 1) {
      return isDark
        ? "bg-rose-950/45 text-rose-400 border-rose-900/20 hover:bg-rose-900/40"
        : "bg-rose-100/80 text-rose-600 border-rose-200/50 hover:bg-rose-200";
    }
    if (count === 2) {
      return isDark
        ? "bg-rose-800/40 text-rose-300 border-rose-700/30 hover:bg-rose-700/65"
        : "bg-rose-300 text-rose-800 border-rose-400 hover:bg-rose-400";
    }
    // 3 or more
    return "bg-rose-600 dark:bg-rose-500 text-white border-rose-700 dark:border-rose-400 hover:opacity-90 shadow-sm";
  };

  // Days of week labels (Korean)
  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

  // Helper to format date for Koreans
  const formatKoreanDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.getMonth() + 1}월 ${d.getDate()}일`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      id="weekly-consistency-tracker"
      className={`p-5 rounded-2xl border transition-all duration-300 ${
        isDark
          ? "bg-neutral-800/80 border-neutral-700 text-neutral-100"
          : "bg-white border-neutral-150 shadow-sm text-neutral-900"
      }`}
    >
      {/* Top Header with Streak and Badges */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-100 dark:border-neutral-700/40 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-rose-500/10 rounded-xl">
            <Flame className="w-5 h-5 text-rose-500 fill-rose-500 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-sm uppercase tracking-tight flex items-center gap-1.5">
              <span>연속 실천 기록 (Streak Tracker)</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono animate-bounce font-extrabold">
                {streakStats.currentStreak}일 연속!
              </span>
            </h3>
            <p className="text-[10px] text-neutral-400 font-medium">
              하루에 한 개 이상 미션을 완수하여 긍정 생각 회로를 연결하세요 🍒
            </p>
          </div>
        </div>

        {/* Stats Panel */}
        <div className="flex gap-4 self-stretch sm:self-auto justify-between bg-neutral-50/50 dark:bg-neutral-900/30 p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-800">
          <div className="text-center px-2">
            <span className="block text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">현재 스트릭</span>
            <span className="text-sm font-extrabold font-mono text-rose-600 dark:text-rose-400 flex items-center justify-center gap-0.5">
              🔥 {streakStats.currentStreak} <span className="text-[10px] font-bold">일</span>
            </span>
          </div>
          <div className="w-[1px] bg-neutral-200 dark:bg-neutral-800 self-stretch"></div>
          <div className="text-center px-2">
            <span className="block text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">최대 스트릭</span>
            <span className="text-sm font-extrabold font-mono text-amber-500 flex items-center justify-center gap-0.5">
              🏆 {streakStats.maxStreak} <span className="text-[10px] font-bold">일</span>
            </span>
          </div>
          <div className="w-[1px] bg-neutral-200 dark:bg-neutral-800 self-stretch"></div>
          <div className="text-center px-2">
            <span className="block text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">총 실천 일수</span>
            <span className="text-sm font-extrabold font-mono text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-0.5">
              🌱 {streakStats.totalActiveDays} <span className="text-[10px] font-bold">일</span>
            </span>
          </div>
        </div>
      </div>

      {/* Grid Heatmap Visualizer */}
      <div className="relative">
        <div className="overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
          <div className="flex gap-2 min-w-[360px] justify-between py-1 select-none">
            {/* Left labels: Day of Week */}
            <div className="flex flex-col justify-between text-[9px] font-bold text-neutral-400 pr-1.5 pt-[13px] h-[98px]">
              <span>일</span>
              <span>화</span>
              <span>목</span>
              <span>토</span>
            </div>

            {/* Column grids */}
            <div className="flex-1 grid grid-cols-12 gap-1.5 max-w-[500px]">
              {weeks.map((week, weekIdx) => {
                // Determine the main month of this column to place column titles
                const middleDay = week[3];
                const showMonthLabel = weekIdx === 0 || (weekIdx > 0 && weeks[weekIdx - 1][3].getMonth() !== middleDay.getMonth());
                const monthName = middleDay.toLocaleString("ko-KR", { month: "short" });

                return (
                  <div key={weekIdx} className="flex flex-col gap-1.5">
                    {/* Month Label above the first column of each month */}
                    <div className="text-[9px] font-bold text-neutral-400 h-3 text-center truncate">
                      {showMonthLabel ? monthName : ""}
                    </div>

                    {/* 7 rows of days for this week */}
                    {week.map((dateObj) => {
                      const dateKey = formatDateKey(dateObj);
                      const count = (completionHistory[dateKey] as number) || 0;
                      const isToday = dateKey === todayStr;

                      return (
                        <div
                          key={dateKey}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const parentRect = e.currentTarget.parentElement?.parentElement?.parentElement?.getBoundingClientRect();
                            if (parentRect) {
                              setHoveredDate({
                                date: dateKey,
                                count,
                                x: rect.left - parentRect.left + rect.width / 2,
                                y: rect.top - parentRect.top - 38,
                              });
                            }
                          }}
                          onMouseLeave={() => setHoveredDate(null)}
                          onClick={() => onAddManualCompletion && onAddManualCompletion(dateKey)}
                          className={`w-full aspect-square max-w-[28px] rounded-[5px] border cursor-pointer transition-all duration-200 flex items-center justify-center ${getCellColorClass(
                            count
                          )} ${isToday ? "ring-2 ring-rose-500/80 ring-offset-2 dark:ring-offset-neutral-900" : ""}`}
                        >
                          {/* Beautiful micro dots */}
                          {count > 0 && (
                            <div className="text-[8px] scale-75 font-mono font-bold leading-none pointer-events-none">
                              {count}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dynamic Tooltip on Hover */}
        <AnimatePresence>
          {hoveredDate && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 5 }}
              transition={{ duration: 0.15 }}
              style={{ left: `${hoveredDate.x}px`, top: `${hoveredDate.y}px` }}
              className="absolute -translate-x-1/2 pointer-events-none z-30 bg-neutral-950 dark:bg-neutral-900 border border-neutral-800 text-white text-[10px] py-1.5 px-3 rounded-lg shadow-lg font-bold flex flex-col items-center gap-0.5 whitespace-nowrap"
            >
              <span className="text-[9px] font-medium text-neutral-400">{formatKoreanDate(hoveredDate.date)}</span>
              <span className="flex items-center gap-1">
                {hoveredDate.count > 0 ? (
                  <>
                    <Sparkles className="w-3 h-3 text-rose-400 fill-rose-400 animate-pulse" />
                    <span>오늘의 미션 <strong className="text-rose-400">{hoveredDate.count}개</strong> 실천 완료!</span>
                  </>
                ) : (
                  <span className="text-neutral-500 font-normal">실천 기록이 아직 없습니다.</span>
                )}
              </span>
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 rotate-45 bg-neutral-950 dark:bg-neutral-900 border-r border-b border-neutral-800"></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend & Interactive Testing Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 mt-3 pt-3 border-t border-dashed border-neutral-150 dark:border-neutral-700/50">
        {/* Colors Legend */}
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-bold">
          <span>덜 채워짐</span>
          <div className="w-2.5 h-2.5 rounded bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700"></div>
          <div className="w-2.5 h-2.5 rounded bg-rose-100 dark:bg-rose-950/40 border border-rose-200"></div>
          <div className="w-2.5 h-2.5 rounded bg-rose-300 dark:bg-rose-800/40 border border-rose-400"></div>
          <div className="w-2.5 h-2.5 rounded bg-rose-600 border border-rose-700"></div>
          <span>더 채워짐</span>
        </div>

        {/* Quick Testing Toggles */}
        {onAddManualCompletion && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] text-neutral-400 font-bold">🧪 수동 실천 테스트:</span>
            <button
              type="button"
              onClick={() => onAddManualCompletion(todayStr)}
              className="px-2.5 py-1 text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-lg hover:bg-rose-100/50 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>오늘 1개 실천</span>
            </button>
            {onClearHistory && (
              <button
                type="button"
                onClick={onClearHistory}
                className="px-2.5 py-1 text-[10px] font-medium bg-neutral-50 dark:bg-neutral-800 text-neutral-500 hover:text-rose-500 border border-neutral-200 dark:border-neutral-700 rounded-lg transition-colors cursor-pointer"
              >
                <span>기록 초기화</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
