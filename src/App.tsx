import React, { useState, useEffect } from "react";
import { 
  Heart, 
  Sparkles, 
  Loader2,
  X,
  ShieldAlert,
  Wind,
  CheckCircle2,
  User,
  LogOut,
  Calendar,
  AlertCircle,
  Copy,
  Check,
  Flame,
  HelpCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Activity,
  Award
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { auth, googleProvider, db, handleFirestoreError, OperationType } from "./firebase";
import { collection, addDoc, doc, updateDoc, deleteDoc, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { BreathingModal } from "./components/BreathingModal";
import { DailyMoodModal } from "./components/DailyMoodModal";
import { DailyMoodLog } from "./types";

export default function App() {
  // Theme settings (Solid Flat Design only)
  const [theme, setTheme] = useState<"cherry" | "midnight">(() => {
    try {
      const saved = localStorage.getItem("jc_theme");
      return (saved === "cherry" || saved === "midnight") ? saved : "cherry";
    } catch {
      return "cherry";
    }
  });

  // User Authentication
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Core Input States
  const [distressLevel, setDistressLevel] = useState<number>(5);
  const [prescriptionInput, setPrescriptionInput] = useState<string>("");
  const [triggerWords, setTriggerWords] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // API Call / Generation States
  const [isPrescribing, setIsPrescribing] = useState<boolean>(false);
  const [prescriptionResult, setPrescriptionResult] = useState<{
    id?: string;
    symptom: string;
    diagnosis: string;
    directions: string[];
    precautions: string;
    preferenceAnalysis?: string;
    isApiQuotaExceeded?: boolean;
    isMissionCompleted?: boolean;
    completedDirections?: boolean[];
    isFavorite?: boolean;
  } | null>(null);

  // Firestore / Past History state
  const [pastMindLogs, setPastMindLogs] = useState<any[]>([]);
  const [isLoadingPastLogs, setIsLoadingPastLogs] = useState<boolean>(false);

  // Daily Mood States
  const [isDailyMoodOpen, setIsDailyMoodOpen] = useState<boolean>(false);
  const [dailyMoodLogs, setDailyMoodLogs] = useState<DailyMoodLog[]>([]);
  const [isLoadingDailyMoods, setIsLoadingDailyMoods] = useState<boolean>(false);
  const [bentoTab, setBentoTab] = useState<"prescriptions" | "dailyMoods">("prescriptions");

  // UX Feedback and Interactive States
  const [inAppToast, setInAppToast] = useState<{ title: string; desc: string } | null>(null);
  const [isSummaryCopied, setIsSummaryCopied] = useState<boolean>(false);
  const [isBreathingOpen, setIsBreathingOpen] = useState<boolean>(false);

  // Save theme choice
  useEffect(() => {
    localStorage.setItem("jc_theme", theme);
  }, [theme]);

  // Handle Toast dismissals automatically
  useEffect(() => {
    if (inAppToast) {
      const timer = setTimeout(() => {
        setInAppToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [inAppToast]);

  // Firebase Auth State Observer
  useEffect(() => {
    setIsAuthLoading(true);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch daily logs from Firestore
  const fetchDailyMoodLogs = async () => {
    if (!db) return;
    setIsLoadingDailyMoods(true);
    try {
      const path = "dailyLogs";
      const q = query(
        collection(db, path),
        where("userId", "==", currentUser?.uid || "guest")
      );
      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
        throw err;
      }
      const logs: DailyMoodLog[] = [];
      querySnapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() as Omit<DailyMoodLog, "id"> });
      });
      // Sort desc by createdAt in memory
      logs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setDailyMoodLogs(logs.slice(0, 12));
    } catch (e) {
      console.warn("Failed to fetch daily mood logs from Firestore:", e);
    } finally {
      setIsLoadingDailyMoods(false);
    }
  };

  // Fetch mind logs from Firestore (Expanded limit to 12 for Bento Grid)
  const fetchPastMindLogs = async () => {
    if (!db) return;
    setIsLoadingPastLogs(true);
    try {
      const path = "mindLogs";
      const q = query(
        collection(db, path),
        where("userId", "==", currentUser?.uid || "guest")
      );
      let querySnapshot;
      try {
        querySnapshot = await getDocs(q);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
        throw err;
      }
      const logs: any[] = [];
      querySnapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() });
      });
      // Sort desc by createdAt in memory
      logs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setPastMindLogs(logs.slice(0, 12));
    } catch (e) {
      console.warn("Failed to fetch past mind logs from Firestore:", e);
    } finally {
      setIsLoadingPastLogs(false);
    }
  };

  // Re-fetch past logs & daily logs whenever user changes
  useEffect(() => {
    fetchPastMindLogs();
    fetchDailyMoodLogs();
  }, [currentUser]);

  // Check and trigger daily mood modal if not recorded yet today
  useEffect(() => {
    if (isAuthLoading) return;

    const checkAndTriggerMoodModal = async () => {
      const todayDateStr = new Date().toISOString().substring(0, 10);
      
      // Fast local storage check first
      const lastLoggedLocal = localStorage.getItem("jc_last_daily_mood_date");
      if (lastLoggedLocal === todayDateStr) {
        return;
      }

      // Firestore database check
      if (db) {
        try {
          const path = "dailyLogs";
          const q = query(
            collection(db, path),
            where("userId", "==", currentUser?.uid || "guest"),
            where("dateStr", "==", todayDateStr),
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
            localStorage.setItem("jc_last_daily_mood_date", todayDateStr);
            return;
          }
        } catch (e) {
          console.warn("Could not check today's daily log status:", e);
        }
      }

      // Trigger modal automatically with a slight delay
      const timer = setTimeout(() => {
        setIsDailyMoodOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    };

    checkAndTriggerMoodModal();
  }, [currentUser, isAuthLoading]);

  // Success handler for daily mood modal
  const handleDailyMoodSuccess = (log: DailyMoodLog) => {
    const todayDateStr = new Date().toISOString().substring(0, 10);
    localStorage.setItem("jc_last_daily_mood_date", todayDateStr);
    setInAppToast({
      title: "🍒 오늘의 기분 기록 완료!",
      desc: "소중한 오늘의 마음 상태가 마음 구급상자에 무사히 보관되었습니다."
    });
    fetchDailyMoodLogs();
    setBentoTab("dailyMoods"); // Show recorded log immediately
  };

  // Delete daily mood log helper
  const handleDeleteDailyLog = async (logId: string) => {
    if (!db || !logId) return;
    try {
      try {
        await deleteDoc(doc(db, "dailyLogs", logId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `dailyLogs/${logId}`);
        throw err;
      }
      setInAppToast({
        title: "🗑️ 기분 기록 삭제 완료",
        desc: "보관함에서 기분 기록을 영구히 삭제했습니다."
      });
      fetchDailyMoodLogs();
    } catch (err) {
      console.error("Failed to delete daily log:", err);
      setInAppToast({
        title: "오류 발생",
        desc: "잠시 후 다시 시도해주세요"
      });
    }
  };

  // Google Social Sign-In
  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        setInAppToast({
          title: "구글 로그인 성공 🍒",
          desc: `${result.user.displayName || result.user.email}님 환영합니다! 보관함 데이터가 안전하게 연동되었습니다.`
        });
      }
    } catch (err) {
      console.error("Google login error:", err);
      setInAppToast({
        title: "로그인 실패",
        desc: "구글 로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      });
    }
  };

  // Log Out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setInAppToast({
        title: "로그아웃 완료",
        desc: "안전하게 로그아웃 되었습니다."
      });
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Distress level description
  const getDistressDescription = (level: number) => {
    if (level <= 3) return "💡 다소 답답하고 가라앉은 기분 (소소한 일상 스트레스)";
    if (level <= 6) return "⚡ 마음 과부하 상태 (생각이 많고 정리되지 않는 고민)";
    if (level <= 8) return "🔥 무겁고 답답한 위기 상태 (큰 스트레스 혹은 무력감)";
    return "🚨 초비상 마음 대피 필요 (정신적 지침, 즉각 처방 필요)";
  };

  // POST request to trigger AI immediate mental prescription
  const handleGetPrescription = async () => {
    if (isPrescribing) return;

    // UX validation rule 3: 입력창이 비어있을 때 경고 안내
    if (!prescriptionInput.trim()) {
      setInAppToast({
        title: "⚠️ 내용을 입력해주세요",
        desc: "지금 어떤 고민이나 상황이 머릿속을 복잡하게 하는지 편하게 적어주세요!"
      });
      return;
    }

    setIsPrescribing(true);
    setPrescriptionResult(null);

    try {
      // Analyze previously completed directions (복용법)
      const completedList: string[] = [];
      pastMindLogs.forEach((log) => {
        if (Array.isArray(log.aiDirections) && Array.isArray(log.completedDirections)) {
          log.aiDirections.forEach((dir: string, idx: number) => {
            if (log.completedDirections[idx] === true) {
              completedList.push(dir);
            }
          });
        }
      });

      const response = await fetch("/api/prescription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          situation: prescriptionInput,
          completedDirectionsHistory: completedList
        })
      });

      if (!response.ok) {
        throw new Error("API returned an error status");
      }

      const data = await response.json();
      
      const symptom = data.symptom || "마음 과부하 및 불안";
      const diagnosis = data.diagnosis || "생각 회로가 쉴 틈 없이 작동해 에너지를 소모 중인 지친 상태입니다.";
      const directions = Array.isArray(data.directions) ? data.directions : ["따뜻한 물 한 잔 가볍게 들이켜기"];
      const precautions = data.precautions || "모든 감정을 지금 완벽하게 해결하지 않아도 충분히 괜찮습니다.";
      const preferenceAnalysis = data.preferenceAnalysis || "";

      // Save worry to Firestore mindLogs collection
      let docId = "";
      if (db) {
        try {
          let docRef;
          try {
            docRef = await addDoc(collection(db, "mindLogs"), {
              userId: currentUser?.uid || "guest",
              beforeScore: distressLevel,
              afterScore: null,
              userGomin: prescriptionInput,
              aiSymptom: symptom,
              aiDiagnosis: diagnosis,
              aiDirections: directions,
              aiPrecautions: precautions,
              preferenceAnalysis: preferenceAnalysis,
              isMissionCompleted: false,
              completedDirections: [false, false, false],
              isFavorite: false,
              createdAt: new Date().toISOString()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, "mindLogs");
            throw err;
          }
          docId = docRef.id;
        } catch (dbErr) {
          console.warn("Could not save mind log to Firestore:", dbErr);
        }
      }

      setPrescriptionResult({
        id: docId,
        symptom,
        diagnosis,
        directions,
        precautions,
        preferenceAnalysis,
        isApiQuotaExceeded: data.isApiQuotaExceeded,
        isMissionCompleted: false,
        completedDirections: [false, false, false],
        isFavorite: false
      });

      setInAppToast({
        title: "🍒 마음 처방전 조제 완료",
        desc: "불안을 덜어줄 따뜻한 진단과 극소형 실천 행동들이 도착했습니다."
      });

      // Refreshes history
      fetchPastMindLogs();
    } catch (error) {
      console.error("AI Prescription error:", error);
      // UX validation rule 2: 오류 발생 시 사용자에게 친근한 오류 안내
      setInAppToast({
        title: "😢 조제 지연 발생",
        desc: "잠시 후 다시 시도해주세요"
      });
    } finally {
      setIsPrescribing(false);
    }
  };

  // Clipboard copy helper
  const handleCopyPrescription = () => {
    if (!prescriptionResult) return;
    
    const directionsText = prescriptionResult.directions
      .map((d, i) => `${i + 1}. [${prescriptionResult.completedDirections?.[i] ? "V" : " "}] ${d}`)
      .join("\n");
    
    const textToCopy = `[정신체리 마음 응급 처방전 🍒]\n\n💊 처방명(증상):\n"${prescriptionResult.symptom}"\n\n🌸 마음 진단 & 위로:\n"${prescriptionResult.diagnosis}"\n\n📋 복용법 (행동 지침):\n${directionsText}\n\n⚠️ 주의사항:\n"${prescriptionResult.precautions}"`;
    
    navigator.clipboard.writeText(textToCopy);
    setIsSummaryCopied(true);
    
    setInAppToast({
      title: "📋 복사 완료!",
      desc: "처방전 내용이 클립보드에 복사되었습니다."
    });

    setTimeout(() => {
      setIsSummaryCopied(false);
    }, 2000);
  };

  // Toggle individual direction step
  const handleToggleDirection = async (idx: number) => {
    if (!prescriptionResult) return;
    
    const currentCompleted = prescriptionResult.completedDirections 
      ? [...prescriptionResult.completedDirections] 
      : [false, false, false];
    
    currentCompleted[idx] = !currentCompleted[idx];
    
    // Check if all are done
    const allDone = currentCompleted.every(val => val === true);

    const updatedResult = {
      ...prescriptionResult,
      completedDirections: currentCompleted,
      isMissionCompleted: allDone
    };
    
    setPrescriptionResult(updatedResult);

    if (prescriptionResult.id && db) {
      try {
        try {
          await updateDoc(doc(db, "mindLogs", prescriptionResult.id), {
            completedDirections: currentCompleted,
            isMissionCompleted: allDone,
            afterScore: allDone ? Math.max(1, distressLevel - 3) : null
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `mindLogs/${prescriptionResult.id}`);
          throw err;
        }
        
        if (allDone) {
          confetti({
            particleCount: 120,
            spread: 70,
            origin: { y: 0.75 },
            colors: ["#ec4899", "#f43f5e", "#fb7185", "#ffd1d1"]
          });
          setInAppToast({
            title: "🎉 처방 행동 복용 완료!",
            desc: "처방받은 행동 미션을 모두 실천하셨습니다. 한층 맑아진 마음을 느껴보세요!"
          });
        }
        fetchPastMindLogs();
      } catch (e) {
        console.error("Failed to update direction step:", e);
      }
    }
  };

  // Toggle favorite in active and database
  const handleToggleFavorite = async () => {
    if (!prescriptionResult) return;
    const newFav = !prescriptionResult.isFavorite;

    setPrescriptionResult({
      ...prescriptionResult,
      isFavorite: newFav
    });

    if (prescriptionResult.id && db) {
      try {
        try {
          await updateDoc(doc(db, "mindLogs", prescriptionResult.id), {
            isFavorite: newFav
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `mindLogs/${prescriptionResult.id}`);
          throw err;
        }
        setInAppToast({
          title: newFav ? "❤️ 즐겨찾기 등록 완료" : "💔 즐겨찾기 해제",
          desc: newFav ? "보관함에 보관되어 언제든 다시 꺼내볼 수 있습니다." : "즐겨찾기 목록에서 해제되었습니다."
        });
        fetchPastMindLogs();
      } catch (e) {
        console.error("Failed to toggle favorite in Firestore:", e);
      }
    } else {
      setInAppToast({
        title: newFav ? "❤️ 즐겨찾기 등록 완료 (임시)" : "💔 즐겨찾기 해제",
        desc: "구글 로그인을 하시면 처방 데이터가 클라우드에 영구 저장됩니다."
      });
    }
  };

  // Load old prescription back to view
  const handleLoadOldPrescription = (log: any) => {
    setPrescriptionInput(log.userGomin || "");
    
    setPrescriptionResult({
      id: log.id,
      symptom: log.aiSymptom || "마음 과부하 및 스트레스",
      diagnosis: log.aiDiagnosis || log.aiEmpathy || "지친 마음에 차분한 휴식이 필요한 상태입니다.",
      directions: log.aiDirections || [log.aiMission || "깊게 호흡하며 어깨 힘 풀기"],
      precautions: log.aiPrecautions || "모든 생각을 한 번에 무리해서 풀지 않아도 괜찮습니다.",
      preferenceAnalysis: log.preferenceAnalysis || "",
      isMissionCompleted: log.isMissionCompleted || false,
      completedDirections: log.completedDirections || [false, false, false],
      isFavorite: log.isFavorite || false
    });

    setInAppToast({
      title: "🔍 처방 기록 열람",
      desc: "이전 처방전을 성공적으로 불러왔습니다."
    });

    // Smooth scroll to active prescription card
    window.scrollTo({ top: 120, behavior: "smooth" });
  };

  // Delete log helper
  const handleDeleteLog = async (logId: string) => {
    if (!db || !logId) return;
    try {
      try {
        await deleteDoc(doc(db, "mindLogs", logId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `mindLogs/${logId}`);
        throw err;
      }
      setInAppToast({
        title: "🗑️ 처방 기록 삭제 완료",
        desc: "마음 구급상자에서 처방 기록을 영구히 삭제했습니다."
      });
      if (prescriptionResult?.id === logId) {
        setPrescriptionResult(null);
      }
      fetchPastMindLogs();
    } catch (err) {
      console.error("Failed to delete log:", err);
      setInAppToast({
        title: "오류 발생",
        desc: "잠시 후 다시 시도해주세요"
      });
    }
  };

  // Compute stats for Bento Grid
  const totalCount = pastMindLogs.length;
  const completedCount = pastMindLogs.filter(l => l.isMissionCompleted).length;
  const favoriteCount = pastMindLogs.filter(l => l.isFavorite).length;

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-200 flex flex-col ${
      theme === "midnight" 
        ? "bg-[#111115] text-[#e2e2e9]" 
        : "bg-[#fcfbfc] text-[#1c1c24]"
    }`}>
      
      {/* HEADER BAR */}
      <header className={`sticky top-0 z-40 border-b backdrop-blur-md px-4 py-3.5 flex items-center justify-between ${
        theme === "midnight" 
          ? "bg-[#111115]/90 border-[#23232a]" 
          : "bg-[#fcfbfc]/90 border-[#ebeaee]"
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl shrink-0">🍒</span>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg text-rose-600 flex flex-wrap items-center gap-1.5 break-keep font-black">
              정신체리
              <span className="text-[10px] sm:text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300 font-bold whitespace-nowrap shrink-0">
                마음 응급 대피소
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Daily Mood trigger */}
          <button
            onClick={() => setIsDailyMoodOpen(true)}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold cursor-pointer border transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              theme === "midnight" 
                ? "bg-[#281622] border-[#4a1c36] text-rose-300 hover:bg-[#381a2e]" 
                : "bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100/30"
            }`}
          >
            <span>🍒 기분 기록</span>
          </button>

          {/* Theme switcher */}
          <button
            onClick={() => setTheme(theme === "cherry" ? "midnight" : "cherry")}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold cursor-pointer border transition-all hover:scale-105 active:scale-95 flex items-center gap-1 whitespace-nowrap shrink-0 ${
              theme === "midnight" 
                ? "bg-[#1e1e24] border-[#2c2c35] text-rose-300 hover:bg-[#25252e]" 
                : "bg-white border-[#ebeaee] text-rose-600 hover:bg-rose-50/50"
            }`}
          >
            {theme === "cherry" ? "🌙 밤모드" : "☀️ 낮모드"}
          </button>

          {/* Login Status */}
          {isAuthLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-neutral-400 shrink-0" />
          ) : currentUser ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-bold text-neutral-500 max-w-[80px] truncate hidden md:inline whitespace-nowrap">
                {currentUser.displayName || "사용자"}님
              </span>
              <button
                onClick={handleSignOut}
                title="로그아웃"
                className={`p-2 rounded-xl border text-neutral-400 hover:text-rose-500 hover:border-rose-100 cursor-pointer shrink-0 transition-all ${
                  theme === "midnight" ? "border-[#2c2c35] bg-[#1a1a20]" : "border-[#ebeaee] bg-white"
                }`}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleSignIn}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold bg-neutral-900 text-white hover:bg-neutral-850 dark:bg-rose-600 dark:hover:bg-rose-500 cursor-pointer shadow-sm flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all"
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">로그인</span>
            </button>
          )}
        </div>
      </header>

      {/* CORE SINGLE SCREEN WORKSPACE */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 md:p-8 flex flex-col gap-10">
        
        {/* TOP GREETING BANNER */}
        <div className="text-center py-4">
          <p className="text-rose-500 font-extrabold text-xs sm:text-sm tracking-wider uppercase mb-1">
            {currentUser ? `${currentUser.displayName || "사용자"}님을 위한` : "당신을 위한"} 오늘의 처방
          </p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-800 dark:text-neutral-100 leading-tight">
            마음 응급 대피소에 오신 것을 환영합니다 🍒
          </h2>
          <p className="text-xs text-neutral-400 mt-2 max-w-md mx-auto leading-relaxed">
            복잡한 대화 없이, 머릿속을 가득 메운 힘든 생각을 단 한 줄만 적어보세요. 즉각 실천할 수 있는 초경량 솔루션을 담은 처방전을 보내드립니다.
          </p>
        </div>

        {/* SINGLE INPUT OR ACTIVE PRESCRIPTION VIEW */}
        <div className="w-full">
          <AnimatePresence mode="wait">
            {!prescriptionResult ? (
              // 1. CHERRY MASSIVE INPUT SCREEN (REDUCES COGNITIVE LOAD)
              <motion.div
                key="input-stage"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className={`p-6 sm:p-10 rounded-3xl border ${
                  theme === "midnight" 
                    ? "bg-[#18181f] border-[#22222a]" 
                    : "bg-white border-[#ebeaee]"
                }`}
              >
                <div className="text-center mb-6">
                  <span className="text-4xl block mb-2">🌸</span>
                  <h3 className="text-lg sm:text-xl font-black text-neutral-800 dark:text-neutral-100">
                    지금 어떤 일이 있었나요?
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 font-medium">
                    머릿속 생각을 편하게 적어보세요.
                  </p>
                </div>

                {/* Massive Spacious Text Area */}
                <div className="mb-4">
                  <textarea
                    value={prescriptionInput}
                    onChange={(e) => setPrescriptionInput(e.target.value)}
                    placeholder="예) 야근하고 퇴근하는 길인데 온몸에 진이 빠지고, 자소서 작성을 마감해야 하는데 머릿속이 새하얘져서 나만 뒤처진 채 길을 잃은 기분이 들어요."
                    rows={6}
                    className={`w-full p-5 rounded-2xl text-sm sm:text-base font-semibold outline-none border transition-all resize-none leading-relaxed ${
                      theme === "midnight"
                        ? "bg-[#111115] border-[#2b2b35] text-neutral-100 focus:border-rose-500/70"
                        : "bg-[#faf9fb] border-[#e2e1e7] text-[#1c1c24] focus:border-rose-400"
                    }`}
                  />
                  <p className="text-[11px] text-neutral-400 mt-1.5 text-center">
                    ※ 취업 준비, 자소서 작성 스트레스나 일상 고통 상황 등을 구분 없이 편하게 털어놓아주세요.
                  </p>
                </div>

                {/* Collapsible Advanced Mental Analytics Options (Zero load by default!) */}
                <div className="mb-6 border-t border-dashed border-neutral-100 dark:border-neutral-800 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="mx-auto flex items-center gap-1.5 text-xs font-bold text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
                  >
                    <span>마음 고통 수치 및 차단 표현 설정</span>
                    {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <AnimatePresence>
                    {showAdvanced && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-4"
                      >
                        <div className="flex flex-col gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-[#1a1a22] border border-neutral-100 dark:border-neutral-800">
                          {/* Distress Scale Button Array */}
                          <div>
                            <label className="text-[11px] font-bold text-neutral-400 block mb-2 text-center">
                              현재 마음 속 고민 및 비상 위기 지수 (1 ~ 10)
                            </label>
                            <div className="grid grid-cols-10 gap-1.5">
                              {[...Array(10)].map((_, i) => {
                                const level = i + 1;
                                const isSelected = distressLevel === level;
                                let colorClass = "";
                                if (level <= 3) {
                                  colorClass = isSelected 
                                    ? "bg-emerald-500 text-white border-emerald-500" 
                                    : "hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-600 border-emerald-100 dark:border-emerald-900/10";
                                } else if (level <= 6) {
                                  colorClass = isSelected 
                                    ? "bg-amber-500 text-white border-amber-500" 
                                    : "hover:bg-amber-50 dark:hover:bg-amber-950/20 text-amber-600 border-amber-100 dark:border-amber-900/10";
                                } else {
                                  colorClass = isSelected 
                                    ? "bg-rose-500 text-white border-rose-500" 
                                    : "hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 border-rose-100 dark:border-rose-900/10";
                                }
                                return (
                                  <button
                                    key={level}
                                    type="button"
                                    onClick={() => setDistressLevel(level)}
                                    className={`h-8 sm:h-9 rounded-lg font-mono font-bold text-xs border text-center transition-all cursor-pointer flex items-center justify-center ${colorClass} ${
                                      isSelected ? "scale-105" : ""
                                    }`}
                                  >
                                    {level}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="mt-2 text-center text-[11px] font-semibold text-rose-500">
                              {getDistressDescription(distressLevel)}
                            </div>
                          </div>

                          {/* Trigger exclusion words */}
                          <div>
                            <label className="text-[11px] font-bold text-neutral-400 block mb-1.5 text-center">
                              들었을 때 불편하고 기분만 가라앉는 표현 금지 (선택)
                            </label>
                            <input
                              type="text"
                              value={triggerWords}
                              onChange={(e) => setTriggerWords(e.target.value)}
                              placeholder="예) 노력, 화이팅, 포기, 의지 (쉼표로 구분)"
                              className={`w-full px-3 py-2 rounded-xl text-xs outline-none border text-center ${
                                theme === "midnight"
                                  ? "bg-[#111115] border-[#2b2b35] text-neutral-100"
                                  : "bg-white border-[#e2e1e7] text-[#1c1c24]"
                              }`}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Main Action Submit Button (UX requirement 1: 생성 중... + disabled) */}
                <button
                  onClick={handleGetPrescription}
                  disabled={isPrescribing}
                  className={`w-full py-4 rounded-2xl font-black text-sm tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    isPrescribing
                      ? "bg-neutral-300 dark:bg-[#282835] text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
                      : "bg-rose-600 hover:bg-rose-500 text-white active:scale-98"
                  }`}
                >
                  {isPrescribing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin animate-infinite" />
                      <span>처방전 제조 중...</span>
                    </>
                  ) : (
                    <>
                      <span>처방전 만들기 💊</span>
                    </>
                  )}
                </button>
              </motion.div>
            ) : (
              // 2. WOW-FACTOR PHYSICIAN ENVELOPE RESULT SCREEN
              <motion.div
                key="result-stage"
                initial={{ opacity: 0, scale: 0.98, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: -20 }}
                className={`p-6 sm:p-9 rounded-3xl border relative overflow-hidden ${
                  theme === "midnight" 
                    ? "bg-[#1e1e26] border-[#2e2e3a] shadow-xl shadow-rose-950/5" 
                    : "bg-rose-50/10 border-rose-100 shadow-lg shadow-rose-100/20"
                }`}
              >
                {/* Medicine envelope stripe top */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-rose-500 flex">
                  {[...Array(24)].map((_, i) => (
                     <div key={i} className="flex-1 h-full odd:bg-white/40" />
                  ))}
                </div>

                {/* Envelope Flap animation */}
                <motion.div 
                  initial={{ rotateX: 0, scaleY: 1 }}
                  animate={{ 
                    rotateX: -140,
                    scaleY: -1,
                    y: -10,
                    opacity: 0.1,
                    transition: { duration: 0.8, ease: "easeInOut" } 
                  }}
                  style={{ transformOrigin: "top", perspective: 800 }}
                  className={`absolute top-2 left-0 right-0 h-10 border-b z-20 flex items-center justify-center ${
                    theme === "midnight" ? "bg-[#252530] border-rose-900/30" : "bg-rose-100 border-rose-300"
                  }`}
                >
                  <span className="text-[10px] font-black text-rose-600 tracking-widest uppercase">OPENED PRESCRIPTION</span>
                </motion.div>

                {/* Prescription Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 mb-6 border-b pb-4 border-dashed border-rose-200/40">
                  <div>
                    <span className="text-[10px] font-bold text-rose-500 tracking-wider uppercase block mb-1">
                      CHERRY MIND CLINIC EMERGENCY PREVENTIVE PRESCRIPTION
                    </span>
                    <h4 className="text-lg font-black text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                      <span>💊 오늘의 마음 처방전</span>
                    </h4>
                  </div>
                  
                  {/* Clipboard copy button */}
                  <button
                    onClick={handleCopyPrescription}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-sm self-start sm:self-center ${
                      isSummaryCopied
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : theme === "midnight"
                          ? "bg-neutral-900 border-[#2e2e3a] text-rose-300 hover:bg-neutral-850"
                          : "bg-white border-rose-100 text-rose-600 hover:bg-rose-50"
                    }`}
                  >
                    {isSummaryCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>복사됨!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>복사 📋</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Prescription Content Inside Rolling Paper */}
                <div className="flex flex-col gap-5">
                  
                  {/* 접수된 고민 */}
                  <div className="p-3.5 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl border border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                    <span className="font-bold text-[10px] text-neutral-400 block mb-1">접수된 마음 고민</span>
                    "{prescriptionInput}"
                  </div>

                  {/* 맞춤형 행동 지침 선호 유형 분석 */}
                  {prescriptionResult.preferenceAnalysis && (
                    <div className="p-4 bg-rose-500/5 dark:bg-rose-950/25 border border-rose-200/30 dark:border-rose-900/30 rounded-2xl flex items-start gap-3">
                      <span className="text-lg shrink-0">🎯</span>
                      <div>
                        <span className="text-[9px] text-rose-500 font-extrabold uppercase tracking-widest block mb-0.5">
                          맞춤 행동 지침 우선 추천 (AI Preference Analysis)
                        </span>
                        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 leading-relaxed">
                          {prescriptionResult.preferenceAnalysis}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 1. 증상 */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-start border-b border-dashed border-rose-200/20 pb-3">
                    <div className="text-xs font-extrabold text-neutral-400 md:col-span-1 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      증상 (Symptom)
                    </div>
                    <div className="md:col-span-3 text-sm font-black text-neutral-800 dark:text-neutral-100">
                      {prescriptionResult.symptom}
                    </div>
                  </div>

                  {/* 2. 진단 */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-start border-b border-dashed border-rose-200/20 pb-3">
                    <div className="text-xs font-extrabold text-neutral-400 md:col-span-1 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      진단 (Diagnosis)
                    </div>
                    <div className="md:col-span-3 text-xs sm:text-sm font-semibold text-neutral-600 dark:text-neutral-300 leading-relaxed">
                      {prescriptionResult.diagnosis}
                    </div>
                  </div>

                  {/* 3. 복용법 ( Checklist with Checkbox line-through ) */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-start border-b border-dashed border-rose-200/20 pb-3">
                    <div className="text-xs font-extrabold text-neutral-400 md:col-span-1 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      복용법 (Directions)
                    </div>
                    <div className="md:col-span-3 flex flex-col gap-2.5">
                      <p className="text-[10px] text-neutral-400 font-medium">
                        ※ 하나씩 실행하고 박스를 체크해보세요. 다 완수하면 처방 완료 보너스가 주어집니다!
                      </p>
                      {prescriptionResult.directions.map((direction, idx) => {
                        const isDone = prescriptionResult.completedDirections?.[idx] || false;
                        return (
                          <div 
                            key={idx}
                            onClick={() => handleToggleDirection(idx)}
                            className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer select-none transition-all ${
                              isDone 
                                ? "bg-emerald-500/5 border-emerald-500/20 text-neutral-400" 
                                : theme === "midnight"
                                  ? "bg-neutral-900/60 border-neutral-800 text-neutral-200 hover:border-neutral-700"
                                  : "bg-white border-neutral-100 text-neutral-800 hover:bg-neutral-50/50"
                            }`}
                          >
                            <button
                              type="button"
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                isDone 
                                  ? "bg-emerald-500 border-emerald-500 text-white" 
                                  : theme === "midnight"
                                    ? "border-neutral-700 bg-neutral-950"
                                    : "border-neutral-300 bg-white"
                              }`}
                            >
                              {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                            <span className={`text-xs sm:text-sm font-bold ${
                              isDone ? "line-through text-neutral-400 font-normal" : ""
                            }`}>
                              {direction}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. 주의사항 */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-start">
                    <div className="text-xs font-extrabold text-neutral-400 md:col-span-1 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                      주의사항 (Precautions)
                    </div>
                    <div className="md:col-span-3 text-xs font-semibold text-rose-500 leading-relaxed bg-rose-500/5 p-3 rounded-xl border border-rose-500/10">
                      {prescriptionResult.precautions}
                    </div>
                  </div>

                </div>

                {/* Prescription Actions footer */}
                <div className="mt-8 pt-5 border-t border-neutral-100 dark:border-[#2e2e3a] flex flex-wrap gap-2.5 justify-between">
                  <div className="flex gap-2 w-full sm:w-auto">
                    {/* Favorite/Bookmark toggle */}
                    <button
                      onClick={handleToggleFavorite}
                      className={`flex-1 sm:flex-initial py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                        prescriptionResult.isFavorite
                          ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                          : theme === "midnight"
                            ? "bg-neutral-900 border-neutral-800 text-rose-300 hover:bg-neutral-800"
                            : "bg-white border-rose-100 text-rose-500 hover:bg-rose-50/50"
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${prescriptionResult.isFavorite ? "fill-white" : ""}`} />
                      <span>{prescriptionResult.isFavorite ? "즐겨찾기 완료" : "처방전 즐겨찾기"}</span>
                    </button>

                    {/* 30-sec breathing launcher */}
                    <button
                      onClick={() => setIsBreathingOpen(true)}
                      className={`flex-1 sm:flex-initial py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                        theme === "midnight"
                          ? "bg-[#111115] border-[#2e2e3a] text-neutral-200 hover:bg-[#252530]"
                          : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      <Wind className="w-4 h-4 text-rose-500 animate-pulse" />
                      <span>30초 심호흡 🧘</span>
                    </button>
                  </div>

                  {/* RESET/GO BACK BUTTON */}
                  <button
                    onClick={() => {
                      setPrescriptionInput("");
                      setPrescriptionResult(null);
                      setTriggerWords("");
                    }}
                    className={`w-full sm:w-auto py-3 px-5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border ${
                      theme === "midnight"
                        ? "bg-rose-600 hover:bg-rose-500 text-white border-rose-600"
                        : "bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-900"
                    }`}
                  >
                    <span>새로운 처방받기 🔄</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* BENTO GRID: MIND LOGS BOX */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-2.5 border-neutral-100 dark:border-neutral-800">
            <h3 className="text-base font-black text-neutral-800 dark:text-neutral-100 flex items-center gap-1.5">
              <span>🗃️ 나의 마음 보관함 (마음 구급상자)</span>
            </h3>
            
            {/* Tab switchers */}
            <div className="flex bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl self-start sm:self-auto">
              <button
                onClick={() => setBentoTab("prescriptions")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  bentoTab === "prescriptions"
                    ? "bg-white dark:bg-[#1c1c24] text-rose-500 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                }`}
              >
                💊 마음 처방전 ({totalCount})
              </button>
              <button
                onClick={() => setBentoTab("dailyMoods")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  bentoTab === "dailyMoods"
                    ? "bg-white dark:bg-[#1c1c24] text-rose-500 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                }`}
              >
                🍒 오늘의 기분 기록 ({dailyMoodLogs.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Bento Card 1: Dynamic Recovery Stat Dashboard (Takes 1 full col on md) */}
            <div className={`p-5 rounded-3xl border flex flex-col justify-between gap-5 md:col-span-1 ${
              theme === "midnight"
                ? "bg-[#1a1a24] border-[#2b2b3a] text-neutral-100"
                : "bg-rose-50/20 border-rose-100/60 text-neutral-800"
            }`}>
              <div>
                <span className="text-rose-500 text-xs font-extrabold tracking-wider uppercase block mb-1">HEALTH OVERVIEW</span>
                <h4 className="text-sm font-black text-neutral-800 dark:text-neutral-100">마음 구급상자 통계</h4>
                <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                  우리가 적은 감정과 그것을 털어낸 치유의 발자취들입니다.
                </p>
              </div>

              {/* Grid of micro numbers */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-2xl bg-white/50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800 text-center">
                  <Activity className="w-4 h-4 mx-auto text-rose-500 mb-1" />
                  <span className="text-lg font-black block leading-none">{totalCount}</span>
                  <span className="text-[9px] text-neutral-400 font-bold">누적 처방</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800 text-center">
                  <Award className="w-4 h-4 mx-auto text-emerald-500 mb-1" />
                  <span className="text-lg font-black block leading-none">{completedCount}</span>
                  <span className="text-[9px] text-neutral-400 font-bold">완료 미션</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800 text-center">
                  <Heart className="w-4 h-4 mx-auto text-rose-500 fill-rose-500/20 mb-1" />
                  <span className="text-lg font-black block leading-none">{favoriteCount}</span>
                  <span className="text-[9px] text-neutral-400 font-bold">즐겨찾기</span>
                </div>
              </div>

              {/* Sweet Quote */}
              <p className="text-[10px] text-neutral-400 italic leading-relaxed text-center font-medium">
                "매일 하나씩, 아주 작은 행동의 실천들이 뇌 속에 맑고 건강한 생각 산소를 공급해줍니다."
              </p>
            </div>

            {/* Bento Grid List of past prescriptions (Takes 2 columns on md) */}
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-[380px] overflow-y-auto pr-1">
              {bentoTab === "prescriptions" ? (
                isLoadingPastLogs ? (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-neutral-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-xs font-semibold">이전 기록들을 정리 중입니다...</span>
                  </div>
                ) : pastMindLogs.length > 0 ? (
                  pastMindLogs.map((log) => {
                    const sSymptom = log.aiSymptom || "마음 과부하 및 스트레스";
                    return (
                      <div
                        key={log.id}
                        className={`p-4 rounded-2xl border flex flex-col justify-between gap-3.5 transition-all text-xs leading-relaxed break-keep relative hover:shadow-sm ${
                          theme === "midnight"
                            ? "bg-[#16161c] border-[#22222d] text-neutral-200"
                            : "bg-white border-neutral-100 text-neutral-800"
                        }`}
                      >
                        {/* Top metadata strip */}
                        <div className="flex items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800/40 pb-1.5">
                          <span className="text-[10px] text-neutral-400 font-bold flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {log.createdAt ? log.createdAt.substring(0, 10) : "최근 기록"}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {log.isFavorite && (
                              <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
                            )}
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                              log.isMissionCompleted
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                : "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                            }`}>
                              {log.isMissionCompleted ? "실천 완료 ✓" : "복용 중"}
                            </span>
                            
                            {/* Remove button */}
                            <button
                              onClick={() => handleDeleteLog(log.id)}
                              title="처방 기록 영구 삭제"
                              className="p-1 rounded-md text-neutral-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-neutral-800/40 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Middle body */}
                        <div>
                          <span className="text-[9px] text-neutral-400 font-extrabold uppercase tracking-wider block mb-0.5">
                            처방약 이름 (증상)
                          </span>
                          <h5 className="text-xs font-black text-rose-500 tracking-tight line-clamp-1 mb-1">
                            💊 {sSymptom}
                          </h5>
                          <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                            고민: "{log.userGomin}"
                          </p>
                        </div>

                        {/* Bottom view detail CTA */}
                        <button
                          onClick={() => handleLoadOldPrescription(log)}
                          className={`w-full py-1.5 rounded-lg font-bold text-[10px] text-center border cursor-pointer transition-all ${
                            theme === "midnight"
                              ? "bg-neutral-900 border-neutral-800 text-rose-300 hover:bg-neutral-850"
                              : "bg-rose-500/5 border-rose-100 text-rose-600 hover:bg-rose-100/40"
                          }`}
                        >
                          처방전 다시보기 🔍
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-14 text-center text-neutral-400 text-xs font-bold">
                    📭 보관된 처방전이 없습니다. 고민을 적고 첫 처방을 받아보세요!
                  </div>
                )
              ) : (
                // Daily Mood Logs List
                isLoadingDailyMoods ? (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-neutral-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                    <span className="text-xs font-semibold">오늘의 기분 기록들을 불러오는 중...</span>
                  </div>
                ) : dailyMoodLogs.length > 0 ? (
                  dailyMoodLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-4 rounded-2xl border flex flex-col justify-between gap-3.5 transition-all text-xs leading-relaxed break-keep relative hover:shadow-sm ${
                        theme === "midnight"
                          ? "bg-[#16161c] border-[#22222d] text-neutral-200"
                          : "bg-white border-neutral-100 text-neutral-800"
                      }`}
                    >
                      {/* Top metadata strip */}
                      <div className="flex items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800/40 pb-1.5">
                        <span className="text-[10px] text-neutral-400 font-bold flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-rose-500" />
                          {log.dateStr}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                            {log.moodLabel}
                          </span>
                          
                          {/* Remove button */}
                          <button
                            onClick={() => handleDeleteDailyLog(log.id!)}
                            title="기록 영구 삭제"
                            className="p-1 rounded-md text-neutral-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-neutral-800/40 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Middle body */}
                      <div className="flex items-start gap-2.5">
                        <span className="text-3xl shrink-0 filter drop-shadow-xs">{log.mood}</span>
                        <div>
                          <span className="text-[9px] text-neutral-400 font-extrabold uppercase tracking-wider block mb-0.5">
                            오늘의 마음 한마디
                          </span>
                          <p className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 line-clamp-3">
                            "{log.note}"
                          </p>
                        </div>
                      </div>

                      {/* Modify Button */}
                      <button
                        onClick={() => {
                          setIsDailyMoodOpen(true);
                        }}
                        className={`w-full py-1.5 rounded-lg font-bold text-[10px] text-center border cursor-pointer transition-all ${
                          theme === "midnight"
                            ? "bg-neutral-900 border-neutral-800 text-rose-300 hover:bg-neutral-850"
                            : "bg-rose-500/5 border-rose-100 text-rose-600 hover:bg-rose-100/40"
                        }`}
                      >
                        오늘의 기록 수정/확인하기 🍒
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-14 text-center text-neutral-400 text-xs font-bold flex flex-col items-center gap-2">
                    <span>📭 오늘의 기분을 아직 기록하지 않았습니다.</span>
                    <button
                      onClick={() => setIsDailyMoodOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white hover:bg-rose-500 font-extrabold text-[10px] cursor-pointer transition-all"
                    >
                      지금 첫 기록하기 🍒
                    </button>
                  </div>
                )
              )}
            </div>

          </div>
        </section>

      </main>

      {/* FOOTER BANNER */}
      <footer className={`py-5 px-4 text-center text-[10px] sm:text-xs font-medium border-t break-keep ${
        theme === "midnight" ? "border-[#23232a] text-neutral-500" : "border-[#ebeaee] text-neutral-400"
      }`}>
        정신체리 마음 응급 대피소는 일상 속 갑작스러운 인지 과부하를 가뿐하게 가라앉힐 수 있는 초소형 처방전을 연구하고 조제합니다. 🍒
      </footer>

      {/* BREATHING MEDITATION MODAL */}
      <BreathingModal
        isOpen={isBreathingOpen}
        onClose={() => setIsBreathingOpen(false)}
        onComplete={() => {
          setInAppToast({
            title: "🧘 심호흡 성공!",
            desc: "차분해진 호흡 덕분에 심장과 전두엽이 한층 맑고 따뜻해졌습니다. 좋은 에너지를 누려보세요!"
          });
        }}
        theme={theme}
      />

      {/* DAILY MOOD RECORDER MODAL */}
      <DailyMoodModal
        isOpen={isDailyMoodOpen}
        onClose={() => setIsDailyMoodOpen(false)}
        userId={currentUser?.uid || "guest"}
        theme={theme}
        onSuccess={handleDailyMoodSuccess}
      />

      {/* FLOATING TOAST SYSTEM */}
      <AnimatePresence>
        {inAppToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-5 right-5 z-50 p-4 rounded-2xl shadow-xl max-w-sm border w-[calc(100vw-40px)] select-none"
            style={{
              backgroundColor: theme === "midnight" ? "#1e1e26" : "#ffffff",
              borderColor: theme === "midnight" ? "#2e2e3a" : "#ebeaee",
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h5 className="text-xs font-extrabold text-rose-600 dark:text-rose-400">
                  {inAppToast.title}
                </h5>
                <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed font-medium">
                  {inAppToast.desc}
                </p>
              </div>
              <button 
                onClick={() => setInAppToast(null)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-600 cursor-pointer ml-2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
