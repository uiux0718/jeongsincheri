import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Wind, X, CheckCircle2, Sparkles, AlertCircle, Heart } from "lucide-react";

interface BreathingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  theme: "cherry" | "midnight";
}

type BreathState = "idle" | "inhale" | "hold" | "exhale" | "complete";

export const BreathingModal: React.FC<BreathingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  theme,
}) => {
  const isDark = theme === "midnight";
  
  const [breathState, setBreathState] = useState<BreathState>("idle");
  const [timeLeft, setTimeLeft] = useState(30);
  const [cycleCount, setCycleCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const breathTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Box/Deep breathing parameters (Inhale 4s, Hold 2s, Exhale 4s)
  useEffect(() => {
    if (!isOpen) {
      setBreathState("idle");
      setTimeLeft(30);
      setCycleCount(0);
      if (timerRef.current) clearInterval(timerRef.current);
      if (breathTimerRef.current) clearTimeout(breathTimerRef.current);
      return;
    }

    // Start breathing routine
    setBreathState("inhale");
    
    // Main 30-second timer
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (breathTimerRef.current) clearTimeout(breathTimerRef.current);
          setBreathState("complete");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Loop for managing breathing cycles
    const runBreathingCycle = () => {
      // Step 1: Inhale (4 seconds)
      setBreathState("inhale");
      
      breathTimerRef.current = setTimeout(() => {
        // Step 2: Hold (2 seconds)
        setBreathState("hold");
        
        breathTimerRef.current = setTimeout(() => {
          // Step 3: Exhale (4 seconds)
          setBreathState("exhale");
          
          breathTimerRef.current = setTimeout(() => {
            // Repeat unless time is up
            setCycleCount((c) => c + 1);
            runBreathingCycle();
          }, 4000); // Exhale duration
        }, 2000); // Hold duration
      }, 4000); // Inhale duration
    };

    runBreathingCycle();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (breathTimerRef.current) clearTimeout(breathTimerRef.current);
    };
  }, [isOpen]);

  // Handle completion
  const handleFinish = () => {
    onComplete();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className={`relative w-full max-w-md rounded-3xl p-6 overflow-hidden border shadow-2xl transition-all duration-300 ${
            isDark 
              ? "bg-neutral-900 border-neutral-800 text-neutral-100" 
              : "bg-white border-neutral-100 text-neutral-900"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-rose-500/10 rounded-lg">
                <Wind className="w-5 h-5 text-rose-500 animate-pulse" />
              </div>
              <h3 className="font-display font-extrabold text-sm tracking-tight">
                30초 마음 안정을 위한 호흡 운동
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200" />
            </button>
          </div>

          {/* Interactive Breathing Area */}
          <div className="flex flex-col items-center justify-center py-8 min-h-[300px]">
            {breathState !== "complete" ? (
              <div className="flex flex-col items-center gap-8 w-full">
                {/* Dynamic scale breathing circle */}
                <div className="relative w-48 h-48 flex items-center justify-center">
                  {/* Outer pulse wave */}
                  <motion.div
                    animate={{
                      scale: breathState === "inhale" ? 1.6 : breathState === "hold" ? 1.6 : 1.0,
                      opacity: breathState === "inhale" ? [0.15, 0.4, 0.15] : breathState === "hold" ? 0.3 : 0.1,
                    }}
                    transition={{
                      duration: breathState === "inhale" ? 4 : breathState === "hold" ? 2 : 4,
                      ease: "easeInOut",
                    }}
                    className="absolute inset-0 rounded-full bg-rose-500/20"
                  />
                  
                  {/* Inner breathing circle */}
                  <motion.div
                    animate={{
                      scale: breathState === "inhale" ? 1.3 : breathState === "hold" ? 1.3 : 1.0,
                      backgroundColor: 
                        breathState === "inhale" 
                          ? "rgba(244, 63, 94, 0.25)" 
                          : breathState === "hold" 
                            ? "rgba(244, 63, 94, 0.35)" 
                            : "rgba(244, 63, 94, 0.15)"
                    }}
                    transition={{
                      duration: breathState === "inhale" ? 4 : breathState === "hold" ? 2 : 4,
                      ease: "easeInOut",
                    }}
                    className="w-36 h-36 rounded-full border-2 border-rose-500/40 flex flex-col items-center justify-center shadow-inner relative"
                  >
                    {/* Visual state icon */}
                    <motion.div
                      animate={{
                        y: breathState === "inhale" ? -4 : breathState === "exhale" ? 4 : 0,
                      }}
                      className="text-rose-500"
                    >
                      <Wind className="w-8 h-8 animate-pulse" />
                    </motion.div>
                    
                    {/* Time left countdown inside */}
                    <span className="font-mono text-xs font-bold text-rose-500 dark:text-rose-400 mt-2">
                      {timeLeft}초 남음
                    </span>
                  </motion.div>
                </div>

                {/* Breathing Instruction text */}
                <div className="text-center">
                  <motion.h4
                    key={breathState}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="font-display font-extrabold text-xl text-rose-500 dark:text-rose-400"
                  >
                    {breathState === "inhale" && "천천히 들이쉬세요 (Inhale)"}
                    {breathState === "hold" && "가만히 멈추세요 (Hold)"}
                    {breathState === "exhale" && "길게 내쉬세요 (Exhale)"}
                  </motion.h4>
                  <p className="text-xs text-neutral-400 mt-1 font-medium">
                    가슴을 펴고 아랫배 깊숙이 맑은 에너지를 채워 넣습니다.
                  </p>
                </div>

                {/* Progress dot indicator */}
                <div className="flex gap-1.5 justify-center">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        cycleCount > i
                          ? "bg-rose-500 w-5"
                          : cycleCount === i && breathState !== "idle"
                            ? "bg-rose-400 animate-pulse"
                            : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              // Completion View
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center gap-5 py-4"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <CheckCircle2 className="w-12 h-12 stroke-[1.5]" />
                </div>
                <div>
                  <h4 className="font-display font-extrabold text-lg text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                    <Sparkles className="w-5 h-5 fill-emerald-500 animate-spin" />
                    <span>호흡 명상 완료!</span>
                  </h4>
                  <p className="text-xs text-neutral-400 mt-2 leading-relaxed max-w-xs font-medium">
                    단 30초의 깊은 호흡만으로도 부교감 신경이 활성화되어 전두엽이 차분하게 정돈됩니다. 훌륭한 마음 정돈이었습니다!
                  </p>
                </div>

                {/* Reward stat visual */}
                <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl px-4 py-2.5 flex items-center gap-2.5">
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                  <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    전두엽 마음 회복도 +5% 보너스 충전 완료 🍒
                  </span>
                </div>

                <button
                  onClick={handleFinish}
                  className="w-full mt-2 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-display font-extrabold py-3.5 px-6 rounded-2xl shadow-md transition-all text-sm cursor-pointer"
                >
                  맑은 기분으로 돌아가기
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
