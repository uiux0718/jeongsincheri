import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Heart, 
  Eye, 
  Zap, 
  CheckCircle, 
  MessageSquare, 
  ArrowRight, 
  Send, 
  MoreVertical, 
  AlertTriangle, 
  Info, 
  Sparkles, 
  RotateCcw, 
  Home, 
  Award, 
  User, 
  Check, 
  Loader2,
  Paperclip,
  Download,
  FileText,
  Sun,
  Moon,
  Lightbulb,
  X,
  Settings,
  Trash2,
  ShieldAlert,
  Wind,
  AlertCircle,
  BarChart2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Stage, ChatMessage, DailyMission, WeeklyLog, UserSituation, CbtPracticeLog } from "./types";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import confetti from "canvas-confetti";
import { loadSessionState, saveSessionState, deleteSessionState, migrateGuestToUser } from "./lib/firebaseSync";
import { auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { SituationProfileEditor } from "./components/SituationProfileEditor";
import { WeeklyConsistencyTracker } from "./components/WeeklyConsistencyTracker";
import { BreathingModal } from "./components/BreathingModal";
import { Typewriter } from "./components/Typewriter";

const inputLabels: Record<string, string> = {
  worry: "나의 원래 걱정/고민",
  friendAdvice: "나의 가장 친한 친구가 해줄 법한 다정한 조언",
  fact: "객관적인 사실(Fact)",
  opinion: "감정에 치우친 내 생각(Opinion)",
  granularity: "감정의 세밀한 척도",
  anxiousAssert: "불안이 속삭이는 왜곡된 가정",
  reframing: "재구성된 단단한 생각 처방전"
};

interface DailyInsightItem {
  title: string;
  category: string;
  fact: string;
  neurotip: string;
}

const dailyInsights: DailyInsightItem[] = [
  {
    category: "마음의 자연스러운 반응",
    title: "우리는 원래 나쁜 것에 더 민감해요",
    fact: "사람의 마음은 위험으로부터 스스로를 지키기 위해, 좋은 일보다 힘들거나 나쁜 일에 약 3~4배 더 강하게 반응하도록 태어났습니다.",
    neurotip: "부정적인 생각이나 감정이 들 때 자신을 탓하지 마세요. '나를 지키기 위한 아주 당연한 보호 신호구나'라며 한 걸음 물러나 바라보세요."
  },
  {
    category: "마음의 회복 탄력성",
    title: "우리의 생각은 매일 새로워질 수 있어요",
    fact: "우리가 평소에 어떤 생각과 행동을 자주 하느냐에 따라 마음의 연결 통로는 매일 끊임없이 약해지기도 하고 새로 튼튼하게 연결되기도 합니다.",
    neurotip: "정신체리가 제안하는 간단한 실천 미션을 꾸준히 해보세요. 힘든 생각 회로는 얇아지고, 편안함을 느끼는 생각 통로가 든든하게 새로 자라납니다."
  },
  {
    category: "내 마음에 이름 붙이기",
    title: "감정에 이름을 붙이면 한결 가벼워집니다",
    fact: "막연히 불안해하거나 걱정할 때보다, 내가 느끼는 감정에 정확한 이름을 붙여 표현하는 것만으로도 불안을 주관하는 영역이 차분해지고 마음에 여유가 생깁니다.",
    neurotip: "걱정이 밀려올 때 참으려고 억누르지 말고, '지금 내 마음은 서운하고 조금 외로운 상태구나' 하고 소리 내어 가만히 읊조려 보세요."
  },
  {
    category: "나를 멀리서 바라보기",
    title: "제3자의 시선으로 보면 스트레스가 줄어들어요",
    fact: "내 생각과 감정을 마치 다른 사람이 겪고 있는 것처럼 객관적으로 한 발자국 뒤에서 관찰할 때 스트레스 물질의 분비량이 크게 감소합니다.",
    neurotip: "'나는 너무 불안해 죽겠다'라고 말하기보다 '내 마음속에 불안이라는 생각이 구름처럼 잠시 지나가고 있구나'라고 나를 멀리서 따뜻하게 봐주세요."
  },
  {
    category: "작은 성공의 기쁨",
    title: "작은 축하와 기쁨이 다음 실천을 도와요",
    fact: "작은 실천을 마치고 스스로를 소소하게 칭찬해 줄 때, 우리 마음에는 소량의 기쁜 긍정 에너지가 채워져, 다음 단계로 힘을 내어 나아갈 원동력이 생겨납니다.",
    neurotip: "오늘의 간단한 미션을 하나 완료한 뒤, '내가 스스로 마음을 보살폈어'라며 스스로를 기분 좋게 다독이고 성취감을 마음에 새겨보세요."
  }
];

const instantMissionsList = [
  "지금 바로 핸드폰 화면을 아래로 완전히 뒤집고, 들이마시고 내쉬는 숨을 크게 3번 해보세요. 🌬️",
  "자리에서 지긋이 일어나 손끝을 하늘로 높이 뻗으며 기지개를 10초간 시원하게 켜보세요. 🧘",
  "시원한 물 한 잔을 마시며, 입술과 목구멍에 닿는 차가운 액체의 촉각에만 온전히 집중해보세요. 💧",
  "창문을 열어 5초간 들어오는 상쾌한 바람을 느끼고 먼 밤하늘이나 바깥 풍경을 바라보세요. 🍃",
  "지금 가장 힘이 들어가 있는 양쪽 어깨를 귀 끝까지 바짝 올렸다가, '툭' 하고 3번 털어내세요. 🎒",
  "가만히 눈을 감고, 내 콧구멍을 통해 들어오는 시원한 숨과 나가는 따뜻한 숨을 5번 세어보세요. 🕯️",
  "주변 공간에서 파란색이나 녹색 물건 3개를 찾아 마음속으로 소리 내어 이름표를 붙여보세요. 🌀",
  "양 손가락 끝을 세워 가볍게 머리 정수리부터 관자놀이까지 톡톡톡 15초 동안 두드려 마사지해 주세요. 💆",
  "목을 왼쪽으로 천천히 한 바퀴, 오른쪽으로 아주 부드럽게 한 바퀴 크게 원을 그려주세요. 🔄",
  "내 발바닥 전체가 방바닥을 딛고 있는 그 단단하고 흔들림 없는 지구의 마찰력을 10초간 느껴보세요. 🦶",
  "카톡이나 업무 메신저 알림을 잠시 끄고, 양 손목을 엇갈려 털어주며 몸의 긴장감을 흔들어 깨우세요. ⏳",
  "내가 오늘 아주 사소하게라도 잘해낸 행동 하나(예: 양치하기, 일어나기)를 마음속으로 듬뿍 칭찬해주세요. 🌸",
  "폰 카메라나 거울을 보며, 나의 소중한 입꼬리를 양옆으로 힘껏 3초 동안 씨익 올리며 미소 지어보세요. 😄",
  "내 가슴 위에 두 손을 포개어 얹고, 콩닥콩닥 뛰고 있는 나만의 소중하고 따뜻한 심장 소리를 느껴보세요. ❤️",
  "주먹을 있는 힘껏 5초간 꽉 쥐었다가, 손바닥을 쫙 펼치며 마음속 걱정들도 함께 허공에 날려버리세요. ✊"
];

// Robust LocalStorage Utilities with Try-Catch protection
const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(`[LocalStorage Write Error] Failed to write key "${key}":`, error);
  }
};

const safeGetItem = (key: string, fallback: string): string => {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (error) {
    console.error(`[LocalStorage Read Error] Failed to read key "${key}":`, error);
    return fallback;
  }
};

const getPersonalizedGreeting = (situation: UserSituation): string => {
  let categoryPart = "";
  if (situation.jobCategory === "취업준비생") {
    categoryPart = "소중한 취업 준비 기간을 보내며 고단하고 불안할 취업준비생님의";
  } else if (situation.jobCategory === "직장인") {
    categoryPart = "숨 가쁜 직장 생활 속에서 매일 버티고 계실 직장인님의";
  } else if (situation.jobCategory === "대학생/대학원생") {
    categoryPart = "학업과 미래에 대한 고민으로 머릿속이 꽉 찬 대학생님의";
  } else if (situation.jobCategory === "프리랜서") {
    categoryPart = "스스로 모든 것을 책임지느라 소리 없이 지쳐있을 프리랜서님의";
  } else if (situation.jobCategory === "주부") {
    categoryPart = "가족들을 챙기느라 정작 스스로의 마음은 돌보지 못했을 주부님의";
  } else if (situation.jobCategory === "휴직/퇴사 상태") {
    categoryPart = "잠시 쉼표를 찍고 소중한 다음 단계를 고심 중인 휴식기님의";
  } else if (situation.jobCategory) {
    categoryPart = `소중한 일상 속에서 고민하고 계실 ${situation.jobCategory}님의`;
  } else {
    categoryPart = "지치고 복잡한";
  }

  let agePart = "";
  if (situation.age) {
    agePart = ` 어느덧 ${situation.age}을 맞아 마주한 고민들,`;
  }

  let gapPart = "";
  if (situation.gapPeriod && situation.gapPeriod !== "없음") {
    gapPart = ` 약 ${situation.gapPeriod} 동안의 소중한 쉼 속에서 느끼는 머릿속 복잡한 감정들이 있으시겠어요.`;
  }

  return `안녕하세요! ${categoryPart} 마음을 따뜻하게 위로하고 정돈해 나가는 마음 메이트, '정신체리'입니다. 🍒\n\n${agePart || "최근 겪고 계신 불안감, 지친 일상의 마음의 과부하 상태 등"}${gapPart || " 어떤 이야기든 좋습니다."} 훈계나 지적 없이 오직 당신의 입장에서 가만히 들어드릴게요. 편안하게 마음을 털어놓아 주세요. 함께 가뿐하고 단단한 매일을 만들어 봐요!`;
};

const loadMessagesSafely = (): ChatMessage[] => {
  const defaultGreet: ChatMessage[] = [
    {
      id: "greet-1",
      role: "assistant",
      content: "안녕하세요. 당신의 지치고 복잡한 마음을 따뜻하게 안아주고 함께 차분히 정돈해 나가는 마음 메이트, '정신체리'입니다. 🍒\n\n최근 겪고 계신 불안감, 지친 일상의 갈등, 혹은 인간관계의 서운함 등 머릿속을 복잡하게 만드는 어떤 이야기든 좋습니다. 편안하게 털어놓아 주시면, 깊이 공감하고 함께 생각을 나누며 마음을 한결 가볍고 단단하게 가꾸어 드릴게요.",
      timestamp: "오전 10:00",
      stage: "EMOTIONAL"
    }
  ];

  try {
    const saved = localStorage.getItem("jc_messages");
    if (!saved) return defaultGreet;

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      console.warn("[Storage Recovery] Saved messages are not an array. Recovering.");
      return defaultGreet;
    }

    // Comprehensive structural alignment check
    const validMessages = parsed.filter((m: any) => {
      return (
        m &&
        typeof m === "object" &&
        typeof m.id === "string" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
      );
    });

    if (validMessages.length === 0) {
      return defaultGreet;
    }

    return validMessages;
  } catch (error) {
    console.error("[Storage Recovery] Error parsing saved messages, resetting cleanly:", error);
    return defaultGreet;
  }
};

const loadMissionsSafely = (): DailyMission[] => {
  const defaultMissions: DailyMission[] = [
    {
      id: "m-1",
      title: "친구 대입법",
      description: "내 고민을 아끼는 소중한 친구가 겪고 있다고 가정하고 객관적으로 조언해보기",
      status: "COMPLETED",
      activationBonus: 12,
      icon: "friend"
    },
    {
      id: "m-2",
      title: "감정 기록",
      description: "현재 느껴지는 부정적인 감정에 대해 억누르지 않고 세밀한 감정 단어로 이름 붙여보기",
      status: "ACTIVE",
      activationBonus: 8,
      icon: "record"
    },
    {
      id: "m-3",
      title: "사실과 생각 분리하기",
      description: "일어난 객관적 '사실'과 내 주관적 '왜곡된 생각'을 날카롭게 분리하여 적어보기",
      status: "PENDING",
      activationBonus: 15,
      icon: "split"
    },
    {
      id: "m-4",
      title: "생각 회로 반전시키기",
      description: "불안한 단언 끝에 '~라는 착각을 했다'라고 붙여서 선언해보기",
      status: "PENDING",
      activationBonus: 10,
      icon: "reverse"
    }
  ];

  try {
    const saved = localStorage.getItem("jc_missions");
    if (!saved) return defaultMissions;

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return defaultMissions;

    const validMissions = parsed.filter((m: any) => {
      return (
        m &&
        typeof m === "object" &&
        typeof m.id === "string" &&
        typeof m.title === "string" &&
        typeof m.description === "string" &&
        (m.status === "PENDING" || m.status === "ACTIVE" || m.status === "COMPLETED")
      );
    });

    if (validMissions.length === 0) return defaultMissions;
    return validMissions;
  } catch (error) {
    console.error("[Storage Recovery] Error parsing saved missions:", error);
    return defaultMissions;
  }
};

interface ActiveDopamineToast {
  id: string;
  text: string;
  x: number;
  y: number;
  hasTarget: boolean;
}

export default function App() {
  // Theme State ("cherry" = light, "midnight" = dark)
  const [theme, setTheme] = useState<"cherry" | "midnight">(() => {
    const saved = safeGetItem("jc_theme", "cherry");
    return (saved === "cherry" || saved === "midnight") ? saved : "cherry";
  });

  // Dopamine/Achievement toast popups
  const [dopamineToasts, setDopamineToasts] = useState<ActiveDopamineToast[]>([]);

  // Views & Tab Routing
  const [currentView, setCurrentView] = useState<"onboarding" | "dashboard">(() => {
    const saved = safeGetItem("jc_current_view", "onboarding");
    return (saved === "onboarding" || saved === "dashboard") ? saved : "onboarding";
  });
  const [activeTab, setActiveTab] = useState<"missions" | "chat" | "profile">(() => {
    const saved = safeGetItem("jc_active_tab", "missions");
    return (saved === "missions" || saved === "chat" || saved === "profile") ? saved : "missions";
  });

  // Chat & Persona States with safe defensive initializers
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    return loadMessagesSafely();
  });
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState<Stage>(() => {
    const saved = safeGetItem("jc_current_stage", "EMOTIONAL") as Stage;
    return (saved === "EMOTIONAL" || saved === "RATIONAL" || saved === "ACTIONABLE") ? saved : "EMOTIONAL";
  });

  // Mind Stats / Synchronization State
  const [syncProgress, setSyncProgress] = useState<number>(() => {
    const saved = safeGetItem("jc_sync_progress", "75");
    const parsed = parseInt(saved, 10);
    return isNaN(parsed) ? 75 : parsed;
  });
  const [showDopamineToast, setShowDopamineToast] = useState(false);
  const [inAppToast, setInAppToast] = useState<{ title: string; desc: string } | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [customConfirm, setCustomConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    requireTypedConfirmation?: string;
  } | null>(null);
  const [typedConfirmationText, setTypedConfirmationText] = useState("");
  const [completedTypedMessageIds, setCompletedTypedMessageIds] = useState<string[]>([]);

  // Browser Notifications & 30-second Breathing Exercise States
  const [isBreathingOpen, setIsBreathingOpen] = useState(false);
  const [lastCheckInTime, setLastCheckInTime] = useState<number>(() => {
    const saved = localStorage.getItem("jc_last_check_in");
    return saved ? parseInt(saved, 10) : Date.now();
  });
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return "default";
  });
  // State to support mock simulation of 4 hours
  const [simulatedTimeOffset, setSimulatedTimeOffset] = useState<number>(0);

  // Handler to update the last check-in timestamp
  const updateCheckIn = () => {
    const now = Date.now();
    setLastCheckInTime(now);
    localStorage.setItem("jc_last_check_in", now.toString());
    setSimulatedTimeOffset(0); // Reset simulation upon fresh check-in
  };

  const hasSentOverdueNotification = useRef(false);

  // Request browser Notification permission
  const requestNotificationPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === "granted") {
          setInAppToast({
            title: "🍒 마음 알림 설정 완료!",
            desc: "정신체리가 4시간 동안 체크인이 없으실 때 마음 챙김 메시지로 찾아갈게요."
          });
          
          // Send a welcome check-in notification
          new Notification("정신체리 마음 알림 🍒", {
            body: "알림 수신 설정이 완료되었습니다. 4시간 동안 쉬어가실 때 마음 정돈 메시지를 보내드립니다.",
            icon: "/favicon.ico"
          });
        }
      } catch (err) {
        console.error("Failed to request Notification permission:", err);
      }
    } else {
      setInAppToast({
        title: "⚠️ 알림 비지원 브라우저",
        desc: "현재 사용 중인 브라우저가 시스템 알림을 지원하지 않습니다."
      });
    }
  };

  useEffect(() => {
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
    
    const checkCheckInStatus = () => {
      const elapsed = Date.now() - lastCheckInTime + simulatedTimeOffset;
      if (elapsed >= FOUR_HOURS_MS && !hasSentOverdueNotification.current) {
        // Trigger browser notification if allowed
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          try {
            const notification = new Notification("정신체리 마음 챙김 알림 🍒", {
              body: "최근 4시간 동안 마음의 여유가 없으셨어요. 30초 깊은 호흡으로 전두엽을 환기하거나 오늘 기분을 기록해보세요!",
              tag: "mental-cherry-checkin",
              requireInteraction: true
            });
            
            notification.onclick = () => {
              window.focus();
              setIsBreathingOpen(true);
              notification.close();
            };
          } catch (e) {
            console.error("Failed to display system notification:", e);
          }
        }
        
        hasSentOverdueNotification.current = true;
      } else if (elapsed < FOUR_HOURS_MS) {
        // Reset if they check in or we clear simulation
        hasSentOverdueNotification.current = false;
      }
    };

    // Check immediately and then every 5 seconds
    checkCheckInStatus();
    const interval = setInterval(checkCheckInStatus, 5000);

    return () => clearInterval(interval);
  }, [lastCheckInTime, simulatedTimeOffset]);

  // Summary modal states
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Daily Missions
  const [missions, setMissions] = useState<DailyMission[]>(() => {
    return loadMissionsSafely();
  });

  // Weekly neuroscience logs
  const [weeklyLogs] = useState<WeeklyLog[]>([
    { day: "월", active: true, intensity: "high" },
    { day: "화", active: true, intensity: "medium" },
    { day: "수", active: false, intensity: "none" },
    { day: "목", active: true, intensity: "high" },
    { day: "금", active: true, intensity: "medium" },
    { day: "토", active: true, intensity: "low" },
    { day: "일", active: false, intensity: "none" }
  ]);

  // User's current neural state select state
  const [currentNeuralState, setCurrentNeuralState] = useState<"overheated" | "neutral" | "synced">(() => {
    const saved = safeGetItem("jc_current_neural_state", "neutral");
    return (saved === "overheated" || saved === "neutral" || saved === "synced") ? saved : "neutral";
  });

  // Report Download Options Modal State
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Fallback variables for removed PDF/Download functionalities to satisfy compilation
  const fileFormat = "txt" as any;
  const isGeneratingPDF = false;
  const pdfSpacingMode = "comfortable" as any;
  const includePersonalBranding = false;
  const brandingName = "";
  const isDownloadValid = false;
  const downloadOptions = {
    includeMissionSummary: false,
    includeChatHistory: false,
    emotion: false,
    rational: false,
    action: false
  };
  const setFileFormat = (val: any) => {};
  const setPdfSpacingMode = (val: any) => {};
  const setIncludePersonalBranding = (val: any) => {};
  const setBrandingName = (val: any) => {};
  const setDownloadOptions = (val: any) => {};
  const downloadSessionSummary = async () => {};

  // CBT practice clinical log state
  const [cbtLogs, setCbtLogs] = useState<CbtPracticeLog[]>(() => {
    try {
      const saved = localStorage.getItem("jc_cbt_logs");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse local CBT logs:", e);
      return [];
    }
  });

  const [selectedArchiveLog, setSelectedArchiveLog] = useState<CbtPracticeLog | null>(null);

  // Save CBT logs to localStorage when changed
  useEffect(() => {
    localStorage.setItem("jc_cbt_logs", JSON.stringify(cbtLogs));
  }, [cbtLogs]);

  // Weekly Consistency Heatmap Tracker History state
  const [completionHistory, setCompletionHistory] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("jc_completion_history");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse local completion history:", e);
    }

    // Set up a beautiful, authentic 6-day streak ending yesterday
    // and older scattered completions to show the visual heatmap immediately.
    const defaultHistory: Record<string, number> = {};
    const today = new Date();
    const formatDateStr = (date: Date): string => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    const temp = new Date(today);
    // Yesterday (1 day ago)
    temp.setDate(today.getDate() - 1);
    defaultHistory[formatDateStr(temp)] = 2;

    // 2 days ago
    temp.setDate(today.getDate() - 2);
    defaultHistory[formatDateStr(temp)] = 1;

    // 3 days ago
    temp.setDate(today.getDate() - 3);
    defaultHistory[formatDateStr(temp)] = 3;

    // 4 days ago
    temp.setDate(today.getDate() - 4);
    defaultHistory[formatDateStr(temp)] = 1;

    // 5 days ago
    temp.setDate(today.getDate() - 5);
    defaultHistory[formatDateStr(temp)] = 2;

    // 6 days ago
    temp.setDate(today.getDate() - 6);
    defaultHistory[formatDateStr(temp)] = 1;

    // Scattered history
    // 10 days ago
    temp.setDate(today.getDate() - 10);
    defaultHistory[formatDateStr(temp)] = 2;

    // 12 days ago
    temp.setDate(today.getDate() - 12);
    defaultHistory[formatDateStr(temp)] = 1;

    // 13 days ago
    temp.setDate(today.getDate() - 13);
    defaultHistory[formatDateStr(temp)] = 3;

    // 20 days ago
    temp.setDate(today.getDate() - 20);
    defaultHistory[formatDateStr(temp)] = 1;

    // 25 days ago
    temp.setDate(today.getDate() - 25);
    defaultHistory[formatDateStr(temp)] = 2;

    // 30 days ago
    temp.setDate(today.getDate() - 30);
    defaultHistory[formatDateStr(temp)] = 1;

    return defaultHistory;
  });

  // Helper to format today's date
  const getTodayDateString = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const incrementCompletionCount = (dateStr: string) => {
    setCompletionHistory(prev => {
      const updated = {
        ...prev,
        [dateStr]: (prev[dateStr] || 0) + 1
      };
      localStorage.setItem("jc_completion_history", JSON.stringify(updated));
      return updated;
    });
  };

  const decrementCompletionCount = (dateStr: string) => {
    setCompletionHistory(prev => {
      const currentVal = prev[dateStr] || 0;
      if (currentVal <= 0) return prev;
      const updated = { ...prev };
      if (currentVal <= 1) {
        delete updated[dateStr];
      } else {
        updated[dateStr] = currentVal - 1;
      }
      localStorage.setItem("jc_completion_history", JSON.stringify(updated));
      return updated;
    });
  };

  const clearCompletionHistory = () => {
    setCompletionHistory({});
    localStorage.removeItem("jc_completion_history");
  };

  // Active mission practice states
  const [activePracticeMission, setActivePracticeMission] = useState<DailyMission | null>(null);
  const [activePracticeStep, setActivePracticeStep] = useState<number>(1);
  const [practiceInputs, setPracticeInputs] = useState<Record<string, string>>({
    worry: "",
    friendAdvice: "",
    fact: "",
    opinion: "",
    granularity: "",
    anxiousAssert: "",
    reframing: ""
  });

  // User situation profile state (optional settings)
  const [userSituation, setUserSituation] = useState<UserSituation>(() => {
    try {
      const saved = localStorage.getItem("jc_user_situation");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to parse local user situation settings:", e);
    }
    return {
      jobCategory: "",
      age: "",
      gapPeriod: "",
      hatedWords: "",
      customDetails: ""
    };
  });

  // Daily Insight Popup states
  const [showDailyInsight, setShowDailyInsight] = useState(false);
  const [dailyInsightIndex, setDailyInsightIndex] = useState(0);

  // --- EMERGENCY MIND CARE TOOLKIT STATES ---
  const [toolkitTab, setToolkitTab] = useState<"instant" | "dump" | "prescription">("instant");
  
  // 1. Instant Mission States
  const [instantMission, setInstantMission] = useState<string | null>(null);
  const [isInstantCompleted, setIsInstantCompleted] = useState<boolean>(false);
  
  // 2. Thought Dump States
  const [thoughtInput, setThoughtInput] = useState<string>("");
  const [isCrumbling, setIsCrumbling] = useState<boolean>(false);
  const [isDumped, setIsDumped] = useState<boolean>(false);
  
  // 3. AI Single-Turn Prescription States
  const [prescriptionInput, setPrescriptionInput] = useState<string>("");
  const [prescriptionResult, setPrescriptionResult] = useState<{ comfort: string, action: string } | null>(null);
  const [isPrescribing, setIsPrescribing] = useState<boolean>(false);

  // Firebase Auth states
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Trigger once per day on application load
  useEffect(() => {
    try {
      const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      const lastShownDate = safeGetItem("jc_last_insight_date", "");
      if (lastShownDate !== todayStr) {
        const dayOfMonth = new Date().getDate();
        setDailyInsightIndex(dayOfMonth % dailyInsights.length);
        setShowDailyInsight(true);
        safeSetItem("jc_last_insight_date", todayStr);
      }
    } catch (e) {
      console.error("Failed to check daily insight date", e);
    }
  }, []);

  const [isStateLoaded, setIsStateLoaded] = useState(false);

  // Initialize and load state from Firestore (with localStorage fallback)
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const savedData = await loadSessionState();
        if (!active) return;
        if (savedData) {
          if (savedData.messages && savedData.messages.length > 0) {
            setMessages(savedData.messages);
          }
          if (savedData.currentStage) {
            setCurrentStage(savedData.currentStage);
          }
          if (savedData.syncProgress) {
            setSyncProgress(savedData.syncProgress);
          }
          if (savedData.missions && savedData.missions.length > 0) {
            setMissions(savedData.missions);
          }
          if (savedData.currentNeuralState) {
            setCurrentNeuralState(savedData.currentNeuralState);
          }
          if (savedData.userSituation) {
            setUserSituation(savedData.userSituation);
          }
          if (savedData.completionHistory) {
            setCompletionHistory(savedData.completionHistory);
          }
        }
      } catch (err) {
        console.error("Failed to load initial session state:", err);
      } finally {
        if (active) {
          setIsStateLoaded(true);
        }
      }
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  // Listen to Firebase Auth state changes and migrate guest data automatically on login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthLoading(true);
      if (user) {
        console.log("[Auth] User logged in:", user.email);
        setCurrentUser(user);
        
        // 1. Perform guest-to-user data migration automatically on login
        await migrateGuestToUser(user.uid);
        
        // 2. Reload session state from Firestore (since it is now synced to user UID)
        try {
          const savedData = await loadSessionState();
          if (savedData) {
            if (savedData.messages && savedData.messages.length > 0) {
              setMessages(savedData.messages);
            }
            if (savedData.currentStage) {
              setCurrentStage(savedData.currentStage);
            }
            if (savedData.syncProgress) {
              setSyncProgress(savedData.syncProgress);
            }
            if (savedData.missions && savedData.missions.length > 0) {
              setMissions(savedData.missions);
            }
            if (savedData.currentNeuralState) {
              setCurrentNeuralState(savedData.currentNeuralState);
            }
            if (savedData.userSituation) {
              setUserSituation(savedData.userSituation);
            }
            if (savedData.completionHistory) {
              setCompletionHistory(savedData.completionHistory);
            }
            if (savedData.cbtLogs) {
              setCbtLogs(savedData.cbtLogs);
            }
          }
        } catch (err) {
          console.error("Failed to load session state after login:", err);
        }
      } else {
        console.log("[Auth] No user logged in.");
        setCurrentUser(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        setInAppToast({
          title: "구글 로그인 성공 🍒",
          desc: `${result.user.displayName || result.user.email}님 환영합니다! 기존 게스트 상담 데이터가 계정으로 안전하게 마이그레이션되었습니다.`
        });
      }
    } catch (err) {
      console.error("Google login error:", err);
      setInAppToast({
        title: "로그인 실패",
        desc: "구글 소셜 로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요."
      });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // Clear local keys to guarantee reset
      localStorage.removeItem("jc_session_id");
      localStorage.removeItem("jc_messages");
      localStorage.removeItem("jc_current_stage");
      localStorage.removeItem("jc_sync_progress");
      localStorage.removeItem("jc_missions");
      localStorage.removeItem("jc_current_neural_state");
      localStorage.removeItem("jc_user_situation");
      localStorage.removeItem("jc_completion_history");
      localStorage.removeItem("jc_cbt_logs");
      
      // Reload page to start with fresh guest session
      window.location.reload();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  // Sync state changes to localStorage reactively (backup layer for UI settings)
  useEffect(() => {
    safeSetItem("jc_theme", theme);
  }, [theme]);

  useEffect(() => {
    safeSetItem("jc_current_view", currentView);
  }, [currentView]);

  useEffect(() => {
    safeSetItem("jc_active_tab", activeTab);
  }, [activeTab]);

  // Reset custom confirmation text input when modal opens or closes
  useEffect(() => {
    if (customConfirm) {
      setTypedConfirmationText("");
    }
  }, [customConfirm]);

  // Auto-dismiss in-app toast
  useEffect(() => {
    if (inAppToast) {
      const timer = setTimeout(() => {
        setInAppToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [inAppToast]);

  // Reactively synchronize core data state changes to Firestore and LocalStorage
  useEffect(() => {
    if (!isStateLoaded) return;
    
    saveSessionState({
      messages,
      currentStage,
      syncProgress,
      missions,
      currentNeuralState,
      userSituation,
      completionHistory,
      cbtLogs
    });
  }, [isStateLoaded, messages, currentStage, syncProgress, missions, currentNeuralState, userSituation, completionHistory, cbtLogs]);

  // Handler to record neural state and update synchronization progress dynamically
  const handleSelectNeuralState = (state: "overheated" | "neutral" | "synced") => {
    updateCheckIn();
    setCurrentNeuralState(state);
    let newSync = 68;
    if (state === "overheated") newSync = 35;
    else if (state === "neutral") newSync = 68;
    else if (state === "synced") newSync = 95;
    setSyncProgress(newSync);
  };

  // Dynamic mood/synchronization trend data based on syncProgress and currentNeuralState
  const moodTrendData = [
    { name: "월", sync: 55, mood: "감정 과부하" },
    { name: "화", sync: 60, mood: "기분 살피기" },
    { name: "수", sync: 58, mood: "일시적 저하" },
    { name: "목", sync: 65, mood: "객관적 자각" },
    { name: "금", sync: 72, mood: "이성 회복" },
    { name: "토", sync: Math.min(syncProgress, 82), mood: "생각 조율" },
    { 
      name: "일", 
      sync: syncProgress, 
      mood: currentNeuralState === "overheated" 
        ? "감정 과부하" 
        : currentNeuralState === "neutral" 
          ? "생각 균형" 
          : "마음 안정" 
    }
  ];

  // Generate dynamic 5-week mission completion statistics from completionHistory
  const weeklyAchievementData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    for (let i = 4; i >= 0; i--) {
      const endDay = new Date(today);
      endDay.setDate(today.getDate() - i * 7);
      
      const startDay = new Date(today);
      startDay.setDate(today.getDate() - i * 7 - 6);
      
      // Calculate active days and total completions in this 7-day window
      let weekCompletions = 0;
      let weekActiveDays = 0;
      
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const tempD = new Date(startDay);
        tempD.setDate(startDay.getDate() + dayOffset);
        
        const y = tempD.getFullYear();
        const m = String(tempD.getMonth() + 1).padStart(2, "0");
        const d = String(tempD.getDate()).padStart(2, "0");
        const dateKey = `${y}-${m}-${d}`;
        
        const count = completionHistory[dateKey] || 0;
        if (count > 0) {
          weekCompletions += count;
          weekActiveDays += 1;
        }
      }
      
      // Target is 4 completed missions per week for 100% achievement rate
      const targetCompletions = 4;
      const rate = Math.min(100, Math.round((weekCompletions / targetCompletions) * 100));
      
      const startFormatted = `${startDay.getMonth() + 1}/${startDay.getDate()}`;
      const endFormatted = `${endDay.getMonth() + 1}/${endDay.getDate()}`;
      
      let label = `${i}주 전`;
      if (i === 0) label = "이번 주";
      
      data.push({
        name: label,
        period: `${startFormatted} ~ ${endFormatted}`,
        rate,
        completions: weekCompletions,
        activeDays: weekActiveDays,
      });
    }
    
    return data;
  }, [completionHistory]);

  const currentWeekHeatmap = useMemo(() => {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0: Sun, 1: Mon, ...
    
    // Find the Monday of the current week (Monday as start of week)
    const daysToSubtract = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToSubtract);
    
    const weekDays = [];
    const dayNames = ["월", "화", "수", "목", "금", "토", "일"];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dateD = String(d.getDate()).padStart(2, "0");
      const dateKey = `${y}-${m}-${dateD}`;
      
      const count = completionHistory[dateKey] || 0;
      const isToday = dateKey === getTodayDateString();
      
      weekDays.push({
        dayName: dayNames[i],
        dateLabel: `${d.getMonth() + 1}/${d.getDate()}`,
        dateKey,
        count,
        isToday,
      });
    }
    
    return weekDays;
  }, [completionHistory]);

  // Chat Auto-Scroll Ref
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Function to automatically scroll to bottom when message is added
  const scrollToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    // Scroll to bottom every time messages or loading states change
    scrollToBottom();
  }, [messages, isLoading]);

  // Send Message logic
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    updateCheckIn();
    const userMsgId = `user-${Date.now()}`;
    const now = new Date();
    const timestampStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

    const userMessage: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: inputValue,
      timestamp: timestampStr,
      stage: currentStage
    };

    const nextMessagesWithUser = [...messages, userMessage];
    setMessages(nextMessagesWithUser);
    safeSetItem("jc_messages", JSON.stringify(nextMessagesWithUser));
    
    setInputValue("");
    setIsLoading(true);

    try {
      // API call to Express /api/chat backend
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: nextMessagesWithUser.map(m => ({
            role: m.role,
            content: m.content
          })),
          userContext: {
            currentStage,
            syncProgress,
            userSituation
          }
        })
      });

      if (!response.ok) {
        throw new Error("서버와의 통신에 실패했습니다.");
      }

      const data = await response.json();
      
      const assistantMsgId = `cherry-${Date.now()}`;
      const cherryMessage: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: data.response,
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
        stage: data.stage || currentStage,
        card: data.card || null
      };

      const finalMessages = [...nextMessagesWithUser, cherryMessage];
      setMessages(finalMessages);
      safeSetItem("jc_messages", JSON.stringify(finalMessages));
      
      if (data.stage) {
        setCurrentStage(data.stage);
        safeSetItem("jc_current_stage", data.stage);
        
        // Slowly increase synchronization progress to give a gamified satisfying experience
        let nextSync = syncProgress;
        if (data.stage === "RATIONAL" && syncProgress < 85) {
          nextSync = 83;
        } else if (data.stage === "ACTIONABLE" && syncProgress < 95) {
          nextSync = 92;
        }
        if (nextSync !== syncProgress) {
          setSyncProgress(nextSync);
          safeSetItem("jc_sync_progress", nextSync.toString());
        }
      }

    } catch (error) {
      console.error("Error sending message:", error);
      const errorMsgId = `err-${Date.now()}`;
      const cherryErrorMessage: ChatMessage = {
        id: errorMsgId,
        role: "assistant",
        content: "죄송합니다. 이야기방 연결에 잠시 오류가 발생했어요. 잠시 후 다시 마음을 편하게 들려주세요! 🍒",
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
        stage: currentStage
      };
      
      const errorMessages = [...nextMessagesWithUser, cherryErrorMessage];
      setMessages(errorMessages);
      safeSetItem("jc_messages", JSON.stringify(errorMessages));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarizeChat = async () => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    setShowSummaryModal(true);
    setSummaryText(null);

    try {
      const response = await fetch("/api/summarize-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        throw new Error("요약 가져오기 실패");
      }

      const data = await response.json();
      setSummaryText(data.summary);
    } catch (error) {
      console.warn("Error summarizing chat:", error);
      setSummaryText("죄송합니다. 마음 핵심 요약을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요! 🍒");
    } finally {
      setIsLoading(false);
      setIsSummarizing(false);
    }
  };

  // Reset conversation & delete Firestore document explicitly (for privacy & security)
  const handleResetChat = () => {
    setCustomConfirm({
      isOpen: true,
      title: "상담 기록 및 프라이버시 완전 삭제",
      message: "정신체리와의 모든 상담 내용, 대화 기록, 행동치료 일지, 미션 진행도가 서버(Firebase Firestore)와 기기에서 흔적 없이 '영구적으로 명시적 삭제'됩니다. 정말 삭제하시겠습니까?",
      confirmText: "예, 영구 삭제합니다",
      cancelText: "취소",
      isDanger: true,
      requireTypedConfirmation: "동의합니다",
      onConfirm: async () => {
        setIsLoading(true);
        try {
          // 1. Explicitly delete Firestore documents (both user & guest sessions if exists) and clear localStorage keys
          await deleteSessionState();

          // 2. Safely re-initialize all React states to default/empty values to prevent trace leakage
          const defaultGreet: ChatMessage[] = [
            {
              id: "greet-1",
              role: "assistant",
              content: "대화가 새로 정돈되었습니다. 언제든지 준비가 되셨을 때 마음속에 얽힌 고민이나 이야기를 편하게 들려주세요. 차근차근 따뜻하게 들어드릴게요! 🍒",
              timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
              stage: "EMOTIONAL"
            }
          ];

          setMessages(defaultGreet);
          setCurrentStage("EMOTIONAL");
          setSyncProgress(75);
          setCurrentNeuralState("neutral");
          
          const defaultMissions: DailyMission[] = [
            {
              id: "m-1",
              title: "친구 대입법",
              description: "내 고민을 아끼는 소중한 친구가 겪고 있다고 가정하고 객관적으로 조언해보기",
              status: "COMPLETED",
              activationBonus: 12,
              icon: "friend"
            },
            {
              id: "m-2",
              title: "감정 기록",
              description: "현재 느껴지는 부정적인 감정에 대해 억누르지 않고 세밀한 감정 단어로 이름 붙여보기",
              status: "ACTIVE",
              activationBonus: 8,
              icon: "record"
            },
            {
              id: "m-3",
              title: "사실과 생각 분리하기",
              description: "일어난 객관적 '사실'과 내 주관적 '왜곡된 생각'을 날카롭게 분리하여 적어보기",
              status: "PENDING",
              activationBonus: 15,
              icon: "split"
            },
            {
              id: "m-4",
              title: "생각 회로 반전시키기",
              description: "불안한 단언 끝에 '~라는 착각을 했다'라고 붙여서 선언해보기",
              status: "PENDING",
              activationBonus: 10,
              icon: "reverse"
            }
          ];
          setMissions(defaultMissions);
          
          setUserSituation({
            jobCategory: "",
            age: "",
            gapPeriod: "",
            hatedWords: "",
            customDetails: ""
          });
          
          setCompletionHistory({});
          setCbtLogs([]);
          setSummaryText(null);
          setCurrentView("onboarding");
          setActiveTab("missions");

          // 3. Set the clean initial defaults in localStorage for next load
          safeSetItem("jc_messages", JSON.stringify(defaultGreet));
          safeSetItem("jc_current_stage", "EMOTIONAL");
          safeSetItem("jc_sync_progress", "75");
          safeSetItem("jc_current_neural_state", "neutral");
          safeSetItem("jc_missions", JSON.stringify(defaultMissions));
          safeSetItem("jc_current_view", "onboarding");
          safeSetItem("jc_active_tab", "missions");

          // 4. Fire a beautiful toast confirming complete deletion
          setInAppToast({
            title: "보안 삭제 및 초기화 완료 🍒",
            desc: "사용자님의 대화 및 일지 데이터가 서버와 로컬 기기에서 완전히 안전하게 소멸되었습니다."
          });
        } catch (err) {
          console.error("Critical error during counseling record reset:", err);
          setInAppToast({
            title: "초기화 실패",
            desc: "서버 삭제 중 오류가 발생했으나 기기 데이터는 보호 조치 되었습니다."
          });
        } finally {
          setIsLoading(false);
        }
      }
    });
  };

  // Complete a mission via direct manual toggle (fallback option)
  const handleDirectCompleteMission = (id: string) => {
    updateCheckIn();
    setMissions(prev => prev.map(m => {
      if (m.id === id) {
        const nextStatus = m.status === "COMPLETED" ? "ACTIVE" : "COMPLETED";
        
        if (nextStatus === "COMPLETED") {
          setSyncProgress(p => Math.min(100, p + m.activationBonus));
          const element = document.getElementById(`mission-card-${id}`);
          triggerDopamineConfetti(element);
          setInAppToast({
            title: `🍒 '${m.title}' 미션 완료!`,
            desc: `스스로 마음을 가꾸는 미션을 실천하여, 마음 밸런스 회복 지표가 +${m.activationBonus}%만큼 든든해졌습니다!`
          });
          incrementCompletionCount(getTodayDateString());
        } else {
          setSyncProgress(p => Math.max(0, p - m.activationBonus));
          decrementCompletionCount(getTodayDateString());
        }

        return { ...m, status: nextStatus };
      }
      return m;
    }));
    setActivePracticeMission(null);
  };

  // Complete a mission through interactive CBT Clinical Practice modal
  const handleCompleteCbtPractice = () => {
    if (!activePracticeMission) return;

    updateCheckIn();
    // Create new CBT practice log entry
    const newLog: CbtPracticeLog = {
      id: `cbt-${Date.now()}`,
      missionId: activePracticeMission.id,
      missionTitle: activePracticeMission.title,
      timestamp: new Date().toLocaleString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      inputs: { ...practiceInputs }
    };

    // Prepend to logs
    setCbtLogs(prev => [newLog, ...prev]);

    // Set mission as completed
    setMissions(prev => prev.map(m => {
      if (m.id === activePracticeMission.id) {
        if (m.status !== "COMPLETED") {
          setSyncProgress(p => Math.min(100, p + m.activationBonus));
          const element = document.getElementById(`mission-card-${activePracticeMission.id}`);
          triggerDopamineConfetti(element);
          setInAppToast({
            title: `🍒 '${m.title}' 실천 클리닉 완료!`,
            desc: `훌륭합니다! 마음 다듬기 연습을 진지하게 완료하셨습니다. 회복 지표가 +${m.activationBonus}%만큼 상승하였으며, 실천 일지에 기록되었습니다.`
          });
          incrementCompletionCount(getTodayDateString());
        }
        return { ...m, status: "COMPLETED" as const };
      }
      return m;
    }));

    // Reset states
    setActivePracticeMission(null);
    setActivePracticeStep(1);
    setPracticeInputs({
      worry: "",
      friendAdvice: "",
      fact: "",
      opinion: "",
      granularity: "",
      anxiousAssert: "",
      reframing: ""
    });
  };

  // Delete a specific CBT practice log entry
  const handleDeleteCbtLog = (logId: string, e: any) => {
    e.stopPropagation();
    setCustomConfirm({
      isOpen: true,
      title: "기록 삭제",
      message: "이 실천 일지 기록을 영구히 삭제하시겠습니까?",
      confirmText: "삭제하기",
      cancelText: "취소",
      isDanger: true,
      onConfirm: () => {
        setCbtLogs(prev => prev.filter(log => log.id !== logId));
      }
    });
  };

  // Click on a mission to either cancel completion or launch interactive CBT Clinic
  const handleToggleMission = (id: string) => {
    const mission = missions.find(m => m.id === id);
    if (!mission) return;

    if (mission.status === "COMPLETED") {
      setCustomConfirm({
        isOpen: true,
        title: "미션 완료 취소",
        message: `'${mission.title}' 미션 완료 상태를 취소하시겠습니까? (회복 지표가 회수됩니다)`,
        confirmText: "미션 취소하기",
        cancelText: "유지하기",
        isDanger: true,
        onConfirm: () => {
          setMissions(prev => prev.map(m => {
            if (m.id === id) {
              setSyncProgress(p => Math.max(0, p - m.activationBonus));
              decrementCompletionCount(getTodayDateString());
              return { ...m, status: "ACTIVE" as const };
            }
            return m;
          }));
        }
      });
    } else {
      // Launch CBT clinical wizard
      setActivePracticeMission(mission);
      setActivePracticeStep(1);
      setPracticeInputs({
        worry: "",
        friendAdvice: "",
        fact: "",
        opinion: "",
        granularity: "",
        anxiousAssert: "",
        reframing: ""
      });
    }
  };

  const handleCompleteMissionDirectly = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card container toggle event
    const mission = missions.find(m => m.id === id);
    if (!mission || mission.status === "COMPLETED") return;

    updateCheckIn();
    setMissions(prev => prev.map(m => {
      if (m.id === id) {
        if (m.status !== "COMPLETED") {
          setSyncProgress(p => Math.min(100, p + m.activationBonus));
          const element = document.getElementById(`mission-card-${id}`) || (e.currentTarget as HTMLElement);
          triggerDopamineConfetti(element);
          setInAppToast({
            title: `🍒 '${m.title}' 실천 완료!`,
            desc: `축하합니다! 연습을 마친 후 오늘의 미션을 즉시 완료하셨습니다. 회복 지표가 +${m.activationBonus}%만큼 상승하였습니다.`
          });
          incrementCompletionCount(getTodayDateString());
        }
        return { ...m, status: "COMPLETED" as const };
      }
      return m;
    }));
  };

  // --- EMERGENCY MIND CARE TOOLKIT HANDLERS ---
  const handleGetInstantMission = () => {
    let randomMission = "";
    // Avoid selecting the exact same mission if possible
    do {
      const idx = Math.floor(Math.random() * instantMissionsList.length);
      randomMission = instantMissionsList[idx];
    } while (randomMission === instantMission && instantMissionsList.length > 1);
    
    setInstantMission(randomMission);
    setIsInstantCompleted(false);
  };

  const handleCompleteInstantMission = (e: React.MouseEvent) => {
    setIsInstantCompleted(true);
    setSyncProgress(prev => Math.min(100, prev + 1)); // minor activation
    incrementCompletionCount(getTodayDateString());
    
    // Confetti!
    triggerDopamineConfetti(e.currentTarget);

    setInAppToast({
      title: "🎉 1초 미션 실천 완료!",
      desc: "훌륭해요! 간단한 신체 움직임과 호흡만으로도 전두엽 활력 신호가 자극되었습니다."
    });
  };

  const handleEmptyThoughtDump = () => {
    if (!thoughtInput.trim()) return;
    setIsCrumbling(true);
    setTimeout(() => {
      setThoughtInput("");
      setIsCrumbling(false);
      setIsDumped(true);
      setSyncProgress(prev => Math.min(100, prev + 1));
      
      setInAppToast({
        title: "🗑️ 생각 쓰레기통 청소 완료!",
        desc: "복잡하고 불안했던 생각을 이곳에 깨끗이 비워냈습니다. 가뿐해진 마음을 느껴보세요."
      });
    }, 900);
  };

  const handleGetPrescription = async () => {
    if (!prescriptionInput.trim()) return;
    setIsPrescribing(true);
    setPrescriptionResult(null);
    try {
      const response = await fetch("/api/prescription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ situation: prescriptionInput })
      });
      if (!response.ok) {
        throw new Error("AI prescription API returned non-200");
      }
      const data = await response.json();
      setPrescriptionResult(data);
      setSyncProgress(prev => Math.min(100, prev + 2)); // 2% activation
      incrementCompletionCount(getTodayDateString());
      
      setInAppToast({
        title: "🍒 처방전 조제 완료!",
        desc: "정신체리가 제안하는 공감과 구체적인 1초 행동 처방전이 조제되었습니다!"
      });
    } catch (error) {
      console.error("AI Prescription error:", error);
      setInAppToast({
        title: "😢 조제 지연 발생",
        desc: "일시적으로 처방전 조제가 지연되고 있습니다. 잠시 후 다시 조제해 보세요."
      });
    } finally {
      setIsPrescribing(false);
    }
  };

  // Start chat directly from Onboarding card click or button
  const startCounseling = () => {
    setCurrentView("dashboard");
    setActiveTab("chat");
    
    // Personalize the initial greeting if first time and profile is configured
    if (messages.length === 1 && messages[0].id === "greet-1") {
      const hasSituation = userSituation.jobCategory || userSituation.age || userSituation.gapPeriod || userSituation.customDetails;
      if (hasSituation) {
        const personalizedContent = getPersonalizedGreeting(userSituation);
        const updatedMsg = {
          ...messages[0],
          content: personalizedContent
        };
        setMessages([updatedMsg]);
        localStorage.setItem("jc_messages", JSON.stringify([updatedMsg]));
      }
    }
  };

  // Trigger fun dopamine confetti animation
  const triggerDopamineConfetti = (target?: HTMLElement | null | { x: number; y: number }) => {
    // Generate a rewarding achievement toast
    const phrases = [
      "🍒 마음 다스리기 성공! 정말 대단해요!",
      "✨ 뇌가 차분하고 맑아지는 중!",
      "🎉 완벽하게 실천하셨습니다!",
      "💖 나를 아끼는 멋진 한 걸음!",
      "🌱 전두엽 마음 근육이 단단해졌어요!",
      "🌟 오늘의 소중한 마음 성장 완료!",
      "🚀 긍정 회로 연동에 성공했습니다!",
      "🍀 꾸준히 나아가는 당신이 자랑스러워요!"
    ];
    const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];

    let pxX = window.innerWidth / 2;
    let pxY = window.innerHeight * 0.3; // Default center-ish
    let hasTarget = false;

    if (target) {
      hasTarget = true;
      if ("x" in target && "y" in target) {
        pxX = target.x * window.innerWidth;
        pxY = target.y * window.innerHeight;
      } else if (target instanceof HTMLElement) {
        const rect = target.getBoundingClientRect();
        pxX = rect.left + rect.width / 2;
        pxY = rect.top; // Top of the element
      }
    }

    const toastId = `dopamine-toast-${Date.now()}-${Math.random()}`;
    const newToast: ActiveDopamineToast = {
      id: toastId,
      text: randomPhrase,
      x: pxX,
      y: pxY,
      hasTarget
    };

    setDopamineToasts(prev => [...prev, newToast]);

    // Automatically remove after 1.5 seconds (1500ms)
    setTimeout(() => {
      setDopamineToasts(prev => prev.filter(t => t.id !== toastId));
    }, 1500);

    let originX = 0.5;
    let originY = 0.6; // Slightly below center by default

    if (target) {
      if ("x" in target && "y" in target) {
        originX = target.x;
        originY = target.y;
      } else if (target instanceof HTMLElement) {
        const rect = target.getBoundingClientRect();
        originX = (rect.left + rect.width / 2) / window.innerWidth;
        originY = (rect.top + rect.height / 2) / window.innerHeight;
      }
    }

    // Keep origin within reasonable viewport limits
    originX = Math.max(0.1, Math.min(0.9, originX));
    originY = Math.max(0.1, Math.min(0.9, originY));

    // If a specific target was passed, trigger a beautiful localized 3D firework fountain/burst
    if (target) {
      const themeColors = ["#f43f5e", "#fb7185", "#34d399", "#38bdf8", "#fbbf24", "#a855f7", "#ec4899", "#ffffff"];

      // Stage 1: The Initial Spark Fountain (shoots up)
      confetti({
        particleCount: 25,
        angle: 90,
        spread: 30,
        startVelocity: 25,
        origin: { x: originX, y: originY },
        colors: ["#ffffff", "#fef08a", "#fb7185"],
        gravity: 1.1,
        ticks: 80,
      });

      // Stage 2: The Core Firework Burst (slightly higher, wider, colorful)
      setTimeout(() => {
        confetti({
          particleCount: 45,
          angle: 90,
          spread: 65,
          startVelocity: 30,
          origin: { x: originX, y: Math.max(0.05, originY - 0.12) }, // burst higher than source
          colors: themeColors,
          gravity: 0.8,
          ticks: 120,
        });
      }, 150);

      // Stage 3: The Wide Ambient Glitter (very high, slow drift)
      setTimeout(() => {
        confetti({
          particleCount: 30,
          angle: 90,
          spread: 100,
          startVelocity: 18,
          origin: { x: originX, y: Math.max(0.05, originY - 0.22) },
          colors: ["#fbbf24", "#f59e0b", "#fffbeb", "#34d399", "#38bdf8"],
          gravity: 0.6,
          scalar: 1.2,
          ticks: 150,
        });
      }, 300);

      // Stage 4: Starry sparkles
      try {
        setTimeout(() => {
          confetti({
            particleCount: 20,
            angle: 90,
            spread: 80,
            startVelocity: 15,
            origin: { x: originX, y: Math.max(0.05, originY - 0.18) },
            colors: ["#fbbf24", "#ffffff", "#f43f5e"],
            shapes: ["star"],
            gravity: 0.5,
            ticks: 100,
          });
        }, 450);
      } catch (e) {
        // Star shapes fallback
      }
    } else {
      // 1. 기본 양쪽 대포 연사 (약 2.5초간 지속)
      const duration = 2.5 * 1000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 6,
          angle: 60,
          spread: 65,
          origin: { x: 0, y: 0.8 },
          colors: ["#ba1340", "#f43f5e", "#fb7185", "#38bdf8", "#34d399", "#fbbf24", "#a855f7", "#ec4899"],
          ticks: 200
        });
        confetti({
          particleCount: 6,
          angle: 120,
          spread: 65,
          origin: { x: 1, y: 0.8 },
          colors: ["#ba1340", "#f43f5e", "#fb7185", "#38bdf8", "#34d399", "#fbbf24", "#a855f7", "#ec4899"],
          ticks: 200
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();

      // 2. 즉각적인 대형 중앙 폭발 (Center Burst)
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { x: 0.5, y: 0.6 },
        colors: ["#ff0055", "#ff5500", "#ffcc00", "#33ccff", "#33ff99", "#b366ff", "#ff66cc"]
      });

      // 3. 지연 효과로 순차적으로 터지는 화려한 사방 폭죽 (Fireworks)
      const fireworkColors = ["#ff0055", "#ffcc00", "#33ccff", "#33ff99", "#b366ff"];
      
      // 0.2초 후 좌상단 폭발
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 45,
          spread: 80,
          origin: { x: 0.2, y: 0.4 },
          colors: fireworkColors
        });
      }, 200);

      // 0.4초 후 우상단 폭발
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 135,
          spread: 80,
          origin: { x: 0.8, y: 0.4 },
          colors: fireworkColors
        });
      }, 400);

      // 0.6초 후 정중앙 고공 폭발
      setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 120,
          origin: { x: 0.5, y: 0.3 },
          colors: ["#fb7185", "#38bdf8", "#fbbf24", "#ffffff"]
        });
      }, 600);

      // 4. 별(star) 데코레이션 효과가 추가되어 더욱 축하 분위기를 극대화
      try {
        setTimeout(() => {
          confetti({
            particleCount: 50,
            spread: 70,
            origin: { x: 0.5, y: 0.5 },
            colors: ["#fbbf24", "#f59e0b", "#fffbeb", "#a855f7"],
            shapes: ["star"]
          });
        }, 800);
      } catch (e) {
        // Ignore fallback
      }
    }
  };

  const isOverdue = (Date.now() - lastCheckInTime + simulatedTimeOffset) >= 4 * 60 * 60 * 1000;

  return (
    <div className={`w-full min-h-screen flex flex-col items-center selection:bg-rose-100 selection:text-rose-900 overflow-x-hidden pb-10 transition-colors duration-500 ${
      theme === "midnight" ? "bg-neutral-950 text-neutral-100" : "bg-neutral-50 text-neutral-900"
    }`}>
      {/* Premium In-App Toast Notification */}
      <AnimatePresence>
        {inAppToast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm px-4 sm:px-0 pointer-events-auto"
          >
            <div className={`flex items-start gap-3 p-4 rounded-2xl shadow-xl border backdrop-blur-md ${
              theme === "midnight" 
                ? "bg-neutral-900/95 border-emerald-500/30 text-neutral-100 shadow-emerald-950/20" 
                : "bg-white/95 border-emerald-200 text-neutral-900 shadow-emerald-100"
            }`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500/10 text-emerald-500 flex-shrink-0 animate-bounce">
                <Sparkles className="w-4 h-4 fill-emerald-500/20" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold font-display flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  {inAppToast.title}
                </h4>
                <p className={`text-[10px] leading-relaxed mt-1 font-medium ${
                  theme === "midnight" ? "text-neutral-300" : "text-neutral-600"
                }`}>
                  {inAppToast.desc}
                </p>
              </div>
              <button 
                onClick={() => setInAppToast(null)}
                className={`p-1 rounded-full transition-colors ${
                  theme === "midnight" ? "hover:bg-neutral-800 text-neutral-400" : "hover:bg-neutral-100 text-neutral-500"
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
 
      {/* Download Options Selection Modal */}
      <AnimatePresence>
        {showDownloadModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDownloadModal(false)}
              className="absolute inset-0 bg-neutral-950"
            />
            
            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={`relative w-full max-w-md rounded-3xl border shadow-2xl p-6 overflow-hidden ${
                theme === "midnight" 
                  ? "bg-neutral-900 border-neutral-800 text-neutral-100" 
                  : "bg-white border-neutral-100 text-neutral-900"
              }`}
            >
              {/* Decorative top blur */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${
                    theme === "midnight" ? "bg-rose-950/40 text-rose-400" : "bg-rose-50 text-rose-600"
                  }`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base">리포트 다운로드 설정</h3>
                    <p className={`text-[10px] ${theme === "midnight" ? "text-neutral-400" : "text-neutral-500"}`}>
                      저장할 파일 형식과 다운로드할 영역을 선택해 주세요
                    </p>
                  </div>
                </div>
                <button
                  disabled={isGeneratingPDF}
                  onClick={() => setShowDownloadModal(false)}
                  className={`p-1.5 rounded-full transition-colors ${
                    isGeneratingPDF ? "opacity-30 cursor-not-allowed" : ""
                  } ${
                    theme === "midnight" ? "hover:bg-neutral-800 text-neutral-400" : "hover:bg-neutral-100 text-neutral-500"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* File Format Selection */}
              <div className="mb-5 relative z-10">
                <label className={`block text-[10px] font-bold mb-2 uppercase tracking-wider ${
                  theme === "midnight" ? "text-neutral-400" : "text-neutral-500"
                }`}>
                  파일 저장 형식
                </label>
                <div className={`grid grid-cols-2 gap-2 p-1 rounded-xl ${
                  theme === "midnight" ? "bg-neutral-800/60" : "bg-neutral-100/80"
                }`}>
                  <button
                    type="button"
                    disabled={isGeneratingPDF}
                    onClick={() => setFileFormat("txt")}
                    className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isGeneratingPDF ? "opacity-50 cursor-not-allowed" : ""
                    } ${
                      fileFormat === "txt"
                        ? theme === "midnight"
                          ? "bg-neutral-700 text-white shadow-sm"
                          : "bg-white text-neutral-900 shadow-sm"
                        : theme === "midnight"
                          ? "text-neutral-400 hover:text-neutral-200"
                          : "text-neutral-500 hover:text-neutral-800"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-500" />
                    <span>텍스트 파일 (.txt)</span>
                  </button>
                  <button
                    type="button"
                    disabled={isGeneratingPDF}
                    onClick={() => setFileFormat("pdf")}
                    className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isGeneratingPDF ? "opacity-50 cursor-not-allowed" : ""
                    } ${
                      fileFormat === "pdf"
                        ? theme === "midnight"
                          ? "bg-neutral-700 text-white shadow-sm"
                          : "bg-white text-neutral-900 shadow-sm"
                        : theme === "midnight"
                          ? "text-neutral-400 hover:text-neutral-200"
                          : "text-neutral-500 hover:text-neutral-800"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-500" />
                    <span>PDF 리포트 (.pdf)</span>
                  </button>
                </div>
              </div>

              {/* Spacing / Layout Mode Option (Only shown for PDF format) */}
              {fileFormat === "pdf" && (
                <div className="mb-5 relative z-10">
                  <label className={`block text-[10px] font-bold mb-2 uppercase tracking-wider ${
                    theme === "midnight" ? "text-neutral-400" : "text-neutral-500"
                  }`}>
                    PDF 레이아웃 여백 설정
                  </label>
                  <div className={`grid grid-cols-2 gap-2 p-1 rounded-xl ${
                    theme === "midnight" ? "bg-neutral-800/60" : "bg-neutral-100/80"
                  }`}>
                    <button
                      type="button"
                      disabled={isGeneratingPDF}
                      onClick={() => setPdfSpacingMode("comfortable")}
                      className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isGeneratingPDF ? "opacity-50 cursor-not-allowed" : ""
                      } ${
                        pdfSpacingMode === "comfortable"
                          ? theme === "midnight"
                            ? "bg-neutral-700 text-white shadow-sm"
                            : "bg-white text-neutral-900 shadow-sm"
                          : theme === "midnight"
                            ? "text-neutral-400 hover:text-neutral-200"
                            : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      <span className="text-sm">🌸</span>
                      <span>여유롭게 (Comfortable)</span>
                    </button>
                    <button
                      type="button"
                      disabled={isGeneratingPDF}
                      onClick={() => setPdfSpacingMode("compact")}
                      className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isGeneratingPDF ? "opacity-50 cursor-not-allowed" : ""
                      } ${
                        pdfSpacingMode === "compact"
                          ? theme === "midnight"
                            ? "bg-neutral-700 text-white shadow-sm"
                            : "bg-white text-neutral-900 shadow-sm"
                          : theme === "midnight"
                            ? "text-neutral-400 hover:text-neutral-200"
                            : "text-neutral-500 hover:text-neutral-800"
                      }`}
                    >
                      <span className="text-sm">⚡</span>
                      <span>촘촘하게 (Compact)</span>
                    </button>
                  </div>
                  <p className={`text-[9px] mt-1.5 px-1 leading-relaxed ${
                    theme === "midnight" ? "text-neutral-400" : "text-neutral-500"
                  }`}>
                    {pdfSpacingMode === "comfortable" 
                      ? "🍒 넉넉한 여백과 표준 글자 크기로 가독성이 높은 표준 리포트를 생성합니다." 
                      : "🍒 좁은 여백과 축소된 글자 크기로 더 많은 내용을 한눈에 요약해 생성합니다."}
                  </p>
                </div>
              )}

              {/* Personal Branding Settings Option (Only shown for PDF format) */}
              {fileFormat === "pdf" && (
                <div className="mb-5 relative z-10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5 pr-4">
                      <label className={`block text-[10px] font-bold uppercase tracking-wider ${
                        theme === "midnight" ? "text-neutral-400" : "text-neutral-500"
                      }`}>
                        개인 브랜드 설정 (Branding)
                      </label>
                      <span className={`text-[9px] leading-tight ${theme === "midnight" ? "text-neutral-400" : "text-neutral-500"}`}>
                        리포트 상단에 이름 및 브랜드 마크를 추가합니다
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isGeneratingPDF}
                      onClick={() => setIncludePersonalBranding(!includePersonalBranding)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isGeneratingPDF ? "opacity-50 cursor-not-allowed" : ""
                      } ${
                        includePersonalBranding ? "bg-rose-500" : "bg-neutral-300 dark:bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          includePersonalBranding ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {includePersonalBranding && (
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          type="text"
                          disabled={isGeneratingPDF}
                          value={brandingName}
                          onChange={(e) => setBrandingName(e.target.value.slice(0, 20))}
                          placeholder="표시할 이름 또는 브랜드명을 입력하세요 (최대 20자)"
                          className={`w-full text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-1 transition-all ${
                            theme === "midnight"
                              ? "bg-neutral-800 border-neutral-700 text-white focus:border-rose-500 focus:ring-rose-500"
                              : "bg-white border-neutral-200 text-neutral-800 focus:border-rose-400 focus:ring-rose-400"
                          }`}
                        />
                      </div>
                      <p className={`text-[9px] px-1 leading-relaxed ${
                        theme === "midnight" ? "text-neutral-400" : "text-neutral-500"
                      }`}>
                        🍒 리포트 상단에 맞춤 로고 영역과 입력하신 이름/브랜드가 함께 표시됩니다.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Report Components Selection Toggle Switches */}
              <div className="mb-5 relative z-10 space-y-2.5">
                <label className={`block text-[10px] font-bold mb-1 uppercase tracking-wider ${
                  theme === "midnight" ? "text-neutral-400" : "text-neutral-500"
                }`}>
                  리포트 구성 요소 선택
                </label>
                
                {/* Toggle 1: 실천 미션 요약 (Mission Summary) */}
                <div className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  theme === "midnight" 
                    ? "bg-neutral-800/40 border-neutral-800" 
                    : "bg-neutral-50/50 border-neutral-200/60"
                }`}>
                  <div className="flex flex-col gap-0.5 pr-4">
                    <span className="text-xs font-bold">실천 미션 요약 포함</span>
                    <span className={`text-[9px] leading-tight ${theme === "midnight" ? "text-neutral-400" : "text-neutral-500"}`}>
                      회복 미션 목록 및 수행 정보를 출력합니다
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isGeneratingPDF}
                    onClick={() => setDownloadOptions(prev => ({ ...prev, includeMissionSummary: !prev.includeMissionSummary }))}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isGeneratingPDF ? "opacity-50 cursor-not-allowed" : ""
                    } ${
                      downloadOptions.includeMissionSummary ? "bg-rose-500" : "bg-neutral-300 dark:bg-neutral-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        downloadOptions.includeMissionSummary ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Toggle 2: 상담 대화 기록 (Chat Session History) */}
                <div className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                  theme === "midnight" 
                    ? "bg-neutral-800/40 border-neutral-800" 
                    : "bg-neutral-50/50 border-neutral-200/60"
                }`}>
                  <div className="flex flex-col gap-0.5 pr-4">
                    <span className="text-xs font-bold">상담 대화 기록 포함</span>
                    <span className={`text-[9px] leading-tight ${theme === "midnight" ? "text-neutral-400" : "text-neutral-500"}`}>
                      AI 정신체리와 주고받은 대화 내용을 출력합니다
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isGeneratingPDF}
                    onClick={() => setDownloadOptions(prev => ({ ...prev, includeChatHistory: !prev.includeChatHistory }))}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isGeneratingPDF ? "opacity-50 cursor-not-allowed" : ""
                    } ${
                      downloadOptions.includeChatHistory ? "bg-rose-500" : "bg-neutral-300 dark:bg-neutral-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        downloadOptions.includeChatHistory ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Checklist Group for detailed Chat Stages (Only active if includeChatHistory is enabled) */}
              <div className={`space-y-3 mb-6 relative z-10 transition-all duration-300 ${
                !downloadOptions.includeChatHistory ? "opacity-40 pointer-events-none" : ""
              }`}>
                <div className="flex items-center justify-between">
                  <label className={`block text-[10px] font-bold mb-1 uppercase tracking-wider ${
                    theme === "midnight" ? "text-neutral-400" : "text-neutral-500"
                  }`}>
                    포함할 대화 단계 상세 선택
                  </label>
                  {!downloadOptions.includeChatHistory && (
                    <span className="text-[9px] text-rose-500 font-bold bg-rose-500/10 px-2 py-0.5 rounded-full">대화 비활성화됨</span>
                  )}
                </div>
                
                {/* 1. 감정 (Emotion) */}
                <div 
                  onClick={() => !isGeneratingPDF && downloadOptions.includeChatHistory && setDownloadOptions(prev => ({ ...prev, emotion: !prev.emotion }))}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                    isGeneratingPDF ? "opacity-60 cursor-not-allowed" : ""
                  } ${
                    downloadOptions.emotion
                      ? theme === "midnight"
                        ? "bg-rose-950/20 border-rose-500/40 shadow-sm"
                        : "bg-rose-50/40 border-rose-200 shadow-sm"
                      : theme === "midnight"
                        ? "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                        : "bg-white border-neutral-200/80 hover:border-neutral-300"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                    downloadOptions.emotion
                      ? "bg-rose-500 text-white"
                      : theme === "midnight" ? "bg-neutral-800 border border-neutral-700" : "bg-neutral-50 border border-neutral-300"
                  }`}>
                    {downloadOptions.emotion && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                  </div>
                  <div className="flex-1 -mt-0.5">
                    <h4 className={`text-xs font-bold ${downloadOptions.emotion ? "text-rose-600 dark:text-rose-400" : "text-neutral-500"}`}>
                      감정 (Emotional Stage)
                    </h4>
                    <p className={`text-[10px] mt-0.5 leading-relaxed ${
                      theme === "midnight" ? "text-neutral-400" : "text-neutral-500"
                    }`}>
                      정신체리와 나눈 다정한 감정 공감 및 고민 해소 대화 기록이 포함됩니다.
                    </p>
                  </div>
                </div>

                {/* 2. 이성적 분석 (Rational) */}
                <div 
                  onClick={() => !isGeneratingPDF && downloadOptions.includeChatHistory && setDownloadOptions(prev => ({ ...prev, rational: !prev.rational }))}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                    isGeneratingPDF ? "opacity-60 cursor-not-allowed" : ""
                  } ${
                    downloadOptions.rational
                      ? theme === "midnight"
                        ? "bg-rose-950/20 border-rose-500/40 shadow-sm"
                        : "bg-rose-50/40 border-rose-200 shadow-sm"
                      : theme === "midnight"
                        ? "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                        : "bg-white border-neutral-200/80 hover:border-neutral-300"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                    downloadOptions.rational
                      ? "bg-rose-500 text-white"
                      : theme === "midnight" ? "bg-neutral-800 border border-neutral-700" : "bg-neutral-50 border border-neutral-300"
                  }`}>
                    {downloadOptions.rational && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                  </div>
                  <div className="flex-1 -mt-0.5">
                    <h4 className={`text-xs font-bold ${downloadOptions.rational ? "text-rose-600 dark:text-rose-400" : "text-neutral-500"}`}>
                      이성적 분석 (Rational Stage)
                    </h4>
                    <p className={`text-[10px] mt-0.5 leading-relaxed ${
                      theme === "midnight" ? "text-neutral-400" : "text-neutral-500"
                    }`}>
                      한 걸음 물러서 상황을 객관적으로 분석하고 팩트를 정리한 대화가 포함됩니다.
                    </p>
                  </div>
                </div>

                {/* 3. 실천 미션 (Action) */}
                <div 
                  onClick={() => !isGeneratingPDF && downloadOptions.includeChatHistory && setDownloadOptions(prev => ({ ...prev, action: !prev.action }))}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 select-none ${
                    isGeneratingPDF ? "opacity-60 cursor-not-allowed" : ""
                  } ${
                    downloadOptions.action
                      ? theme === "midnight"
                        ? "bg-rose-950/20 border-rose-500/40 shadow-sm"
                        : "bg-rose-50/40 border-rose-200 shadow-sm"
                      : theme === "midnight"
                        ? "bg-neutral-900 border-neutral-800 hover:border-neutral-700"
                        : "bg-white border-neutral-200/80 hover:border-neutral-300"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                    downloadOptions.action
                      ? "bg-rose-500 text-white"
                      : theme === "midnight" ? "bg-neutral-800 border border-neutral-700" : "bg-neutral-50 border border-neutral-300"
                  }`}>
                    {downloadOptions.action && <Check className="w-3.5 h-3.5 stroke-[3px]" />}
                  </div>
                  <div className="flex-1 -mt-0.5">
                    <h4 className={`text-xs font-bold ${downloadOptions.action ? "text-rose-600 dark:text-rose-400" : "text-neutral-500"}`}>
                      실천 미션 (Action Stage)
                    </h4>
                    <p className={`text-[10px] mt-0.5 leading-relaxed ${
                      theme === "midnight" ? "text-neutral-400" : "text-neutral-500"
                    }`}>
                      진행 중이거나 완료한 맞춤 일상 마음 회복 실천 미션 목록과 행동 대화가 포함됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* Warning label if none selected */}
              {!isDownloadValid && (
                <div className="flex items-center gap-1.5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-500 text-[10px] font-bold mb-5 relative z-10 animate-pulse">
                  <Info className="w-3.5 h-3.5" />
                  <span>최소 하나의 구성 요소(실천 미션 또는 대화 기록 단계)를 선택해 주세요.</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2.5 relative z-10">
                <button
                  disabled={isGeneratingPDF}
                  onClick={() => setShowDownloadModal(false)}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer ${
                    isGeneratingPDF ? "opacity-40 cursor-not-allowed" : ""
                  } ${
                    theme === "midnight" 
                      ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700" 
                      : "bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border border-neutral-200/60"
                  }`}
                >
                  취소
                </button>
                <button
                  disabled={!isDownloadValid || isGeneratingPDF}
                  onClick={async () => {
                    await downloadSessionSummary();
                    setShowDownloadModal(false);
                  }}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                    !isDownloadValid || isGeneratingPDF
                      ? "opacity-40 cursor-not-allowed bg-neutral-300 text-neutral-500"
                      : theme === "midnight"
                        ? "bg-rose-700 hover:bg-rose-600 text-white"
                        : "bg-rose-600 hover:bg-rose-500 text-white"
                  }`}
                >
                  {isGeneratingPDF ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>PDF 파일 생성 중...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>다운로드 시작</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CBT Clinic Interactive Modal */}
      <AnimatePresence>
        {activePracticeMission && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setActivePracticeMission(null)}
              className="absolute inset-0 bg-neutral-950"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className={`relative w-full max-w-lg rounded-3xl border shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col ${
                theme === "midnight"
                  ? "bg-neutral-900 border-neutral-800 text-neutral-100"
                  : "bg-white border-neutral-200 text-neutral-900"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🍒</span>
                  <div>
                    <span className={`text-[9px] uppercase tracking-wider font-bold ${
                      theme === "midnight" ? "text-rose-400" : "text-rose-600"
                    }`}>마음 돌봄 실천 클리닉</span>
                    <h2 className="text-base font-black tracking-tight">{activePracticeMission.title}</h2>
                  </div>
                </div>
                <button
                  onClick={() => setActivePracticeMission(null)}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    theme === "midnight" ? "hover:bg-neutral-800 text-neutral-400" : "hover:bg-neutral-100 text-neutral-500"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Steps bar */}
              <div className="flex items-center justify-center gap-1.5 mb-6">
                {[1, 2, activePracticeMission.id === "m-4" ? null : 3].filter(Boolean).map((stepNum, idx, arr) => (
                  <div key={idx} className="flex items-center flex-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
                      activePracticeStep === stepNum
                        ? "bg-rose-600 border-rose-600 text-white font-black scale-110"
                        : (activePracticeStep || 1) > (stepNum || 1)
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : theme === "midnight"
                            ? "bg-neutral-800 border-neutral-700 text-neutral-400"
                            : "bg-neutral-100 border-neutral-200 text-neutral-400"
                    }`}>
                      {stepNum}
                    </div>
                    {idx < arr.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 rounded-full transition-all ${
                        (activePracticeStep || 1) > (stepNum || 1)
                          ? "bg-emerald-500"
                          : theme === "midnight"
                            ? "bg-neutral-800"
                            : "bg-neutral-100"
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[50vh] min-h-[300px]">
                {/* 1. 친구 대입법 (m-1) */}
                {activePracticeMission.id === "m-1" && (
                  <>
                    {activePracticeStep === 1 && (
                      <div className="space-y-3">
                        <div className="p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30">
                          <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                            <strong>친구 대입법 (Friend Substitution Method)</strong>은 내 마음속 날카로운 자책과 왜곡된 생각을 조금 한 걸음 떨어져 객관적으로 수용하고 바로잡는 강력한 인지 요법입니다.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-neutral-500">나를 괴롭히는 자책하는 생각 적기</label>
                          <textarea
                            rows={4}
                            value={practiceInputs.worry || ""}
                            onChange={(e) => setPracticeInputs(prev => ({ ...prev, worry: e.target.value }))}
                            placeholder="예: 이번 면접을 실수해서 망쳤어. 난 평생 직업을 갖지 못할 패배자야..."
                            className={`w-full text-xs p-3.5 rounded-xl border focus:outline-none focus:ring-1 transition-all ${
                              theme === "midnight"
                                ? "bg-neutral-800 border-neutral-700 text-white focus:border-rose-500 focus:ring-rose-500"
                                : "bg-white border-neutral-200 text-neutral-800 focus:border-rose-400 focus:ring-rose-400"
                            }`}
                          />
                        </div>
                      </div>
                    )}

                    {activePracticeStep === 2 && (
                      <div className="space-y-3">
                        <div className="p-4 rounded-2xl bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30">
                          <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                            만약 <strong>내가 가장 아끼고 소중히 생각하는 친구</strong>가 나에게 다가와 내가 방금 털어놓은 것과 똑같이 자책하며 괴로워한다면, 그 친구에게 어떤 따뜻한 위로와 응원을 전해주고 싶나요?
                          </p>
                        </div>
                        <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl text-xs">
                          <span className="font-bold block text-[10px] text-neutral-400 mb-1">친구의 고민:</span>
                          <span className="text-neutral-500 italic">" {practiceInputs.worry} "</span>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-neutral-500">친구에게 해줄 다정한 조언 적기</label>
                          <textarea
                            rows={4}
                            value={practiceInputs.friendAdvice || ""}
                            onChange={(e) => setPracticeInputs(prev => ({ ...prev, friendAdvice: e.target.value }))}
                            placeholder="예: 누구나 면접에서 실수할 수 있어! 그것이 너의 모든 가치나 역량을 뜻하지 않아. 넌 충분히 열심히 해왔으니 낙담하지 말고 힘냈으면 좋겠어."
                            className={`w-full text-xs p-3.5 rounded-xl border focus:outline-none focus:ring-1 transition-all ${
                              theme === "midnight"
                                ? "bg-neutral-800 border-neutral-700 text-white focus:border-rose-500 focus:ring-rose-500"
                                : "bg-white border-neutral-200 text-neutral-800 focus:border-rose-400 focus:ring-rose-400"
                            }`}
                          />
                        </div>
                      </div>
                    )}

                    {activePracticeStep === 3 && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30">
                          <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                            자, 이제 <strong>내가 소중한 사람에게 한 이 다정한 조언</strong>을 나 자신에게 그대로 대입해 볼 차례입니다. 나 또한 가혹한 자책이 아닌, 따뜻한 격려를 받기에 충분히 귀한 사람입니다. 아래를 가만히 소리 내어 읽어주세요.
                          </p>
                        </div>

                        <div className="p-5 bg-rose-50/30 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl relative">
                          <span className="absolute -top-3 left-4 bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded text-[9px] font-bold">마음 대입문 🌸</span>
                          <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed mt-1 font-medium whitespace-pre-wrap">
                            "나는 내 고민을 친구의 아픔처럼 귀히 여길 것입니다. 아끼는 소중한 사람에게 건넸던 마음 그대로, 이제 나 자신에게 속삭여 줄게요."
                          </p>
                          <div className="mt-4 border-t border-rose-100 dark:border-rose-900/50 pt-3 text-xs italic text-rose-600 dark:text-rose-400 font-bold whitespace-pre-wrap">
                            &ldquo;{practiceInputs.friendAdvice}&rdquo;
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-neutral-500">조언을 나에게 대입해 본 뒤의 마음 상태/다짐 적기</label>
                          <textarea
                            rows={3}
                            value={practiceInputs.reframing || ""}
                            onChange={(e) => setPracticeInputs(prev => ({ ...prev, reframing: e.target.value }))}
                            placeholder="예: 친구에게 한 말인데 나에게도 깊은 위로가 되네요. 스스로에게 조금 더 부드럽고 관대해져야겠습니다."
                            className={`w-full text-xs p-3.5 rounded-xl border focus:outline-none focus:ring-1 transition-all ${
                              theme === "midnight"
                                ? "bg-neutral-800 border-neutral-700 text-white focus:border-rose-500 focus:ring-rose-500"
                                : "bg-white border-neutral-200 text-neutral-800 focus:border-rose-400 focus:ring-rose-400"
                            }`}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 2. 감정 기록 (m-2) */}
                {activePracticeMission.id === "m-2" && (
                  <>
                    {activePracticeStep === 1 && (
                      <div className="space-y-3">
                        <div className="p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30">
                          <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                            <strong>감정 기록</strong>은 모호하고 거대한 부정적인 감정 덩어리를 잘게 조각내어 세밀한 이름을 붙여주는 연습입니다. 뇌는 감정에 구체적인 이름이 명명될 때 불안을 빠르게 가라앉힙니다.
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-neutral-500">지금 가슴에 얽혀있는 어두운 감정이나 상황 쏟아내기</label>
                          <textarea
                            rows={4}
                            value={practiceInputs.worry || ""}
                            onChange={(e) => setPracticeInputs(prev => ({ ...prev, worry: e.target.value }))}
                            placeholder="예: 그냥 다 답답하고 미래가 안 보이고 너무 막막해. 짜증도 많아지고 속상한 기분이야..."
                            className={`w-full text-xs p-3.5 rounded-xl border focus:outline-none focus:ring-1 transition-all ${
                              theme === "midnight"
                                ? "bg-neutral-800 border-neutral-700 text-white focus:border-rose-500 focus:ring-rose-500"
                                : "bg-white border-neutral-200 text-neutral-800 focus:border-rose-400 focus:ring-rose-400"
                            }`}
                          />
                        </div>
                      </div>
                    )}

                    {activePracticeStep === 2 && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                          단순히 '화나고 짜증 난다' 아래에 가려져 있던 세밀한 감정들을 골라보세요. 정서적 과립성을 높여 이름표를 붙여주면 마음이 가벼워집니다.
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-neutral-500">감정 단어 선택 (클릭하면 자동 입력됩니다)</label>
                          <div className="flex flex-wrap gap-2 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                            {["무력감", "소외감", "좌절감", "허탈함", "죄책감", "불안감", "억울함", "초조함", "시기심", "슬픔", "부끄러움", "외로움"].map((word) => {
                              const currentWords = (practiceInputs.granularity || "").split(",").map(w => w.trim()).filter(Boolean);
                              const isSelected = currentWords.includes(word);
                              return (
                                <button
                                  type="button"
                                  key={word}
                                  onClick={() => {
                                    let nextWords;
                                    if (isSelected) {
                                      nextWords = currentWords.filter(w => w !== word);
                                    } else {
                                      nextWords = [...currentWords, word];
                                    }
                                    setPracticeInputs(prev => ({ ...prev, granularity: nextWords.join(", ") }));
                                  }}
                                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-rose-500 text-white shadow-sm scale-105"
                                      : theme === "midnight"
                                        ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700"
                                        : "bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200"
                                  }`}
                                >
                                  {word}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-neutral-500">선택된 진짜 감정 이름표</label>
                          <input
                            type="text"
                            value={practiceInputs.granularity || ""}
                            onChange={(e) => setPracticeInputs(prev => ({ ...prev, granularity: e.target.value }))}
                            placeholder="단어들을 선택하거나 직접 쉼표로 분리하여 입력해 주세요."
                            className={`w-full text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-1 transition-all ${
                              theme === "midnight"
                                ? "bg-neutral-800 border-neutral-700 text-white focus:border-rose-500 focus:ring-rose-500"
                                : "bg-white border-neutral-200 text-neutral-800 focus:border-rose-400 focus:ring-rose-400"
                            }`}
                          />
                        </div>
                      </div>
                    )}

                    {activePracticeStep === 3 && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                          감정을 조절하는 핵심은 감정을 억누르는 것이 아니라, 있는 그대로 인정하고 부드럽게 흘려보내는 것입니다. 아래의 고백문을 소리 내어 고백해 봅니다.
                        </div>

                        <div className="p-5 bg-rose-50/30 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl">
                          <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium">
                            "내가 현재 가슴속에 안고 괴로워하는 것은 모호한 성질의 짜증이 아니라, 사실 <span className="text-rose-600 dark:text-rose-400 font-extrabold underline underline-offset-4">{practiceInputs.granularity || "내 안의 섬세한 정서"}</span>에 더 가깝습니다."
                          </p>
                          <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium mt-3">
                            "이 감정은 내 삶을 파괴하거나 규정하려 하는 악마가 아닙니다. 단지 나를 지키기 위해 내 마음이 올리는 자연스러운 신호일 뿐입니다. 내 안의 아픈 감정을 저항 없이 품고 수용하며, 차분하게 안아줄 것입니다."
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-neutral-500">감정을 솔직하게 분리하여 마주한 현재 마음 고백</label>
                          <textarea
                            rows={3}
                            value={practiceInputs.reframing || ""}
                            onChange={(e) => setPracticeInputs(prev => ({ ...prev, reframing: e.target.value }))}
                            placeholder="예: 뭉뚱그려 속상했던 기분을 쪼개서 적고 나니, 오히려 단순해지고 나를 지탱하고 보듬어줄 이유가 생겼습니다."
                            className={`w-full text-xs p-3.5 rounded-xl border focus:outline-none focus:ring-1 transition-all ${
                              theme === "midnight"
                                ? "bg-neutral-800 border-neutral-700 text-white focus:border-rose-500 focus:ring-rose-500"
                                : "bg-white border-neutral-200 text-neutral-800 focus:border-rose-400 focus:ring-rose-400"
                            }`}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 3. 사실과 생각 분리하기 (m-3) */}
                {activePracticeMission.id === "m-3" && (
                  <>
                    {activePracticeStep === 1 && (
                      <div className="space-y-3">
                        <div className="p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                          <strong>사실과 생각 분리하기 (Fact vs. Thought)</strong>는 객관적인 사건(Fact)과 내 머리가 과장하여 만들어 낸 주관적인 해석(Thought)을 날카롭게 분리하는 연습입니다.
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-neutral-500">내 머릿속에 가득 찬 스트레스 상황이나 얽힌 고민 쓰기</label>
                          <textarea
                            rows={4}
                            value={practiceInputs.worry || ""}
                            onChange={(e) => setPracticeInputs(prev => ({ ...prev, worry: e.target.value }))}
                            placeholder="예: 과장님이 기획안을 보시더니 고개를 저으시면서 피드백 지적을 잔뜩 주셨어. 난 역시 기획머리가 없고 이 프로젝트도 내 실수로 완전히 실패할 게 뻔해..."
                            className={`w-full text-xs p-3.5 rounded-xl border focus:outline-none focus:ring-1 transition-all ${
                              theme === "midnight"
                                ? "bg-neutral-800 border-neutral-700 text-white focus:border-rose-500 focus:ring-rose-500"
                                : "bg-white border-neutral-200 text-neutral-800 focus:border-rose-400 focus:ring-rose-400"
                            }`}
                          />
                        </div>
                      </div>
                    )}

                    {activePracticeStep === 2 && (
                      <div className="space-y-3">
                        <div className="p-4 rounded-2xl bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                          모든 감정, 추측, 파국화 등 주관을 걷어내고 <strong>제3자의 렌즈가 촬영한 오직 '사실(Fact)'</strong>만 추출해 보세요.
                        </div>
                        <div className="p-3 bg-neutral-50 dark:bg-neutral-800/40 border border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl text-xs text-neutral-500">
                          <span className="font-bold block text-[10px] text-neutral-400 mb-1">나의 고민:</span>
                          "{practiceInputs.worry}"
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-neutral-500">객관적인 '사실(Fact)'만 도려내 쓰기</label>
                          <textarea
                            rows={3}
                            value={practiceInputs.fact || ""}
                            onChange={(e) => setPracticeInputs(prev => ({ ...prev, fact: e.target.value }))}
                            placeholder="예: 기획서 내용에 대해 두 차례 구체적인 수정 피드백을 전달받았다."
                            className={`w-full text-xs p-3.5 rounded-xl border focus:outline-none focus:ring-1 transition-all ${
                              theme === "midnight"
                                ? "bg-neutral-800 border-neutral-700 text-white focus:border-rose-500 focus:ring-rose-500"
                                : "bg-white border-neutral-200 text-neutral-800 focus:border-rose-400 focus:ring-rose-400"
                            }`}
                          />
                        </div>
                      </div>
                    )}

                    {activePracticeStep === 3 && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                          이제 그 '사실' 위로 내 뇌가 자동적으로 만들어 낸 <strong>주관적이고 왜곡된 '생각(Thought)'</strong>과 추측들을 냉정히 분리하여 밝혀줍니다.
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                            <span className="text-[10px] uppercase font-mono font-bold text-emerald-600 dark:text-emerald-400 block mb-1">CAMERA FACT (사실)</span>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">{practiceInputs.fact}</p>
                          </div>
                          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                            <span className="text-[10px] uppercase font-mono font-bold text-amber-500 block mb-1">MIND DISTORTION (왜곡된 생각)</span>
                            <p className="text-xs text-neutral-500 italic leading-relaxed">"사실 위에 덧그려진 수많은 두려운 상상들..."</p>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-neutral-500">사실 위에 덧씌워진 내 주관적 '생각/최악의 추측' 적기</label>
                          <textarea
                            rows={3}
                            value={practiceInputs.opinion || ""}
                            onChange={(e) => setPracticeInputs(prev => ({ ...prev, opinion: e.target.value }))}
                            placeholder="예: 과장님은 나를 극도로 무능하게 여길 것이고 조만간 해고당할 것이라는 최악의 소설을 썼습니다."
                            className={`w-full text-xs p-3.5 rounded-xl border focus:outline-none focus:ring-1 transition-all ${
                              theme === "midnight"
                                ? "bg-neutral-800 border-neutral-700 text-white focus:border-rose-500 focus:ring-rose-500"
                                : "bg-white border-neutral-200 text-neutral-800 focus:border-rose-400 focus:ring-rose-400"
                            }`}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 4. 생각 회로 반전시키기 (m-4) */}
                {activePracticeMission.id === "m-4" && (
                  <>
                    {activePracticeStep === 1 && (
                      <div className="space-y-3">
                        <div className="p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                          <strong>생각 회로 반전시키기 (De-identification)</strong>는 나를 지배하고 있는 거대한 종결적 예단 끝에 단순한 언어적 필터를 붙여, 나와 생각 사이에 건강한 거리를 두는 연습입니다.
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-neutral-500">나의 머리를 짓누르고 지배하는 부정적이고 불안한 단언 쓰기</label>
                          <textarea
                            rows={4}
                            value={practiceInputs.anxiousAssert || ""}
                            onChange={(e) => setPracticeInputs(prev => ({ ...prev, anxiousAssert: e.target.value }))}
                            placeholder="예: 나는 이번 도전에서도 또 비참하게 실패하게 될 거야."
                            className={`w-full text-xs p-3.5 rounded-xl border focus:outline-none focus:ring-1 transition-all ${
                              theme === "midnight"
                                ? "bg-neutral-800 border-neutral-700 text-white focus:border-rose-500 focus:ring-rose-500"
                                : "bg-white border-neutral-200 text-neutral-800 focus:border-rose-400 focus:ring-rose-400"
                            }`}
                          />
                        </div>
                      </div>
                    )}

                    {activePracticeStep === 2 && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                          내가 단정 짓고 확신했던 절망적인 예언 끝에 <strong>'~라는 착각을 했다'</strong> 또는 <strong>'~라는 생각이 스쳐 지나갔다'</strong>라는 인지적 안전장치를 덧붙여 봅니다. 이 선언은 내 뇌의 착시 현상을 가리켜 줄 것입니다.
                        </div>

                        <div className="p-5 rounded-2xl border border-rose-100 dark:border-rose-900/30 bg-rose-50/20 dark:bg-rose-950/10 space-y-3 text-center">
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">반전된 인지 회로 ⚡</span>
                          
                          <div className="text-sm text-neutral-700 dark:text-neutral-200 leading-relaxed max-w-md mx-auto py-2">
                            <span className="line-through text-neutral-400 dark:text-neutral-500 font-normal">"{practiceInputs.anxiousAssert}"</span>
                            <div className="mt-2 text-rose-600 dark:text-rose-400 font-black text-base">
                              &ldquo;나는 {practiceInputs.anxiousAssert} 라는 생각이 내 머릿속을 잠시 스쳐 지나갔을 뿐이라는 사실을 알고 있다.&rdquo;
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-neutral-500">생각에 안전장치 꼬리표를 달고 나서 느끼는 솔직한 기분 적기</label>
                          <textarea
                            rows={3}
                            value={practiceInputs.reframing || ""}
                            onChange={(e) => setPracticeInputs(prev => ({ ...prev, reframing: e.target.value }))}
                            placeholder="예: '실패할 것이다'가 100% 진실처럼 다가왔었는데, 단순한 착각이자 지나가는 바람 같은 생각일 뿐이라는 깨달음이 와닿아 훨씬 마음이 가벼워집니다."
                            className={`w-full text-xs p-3.5 rounded-xl border focus:outline-none focus:ring-1 transition-all ${
                              theme === "midnight"
                                ? "bg-neutral-800 border-neutral-700 text-white focus:border-rose-500 focus:ring-rose-500"
                                : "bg-white border-neutral-200 text-neutral-800 focus:border-rose-400 focus:ring-rose-400"
                            }`}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="mt-6 border-t border-neutral-100 dark:border-neutral-800 pt-4 flex gap-2">
                {/* Fallback Option: Just complete manually */}
                {activePracticeStep === 1 && (
                  <button
                    type="button"
                    onClick={() => handleDirectCompleteMission(activePracticeMission.id)}
                    className={`px-3 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer ${
                      theme === "midnight"
                        ? "bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 border border-neutral-800"
                        : "bg-neutral-50 hover:bg-neutral-100 text-neutral-500 border border-neutral-200/60"
                    }`}
                  >
                    직접 완료
                  </button>
                )}

                {/* Back Button */}
                {activePracticeStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setActivePracticeStep(prev => prev - 1)}
                    className={`px-4 py-3 rounded-xl font-bold transition-all text-xs cursor-pointer ${
                      theme === "midnight"
                        ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700"
                        : "bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border border-neutral-200/60"
                    }`}
                  >
                    이전
                  </button>
                )}

                {/* Next/Submit Button */}
                {(() => {
                  const maxSteps = activePracticeMission.id === "m-4" ? 2 : 3;
                  const isLastStep = activePracticeStep === maxSteps;
                  
                  // Check validation
                  let isValid = false;
                  if (activePracticeMission.id === "m-1") {
                    if (activePracticeStep === 1) isValid = !!practiceInputs.worry?.trim();
                    if (activePracticeStep === 2) isValid = !!practiceInputs.friendAdvice?.trim();
                    if (activePracticeStep === 3) isValid = !!practiceInputs.reframing?.trim();
                  } else if (activePracticeMission.id === "m-2") {
                    if (activePracticeStep === 1) isValid = !!practiceInputs.worry?.trim();
                    if (activePracticeStep === 2) isValid = !!practiceInputs.granularity?.trim();
                    if (activePracticeStep === 3) isValid = !!practiceInputs.reframing?.trim();
                  } else if (activePracticeMission.id === "m-3") {
                    if (activePracticeStep === 1) isValid = !!practiceInputs.worry?.trim();
                    if (activePracticeStep === 2) isValid = !!practiceInputs.fact?.trim();
                    if (activePracticeStep === 3) isValid = !!practiceInputs.opinion?.trim();
                  } else if (activePracticeMission.id === "m-4") {
                    if (activePracticeStep === 1) isValid = !!practiceInputs.anxiousAssert?.trim();
                    if (activePracticeStep === 2) isValid = !!practiceInputs.reframing?.trim();
                  }

                  return (
                    <button
                      type="button"
                      disabled={!isValid}
                      onClick={() => {
                        if (isLastStep) {
                          handleCompleteCbtPractice();
                        } else {
                          setActivePracticeStep(prev => prev + 1);
                        }
                      }}
                      className={`flex-1 py-3 rounded-xl font-bold transition-all text-xs flex items-center justify-center gap-1 cursor-pointer ${
                        !isValid
                          ? "opacity-40 cursor-not-allowed bg-neutral-300 text-neutral-500"
                          : theme === "midnight"
                            ? "bg-rose-700 hover:bg-rose-600 text-white"
                            : "bg-rose-600 hover:bg-rose-500 text-white"
                      }`}
                    >
                      {isLastStep ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>미션 실천 완료</span>
                        </>
                      ) : (
                        <>
                          <span>다음 단계</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Ambient Background Effect */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        {theme === "midnight" ? (
          <>
            <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-rose-950/15 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }}></div>
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-950/15 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: '12s' }}></div>
          </>
        ) : (
          <>
            <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-rose-500/5 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }}></div>
            <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: '12s' }}></div>
          </>
        )}
      </div>

      {/* Main Container */}
      {/* Main Container */}
      <div className={`w-full max-w-md md:max-w-3xl lg:max-w-4xl min-h-screen shadow-2xl flex flex-col relative border-x pb-20 transition-all duration-500 ${
        theme === "midnight" ? "bg-neutral-900/95 border-neutral-800 text-neutral-100" : "bg-white border-neutral-100 text-neutral-900"
      }`}>
        
        {/* Header (TopAppBar) */}
        <header className={`sticky top-0 w-full z-50 backdrop-blur-md border-b h-16 transition-colors duration-300 ${
          theme === "midnight" ? "bg-neutral-900/90 border-neutral-800 text-neutral-100" : "bg-white/90 border-neutral-100 text-neutral-900"
        }`}>
          <div className="max-w-3xl mx-auto w-full h-full flex items-center justify-between px-5">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border overflow-hidden shadow-inner cursor-pointer transition-colors ${
                theme === "midnight" ? "bg-neutral-800 border-neutral-700" : "bg-rose-50 border-rose-100"
              }`} onClick={() => setCurrentView("onboarding")}>
                {/* Jeongsin Cherry Logo Image */}
                <img 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBQm9HpyLC4oEHuAFVmoGqMzCeiPx-miwLYyI6KPYw7DeeZD__k-p6z1HQicQVe7tCwrTNgvNH5mi2IrDQGEpDdUlowpJ_yUaqwJZu-n4-fnTiTHjjcCilo_9OQCRvwiwxVqBe1XXnw2SXt3LJ2OYvyxu7zGSjKzdDG3P7vAehmsrdPuYc6o2gnaGq0jSLEDsOfPZ3cKhf2qHtHPZJZkzDlVh4i2zY6vUQY3wA_3mRhEF_xySNfiZNxFSPpjFLJGe8KyAbNjDrghJY" 
                  alt="Jeongsin Cherry" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span 
                className={`font-display font-bold text-lg tracking-tight cursor-pointer hover:opacity-90 active:scale-95 transition-all ${
                  theme === "midnight" ? "text-rose-400" : "text-rose-700"
                }`}
                onClick={() => {
                  setCurrentView("dashboard");
                  setActiveTab("missions");
                }}
              >
                Jeongsin Cherry
              </span>
            </div>
            <div className="flex items-center gap-1">
              {/* Theme Toggle Button */}
              <button 
                onClick={() => setTheme(prev => prev === "cherry" ? "midnight" : "cherry")}
                className={`p-2 rounded-full transition-colors duration-300 cursor-pointer ${
                  theme === "midnight" 
                    ? "text-amber-400 hover:bg-neutral-800" 
                    : "text-neutral-500 hover:bg-neutral-100"
                }`}
                title={theme === "midnight" ? "Cherry Blossom 라이트 모드" : "Midnight Neuro 다크 모드"}
              >
                {theme === "midnight" ? <Sun className="w-5 h-5 animate-pulse" /> : <Moon className="w-5 h-5" />}
              </button>

              <button 
                onClick={() => {
                  setCurrentView("dashboard");
                  setActiveTab("chat");
                }}
                className={`p-2 rounded-full transition-colors relative cursor-pointer ${
                  theme === "midnight" ? "text-rose-400 hover:bg-neutral-800" : "text-rose-600 hover:bg-rose-50"
                }`}
                title="상담 대화방 바로가기"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
              <div className="relative">
                <button 
                  onClick={() => setShowMoreMenu(prev => !prev)}
                  className={`p-2 rounded-full transition-colors relative cursor-pointer ${
                    theme === "midnight" 
                      ? "text-neutral-400 hover:bg-neutral-800" 
                      : "text-neutral-500 hover:bg-rose-50"
                  } ${showMoreMenu ? (theme === "midnight" ? "bg-neutral-800 text-white" : "bg-rose-50 text-rose-600") : ""}`}
                  title="더보기"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {showMoreMenu && (
                    <>
                      {/* Backdrop for easy closing */}
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowMoreMenu(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute right-0 mt-1.5 w-48 rounded-xl shadow-lg border z-50 overflow-hidden ${
                          theme === "midnight"
                            ? "bg-neutral-900 border-neutral-800 text-neutral-200"
                            : "bg-white border-rose-100 text-neutral-700"
                        }`}
                      >
                        <div className="py-1">
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              setShowInfoModal(true);
                            }}
                            className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-left transition-colors cursor-pointer ${
                              theme === "midnight" ? "hover:bg-neutral-800" : "hover:bg-rose-50"
                            }`}
                          >
                            <Info className="w-4 h-4 text-emerald-500" />
                            <span>서비스 소개</span>
                          </button>
                          
                          <div className={`border-t my-1 ${theme === "midnight" ? "border-neutral-800" : "border-rose-50"}`} />
                          
                          <button
                            onClick={() => {
                              setShowMoreMenu(false);
                              setShowSettingsModal(true);
                            }}
                            className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-left transition-colors cursor-pointer ${
                              theme === "midnight" ? "hover:bg-neutral-800 text-neutral-200" : "hover:bg-rose-50 text-neutral-700"
                            }`}
                          >
                            <Settings className="w-4 h-4 text-rose-400" />
                            <span>설정</span>
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area with Animations */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          <AnimatePresence mode="wait">
            {currentView === "onboarding" ? (
              
              /* ================= ONBOARDING VIEW ================= */
              <motion.div
                key="onboarding"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                className="flex-1 px-5 pt-8 pb-10 flex flex-col items-center max-w-2xl mx-auto w-full"
              >
                {/* Hero Title */}
                <div className="text-center mb-8">
                  <h1 className="font-display text-[26px] font-extrabold text-neutral-900 leading-tight tracking-tight">
                    따뜻한 위로와 든든한 <span className="text-rose-600 border-b-2 border-rose-100">생각 정리</span>의 만남,
                    <br />
                    정신체리
                  </h1>
                  <p className="text-sm text-neutral-500 mt-3 font-medium leading-relaxed">
                    당신의 마음을 다정하게 다독이고, 생각을 객관적으로 정리하여
                    <br />
                    한층 더 단단하고 가벼운 일상을 선물합니다.
                  </p>
                </div>

                {/* 3 Step Concept Cards (Bento style) */}
                <div className="w-full space-y-4 mb-8">
                  
                  {/* Step 1: Emotion */}
                  <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                        <Heart className="w-4 h-4 fill-rose-500 text-rose-500" />
                      </div>
                      <h3 className="font-display font-bold text-neutral-900 text-base">감정 털어놓기 (마음 체리)</h3>
                    </div>
                    <p className="text-xs text-neutral-500 leading-relaxed">
                      내 힘든 기분을 있는 그대로 편안하게 털어놓으세요. 마음속에 억눌려 있던 걱정과 감정의 무거운 짐을 다정하게 가만히 받아안아 줍니다.
                    </p>
                    <div className="mt-3 text-[10px] font-bold tracking-wider text-rose-500">
                      1단계. 마음 열고 털어놓기
                    </div>
                  </div>

                  {/* Step 2: Rationality */}
                  <div className="bg-neutral-900 text-neutral-100 p-5 rounded-2xl shadow-md relative overflow-hidden group">
                    <div className="absolute right-0 top-0 opacity-5 transform translate-x-4 -translate-y-4">
                      <Eye className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-3 mb-2.5 relative z-10">
                      <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center text-white">
                        <Eye className="w-4 h-4" />
                      </div>
                      <h3 className="font-display font-bold text-white text-base">오해와 사실 구분하기 (정신 체리)</h3>
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed relative z-10">
                      복잡한 감정 때문에 나도 모르게 가졌던 오해나 걱정들을 제3자의 시선으로 돌아봅니다. 생각은 단지 생각일 뿐, 사실이 아님을 깨닫는 시간입니다.
                    </p>
                    <div className="mt-3 text-[10px] font-bold tracking-wider text-rose-400 relative z-10">
                      2단계. 객관적으로 돌아보기
                    </div>
                  </div>

                  {/* Step 3: Action */}
                  <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Zap className="w-4 h-4 fill-emerald-600 text-emerald-600" />
                      </div>
                      <h3 className="font-display font-bold text-neutral-900 text-base">행동으로 실천하기 (단단 체리)</h3>
                    </div>
                    <p className="text-xs text-neutral-500 leading-relaxed">
                      머리로만 정리하는 것을 넘어, 일상에서 아주 쉽게 시도할 수 있는 작은 미션들을 행동에 옮겨 건강하고 단단한 마음 습관을 완성해 봅니다.
                    </p>
                    <div className="mt-3 text-[10px] font-bold tracking-wider text-emerald-600">
                      3단계. 기분 좋은 행동 실천
                    </div>
                  </div>

                </div>

                {/* Aesthetic abstract neural pathways illustration */}
                <div className="w-full h-44 rounded-2xl overflow-hidden relative shadow-sm border border-neutral-100 mb-8 bg-neutral-900">
                  <img 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAumsBMSdQkDoT6Dw2bV0Ezledo_xGSOdZhbTCiCWf9HFbU9em7GzNQIIHPWRFG5964Vc_2U5FJ7S_9FPCGHVwJNmddBan4ExJ9WMG0E6XTnzon2icYSKOIS9XX2D-pjoe6k_co3jp_y8-O9vkmk3kUFvWJIt8m-K9Xr1T5Rs8MfrwBOe2CrNcTp3Ryt-IJ95cikc91oTCY6A0zEzDYVYlZ1wkkjpJ-jE7U2T_88LX7fv32Kw8ZCapAx7Baa2sk64L5RuoatuhnxQ" 
                    alt="Neuroplasticity Illustration" 
                    className="w-full h-full object-cover opacity-80"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                    <div className="text-white text-xs font-medium">
                      소개: 마음을 단단히 가꾸는 3단계 생각 정리 코칭 🍒
                    </div>
                  </div>
                </div>

                {/* 3-Emoji Neural State Selector Bar */}
                <div id="neural-state-selector" className={`p-4 rounded-2xl border shadow-sm space-y-3 transition-all duration-300 ${
                  theme === "midnight" 
                    ? "bg-neutral-800 border-neutral-700 text-neutral-100" 
                    : "bg-white border-neutral-100 text-neutral-900"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-wider text-neutral-400">
                      현재 내 기분 상태
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                      theme === "midnight" ? "bg-rose-950/50 text-rose-400" : "bg-rose-50 text-rose-600"
                    }`}>
                      마음 기록 ({currentNeuralState === "overheated" ? "복잡함" : currentNeuralState === "neutral" ? "보통" : "편안함"})
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {/* Overheated State */}
                    <button
                      onClick={() => handleSelectNeuralState("overheated")}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                        currentNeuralState === "overheated"
                          ? "border-rose-500 bg-rose-500/10 text-rose-600 font-bold"
                          : theme === "midnight"
                            ? "border-neutral-700 bg-neutral-900/40 text-neutral-400 hover:border-neutral-600 hover:bg-neutral-900/60"
                            : "border-neutral-100 bg-neutral-50/50 text-neutral-500 hover:border-neutral-200 hover:bg-neutral-100/70"
                      }`}
                    >
                      <span className="text-2xl animate-pulse">😭</span>
                      <span className={`text-[10px] font-bold ${currentNeuralState === "overheated" ? "text-rose-500" : ""}`}>조금 복잡함</span>
                      <span className="text-[9px] text-neutral-400">회복도 35%</span>
                    </button>

                    {/* Neutral State */}
                    <button
                      onClick={() => handleSelectNeuralState("neutral")}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                        currentNeuralState === "neutral"
                          ? "border-amber-500 bg-amber-500/10 text-amber-600 font-bold font-sans"
                          : theme === "midnight"
                            ? "border-neutral-700 bg-neutral-900/40 text-neutral-400 hover:border-neutral-600 hover:bg-neutral-900/60"
                            : "border-neutral-100 bg-neutral-50/50 text-neutral-500 hover:border-neutral-200 hover:bg-neutral-100/70"
                      }`}
                    >
                      <span className="text-2xl">😐</span>
                      <span className={`text-[10px] font-bold ${currentNeuralState === "neutral" ? "text-amber-500" : ""}`}>적당히 차분</span>
                      <span className="text-[9px] text-neutral-400">회복도 68%</span>
                    </button>

                    {/* Synced State */}
                    <button
                      onClick={() => handleSelectNeuralState("synced")}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                        currentNeuralState === "synced"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 font-bold font-sans"
                          : theme === "midnight"
                            ? "border-neutral-700 bg-neutral-900/40 text-neutral-400 hover:border-neutral-600 hover:bg-neutral-900/60"
                            : "border-neutral-100 bg-neutral-50/50 text-neutral-500 hover:border-neutral-200 hover:bg-neutral-100/70"
                      }`}
                    >
                      <span className="text-2xl">😊</span>
                      <span className={`text-[10px] font-bold ${currentNeuralState === "synced" ? "text-emerald-500" : ""}`}>매우 편안</span>
                      <span className="text-[9px] text-neutral-400">회복도 95%</span>
                    </button>
                  </div>
                </div>

                {/* 🍒 Personalization Settings Form inside Onboarding */}
                <div className="w-full mt-6">
                  <SituationProfileEditor
                    initialSituation={userSituation}
                    onSave={(updated) => {
                      setUserSituation(updated);
                      localStorage.setItem("jc_user_situation", JSON.stringify(updated));
                      triggerDopamineConfetti();
                      setInAppToast({
                        title: "개인화 마음 프로필 설정 완료 🍒",
                        desc: "입력하신 내 상황과 듣기 싫은 말이 전두엽 코칭 네트워크에 연동되었습니다. 정신체리가 세심하게 인지하고 대화를 시작할게요!"
                      });
                      setTimeout(() => setInAppToast(null), 4500);
                    }}
                    theme={theme}
                  />
                </div>

                {/* Big Start Counseling Button */}
                <button
                  onClick={startCounseling}
                  className="w-full mt-6 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 active:scale-95 text-white font-display font-extrabold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 fill-white animate-pulse" />
                  <span>정신체리와 3단계 마음 코칭 시작하기 🍒</span>
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4 }}
                className="flex-1 flex flex-col max-w-3xl mx-auto w-full"
              >
                {activeTab === "missions" && (
                  <div className="px-5 pt-5 pb-8 space-y-6">
                    {/* Overdue alert banner if inactive for 4+ hours */}
                    {isOverdue && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm transition-all relative overflow-hidden ${
                          theme === "midnight"
                            ? "bg-rose-500/10 border-rose-500/20 text-neutral-100"
                            : "bg-rose-50 border-rose-100 text-neutral-900"
                        }`}
                      >
                        <div className="absolute right-0 bottom-0 opacity-5 transform translate-x-3 translate-y-3 pointer-events-none">
                          <Wind className="w-32 h-32" />
                        </div>
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-xl mt-0.5 flex-shrink-0 ${
                            theme === "midnight" ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-600"
                          }`}>
                            <AlertCircle className="w-5 h-5 animate-bounce" />
                          </div>
                          <div>
                            <h4 className="font-display font-extrabold text-sm tracking-tight">
                              최근 4시간 동안 쉬어가는 체크인이 없으셨습니다 🍒
                            </h4>
                            <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed max-w-lg">
                              마음 정돈 에너지가 살짝 둔화될 수 있습니다. 30초 간단한 호흡 훈련으로 뇌에 신선한 산소를 보충하거나, 지금 느끼는 솔직한 기분을 기록하여 마음 밸런스를 환기해보세요.
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => setIsBreathingOpen(true)}
                            className="flex-1 sm:flex-initial px-4 py-2 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/10 transition-all cursor-pointer whitespace-nowrap"
                          >
                            🌬️ 30초 호흡 시작
                          </button>
                          <button
                            onClick={() => {
                              const element = document.getElementById("neural-state-selector");
                              if (element) {
                                element.scrollIntoView({ behavior: "smooth" });
                              } else {
                                setInAppToast({
                                  title: "👇 아래에서 기분을 선택하세요",
                                  desc: "대시보드 하단의 '현재 내 기분 상태' 위젯에서 기분을 기록하실 수 있습니다."
                                });
                              }
                            }}
                            className={`flex-1 sm:flex-initial px-4 py-2 border text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                              theme === "midnight"
                                ? "border-neutral-700 hover:bg-neutral-800 text-neutral-300"
                                : "border-neutral-200 hover:bg-white text-neutral-700 shadow-sm"
                            }`}
                          >
                            🍒 기분 기록하기
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* 마음 회복 및 성장 진행률 카드 */}
                    <div className="bg-cherry-gradient text-white p-5 rounded-2xl shadow-md relative overflow-hidden min-w-[280px] flex flex-col flex-wrap">
                      <div className="absolute right-0 top-0 opacity-10 transform translate-x-3 -translate-y-3">
                        <Heart className="w-24 h-24 text-white" />
                      </div>
                      <div className="relative z-10 flex flex-col flex-wrap gap-1 min-w-0 w-full">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold tracking-wider text-rose-300 whitespace-nowrap">
                            나의 마음 싱크로율 수치
                          </span>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        </div>
                        <h2 className="font-display font-extrabold text-lg leading-tight break-keep flex flex-wrap gap-x-1.5 items-baseline">
                          <span>내 마음에 쓰는 에너지가</span>
                          <span className="whitespace-nowrap">{syncProgress}% 조율되었습니다.</span>
                        </h2>
                        {/* Custom visual progress bar */}
                        <div className="mt-5 space-y-2">
                          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-rose-400 rounded-full transition-all duration-1000"
                              style={{ width: `${syncProgress}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-[10px] sm:text-xs font-medium text-rose-100 gap-2 mt-1">
                            <div className={`text-left leading-tight ${syncProgress >= 50 ? "text-white font-bold" : ""}`}>
                              <span className="block text-[8px] sm:text-[9px] opacity-75 font-mono mb-0.5">1단계</span>
                              <span className="whitespace-nowrap">마음 털어놓기</span>
                            </div>
                            <div className={`text-center leading-tight ${syncProgress >= 80 ? "text-white font-bold" : ""}`}>
                              <span className="block text-[8px] sm:text-[9px] opacity-75 font-mono mb-0.5">2단계</span>
                              <span className="whitespace-nowrap">객관적으로 보기</span>
                            </div>
                            <div className={`text-right leading-tight ${syncProgress >= 95 ? "text-white font-bold" : ""}`}>
                              <span className="block text-[8px] sm:text-[9px] opacity-75 font-mono mb-0.5">3단계</span>
                              <span className="whitespace-nowrap font-sans font-bold text-rose-300">행동 실천하기</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 정신체리 마음 응급 대피소 (Emergency Mind Care Toolkit) */}
                    <div className={`p-5 rounded-2xl border shadow-md transition-all duration-300 relative ${
                      theme === "midnight" 
                        ? "bg-neutral-800 border-neutral-700 text-neutral-100" 
                        : "bg-white border-neutral-150 text-neutral-900"
                    }`}>
                      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-neutral-100 dark:border-neutral-700/50">
                        <span className="text-xl">🚨</span>
                        <div>
                          <h3 className="font-display font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                            <span>마음 응급 대피소</span>
                            <span className="text-[10px] bg-rose-500 text-white font-mono font-bold px-1.5 py-0.5 rounded">QUICK RESET</span>
                          </h3>
                          <p className="text-[10px] text-neutral-400">대화조차 버거운 날, 1초 만에 머릿속 복잡함을 환기해보세요 🍒</p>
                        </div>
                      </div>

                      {/* Toolkit Tabs */}
                      <div className="flex bg-neutral-100 dark:bg-neutral-900/60 p-1 rounded-xl mb-4 gap-1">
                        <button
                          onClick={() => {
                            setToolkitTab("instant");
                            if (!instantMission) {
                              const idx = Math.floor(Math.random() * instantMissionsList.length);
                              setInstantMission(instantMissionsList[idx]);
                              setIsInstantCompleted(false);
                            }
                          }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer ${
                            toolkitTab === "instant"
                              ? theme === "midnight"
                                ? "bg-neutral-800 text-rose-400 shadow-sm"
                                : "bg-white text-rose-600 shadow-sm"
                              : "text-neutral-400 hover:text-rose-500"
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>1초 즉시 미션</span>
                        </button>
                        <button
                          onClick={() => {
                            setToolkitTab("dump");
                            setIsDumped(false);
                          }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer ${
                            toolkitTab === "dump"
                              ? theme === "midnight"
                                ? "bg-neutral-800 text-rose-400 shadow-sm"
                                : "bg-white text-rose-600 shadow-sm"
                              : "text-neutral-400 hover:text-rose-500"
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>생각 쓰레기통</span>
                        </button>
                        <button
                          onClick={() => setToolkitTab("prescription")}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer ${
                            toolkitTab === "prescription"
                              ? theme === "midnight"
                                ? "bg-neutral-800 text-rose-400 shadow-sm"
                                : "bg-white text-rose-600 shadow-sm"
                              : "text-neutral-400 hover:text-rose-500"
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>한 줄 처방전</span>
                        </button>
                      </div>

                      {/* Tab Content 1: 1초 즉시 미션 */}
                      {toolkitTab === "instant" && (
                        <div className="space-y-4 py-1">
                          {!instantMission ? (
                            <div className="text-center py-6 space-y-3">
                              <p className="text-xs text-neutral-400">당장 행동에 나서기 어려운 순간인가요? 아래 버튼을 눌러 몸을 조금 움직여보세요.</p>
                              <button
                                onClick={handleGetInstantMission}
                                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 mx-auto"
                              >
                                <Zap className="w-3.5 h-3.5" />
                                <span>즉시 미션 처방받기 🍒</span>
                              </button>
                            </div>
                          ) : (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className={`p-4 rounded-xl border relative overflow-hidden ${
                                isInstantCompleted
                                  ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-800 dark:text-emerald-400"
                                  : theme === "midnight"
                                    ? "bg-neutral-900/40 border-neutral-700/60"
                                    : "bg-rose-50/40 border-rose-100"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <span className="text-xl mt-0.5">🚀</span>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-xs text-neutral-400 mb-1">지금 바로 실천할 행동 가이드</h4>
                                  <p className={`text-xs font-extrabold leading-relaxed ${isInstantCompleted ? "line-through opacity-60 text-emerald-600 dark:text-emerald-400" : "text-neutral-800 dark:text-neutral-200"}`}>
                                    {instantMission}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-dashed border-neutral-200 dark:border-neutral-700/50">
                                <button
                                  onClick={handleGetInstantMission}
                                  className={`text-[11px] font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                    theme === "midnight"
                                      ? "bg-neutral-800 text-neutral-300 hover:bg-neutral-750"
                                      : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
                                  }`}
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>다른 미션 뽑기</span>
                                </button>
                                
                                {!isInstantCompleted ? (
                                  <button
                                    onClick={handleCompleteInstantMission}
                                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>완료했습니다! 🎉</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                    <span>실천 완료 (+1%)</span>
                                  </span>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )}

                      {/* Tab Content 2: 생각 쓰레기통 */}
                      {toolkitTab === "dump" && (
                        <div className="space-y-4 py-1">
                          {!isDumped ? (
                            <div className="space-y-3">
                              <p className="text-xs text-neutral-400 leading-relaxed">
                                머릿속에 가득 찬 불안, 분노, 자책, 복잡한 생각을 아래 상자에 솔직하게 털어놓으세요. <br />
                                버튼을 누르면 이 상자와 함께 완전히 흔적 없이 타서 사라집니다.
                              </p>
                              <div className="relative">
                                <motion.div
                                  animate={isCrumbling ? {
                                    scale: [1, 0.4, 0],
                                    rotate: [0, 30, -45],
                                    opacity: [1, 0.5, 0],
                                    borderRadius: ["12px", "50px", "100px"]
                                  } : {}}
                                  transition={{ duration: 0.8, ease: "easeInOut" }}
                                >
                                  <textarea
                                    value={thoughtInput}
                                    onChange={(e) => setThoughtInput(e.target.value)}
                                    disabled={isCrumbling}
                                    rows={3}
                                    placeholder="팀장님 말 한마디가 자꾸 마음에 남고, 내가 부족한 것 같아 미치겠음..."
                                    className={`w-full p-3 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500/50 resize-none border ${
                                      theme === "midnight"
                                        ? "bg-neutral-900/60 border-neutral-700 text-neutral-100 placeholder-neutral-500"
                                        : "bg-neutral-50 border-neutral-200 text-neutral-800 placeholder-neutral-400"
                                    }`}
                                  />
                                </motion.div>
                              </div>
                              <div className="flex justify-end">
                                <button
                                  onClick={handleEmptyThoughtDump}
                                  disabled={!thoughtInput.trim() || isCrumbling}
                                  className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                                    !thoughtInput.trim() || isCrumbling
                                      ? "opacity-50 cursor-not-allowed bg-neutral-100 text-neutral-400 dark:bg-neutral-850"
                                      : "bg-neutral-950 text-white hover:bg-neutral-850 active:scale-95"
                                  }`}
                                >
                                  {isCrumbling ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>생각 뭉개는 중...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>생각 쓰레기통에 버리기 🗑️</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-center py-6 space-y-3"
                            >
                              <div className="text-3xl animate-bounce">✨🗑️✨</div>
                              <div>
                                <h4 className="font-extrabold text-sm text-neutral-800 dark:text-neutral-100">머릿속 생각 완전히 비워냄!</h4>
                                <p className="text-[11px] text-neutral-400 mt-1 max-w-xs mx-auto">
                                  당신의 머리를 무겁게 짓누르던 생각 파편을 쓰레기통에 영구히 버리고 분쇄했습니다. 이곳에 지친 마음을 온전히 두고 편히 쉬어 가세요.
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  setIsDumped(false);
                                  setThoughtInput("");
                                }}
                                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-all active:scale-95"
                              >
                                새로운 생각 버리기 📝
                              </button>
                            </motion.div>
                          )}
                        </div>
                      )}

                      {/* Tab Content 3: 한 줄 처방전 */}
                      {toolkitTab === "prescription" && (
                        <div className="space-y-4 py-1">
                          <p className="text-xs text-neutral-400 leading-relaxed">
                            복잡하게 여러 마디 대화를 나누는 것도 피곤한 순간인가요? <br />
                            지금 처한 답답한 상황을 <strong>딱 한 문장</strong>으로 입력하시면, 정신체리가 즉각적으로 <strong>[딱 1줄의 위로 공감 + 1줄 행동 처방]</strong>을 내려드릴게요.
                          </p>

                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={prescriptionInput}
                                onChange={(e) => setPrescriptionInput(e.target.value)}
                                disabled={isPrescribing}
                                placeholder="팀장님한테 기획서 까여서 멘탈 탈탈 털리고 힘이 빠짐"
                                className={`flex-1 p-3 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-500/50 border ${
                                  theme === "midnight"
                                    ? "bg-neutral-900/60 border-neutral-700 text-neutral-100 placeholder-neutral-500"
                                    : "bg-neutral-50 border-neutral-200 text-neutral-800 placeholder-neutral-400"
                                }`}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && prescriptionInput.trim() && !isPrescribing) {
                                    handleGetPrescription();
                                  }
                                }}
                              />
                              <button
                                onClick={handleGetPrescription}
                                disabled={!prescriptionInput.trim() || isPrescribing}
                                className={`px-4 py-3 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                                  !prescriptionInput.trim() || isPrescribing
                                    ? "opacity-50 cursor-not-allowed bg-neutral-100 text-neutral-400 dark:bg-neutral-850"
                                    : "bg-rose-600 text-white hover:bg-rose-500 active:scale-95 shadow-md shadow-rose-500/10"
                                }`}
                              >
                                {isPrescribing ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <span>즉시 처방 💊</span>
                                )}
                              </button>
                            </div>

                            {isPrescribing && (
                              <div className="py-6 text-center space-y-2">
                                <Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" />
                                <p className="text-[11px] text-neutral-400 font-medium animate-pulse">정신체리가 1초 명약 처방전을 조제하는 중입니다... 🍒</p>
                              </div>
                            )}

                            {!isPrescribing && prescriptionResult && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`p-4 rounded-xl border relative ${
                                  theme === "midnight"
                                    ? "bg-neutral-900/50 border-rose-500/20"
                                    : "bg-rose-50/50 border-rose-100"
                                }`}
                              >
                                <div className="absolute right-4 top-4 text-xs font-bold text-rose-500/40 uppercase tracking-widest font-mono select-none">Prescription</div>
                                <div className="space-y-3.5">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-500">
                                      <span>❤️</span>
                                      <span>따뜻한 한 줄 약제</span>
                                    </div>
                                    <p className="text-xs font-extrabold text-neutral-800 dark:text-neutral-100 leading-relaxed break-keep">
                                      {prescriptionResult.comfort}
                                    </p>
                                  </div>

                                  <div className="space-y-1 border-t border-dashed border-neutral-200 dark:border-neutral-700/50 pt-2.5">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                                      <span>🚀</span>
                                      <span>오늘의 1초 행동 지침</span>
                                    </div>
                                    <p className="text-xs font-extrabold text-neutral-800 dark:text-neutral-100 leading-relaxed break-keep">
                                      {prescriptionResult.action}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-4 flex justify-end gap-2 pt-2">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(`[정신체리 한줄 처방]\n\n위로: ${prescriptionResult.comfort}\n행동: ${prescriptionResult.action}`);
                                      setInAppToast({
                                        title: "📋 처방전 복사 완료",
                                        desc: "처방전 텍스트가 클립보드에 성공적으로 복사되었습니다!"
                                      });
                                    }}
                                    className={`text-[10px] font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
                                      theme === "midnight"
                                        ? "bg-neutral-800 text-neutral-300 hover:bg-neutral-750"
                                        : "bg-neutral-50 text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
                                    }`}
                                  >
                                    텍스트 복사 📋
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      // Trigger dopamine confetti to celebrate!
                                      triggerDopamineConfetti(e.currentTarget);
                                      setInAppToast({
                                        title: "💾 보관함에 복용 완료",
                                        desc: "소중한 행동 처방이 마음에 깊이 기억되었습니다. 하루 1%씩 건강해지세요!"
                                      });
                                    }}
                                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-all active:scale-95"
                                  >
                                    처방 복용하기 🍒
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Daily Insight Card with Manual Trigger */}
                    <div className={`p-4 rounded-2xl border shadow-sm transition-all duration-300 relative overflow-hidden flex items-center gap-4 ${
                      theme === "midnight" 
                        ? "bg-neutral-800 border-neutral-700 text-neutral-100" 
                        : "bg-white border-neutral-100 text-neutral-900"
                    }`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        theme === "midnight" ? "bg-rose-950/40 text-rose-400" : "bg-rose-50 text-rose-600"
                      }`}>
                        <Lightbulb className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            theme === "midnight" ? "text-rose-400" : "text-rose-600"
                          }`}>오늘의 생각 다스리기 팁</span>
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                        </div>
                        <h4 className={`text-xs font-bold truncate ${theme === "midnight" ? "text-neutral-100" : "text-neutral-800"}`}>
                          {dailyInsights[dailyInsightIndex].category}
                        </h4>
                        <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                          {dailyInsights[dailyInsightIndex].title}
                        </p>
                      </div>
                      <button
                        onClick={() => setShowDailyInsight(true)}
                        className={`text-xs font-bold py-1.5 px-3 rounded-lg transition-all active:scale-95 cursor-pointer ${
                          theme === "midnight" 
                            ? "bg-rose-950/50 text-rose-400 hover:bg-rose-900/50 border border-rose-500/30" 
                            : "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100"
                        }`}
                      >
                        열기
                      </button>
                    </div>

                    {/* Weekly Consistency Heatmap Tracker */}
                    <WeeklyConsistencyTracker 
                      completionHistory={completionHistory}
                      onAddManualCompletion={(dateStr) => incrementCompletionCount(dateStr)}
                      onClearHistory={clearCompletionHistory}
                      theme={theme}
                    />

                    {/* Mission Header */}
                    <div className="flex items-center justify-between">
                      <h3 className={`font-display font-extrabold text-base ${
                        theme === "midnight" ? "text-neutral-100" : "text-neutral-800"
                      }`}>
                        오늘의 단단 체리 미션
                      </h3>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                        theme === "midnight" 
                          ? "text-rose-400 bg-rose-950/20 border-rose-900/40" 
                          : "text-rose-600 bg-rose-50 border-rose-100"
                      }`}>
                        {missions.filter(m => m.status === "COMPLETED").length} / {missions.length} 완료
                      </span>
                    </div>

                    {/* Mission List */}
                    <div className="space-y-3">
                      {missions.map((mission) => (
                        <div 
                          key={mission.id}
                          id={`mission-card-${mission.id}`}
                          onClick={() => handleToggleMission(mission.id)}
                          className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col gap-3.5 ${
                            mission.status === "COMPLETED" 
                              ? theme === "midnight"
                                ? "bg-emerald-950/15 border-emerald-900/30 text-neutral-400 hover:bg-emerald-950/20"
                                : "bg-emerald-50/30 border-emerald-100/80 text-neutral-500 hover:bg-emerald-50/50" 
                              : mission.status === "ACTIVE"
                                ? theme === "midnight"
                                  ? "bg-neutral-800 border-rose-500/30 shadow-sm hover:border-rose-500/50 text-neutral-100"
                                  : "bg-white border-rose-200 shadow-sm hover:border-rose-300 text-neutral-900"
                                : theme === "midnight"
                                  ? "bg-neutral-800 border-neutral-800 hover:border-neutral-750 text-neutral-300"
                                  : "bg-white border-neutral-100 shadow-sm hover:border-neutral-200 text-neutral-900"
                          }`}
                        >
                          {/* Inner Content Wrapper */}
                          <div className="flex items-start gap-4 w-full">
                            {/* Checkbox Icon with smooth transitions and sparkles */}
                            <div className="flex-shrink-0 relative">
                              <AnimatePresence mode="wait">
                                {mission.status === "COMPLETED" ? (
                                  <motion.div
                                    key="completed"
                                    initial={{ scale: 0.6, rotate: -45, opacity: 0 }}
                                    animate={{ 
                                      scale: [0.6, 1.2, 0.95, 1], 
                                      rotate: 0, 
                                      opacity: 1,
                                    }}
                                    transition={{ duration: 0.45, ease: "easeOut" }}
                                    className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm relative animate-pulse-once"
                                  >
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      transition={{ delay: 0.1, duration: 0.2 }}
                                    >
                                      <CheckCircle className="w-5.5 h-5.5 fill-emerald-100 dark:fill-emerald-950/50 text-emerald-600 dark:text-emerald-400" />
                                    </motion.div>
                                    
                                    {/* Sparkle animated elements */}
                                    <motion.span 
                                      animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0] }}
                                      transition={{ duration: 0.8, delay: 0.1, repeat: Infinity, repeatDelay: 3 }}
                                      className="absolute -top-1.5 -right-1.5 text-[11px] pointer-events-none"
                                    >
                                      ✨
                                    </motion.span>
                                    <motion.span 
                                      animate={{ scale: [0, 1.1, 0], opacity: [0, 1, 0] }}
                                      transition={{ duration: 0.8, delay: 0.4, repeat: Infinity, repeatDelay: 4 }}
                                      className="absolute -bottom-1 -left-1 text-[9px] pointer-events-none"
                                    >
                                      ✨
                                    </motion.span>
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    key="incomplete"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-dashed transition-all duration-300 ${
                                      mission.status === "ACTIVE" 
                                        ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-900/60 shadow-inner" 
                                        : "bg-neutral-100 dark:bg-neutral-850 text-neutral-400 dark:text-neutral-500 border-neutral-300 dark:border-neutral-700"
                                    }`}
                                  >
                                    <Sparkles className={`w-4 h-4 ${mission.status === "ACTIVE" ? "animate-pulse" : ""}`} />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Text content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <h4 className={`text-sm font-bold truncate transition-all duration-300 ${
                                  mission.status === "COMPLETED" 
                                    ? "line-through text-neutral-400 dark:text-neutral-500 decoration-neutral-400/40" 
                                    : "text-neutral-900 dark:text-neutral-100"
                                }`}>
                                  {mission.title}
                                </h4>
                                {mission.status === "ACTIVE" && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-[9px] font-mono font-bold text-white tracking-wider">
                                    ACTIVE
                                  </span>
                                )}
                              </div>
                              <p className={`text-xs break-words whitespace-normal transition-all duration-300 ${
                                mission.status === "COMPLETED"
                                  ? "line-through text-neutral-400/70 dark:text-neutral-500/70 decoration-neutral-400/30"
                                  : "text-neutral-500 dark:text-neutral-400"
                              }`}>
                                {mission.description}
                              </p>
                            </div>

                            {/* Stat value */}
                            <div className="text-right flex-shrink-0">
                              <div className="text-[10px] font-mono text-neutral-400 font-bold">
                                Prefrontal
                              </div>
                              <div className={`text-xs font-mono font-extrabold transition-all duration-300 ${
                                mission.status === "COMPLETED" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                              }`}>
                                +{mission.activationBonus}%
                              </div>
                            </div>
                          </div>

                          {/* Complete Mission Button - Excluded when completed */}
                          {mission.status !== "COMPLETED" && (
                            <div className="flex justify-end w-full border-t border-dashed border-neutral-100 dark:border-neutral-700/50 pt-2.5">
                              <button
                                id={`btn-complete-mission-${mission.id}`}
                                onClick={(e) => handleCompleteMissionDirectly(mission.id, e)}
                                className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 border cursor-pointer shadow-sm ${
                                  mission.status === "ACTIVE"
                                    ? "bg-rose-600 hover:bg-rose-500 text-white border-rose-600"
                                    : theme === "midnight"
                                      ? "bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border-neutral-700"
                                      : "bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border-neutral-200"
                                }`}
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                미션 완료하기
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* 나의 인지 회복 실천 일지 (CBT Clinical Practice Journal Logs) */}
                    <div className={`p-5 rounded-2xl border shadow-sm transition-all duration-300 ${
                      theme === "midnight" 
                        ? "bg-neutral-800 border-neutral-700 text-neutral-100" 
                        : "bg-white border-neutral-100 text-neutral-900"
                    }`}>
                      <div className="flex items-center justify-between mb-4 border-b border-neutral-100 dark:border-neutral-850 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📖</span>
                          <div>
                            <h3 className="font-display font-extrabold text-xs uppercase tracking-tight">나의 인지 회복 실천 일지</h3>
                            <p className="text-[9px] text-neutral-400 font-medium">실천 클리닉을 통해 교정된 생각의 기록</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          theme === "midnight" ? "bg-neutral-900 text-neutral-400" : "bg-neutral-50 text-neutral-500"
                        }`}>
                          총 {cbtLogs.length}건
                        </span>
                      </div>

                      {cbtLogs.length === 0 ? (
                        <div className="py-8 text-center px-4">
                          <p className="text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto">
                            아직 작성된 실천 일지가 없네요. <br />
                            <strong>체리 미션을 클릭</strong>하여 마음 돌봄 실천 클리닉을 시작하고 왜곡된 생각 회로를 함께 다듬어 보세요! 🍒
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                          {cbtLogs.map((log) => (
                            <div 
                              key={log.id} 
                              className={`p-4 rounded-xl border relative transition-all text-xs space-y-3 ${
                                theme === "midnight" 
                                  ? "bg-neutral-900/40 border-neutral-700/60 text-neutral-300" 
                                  : "bg-neutral-50/50 border-neutral-150 text-neutral-700"
                              }`}
                            >
                              {/* Log Header */}
                              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/40 pb-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-rose-500 text-xs font-bold">🍒</span>
                                  <span className="font-extrabold text-neutral-800 dark:text-neutral-100 text-xs">{log.missionTitle}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] text-neutral-400 font-medium font-mono">{log.timestamp}</span>
                                  <button
                                    onClick={(e) => handleDeleteCbtLog(log.id, e)}
                                    className="p-1 text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer"
                                    title="일지 삭제"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {/* Log Inputs customized by Mission */}
                              {log.missionId === "m-1" && (
                                <div className="space-y-2 text-[11px] leading-relaxed">
                                  <div>
                                    <span className="font-bold text-neutral-400 block text-[9px] uppercase tracking-wider">나를 괴롭히던 자책 생각</span>
                                    <p className="line-through text-neutral-400 italic bg-rose-500/5 p-2 rounded-lg mt-0.5">"{log.inputs.worry}"</p>
                                  </div>
                                  <div>
                                    <span className="font-bold text-neutral-400 block text-[9px] uppercase tracking-wider">사랑하는 친구로 대입해 본 다정한 조언</span>
                                    <p className="font-bold text-rose-600 dark:text-rose-400 bg-rose-500/5 p-2 rounded-lg mt-0.5 border border-rose-500/10">"{log.inputs.friendAdvice}"</p>
                                  </div>
                                  <div>
                                    <span className="font-bold text-neutral-400 block text-[9px] uppercase tracking-wider">위로를 나 자신에게 대입해 본 깨달음</span>
                                    <p className="text-neutral-800 dark:text-neutral-200 bg-emerald-500/5 p-2 rounded-lg mt-0.5 border border-emerald-500/10">"{log.inputs.reframing}"</p>
                                  </div>
                                </div>
                              )}

                              {log.missionId === "m-2" && (
                                <div className="space-y-2 text-[11px] leading-relaxed">
                                  <div>
                                    <span className="font-bold text-neutral-400 block text-[9px] uppercase tracking-wider">마음속 복잡하던 원래의 감정 덩어리</span>
                                    <p className="text-neutral-400 italic bg-neutral-100 dark:bg-neutral-800/40 p-2 rounded-lg mt-0.5">"{log.inputs.worry}"</p>
                                  </div>
                                  <div>
                                    <span className="font-bold text-neutral-400 block text-[9px] uppercase tracking-wider">세밀하게 해체하여 붙인 내 정밀한 감정 이름표</span>
                                    <p className="font-bold text-rose-500 bg-rose-500/5 p-2 rounded-lg mt-0.5 inline-block border border-rose-500/10">🏷️ {log.inputs.granularity}</p>
                                  </div>
                                  <div>
                                    <span className="font-bold text-neutral-400 block text-[9px] uppercase tracking-wider">감정을 있는 그대로 마주하고 품은 소회</span>
                                    <p className="text-neutral-800 dark:text-neutral-200 bg-emerald-500/5 p-2 rounded-lg mt-0.5 border border-emerald-500/10">"{log.inputs.reframing}"</p>
                                  </div>
                                </div>
                              )}

                              {log.missionId === "m-3" && (
                                <div className="space-y-2 text-[11px] leading-relaxed">
                                  <div>
                                    <span className="font-bold text-neutral-400 block text-[9px] uppercase tracking-wider">원래의 고민과 스트레스 사건</span>
                                    <p className="text-neutral-400 italic bg-neutral-100 dark:bg-neutral-800/40 p-2 rounded-lg mt-0.5">"{log.inputs.worry}"</p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div className="bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-[9px] uppercase tracking-wider">CAMERA FACT (객관적 사실)</span>
                                      <p className="mt-0.5 text-neutral-700 dark:text-neutral-300">"{log.inputs.fact}"</p>
                                    </div>
                                    <div className="bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                                      <span className="font-bold text-amber-500 block text-[9px] uppercase tracking-wider">MIND DISTORTION (왜곡된 생각)</span>
                                      <p className="mt-0.5 text-neutral-500 italic">"{log.inputs.opinion}"</p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {log.missionId === "m-4" && (
                                <div className="space-y-2 text-[11px] leading-relaxed">
                                  <div>
                                    <span className="font-bold text-neutral-400 block text-[9px] uppercase tracking-wider">나를 지배하던 절망적이고 파국적인 예단</span>
                                    <p className="line-through text-neutral-400 italic bg-neutral-100 dark:bg-neutral-800/40 p-2 rounded-lg mt-0.5">"{log.inputs.anxiousAssert}"</p>
                                  </div>
                                  <div>
                                    <span className="font-bold text-neutral-400 block text-[9px] uppercase tracking-wider">인지적 꼬리표('~라는 착각')를 붙이고 거리를 둔 후</span>
                                    <p className="font-bold text-rose-600 dark:text-rose-400 bg-rose-500/5 p-2 rounded-lg mt-0.5 border border-rose-500/10">
                                      "나는 {log.inputs.anxiousAssert} 라는 생각이 내 머릿속을 잠시 스쳐 지나갔을 뿐임을 안다."
                                    </p>
                                  </div>
                                  <div>
                                    <span className="font-bold text-neutral-400 block text-[9px] uppercase tracking-wider">반전 선언 후 달라진 가벼운 소회</span>
                                    <p className="text-neutral-800 dark:text-neutral-200 bg-emerald-500/5 p-2 rounded-lg mt-0.5 border border-emerald-500/10">"{log.inputs.reframing}"</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Hard truth quotes */}
                    <div className="bg-neutral-950 text-white rounded-2xl p-5 relative overflow-hidden shadow-md">
                      <div className="absolute -top-10 -right-10 w-28 h-28 bg-rose-500/10 rounded-full blur-2xl"></div>
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-rose-400" />
                        <span className="text-[10px] font-bold tracking-widest text-rose-400">
                          생각 다듬기 한마디
                        </span>
                      </div>
                      <p className="font-display font-bold text-base text-neutral-100 leading-relaxed mb-4">
                        &ldquo;생각은 스쳐 지나가는 바람일 뿐 사실이 아닙니다. 복잡한 마음에 잠시 가려져 걱정하고 있었던 것뿐이에요.&rdquo;
                      </p>
                      <button 
                        onClick={() => {
                          setActiveTab("chat");
                        }}
                        className="w-full bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold py-3 rounded-lg transition-colors cursor-pointer"
                      >
                        대항하기 미션 대화 시작
                      </button>
                    </div>

                    {/* Weekly metrics */}
                    <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm">
                      <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4">
                        주간 인지 강화 지표
                      </h3>
                      <div className="grid grid-cols-7 gap-1 sm:gap-2">
                        {weeklyLogs.map((log, i) => (
                          <div key={i} className="flex flex-col items-center gap-1.5">
                            <div className={`w-full aspect-square rounded-lg flex items-center justify-center transition-all ${
                              log.intensity === "high" 
                                ? "bg-rose-600 text-white shadow-sm" 
                                : log.intensity === "medium"
                                  ? "bg-rose-100 text-rose-700 border border-rose-200"
                                  : log.intensity === "low"
                                    ? "bg-rose-50 text-rose-600 border border-rose-100"
                                    : "bg-neutral-100 border border-neutral-200"
                            }`}>
                              {log.active ? (
                                <Heart className="w-4.5 h-4.5" />
                              ) : (
                                <div className="w-1.5 h-1.5 rounded-full bg-neutral-300"></div>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-neutral-400">
                              {log.day}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "chat" && (
                  
                  /* --------------- CHAT TAB --------------- */
                  <div className="flex-1 flex flex-col min-h-0">
                    
                    {/* Chat room top header with Summary button */}
                    <div className={`px-4 sm:px-8 md:px-12 lg:px-16 py-3 border-b flex items-center justify-between transition-colors duration-300 ${
                      theme === "midnight" ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-100"
                    }`}>
                      <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 select-none">
                          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></div>
                          <span className={`text-xs font-extrabold tracking-tight ${theme === "midnight" ? "text-neutral-200" : "text-neutral-800"}`}>
                            정신체리와의 마음 상담실
                          </span>
                        </div>
                        
                        <button
                          id="btn-summarize-chat"
                          onClick={handleSummarizeChat}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full active:scale-95 text-[11px] font-extrabold transition-all border cursor-pointer shadow-sm ${
                            theme === "midnight" 
                              ? "bg-rose-950/40 text-rose-300 border-rose-900/50 hover:bg-rose-900/40 hover:border-rose-800" 
                              : "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-100 hover:border-rose-200"
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          오늘의 마음 핵심 요약
                        </button>
                      </div>
                    </div>

                    {/* Progress Indicator for current dialogue stage */}
                    <div className={`px-4 sm:px-8 md:px-12 lg:px-16 py-3 border-b transition-colors duration-300 ${
                      theme === "midnight" ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-100"
                    }`}>
                      <div className="max-w-3xl mx-auto w-full flex flex-col">
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <div className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                            currentStage === "EMOTIONAL" || currentStage === "RATIONAL" || currentStage === "ACTIONABLE" 
                              ? "bg-rose-600" 
                              : theme === "midnight" ? "bg-neutral-800" : "bg-neutral-200"
                          }`}></div>
                          <div className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                            currentStage === "RATIONAL" || currentStage === "ACTIONABLE" 
                              ? "bg-rose-600" 
                              : theme === "midnight" ? "bg-neutral-800" : "bg-neutral-200"
                          }`}></div>
                          <div className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${
                            currentStage === "ACTIONABLE" 
                              ? "bg-rose-600" 
                              : theme === "midnight" ? "bg-neutral-800" : "bg-neutral-200"
                          }`}></div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold tracking-tight px-0.5 select-none">
                          <span className={currentStage === "EMOTIONAL" ? "text-rose-600 scale-105" : "text-neutral-400"}>1단계: 마음 털어놓기</span>
                          <span className={currentStage === "RATIONAL" ? "text-rose-600 scale-105" : "text-neutral-400"}>2단계: 객관적으로 보기</span>
                          <span className={currentStage === "ACTIONABLE" ? "text-rose-600 scale-105" : "text-neutral-400"}>3단계: 직접 실천하기</span>
                        </div>
                      </div>
                    </div>

                    {/* Chat Messages Log */}
                    <div 
                      ref={chatContainerRef}
                      className="flex-1 overflow-y-auto px-4 sm:px-8 md:px-12 lg:px-16 py-4"
                      style={{ maxHeight: 'calc(100vh - 256px)' }}
                    >
                      <div className="max-w-3xl mx-auto w-full space-y-4 flex flex-col">
                        {messages.map((message, idx) => {
                          const isAssistant = message.role === "assistant";
                          const isLast = idx === messages.length - 1;
                          const shouldType = isAssistant && isLast && !completedTypedMessageIds.includes(message.id);
                          return (
                            <div 
                              key={message.id}
                              className={`flex flex-col ${isAssistant ? "items-start" : "items-end"} space-y-1 w-full`}
                            >
                              {/* Dialogue header badge */}
                              {isAssistant && message.stage && (
                               <span className="text-[9.5px] font-bold px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 ml-1 sm:ml-9 mb-0.5 select-none">
                                  {message.stage === "EMOTIONAL" ? "1단계: 마음 털어놓기" : message.stage === "RATIONAL" ? "2단계: 객관적으로 보기" : "3단계: 직접 실천하기"}
                                </span>
                              )}

                              <div className={`flex items-end gap-2 w-full max-w-[85%] sm:max-w-[90%] md:max-w-[92%] lg:max-w-[95%] ${isAssistant ? "justify-start mr-auto" : "justify-end ml-auto"}`}>
                                {isAssistant && (
                                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-neutral-100 shadow-sm hidden sm:block">
                                    <img 
                                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuBQm9HpyLC4oEHuAFVmoGqMzCeiPx-miwLYyI6KPYw7DeeZD__k-p6z1HQicQVe7tCwrTNgvNH5mi2IrDQGEpDdUlowpJ_yUaqwJZu-n4-fnTiTHjjcCilo_9OQCRvwiwxVqBe1XXnw2SXt3LJ2OYvyxu7zGSjKzdDG3P7vAehmsrdPuYc6o2gnaGq0jSLEDsOfPZ3cKhf2qHtHPZJZkzDlVh4i2zY6vUQY3wA_3mRhEF_xySNfiZNxFSPpjFLJGe8KyAbNjDrghJY" 
                                      alt="Cherry Profile" 
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                )}
                                
                                <div className={`p-4 rounded-2xl ${
                                  isAssistant 
                                    ? theme === "midnight"
                                      ? "bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-tl-none shadow-sm"
                                      : "bg-white border border-neutral-100 text-neutral-800 rounded-tl-none shadow-sm"
                                    : "bg-rose-600 text-white rounded-tr-none shadow-sm"
                                }`}>
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                    {shouldType ? (
                                      <Typewriter 
                                        text={message.content}
                                        onComplete={() => setCompletedTypedMessageIds(prev => [...prev, message.id])}
                                      />
                                    ) : (
                                      message.content
                                    )}
                                  </p>
                                </div>

                                <span className="text-[9px] text-neutral-400 whitespace-nowrap mb-1">
                                  {message.timestamp}
                                </span>
                              </div>

                              {/* Render interactive diagnostic card inside message flow */}
                            {isAssistant && message.card && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="w-full max-w-sm mt-3 ml-0 sm:ml-8"
                              >
                                {message.card.type === "fact_check" ? (
                                  
                                  /* Fact Check / Cognitive distortion analysis card */
                                  <div className={`border-l-[6px] border-rose-600 rounded-2xl p-5 shadow-sm border ${
                                    theme === "midnight" ? "bg-neutral-800 border-neutral-700" : "bg-white border-neutral-100"
                                  }`}>
                                    <div className="flex items-center gap-2.5 mb-3">
                                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                        theme === "midnight" ? "bg-rose-950/50 text-rose-400" : "bg-rose-50 text-rose-600"
                                      }`}>
                                        <Eye className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <h4 className="text-xs font-bold text-rose-600 uppercase tracking-widest font-mono">
                                          {message.card.title}
                                        </h4>
                                        <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
                                          {message.card.subtitle}
                                        </p>
                                      </div>
                                    </div>
                                    <p className={`text-xs leading-relaxed font-medium ${
                                      theme === "midnight" ? "text-neutral-300" : "text-neutral-600"
                                    }`}>
                                      {message.card.content}
                                    </p>
                                    {message.card.metric && (
                                      <div className={`mt-4 pt-3 border-t flex items-center justify-between ${
                                        theme === "midnight" ? "border-neutral-700" : "border-neutral-50"
                                      }`}>
                                        <span className="text-[10px] font-bold text-rose-600">생각 정리도</span>
                                        <span className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded ${
                                          theme === "midnight" ? "text-rose-400 bg-rose-950/40 border border-rose-900/30" : "text-rose-600 bg-rose-50"
                                        }`}>
                                          {message.card.metric}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                ) : (

                                  /* CBT Mission recommendation card */
                                  <div className="bg-neutral-900 text-white rounded-2xl p-4 shadow-md border border-neutral-800">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                                        <span className="text-[10px] font-mono tracking-widest text-emerald-400 font-bold uppercase">
                                          {message.card.title}
                                        </span>
                                      </div>
                                      {message.card.metric && (
                                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold font-mono px-1.5 py-0.5 rounded">
                                          {message.card.metric}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-neutral-200 font-medium leading-relaxed mb-3">
                                      {message.card.content}
                                    </p>
                                    <button 
                                      onClick={(e) => {
                                        // Auto-activate mission
                                        setMissions(prev => prev.map(m => {
                                          if (m.title.includes("분리") || m.title.includes("대입") || m.title.includes("회로")) {
                                            return { ...m, status: "ACTIVE" };
                                          }
                                          return m;
                                        }));
                                        
                                        // Play satisfying confetti reward
                                        triggerDopamineConfetti(e.currentTarget);

                                        setInAppToast({
                                          title: "⚡ 행동 미션 연계 완료!",
                                          desc: "정신체리가 추천한 생각 회로 반전 훈련이 '오늘의 미션' 탭에 활성화되었습니다."
                                        });
                                      }}
                                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                                    >
                                      내 미션 보드에 활성화하기 ⚡
                                    </button>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Chat input form container pinned to bottom */}
                  <div className={`border-t p-4 select-none ${
                    theme === "midnight" ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-100"
                  }`}>
                    <div className="max-w-3xl mx-auto space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-1.5 select-none break-keep text-left">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
                            {currentStage === "ACTIONABLE" ? "나의 행동 계획 및 의견 작성" : "마음 대화 입력"}
                          </span>
                          <span className="text-[9.5px] text-neutral-400 font-medium">
                            {currentStage === "ACTIONABLE" ? "💡 위 추천 솔루션에 대한 의견을 들려주세요" : "🍒 정신체리와 편하게 이야기하세요"}
                          </span>
                        </div>

                        {/* Text Input area */}
                        <div className="flex items-center gap-2">
                          <div className={`flex-1 border focus-within:border-rose-300 focus-within:ring-2 focus-within:ring-rose-100 rounded-2xl px-4 py-2.5 flex items-center gap-2 transition-all ${
                            theme === "midnight" ? "bg-neutral-950 border-neutral-800 text-neutral-100" : "bg-neutral-50 border-neutral-200 text-neutral-800"
                          }`}>
                            <textarea
                              value={inputValue}
                              onChange={(e) => setInputValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendMessage();
                                }
                              }}
                              placeholder={
                                currentStage === "EMOTIONAL" 
                                  ? "현재 어떤 고민이 머릿속을 복잡하게 만드나요? 🍒" 
                                  : currentStage === "RATIONAL"
                                    ? "한 발짝 떨어져 생각을 가만히 바라보고 나누어 봅시다..."
                                    : "행동 미션에 대한 나의 생각이나 편안한 다짐을 입력해 주세요... 🍒"
                              }
                              rows={1}
                              className={`flex-1 bg-transparent border-none outline-none focus:ring-0 text-sm placeholder-neutral-400 resize-none max-h-24 leading-relaxed ${
                                theme === "midnight" ? "text-neutral-100" : "text-neutral-800"
                              }`}
                            />
                            <button className="text-neutral-400 hover:text-neutral-600 p-1 rounded-full transition-colors">
                              <Paperclip className="w-4.5 h-4.5" />
                            </button>
                          </div>
                          <button 
                            onClick={handleSendMessage}
                            disabled={!inputValue.trim() || isLoading}
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                              inputValue.trim() && !isLoading 
                                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-md active:scale-90" 
                                : "bg-neutral-100 text-neutral-300"
                            }`}
                          >
                            <Send className="w-4.5 h-4.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {activeTab === "profile" && (
                  
                  /* --------------- PROFILE TAB --------------- */
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-5 pt-5 pb-8 space-y-6 max-w-3xl mx-auto w-full"
                  >
                    {/* Floating Dopamine Toast notification */}
                    <AnimatePresence>
                      {showDopamineToast && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -10 }}
                          className="bg-emerald-600 text-white p-4 rounded-2xl shadow-lg flex items-center gap-3 border border-emerald-500"
                        >
                          <Sparkles className="w-5 h-5 text-emerald-200 animate-spin flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs font-extrabold font-display">⚡ 마음 회복 에너지 활성화 완료!</p>
                            <p className="text-[10px] text-emerald-100 font-medium leading-relaxed">
                              부정적인 생각에서 벗어나 스스로 마음을 잘 보살핀 덕분에, 마음 밸런스가 한층 더 든든하고 편안해졌습니다.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Google Social Login Integration Panel */}
                    <div className={`p-5 rounded-2xl border shadow-sm transition-colors duration-300 relative overflow-hidden ${
                      theme === "midnight" ? "bg-neutral-800 border-neutral-700" : "bg-white border-neutral-100"
                    }`}>
                      {currentUser ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            {currentUser.photoURL ? (
                              <img 
                                src={currentUser.photoURL} 
                                alt={currentUser.displayName || "User Profile"} 
                                className="w-12 h-12 rounded-full border border-neutral-200 object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold font-display uppercase border ${
                                theme === "midnight" ? "bg-neutral-700 border-neutral-600 text-rose-400" : "bg-rose-50 border-rose-100 text-rose-600"
                              }`}>
                                {(currentUser.displayName || currentUser.email || "U").substring(0, 1)}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-display font-extrabold text-sm ${theme === "midnight" ? "text-neutral-100" : "text-neutral-900"}`}>
                                  {currentUser.displayName || "사용자 계정"}
                                </span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                  구글 연동 완료 🍒
                                </span>
                              </div>
                              <p className="text-[11px] text-neutral-400 font-medium">
                                {currentUser.email}
                              </p>
                            </div>
                          </div>
                          
                          <button
                            onClick={handleSignOut}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                              theme === "midnight" 
                                ? "bg-neutral-700 hover:bg-neutral-650 text-neutral-300" 
                                : "bg-neutral-100 hover:bg-neutral-200 text-neutral-600"
                            }`}
                          >
                            로그아웃
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                              theme === "midnight" ? "bg-neutral-700/50 border-neutral-600 text-rose-400" : "bg-rose-50 border-rose-100 text-rose-600"
                            }`}>
                              <Sparkles className="w-4.5 h-4.5" />
                            </div>
                            <div className="space-y-1">
                              <h4 className={`text-sm font-bold ${theme === "midnight" ? "text-neutral-100" : "text-neutral-900"}`}>
                                구글 계정을 연동해 보세요 🍒
                              </h4>
                              <p className="text-[11px] text-neutral-400 leading-relaxed">
                                내 마음 상담 내역과 CBT 실천 미션 기록을 안전하게 저장하고 보호하세요. 기기를 교체하더라도 로그인 즉시 모든 상담 기록을 복원해 드립니다. 
                                <br />
                                <span className={`font-semibold ${theme === "midnight" ? "text-rose-400" : "text-rose-600"}`}>
                                  ※ 게스트 대화 기록은 로그인 시 구글 계정으로 즉시 안전하게 마이그레이션 및 병합됩니다.
                                </span>
                              </p>
                            </div>
                          </div>
                          
                          <button
                            onClick={handleGoogleSignIn}
                            className="w-full flex items-center justify-center gap-2.5 bg-white border border-neutral-300 rounded-xl px-4 py-3 text-xs font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50 active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                              <path fill="#EA4335" d="M12 5.04c1.7 0 3.2.6 4.4 1.8l3.3-3.3C17.7 1.6 15 1 12 1 7.3 1 3.4 3.7 1.5 7.6l3.9 3c.9-2.7 3.4-4.5 6.6-4.5z"/>
                              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"/>
                              <path fill="#FBBC05" d="M5.4 14.6c-.2-.7-.4-1.5-.4-2.3c0-.8.2-1.6.4-2.3L1.5 7C.5 8.9 0 11.1 0 13.5s.5 4.6 1.5 6.5l3.9-3z"/>
                              <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-2.9l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2c-3.2 0-5.7-1.8-6.6-4.5l-3.9 3c1.9 3.9 5.8 6.6 10.5 6.6z"/>
                            </svg>
                            <span>Google 계정으로 계속하기 (자동 데이터 병합)</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Visual mind balance metric card */}
                    <div className={`p-5 rounded-2xl border shadow-sm flex items-center gap-5 transition-colors duration-300 ${
                      theme === "midnight" ? "bg-neutral-800 border-neutral-700" : "bg-white border-neutral-100"
                    }`}>
                      <div className={`w-20 h-20 rounded-full border flex items-center justify-center flex-shrink-0 relative transition-colors ${
                        theme === "midnight" ? "bg-neutral-700 border-neutral-600" : "bg-rose-50 border-rose-100"
                      }`}>
                        <Heart className={`w-10 h-10 animate-pulse ${theme === "midnight" ? "text-rose-400" : "text-rose-600"}`} />
                      </div>
                      <div>
                        <h3 className={`font-display font-extrabold text-base transition-colors ${
                          theme === "midnight" ? "text-neutral-100" : "text-neutral-900"
                        }`}>
                          정신체리 마음 밸런스
                        </h3>
                        <p className={`text-xs mt-1 leading-relaxed transition-colors ${
                          theme === "midnight" ? "text-neutral-400" : "text-neutral-500"
                        }`}>
                          대화와 마음 미션을 나누며 한 걸음씩 가꾸어 가는 나의 마음 회복도입니다.
                        </p>
                      </div>
                    </div>

                    {/* Stats bento grid */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      
                      <div className={`p-4 rounded-xl border shadow-sm transition-colors duration-300 ${
                        theme === "midnight" ? "bg-neutral-800 border-neutral-700" : "bg-white border-neutral-100"
                      }`}>
                        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 mb-1">
                          Prefrontal Activation
                        </div>
                        <div className={`text-2xl font-display font-extrabold ${theme === "midnight" ? "text-rose-400" : "text-rose-600"}`}>
                          {syncProgress}%
                        </div>
                        <div className={`w-full h-1 rounded-full mt-2 overflow-hidden transition-colors ${
                          theme === "midnight" ? "bg-neutral-700" : "bg-neutral-100"
                        }`}>
                          <div className={`h-full rounded-full ${theme === "midnight" ? "bg-rose-500" : "bg-rose-600"}`} style={{ width: `${syncProgress}%` }}></div>
                        </div>
                      </div>

                      {/* Card 2: 연속 실천 기록 */}
                      <div 
                        onClick={(e) => {
                          triggerDopamineConfetti(e.currentTarget);
                          setShowDopamineToast(true);
                        }}
                        className={`p-4 rounded-xl border shadow-sm cursor-pointer active:scale-95 transition-all duration-300 relative overflow-hidden group select-none ${
                          theme === "midnight" 
                            ? "bg-neutral-800 border-neutral-700 hover:border-emerald-700" 
                            : "bg-white border-neutral-100 hover:border-emerald-200"
                        }`}
                      >
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                        </div>
                        <div className="text-[10px] font-bold tracking-wider text-neutral-400 mb-1 flex items-center gap-1">
                          연속 실천 기록
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        </div>
                        <div className="text-2xl font-display font-extrabold text-emerald-600 flex items-center gap-1.5">
                          5일째 🍒
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-1 font-bold group-hover:text-emerald-500 transition-colors">
                          터치하여 마음 충전하기 🍒
                        </p>
                      </div>

                    </div>

                    {/* 🍒 Dynamic Mind Profile & Hated Words Settings inside Profile Tab */}
                    <SituationProfileEditor
                      initialSituation={userSituation}
                      onSave={(updated) => {
                        setUserSituation(updated);
                        localStorage.setItem("jc_user_situation", JSON.stringify(updated));
                        
                        // Sync with cloud database securely
                        saveSessionState({
                          messages,
                          currentStage,
                          syncProgress,
                          missions,
                          currentNeuralState,
                          userSituation: updated
                        });
                        
                        triggerDopamineConfetti();
                        setInAppToast({
                          title: "개인화 마음 프로필 업데이트 완료 🍒",
                          desc: "입력하신 내 상황과 금지어가 성공적으로 저장 및 동기화되었습니다. 정신체리가 대화 시 적극적으로 배려하고 반영합니다."
                        });
                        setTimeout(() => setInAppToast(null), 4500);
                      }}
                      theme={theme}
                    />

                    {/* Theme Settings Selection Card */}
                    <div className={`p-5 rounded-2xl border shadow-sm space-y-4 transition-colors duration-300 ${
                      theme === "midnight" ? "bg-neutral-800 border-neutral-700" : "bg-white border-neutral-100"
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          theme === "midnight" ? "bg-rose-950/40 text-rose-400" : "bg-rose-50 text-rose-600"
                        }`}>
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className={`text-xs font-bold ${theme === "midnight" ? "text-neutral-100" : "text-neutral-800"}`}>
                            인터페이스 테마 설정
                          </h4>
                          <p className="text-[10px] text-neutral-400 font-medium">
                            사용자의 환경과 상태에 맞는 비주얼 프리셋 선택
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3.5 pt-1">
                        {/* Cherry Blossom (Light Mode) */}
                        <button
                          onClick={() => setTheme("cherry")}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                            theme === "cherry"
                              ? "border-rose-500 bg-rose-50/20 text-rose-700 font-bold shadow-sm"
                              : theme === "midnight"
                              ? "border-neutral-700 bg-neutral-900/40 text-neutral-400 hover:border-neutral-600"
                              : "border-neutral-100 bg-white text-neutral-500 hover:border-neutral-200"
                          }`}
                        >
                          <Sun className={`w-5 h-5 ${theme === "cherry" ? "text-rose-500" : "text-neutral-400"}`} />
                          <div className="text-center">
                            <span className="text-[11px] block font-display">Cherry Blossom</span>
                            <span className="text-[9px] text-neutral-400 font-medium font-sans">체리 라이트 모드</span>
                          </div>
                        </button>

                        {/* Midnight Neuro (Dark Mode) */}
                        <button
                          onClick={() => setTheme("midnight")}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                            theme === "midnight"
                              ? "border-rose-400 bg-neutral-700 text-rose-400 font-bold shadow-sm"
                              : "border-neutral-100 bg-white text-neutral-500 hover:border-neutral-200"
                          }`}
                        >
                          <Moon className={`w-5 h-5 ${theme === "midnight" ? "text-rose-400" : "text-neutral-400"}`} />
                          <div className="text-center">
                            <span className="text-[11px] block font-display">Midnight Neuro</span>
                            <span className="text-[9px] text-neutral-400 font-medium font-sans">뉴로 다크 모드</span>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Weekly Mood/Synchronization Line Chart */}
                    <div className={`p-5 rounded-2xl border shadow-sm space-y-3 transition-colors duration-300 ${
                      theme === "midnight" ? "bg-neutral-800 border-neutral-700" : "bg-white border-neutral-100"
                    }`}>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                          주간 인지 강화 및 동기화 트렌드
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                          theme === "midnight" ? "bg-rose-950/60 text-rose-400" : "bg-rose-50 text-rose-600"
                        }`}>
                          Prefrontal Sync Trend
                        </span>
                      </div>
                      
                      <div className="h-48 w-full text-xs font-sans">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={moodTrendData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={theme === "midnight" ? "#2a2b2d" : "#f0f0f0"} vertical={false} />
                            <XAxis 
                              dataKey="name" 
                              stroke={theme === "midnight" ? "#737373" : "#a3a3a3"} 
                              fontSize={10}
                              tickLine={false} 
                              axisLine={false} 
                            />
                            <YAxis 
                              domain={[30, 100]} 
                              stroke={theme === "midnight" ? "#737373" : "#a3a3a3"} 
                              fontSize={10}
                              tickLine={false} 
                              axisLine={false} 
                              tickCount={5}
                            />
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-neutral-900 text-white p-2.5 rounded-xl border border-neutral-800 text-[11px] shadow-lg">
                                      <p className="font-bold mb-0.5">{data.name}요일 동기화</p>
                                      <p className="text-rose-400">지표: <span className="font-bold">{payload[0].value}%</span></p>
                                      <p className="text-emerald-400 mt-0.5">상태: <span className="font-medium">{data.mood}</span></p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="sync" 
                              stroke={theme === "midnight" ? "#fb7185" : "#ba1340"} 
                              strokeWidth={3} 
                              activeDot={{ r: 6, strokeWidth: 0, fill: theme === 'midnight' ? '#fb7185' : '#ba1340' }}
                              dot={{ r: 3, stroke: theme === 'midnight' ? '#fb7185' : '#ba1340', strokeWidth: 1, fill: theme === 'midnight' ? '#1e1e1e' : '#ffffff' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <p className="text-[10px] text-neutral-400 text-center font-medium select-none">
                        ※ 마음에 도움되는 미션을 실천할 때마다 나의 마음 밸런스 지표가 실시간으로 튼튼하게 채워집니다.
                      </p>
                    </div>

                    {/* 💾 Saved Healing Archive View */}
                    <div className={`p-5 rounded-2xl border shadow-sm space-y-4 transition-colors duration-300 ${
                      theme === "midnight" ? "bg-neutral-800 border-neutral-700" : "bg-white border-neutral-100"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            theme === "midnight" ? "bg-rose-950/40 text-rose-400" : "bg-rose-50 text-rose-600"
                          }`}>
                            <CheckCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className={`text-xs font-bold uppercase tracking-wider ${theme === "midnight" ? "text-neutral-100" : "text-neutral-800"}`}>
                              💾 나의 마음 치유 아카이브
                            </h4>
                            <p className="text-[10px] text-neutral-400 font-medium">
                              정신체리와 오해를 풀고 기록해 온 인지행동 미션 처방전
                            </p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          theme === "midnight" ? "bg-neutral-700 text-neutral-300" : "bg-neutral-100 text-neutral-600"
                        }`}>
                          보관 개수: {cbtLogs.length}개
                        </span>
                      </div>

                      {cbtLogs.length === 0 ? (
                        <div className={`p-6 rounded-xl border border-dashed text-center space-y-2 transition-colors ${
                          theme === "midnight" ? "border-neutral-700 bg-neutral-900/20" : "border-neutral-200 bg-neutral-50/50"
                        }`}>
                          <p className={`text-xs font-semibold ${theme === "midnight" ? "text-neutral-400" : "text-neutral-600"}`}>
                            아직 저장된 마음 처방전이나 실천 로그가 없습니다.
                          </p>
                          <p className="text-[10px] text-neutral-400 max-w-xs mx-auto leading-relaxed">
                            정신체리와 대화하며 인지행동 미션을 성실히 실천하고 보관함에 안전하게 저장해 보세요! 🍒
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
                          {cbtLogs.map((log) => {
                            const formattedDate = new Date(log.timestamp).toLocaleString("ko-KR", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            });
                            
                            const isExpanded = selectedArchiveLog?.id === log.id;

                            return (
                              <div 
                                key={log.id}
                                className={`rounded-xl border transition-all duration-300 overflow-hidden ${
                                  isExpanded 
                                    ? (theme === "midnight" ? "border-rose-500/40 bg-neutral-900/60" : "border-rose-200 bg-rose-50/20")
                                    : (theme === "midnight" ? "border-neutral-700 bg-neutral-900/20 hover:border-neutral-600" : "border-neutral-100 bg-neutral-50/40 hover:border-neutral-200")
                                }`}
                              >
                                {/* Header Toggle bar */}
                                <div className="p-3.5 flex items-center justify-between gap-3 select-none">
                                  <div 
                                    className="flex-1 cursor-pointer"
                                    onClick={() => setSelectedArchiveLog(isExpanded ? null : log)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-bold ${theme === "midnight" ? "text-neutral-100" : "text-neutral-800"}`}>
                                        {log.missionTitle || "마음 행동 미션 처방전"}
                                      </span>
                                      <span className="text-[9px] font-medium text-neutral-400 font-mono">
                                        {formattedDate}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-neutral-400 mt-1 line-clamp-1 font-sans">
                                      {log.inputs.reframing || log.inputs.worry || "처방 기록 상세 보기"}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => {
                                        // Delete single log securely
                                        const updated = cbtLogs.filter(l => l.id !== log.id);
                                        setCbtLogs(updated);
                                        if (isExpanded) {
                                          setSelectedArchiveLog(null);
                                        }
                                        setInAppToast({
                                          title: "아카이브 기록 삭제 완료 🗑️",
                                          desc: "해당 실천 미션 기록이 보관함에서 영구적으로 삭제되었습니다."
                                        });
                                      }}
                                      className={`p-2 rounded-lg hover:text-rose-500 transition-colors cursor-pointer ${
                                        theme === "midnight" ? "text-neutral-500 hover:bg-neutral-800" : "text-neutral-400 hover:bg-neutral-100"
                                      }`}
                                      title="삭제"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    <button
                                      onClick={() => setSelectedArchiveLog(isExpanded ? null : log)}
                                      className={`p-1 text-[11px] font-bold px-2 py-1 rounded-md transition-all cursor-pointer ${
                                        isExpanded 
                                          ? (theme === "midnight" ? "bg-rose-950/40 text-rose-400" : "bg-rose-100 text-rose-700")
                                          : (theme === "midnight" ? "text-neutral-400 hover:bg-neutral-800" : "text-neutral-500 hover:bg-neutral-100")
                                      }`}
                                    >
                                      {isExpanded ? "접기" : "보기"}
                                    </button>
                                  </div>
                                </div>

                                {/* Expanded detailed slate */}
                                {isExpanded && (
                                  <div className={`px-4 pb-4 pt-1 border-t text-[11px] space-y-3 font-sans leading-relaxed ${
                                    theme === "midnight" ? "border-neutral-800 bg-neutral-950/30 text-neutral-200" : "border-neutral-100 bg-white/50 text-neutral-800"
                                  }`}>
                                    {Object.entries(log.inputs).map(([key, value]) => {
                                      const label = inputLabels[key] || key;
                                      if (!value) return null;
                                      return (
                                        <div key={key} className="space-y-1">
                                          <div className={`text-[10px] font-extrabold flex items-center gap-1.5 ${
                                            key === "reframing" 
                                              ? "text-rose-500" 
                                              : (theme === "midnight" ? "text-neutral-400" : "text-neutral-500")
                                          }`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                            <span>{label}</span>
                                          </div>
                                          <div className={`p-2.5 rounded-lg border text-[11px] font-medium leading-relaxed ${
                                            key === "reframing" 
                                              ? (theme === "midnight" ? "bg-rose-950/20 border-rose-900/30 text-rose-200" : "bg-rose-50 border-rose-100 text-rose-800")
                                              : (theme === "midnight" ? "bg-neutral-900/50 border-neutral-800" : "bg-neutral-50 border-neutral-100")
                                          }`}>
                                            {value}
                                          </div>
                                        </div>
                                      );
                                    })}
                                    
                                    {/* Action row to export just this prescription */}
                                    <div className="pt-2 flex justify-end">
                                      <button
                                        onClick={() => {
                                          const text = `
=============================================
🍒 정신체리 [마음 치유 아카이브 처방전] 🍒
=============================================
일시: ${new Date(log.timestamp).toLocaleString("ko-KR")}
미션명: ${log.missionTitle}

${Object.entries(log.inputs)
  .map(([key, value]) => {
    const label = inputLabels[key] || key;
    return `▶ ${label}\n  ${value}`;
  })
  .join("\n\n")}
=============================================
정신체리는 당신의 마음 회복 여정을 진심으로 응원합니다.
`;
                                          const element = document.createElement("a");
                                          const file = new Blob([text], { type: 'text/plain;charset=utf-8' });
                                          element.href = URL.createObjectURL(file);
                                          element.download = `정신체리_처방전_${log.missionTitle.replace(/\s+/g, '_')}.txt`;
                                          document.body.appendChild(element);
                                          element.click();
                                          document.body.removeChild(element);
                                        }}
                                        className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-sm text-white transition-all cursor-pointer ${
                                          theme === "midnight" ? "bg-rose-700 hover:bg-rose-650" : "bg-rose-600 hover:bg-rose-700"
                                        }`}
                                      >
                                        <Download className="w-3 h-3" />
                                        <span>단일 처방전 다운로드 (.txt)</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Detailed brain areas state */}
                    <div className={`p-5 rounded-2xl border shadow-sm space-y-4 transition-colors duration-300 ${
                      theme === "midnight" ? "bg-neutral-800 border-neutral-700" : "bg-white border-neutral-100"
                    }`}>
                      <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                        나의 마음 에너지 밸런스
                      </h4>
                      
                      {/* Amygdala */}
                      <div className="space-y-1">
                        <div className={`flex justify-between text-xs font-bold transition-colors ${
                          theme === "midnight" ? "text-neutral-300" : "text-neutral-700"
                        }`}>
                          <span>감정 진정도 (차분함 유지 장치)</span>
                          <span className="text-emerald-500">편안함</span>
                        </div>
                        <div className={`w-full h-2 rounded-full overflow-hidden transition-colors ${
                          theme === "midnight" ? "bg-neutral-700" : "bg-neutral-100"
                        }`}>
                          <div className="bg-emerald-500 h-full rounded-full" style={{ width: "85%" }}></div>
                        </div>
                      </div>

                      {/* Prefrontal Cortex */}
                      <div className="space-y-1">
                        <div className={`flex justify-between text-xs font-bold transition-colors ${
                          theme === "midnight" ? "text-neutral-300" : "text-neutral-700"
                        }`}>
                          <span>이성적 조율도 (생각 조절 및 필터링 장치)</span>
                          <span className={theme === "midnight" ? "text-rose-400" : "text-rose-600"}>조율 중 ({syncProgress}%)</span>
                        </div>
                        <div className={`w-full h-2 rounded-full overflow-hidden transition-colors ${
                          theme === "midnight" ? "bg-neutral-700" : "bg-neutral-100"
                        }`}>
                          <div className={`h-full rounded-full ${theme === "midnight" ? "bg-rose-500" : "bg-rose-600"}`} style={{ width: `${syncProgress}%` }}></div>
                        </div>
                      </div>

                    </div>

                    {/* Summary Report Download Card */}
                    <div className={`p-5 rounded-2xl border shadow-sm flex flex-col gap-3.5 transition-colors duration-300 ${
                      theme === "midnight" ? "bg-neutral-800 border-neutral-700" : "bg-white border-neutral-100"
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          theme === "midnight" ? "bg-rose-950/40 text-rose-400" : "bg-rose-50 text-rose-600"
                        }`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className={`text-xs font-bold transition-colors ${theme === "midnight" ? "text-neutral-100" : "text-neutral-800"}`}>
                            상담 세션 전체 리포트
                          </h4>
                          <p className="text-[10px] text-neutral-400 font-medium">
                            전체 상담 내역과 인지행동 미션 성과 요약본
                          </p>
                        </div>
                      </div>
                      <p className={`text-xs leading-relaxed transition-colors ${
                        theme === "midnight" ? "text-neutral-400" : "text-neutral-500"
                      }`}>
                        정신체리와 나눈 다정한 3단계 대화 기록과 마음 밸런스 점수를 텍스트 파일로 저장하여, 마음이 든든하게 변화하는 과정을 기록하고 확인해 보세요.
                      </p>
                      <button
                        onClick={() => setShowDownloadModal(true)}
                        className={`w-full hover:opacity-90 active:scale-95 text-white font-display font-bold py-3.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer text-xs ${
                          theme === "midnight" ? "bg-rose-700" : "bg-rose-600"
                        }`}
                      >
                        <Download className="w-4 h-4" />
                        <span>상담 리포트 다운로드 (.txt)</span>
                      </button>
                    </div>

                    {/* 📊 주간 미션 달성률 및 실천 통계 */}
                    <div className={`p-5 rounded-2xl border shadow-sm space-y-4 transition-colors duration-300 ${
                      theme === "midnight" ? "bg-neutral-800 border-neutral-700" : "bg-white border-neutral-100"
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          theme === "midnight" ? "bg-rose-950/40 text-rose-400" : "bg-rose-50 text-rose-600"
                        }`}>
                          <BarChart2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className={`text-xs font-bold uppercase tracking-wider ${theme === "midnight" ? "text-neutral-100" : "text-neutral-800"}`}>
                            📊 주간 미션 달성률 및 실천 통계
                          </h4>
                          <p className="text-[10px] text-neutral-400 font-medium">
                            CBT 행동 실천 미션의 주간 달성 추이 및 일자별 히트맵
                          </p>
                        </div>
                      </div>

                      {/* Line Chart showing 5-week achievement trend */}
                      <div className="space-y-1.5 pt-1">
                        <span className={`text-[11px] font-bold block ${theme === "midnight" ? "text-neutral-300" : "text-neutral-700"}`}>
                          📈 주간 미션 달성률 추이 (%)
                        </span>
                        <div className="h-44 w-full text-xs font-sans">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={weeklyAchievementData} margin={{ top: 10, right: 15, left: -25, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={theme === "midnight" ? "#2a2b2d" : "#f0f0f0"} vertical={false} />
                              <XAxis 
                                dataKey="name" 
                                stroke={theme === "midnight" ? "#737373" : "#a3a3a3"} 
                                fontSize={10}
                                tickLine={false} 
                                axisLine={false} 
                              />
                              <YAxis 
                                domain={[0, 100]} 
                                stroke={theme === "midnight" ? "#737373" : "#a3a3a3"} 
                                fontSize={10}
                                tickLine={false} 
                                axisLine={false} 
                                tickCount={5}
                              />
                              <Tooltip 
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-neutral-900 text-white p-2.5 rounded-xl border border-neutral-800 text-[11px] shadow-lg">
                                        <p className="font-bold mb-0.5">{data.name} ({data.period})</p>
                                        <p className="text-rose-400">주간 달성률: <span className="font-bold">{data.rate}%</span></p>
                                        <p className="text-emerald-400 mt-0.5">완료 미션 수: <span className="font-medium">{data.completions}개</span></p>
                                        <p className="text-blue-400">실천한 일수: <span className="font-medium">{data.activeDays}일 / 7일</span></p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="rate" 
                                stroke={theme === "midnight" ? "#f43f5e" : "#e11d48"} 
                                strokeWidth={3} 
                                activeDot={{ r: 6, strokeWidth: 0, fill: theme === 'midnight' ? '#f43f5e' : '#e11d48' }}
                                dot={{ r: 3, stroke: theme === 'midnight' ? '#f43f5e' : '#e11d48', strokeWidth: 1, fill: theme === 'midnight' ? '#1e1e1e' : '#ffffff' }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Heatmap Section */}
                      <div className="space-y-2 pt-2 border-t border-dashed border-neutral-150 dark:border-neutral-700/50">
                        <span className={`text-[11px] font-bold block ${theme === "midnight" ? "text-neutral-300" : "text-neutral-700"}`}>
                          📅 이번 주 미션 실천 히트맵
                        </span>
                        
                        <div className="grid grid-cols-7 gap-1.5 pt-1">
                          {currentWeekHeatmap.map((day) => {
                            let cellBg = "";
                            let textCol = "";
                            
                            if (day.count === 0) {
                              cellBg = theme === "midnight" ? "bg-neutral-900 border-neutral-800 hover:bg-neutral-850" : "bg-neutral-50 border-neutral-100 hover:bg-neutral-100";
                              textCol = theme === "midnight" ? "text-neutral-600" : "text-neutral-400";
                            } else if (day.count === 1) {
                              cellBg = theme === "midnight" ? "bg-rose-950/40 border-rose-900/30 text-rose-400" : "bg-rose-50 border-rose-100 text-rose-600";
                              textCol = theme === "midnight" ? "text-rose-400" : "text-rose-600";
                            } else if (day.count === 2) {
                              cellBg = theme === "midnight" ? "bg-rose-900/60 border-rose-800/40 text-rose-300" : "bg-rose-200 border-rose-300 text-rose-800";
                              textCol = theme === "midnight" ? "text-rose-300" : "text-rose-800";
                            } else {
                              cellBg = theme === "midnight" ? "bg-rose-600 border-rose-700 text-white" : "bg-rose-500 border-rose-600 text-white";
                              textCol = "text-white";
                            }

                            return (
                              <div 
                                key={day.dateKey}
                                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${cellBg} ${
                                  day.isToday ? "ring-2 ring-offset-2 ring-rose-500 dark:ring-offset-neutral-800" : ""
                                }`}
                                title={`${day.dateLabel}: ${day.count}개 완료`}
                              >
                                <span className={`text-[10px] font-bold ${day.count > 0 ? textCol : (theme === "midnight" ? "text-neutral-400" : "text-neutral-500")}`}>
                                  {day.dayName}
                                </span>
                                <span className="text-[9px] opacity-75 font-mono block mt-0.5">
                                  {day.dateLabel.split('/')[1]}일
                                </span>
                                <div className={`mt-1.5 text-[10px] font-black font-mono px-1.5 py-0.5 rounded-full ${
                                  day.count > 0 
                                    ? (day.count >= 3 ? "bg-white/20 text-white" : "bg-rose-500/10 text-rose-500")
                                    : "text-transparent"
                                }`}>
                                  {day.count || "-"}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-neutral-400 font-medium px-0.5">
                          <span>* 하루 4개 미션 달성 시 주간 목표 100% 충족</span>
                          <span className="flex items-center gap-1">
                            범례: 0개 <span className="inline-block w-2 h-2 rounded bg-neutral-100 dark:bg-neutral-900 border text-center"></span>
                            <span className="inline-block w-2 h-2 rounded bg-rose-100 dark:bg-rose-950/40 border"></span>
                            <span className="inline-block w-2 h-2 rounded bg-rose-500 border"></span> 3개+
                          </span>
                        </div>
                      </div>
                    </div>

                  </motion.div>
                )}

                 {/* Bottom Navigation tab-bar */}
                <nav className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md md:max-w-3xl lg:max-w-4xl z-50 backdrop-blur-md border-t border-x py-2.5 px-4 flex justify-around items-center transition-all duration-300 ${
                  theme === "midnight" 
                    ? "bg-neutral-900/90 border-neutral-800 text-neutral-100" 
                    : "bg-white/95 border-neutral-100 text-neutral-900 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]"
                }`}>
                  <button 
                    onClick={() => setActiveTab("missions")}
                    className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
                      activeTab === "missions" 
                        ? (theme === "midnight" ? "text-rose-400 font-bold scale-105" : "text-rose-600 font-bold scale-105") 
                        : (theme === "midnight" ? "text-neutral-500 hover:text-neutral-300" : "text-neutral-400 hover:text-neutral-600")
                    }`}
                  >
                    <Award className="w-5 h-5 mb-0.5" />
                    <span className="text-[10px]">Missions</span>
                  </button>

                  <button 
                    onClick={() => setActiveTab("chat")}
                    className={`flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                      activeTab === "chat" 
                        ? (theme === "midnight" ? "text-rose-400 font-bold scale-105" : "text-rose-600 font-bold scale-105") 
                        : (theme === "midnight" ? "text-neutral-500 hover:text-neutral-300" : "text-neutral-400 hover:text-neutral-600")
                    }`}
                  >
                    <MessageSquare className="w-5 h-5 mb-0.5" />
                    <span className="text-[10px]">Chat</span>
                    <span className={`absolute -top-1 right-2 w-2 h-2 rounded-full ${theme === "midnight" ? "bg-rose-500" : "bg-rose-600"}`}></span>
                  </button>

                  <button 
                    onClick={() => setActiveTab("profile")}
                    className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
                      activeTab === "profile" 
                        ? (theme === "midnight" ? "text-rose-400 font-bold scale-105" : "text-rose-600 font-bold scale-105") 
                        : (theme === "midnight" ? "text-neutral-500 hover:text-neutral-300" : "text-neutral-400 hover:text-neutral-600")
                    }`}
                  >
                    <User className="w-5 h-5 mb-0.5" />
                    <span className="text-[10px]">Profile</span>
                  </button>
                </nav>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Daily Insight Popup Overlay Modal */}
        <AnimatePresence>
          {showDailyInsight && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowDailyInsight(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              
              {/* Modal Body */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className={`relative w-full max-w-sm rounded-3xl p-6 shadow-2xl border overflow-hidden transition-colors duration-300 z-10 ${
                  theme === "midnight" 
                    ? "bg-neutral-900 border-neutral-800 text-neutral-100" 
                    : "bg-white border-neutral-100 text-neutral-900"
                }`}
              >
                {/* Glowing Background Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Close Button */}
                <button
                  onClick={() => setShowDailyInsight(false)}
                  className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors cursor-pointer ${
                    theme === "midnight" 
                      ? "text-neutral-400 hover:bg-neutral-800 hover:text-white" 
                      : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Header Icon & Title */}
                <div className="flex flex-col items-center text-center mt-2 mb-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 shadow-sm ${
                    theme === "midnight" ? "bg-rose-950/40 text-rose-400" : "bg-rose-50 text-rose-600"
                  }`}>
                    <Lightbulb className="w-6 h-6 animate-pulse" />
                  </div>
                  <span className={`text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                    theme === "midnight" ? "bg-rose-950/40 text-rose-400" : "bg-rose-50 text-rose-600"
                  }`}>
                    {dailyInsights[dailyInsightIndex].category}
                  </span>
                  <h3 className={`text-lg font-extrabold font-display mt-3 ${
                    theme === "midnight" ? "text-white" : "text-neutral-950"
                  }`}>
                    {dailyInsights[dailyInsightIndex].title}
                  </h3>
                </div>

                {/* Fact Content */}
                <div className={`p-4 rounded-2xl border text-center text-xs leading-relaxed font-medium mb-4 ${
                  theme === "midnight" ? "bg-neutral-800/80 border-neutral-700 text-neutral-300" : "bg-rose-50/20 border-rose-100/50 text-neutral-600"
                }`}>
                  "{dailyInsights[dailyInsightIndex].fact}"
                </div>

                {/* Expert Neuro Tip */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-rose-500">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>정신체리의 마음 정리 팁 (Cheer-tip)</span>
                  </div>
                  <p className={`text-xs leading-relaxed ${
                    theme === "midnight" ? "text-neutral-400" : "text-neutral-500"
                  }`}>
                    {dailyInsights[dailyInsightIndex].neurotip}
                  </p>
                </div>

                {/* Confirm / Action Button */}
                <button
                  onClick={(e) => {
                    setShowDailyInsight(false);
                    triggerDopamineConfetti(e.currentTarget);
                  }}
                  className={`w-full font-display font-bold py-3 px-4 rounded-xl shadow-sm transition-all active:scale-95 text-xs text-white text-center cursor-pointer mt-5 ${
                    theme === "midnight" 
                      ? "bg-rose-700 hover:bg-rose-600 shadow-rose-950/20" 
                      : "bg-rose-600 hover:bg-rose-500 shadow-rose-100"
                  }`}
                >
                  확인 완료 (마음 충전 🍒)
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* 오늘의 마음 핵심 요약 모달 */}
        <AnimatePresence>
          {showSummaryModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSummaryModal(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              
              {/* Modal Body */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className={`relative w-full max-w-md rounded-3xl p-6 shadow-2xl border overflow-hidden transition-colors duration-300 z-10 max-h-[85vh] overflow-y-auto ${
                  theme === "midnight" 
                    ? "bg-neutral-900 border-neutral-800 text-neutral-100" 
                    : "bg-white border-rose-100 text-neutral-900"
                }`}
              >
                {/* Glowing Background Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Close Button */}
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors cursor-pointer ${
                    theme === "midnight" 
                      ? "text-neutral-400 hover:bg-neutral-800 hover:text-white" 
                      : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-2 mb-4 mt-2">
                  <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-sm sm:text-base">오늘의 마음 핵심 요약</h3>
                    <p className="text-[10px] text-neutral-400 font-mono">Mind Essence Synthesis 🍒</p>
                  </div>
                </div>

                {/* Content */}
                {isSummarizing || !summaryText ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium text-center leading-relaxed animate-pulse">
                      정신체리가 우리의 나눈 대화를 따뜻하게 되짚어보며<br />
                      마음의 핵심을 정성스레 요약하고 있습니다...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
                      정신체리가 꼼꼼하게 도출해낸 오늘의 마인드 에센스 리포트입니다.
                    </p>

                    <div className={`p-5 rounded-2xl border text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium shadow-sm leading-relaxed ${
                      theme === "midnight" 
                        ? "bg-neutral-800/60 border-neutral-700 text-neutral-200" 
                        : "bg-rose-50/40 border-rose-100 text-neutral-800"
                    }`}>
                      {summaryText}
                    </div>

                    <p className="text-[11px] text-center text-neutral-400 pt-1">
                      🍒 정신체리의 현실 솔루션을 마음에 담고, 오늘 하루 작은 것부터 실천해보세요.
                    </p>
                  </div>
                )}

                {/* Footer button */}
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className={`w-full mt-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer text-white ${
                    theme === "midnight"
                      ? "bg-rose-700 hover:bg-rose-600"
                      : "bg-rose-600 hover:bg-rose-500"
                  }`}
                >
                  확인 완료
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Service Info Modal */}
        <AnimatePresence>
          {showInfoModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowInfoModal(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              
              {/* Modal Body */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className={`relative w-full max-w-sm rounded-3xl p-6 shadow-2xl border overflow-hidden transition-colors duration-300 z-10 max-h-[85vh] overflow-y-auto ${
                  theme === "midnight" 
                    ? "bg-neutral-900 border-neutral-800 text-neutral-100" 
                    : "bg-white border-rose-100 text-neutral-900"
                }`}
              >
                {/* Glowing Background Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Close Button */}
                <button
                  onClick={() => setShowInfoModal(false)}
                  className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors cursor-pointer ${
                    theme === "midnight" 
                      ? "text-neutral-400 hover:bg-neutral-800 hover:text-white" 
                      : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-2 mb-4 mt-2">
                  <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-base">정신체리 서비스 소개</h3>
                    <p className="text-[10px] text-neutral-400 font-mono">Mind Sync-Cherry v1.0</p>
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-4 text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
                    정신체리는 당신의 마음에 쏟는 에너지를 정교하게 진단하고 조율하여 온전한 회복과 성장을 이끄는 스마트 동반자입니다.
                  </p>

                  <div className={`p-4 rounded-2xl border space-y-3 ${
                    theme === "midnight" ? "bg-neutral-800/50 border-neutral-700" : "bg-neutral-50 border-neutral-100"
                  }`}>
                    <h4 className="font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                      마음 싱크로율 로드맵
                    </h4>
                    
                    <div className="space-y-2.5">
                      <div className="flex gap-2">
                        <span className="font-bold font-mono text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded h-fit">1단계</span>
                        <div>
                          <p className="font-bold text-neutral-800 dark:text-neutral-100">마음 털어놓기 (감정 환기)</p>
                          <p className="text-[11px] opacity-80">마음의 소리를 비난 없이 온전히 안전한 대화로 가만히 털어놓고 감정을 발산합니다.</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <span className="font-bold font-mono text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded h-fit">2단계</span>
                        <div>
                          <p className="font-bold text-neutral-800 dark:text-neutral-100">객관적으로 보기 (인지 재구성)</p>
                          <p className="text-[11px] opacity-80">감정 필터를 한 겹 걷어내고, 내 마음을 한 걸음 물러나 객관적인 사실로 바라봅니다.</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <span className="font-bold font-mono text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded h-fit">3단계</span>
                        <div>
                          <p className="font-bold text-neutral-800 dark:text-neutral-100">직접 실천하기 (행동 처방)</p>
                          <p className="text-[11px] opacity-80">CBT 일기 작성과 매일 가벼운 맞춤 미션 실천을 통해 건강한 마음 습관을 완성합니다.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-center text-neutral-400 pt-1">
                    지금 정신체리와 함께 마음을 가만히 조율해 보세요.
                  </p>
                </div>

                {/* Footer button */}
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="w-full mt-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                >
                  확인 완료
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettingsModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSettingsModal(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              
              {/* Modal Body */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className={`relative w-full max-w-sm rounded-3xl p-6 shadow-2xl border overflow-hidden transition-colors duration-300 z-10 max-h-[85vh] overflow-y-auto ${
                  theme === "midnight" 
                    ? "bg-neutral-900 border-neutral-800 text-neutral-100" 
                    : "bg-white border-rose-100 text-neutral-900"
                }`}
              >
                {/* Close Button */}
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors cursor-pointer ${
                    theme === "midnight" 
                      ? "text-neutral-400 hover:bg-neutral-800 hover:text-white" 
                      : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-2 mb-6 mt-2">
                  <div className={`p-2 rounded-xl ${
                    theme === "midnight" ? "bg-neutral-800 text-rose-400" : "bg-rose-50 text-rose-600"
                  }`}>
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-base">시스템 설정</h3>
                    <p className="text-[10px] text-neutral-400 font-mono">Jeongsin Cherry Preferences</p>
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-5 text-xs">
                  {/* Theme Section */}
                  <div className={`p-4 rounded-2xl border ${
                    theme === "midnight" ? "bg-neutral-800/40 border-neutral-800" : "bg-neutral-50 border-neutral-100"
                  }`}>
                    <h4 className="font-bold text-neutral-800 dark:text-neutral-100 mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                      테마 스타일 설정
                    </h4>
                    <p className="text-[11px] text-neutral-400 mb-3 leading-relaxed">
                      앱의 전반적인 분위기와 색상 테마를 자유롭게 조율합니다.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTheme("cherry")}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                          theme === "cherry"
                            ? "bg-rose-500 border-rose-500 text-white shadow-sm cursor-pointer"
                            : "bg-transparent border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                        }`}
                      >
                        체리블라썸 (라이트)
                      </button>
                      <button
                        onClick={() => setTheme("midnight")}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                          theme === "midnight"
                            ? "bg-neutral-800 border-neutral-700 text-rose-400 shadow-sm cursor-pointer"
                            : "bg-transparent border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                        }`}
                      >
                        미드나잇 (다크)
                      </button>
                    </div>
                  </div>

                  {/* Mindfulness Notifications & Breathing simulation section */}
                  <div className={`p-4 rounded-2xl border ${
                    theme === "midnight" ? "bg-neutral-800/40 border-neutral-800" : "bg-neutral-50 border-neutral-100"
                  }`}>
                    <h4 className="font-bold text-neutral-800 dark:text-neutral-100 mb-2 flex items-center gap-1.5">
                      <Wind className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                      마음 챙김 알림 설정
                    </h4>
                    <p className="text-[11px] text-neutral-400 mb-3 leading-relaxed">
                      4시간 동안 마음 체크인이 없을 때 30초 호흡 운동이나 기분 기록을 유도하는 기기 알림을 전송합니다.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">기기 알림 상태</span>
                        <span className={`font-mono font-bold text-[9px] uppercase px-2 py-0.5 rounded-full ${
                          notificationPermission === "granted"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : notificationPermission === "denied"
                              ? "bg-rose-500/10 text-rose-500"
                              : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400"
                        }`}>
                          {notificationPermission === "granted" && "활성화됨"}
                          {notificationPermission === "denied" && "거부됨"}
                          {notificationPermission === "default" && "권한 필요"}
                        </span>
                      </div>

                      {notificationPermission !== "granted" && (
                        <button
                          onClick={requestNotificationPermission}
                          className="w-full py-2 rounded-xl text-xs font-bold transition-all bg-rose-500 hover:bg-rose-600 active:scale-95 text-white shadow-sm cursor-pointer"
                        >
                          기기 알림 허용하기
                        </button>
                      )}

                      {/* Mock/Simulator Button */}
                      <div className="border-t border-neutral-200/50 dark:border-neutral-700/50 pt-2.5">
                        <span className="text-[10px] text-neutral-400 block mb-1.5 font-medium">알림 기능 즉시 체험하기 (시뮬레이터)</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
                              setSimulatedTimeOffset(FOUR_HOURS_MS + 600 * 1000); // 4 hours 10 mins
                              setShowSettingsModal(false);
                              setInAppToast({
                                title: "🕒 4시간 경과 가상 시뮬레이터 작동!",
                                desc: "마지막 체크인 후 4시간이 경과한 것으로 가상 설정되었습니다. 대시보드 알림 및 기기 알림이 활성화됩니다."
                              });
                            }}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/5 transition-all cursor-pointer text-center"
                          >
                            🕒 4시간 방치 상황 재현
                          </button>
                          <button
                            onClick={() => {
                              setIsBreathingOpen(true);
                              setShowSettingsModal(false);
                            }}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-bold bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-all cursor-pointer text-center"
                          >
                            🌬️ 호흡 운동 실행
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sync Status Section */}
                  <div className={`p-4 rounded-2xl border ${
                    theme === "midnight" ? "bg-neutral-800/40 border-neutral-800" : "bg-neutral-50 border-neutral-100"
                  }`}>
                    <h4 className="font-bold text-neutral-800 dark:text-neutral-100 mb-2 flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500" />
                      클라우드 보안 동기화
                    </h4>
                    <div className="space-y-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                      <div className="flex justify-between">
                        <span>실시간 클라우드 연동</span>
                        <span className="text-emerald-500 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          보안 연결 활성화됨
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>사용자 고유 세션</span>
                        <span className="font-mono text-[10px]">
                          {localStorage.getItem("jc_session_id") ? `${localStorage.getItem("jc_session_id")?.slice(0, 12)}...` : "임시 세션"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Danger Zone Section */}
                  <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/5">
                    <h4 className="font-bold text-rose-600 dark:text-rose-400 mb-1.5 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-rose-500" />
                      위험 구역 (Danger Zone)
                    </h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
                      대화 기록, 미션 진행도, 감정 수치 및 행동치료 일지 등 모든 데이터가 기기와 클라우드에서 영구히 완전 삭제되며, 처음 온보딩 단계로 되돌아갑니다. <span className="font-bold text-rose-500 underline">이 작업은 복구할 수 없습니다.</span>
                    </p>
                    
                    <button
                      onClick={() => {
                        setShowSettingsModal(false);
                        handleResetChat();
                      }}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      대화 및 기록 영구 초기화
                    </button>
                  </div>
                </div>

                {/* Close modal button at the bottom */}
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className={`w-full mt-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer border ${
                    theme === "midnight"
                      ? "border-neutral-800 hover:bg-neutral-800 text-neutral-300"
                      : "border-neutral-200 hover:bg-neutral-50 text-neutral-600"
                  }`}
                >
                  설정 닫기
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Custom Confirmation Modal */}
        <AnimatePresence>
          {customConfirm && customConfirm.isOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setCustomConfirm(null)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              
              {/* Modal Body */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className={`relative w-full max-w-sm rounded-3xl p-6 shadow-2xl border overflow-hidden transition-colors duration-300 z-10 ${
                  theme === "midnight" 
                    ? "bg-neutral-900 border-neutral-800 text-neutral-100" 
                    : "bg-white border-rose-100 text-neutral-900"
                }`}
              >
                {/* Visual Icon */}
                <div className="flex justify-center mb-4">
                  <div className={`p-4 rounded-full ${
                    customConfirm.isDanger 
                      ? "bg-rose-50 dark:bg-rose-950/40 text-rose-500" 
                      : "bg-amber-50 dark:bg-amber-950/40 text-amber-500"
                  }`}>
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-center font-display font-extrabold text-lg mb-2">
                  {customConfirm.title}
                </h3>

                {/* Message */}
                <p className="text-center text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6 font-medium">
                  {customConfirm.message}
                </p>

                {/* Typed Security Confirmation */}
                {customConfirm.requireTypedConfirmation && (
                  <div className="mb-6">
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 text-center mb-2">
                      실수 방지를 위해 아래 입력창에 <span className="font-bold text-rose-500">"{customConfirm.requireTypedConfirmation}"</span>을 정확히 입력해 주세요.
                    </p>
                    <input
                      type="text"
                      value={typedConfirmationText}
                      onChange={(e) => setTypedConfirmationText(e.target.value)}
                      placeholder={customConfirm.requireTypedConfirmation}
                      className={`w-full px-4 py-2.5 rounded-xl text-center text-xs font-bold transition-all focus:outline-none focus:ring-2 ${
                        theme === "midnight"
                          ? "bg-neutral-800 border-neutral-700 text-neutral-100 focus:ring-rose-500/50 placeholder-neutral-600"
                          : "bg-neutral-50 border-neutral-200 text-neutral-900 focus:ring-rose-500/30 placeholder-neutral-300"
                      } border`}
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setCustomConfirm(null)}
                    className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer border ${
                      theme === "midnight"
                        ? "border-neutral-800 hover:bg-neutral-800 text-neutral-300"
                        : "border-neutral-200 hover:bg-neutral-50 text-neutral-600"
                    }`}
                  >
                    {customConfirm.cancelText || "취소"}
                  </button>
                  <button
                    disabled={
                      customConfirm.requireTypedConfirmation !== undefined &&
                      typedConfirmationText !== customConfirm.requireTypedConfirmation
                    }
                    onClick={async () => {
                      const action = customConfirm.onConfirm;
                      setCustomConfirm(null);
                      await action();
                    }}
                    className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 cursor-pointer text-white disabled:opacity-40 disabled:cursor-not-allowed ${
                      customConfirm.isDanger
                        ? (theme === "midnight" ? "bg-rose-700 hover:bg-rose-600" : "bg-rose-600 hover:bg-rose-500")
                        : (theme === "midnight" ? "bg-emerald-700 hover:bg-emerald-600" : "bg-emerald-600 hover:bg-emerald-500")
                    }`}
                  >
                    {customConfirm.confirmText || "확인"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Off-screen PDF report template for high-fidelity PDF rendering */}
        <div style={{ position: "absolute", left: "-9999px", top: "-9999px", width: "794px" }}>
          <div 
            id="pdf-report-template" 
            className={`bg-white text-neutral-900 font-sans flex flex-col select-none transition-all ${
              pdfSpacingMode === "compact" ? "p-8 gap-5 text-[11px]" : "p-12 gap-8 text-xs"
            }`}
            style={{ width: "794px", minHeight: "1123px" }}
          >
            {/* Header */}
            <div className={`flex items-center justify-between border-b border-rose-100 ${
              pdfSpacingMode === "compact" ? "pb-3.5" : "pb-6"
            }`}>
              <div>
                {includePersonalBranding && (
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                      <span>👤</span>
                      <span>{brandingName || "사용자 지정 브랜드"}</span>
                    </span>
                    <span className="text-[9px] text-neutral-400 border border-dashed border-neutral-300 px-2 py-0.5 rounded font-mono bg-neutral-50/50 shrink-0">
                      [ CUSTOM LOGO PLACEHOLDER ]
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xl">🍒</span>
                  <span className="font-display font-extrabold text-rose-600 text-lg tracking-tight">정신체리</span>
                  <span className="text-[10px] bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded-full font-bold">마음 메이트</span>
                </div>
                <h1 className={`font-display font-black tracking-tight text-neutral-900 ${
                  pdfSpacingMode === "compact" ? "text-xl" : "text-2xl"
                }`}>마음 가꾸기 상담 리포트</h1>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-neutral-400 font-mono">REPORT ID: JC-{Date.now()}</p>
                <p className="text-xs text-neutral-600 font-medium mt-1">발행일자: {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</p>
              </div>
            </div>

            {/* Core Status Block */}
            <div className={`grid grid-cols-2 ${pdfSpacingMode === "compact" ? "gap-3" : "gap-4"}`}>
              <div className={`rounded-2xl bg-rose-50/40 border border-rose-100 flex flex-col justify-between ${
                pdfSpacingMode === "compact" ? "p-4" : "p-5"
              }`}>
                <div>
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">My Mind Balance Score</p>
                  <h3 className={`font-display font-black text-rose-700 mt-1 ${
                    pdfSpacingMode === "compact" ? "text-base" : "text-lg"
                  }`}>나의 마음 회복도</h3>
                </div>
                <div className="flex items-end gap-3 mt-4">
                  <span className={`font-display font-black text-rose-600 leading-none ${
                    pdfSpacingMode === "compact" ? "text-4xl" : "text-5xl"
                  }`}>{syncProgress}%</span>
                  <div className="flex-1 pb-1">
                    <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full" style={{ width: `${syncProgress}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl bg-rose-50/40 border border-rose-100 flex flex-col justify-between ${
                pdfSpacingMode === "compact" ? "p-4" : "p-5"
              }`}>
                <div>
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Mindful Action Tracker</p>
                  <h3 className={`font-display font-black text-rose-700 mt-1 ${
                    pdfSpacingMode === "compact" ? "text-base" : "text-lg"
                  }`}>실천 미션 달성도</h3>
                </div>
                <div className="flex items-end justify-between mt-4">
                  <div className="flex items-baseline gap-1">
                    <span className={`font-display font-black text-rose-600 leading-none ${
                      pdfSpacingMode === "compact" ? "text-4xl" : "text-5xl"
                    }`}>
                      {missions.filter(m => m.status === "COMPLETED").length}
                    </span>
                    <span className="text-sm font-bold text-neutral-400">/ {missions.length}개</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-rose-600 bg-white border border-rose-100/60 px-2.5 py-1 rounded-full">
                      달성률 {missions.length ? Math.round((missions.filter(m => m.status === "COMPLETED").length / missions.length) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 1. 실천 미션 리스트 */}
            {downloadOptions.includeMissionSummary && downloadOptions.action && missions.length > 0 && (
              <div className={pdfSpacingMode === "compact" ? "space-y-2.5" : "space-y-4"}>
                <div className="flex items-center gap-2 border-b pb-2 border-neutral-100">
                  <span className="text-rose-500">✨</span>
                  <h3 className="font-display font-extrabold text-sm text-neutral-800">마음 회복을 위한 실천 미션 목록</h3>
                </div>
                <div className={pdfSpacingMode === "compact" ? "space-y-2" : "space-y-3"}>
                  {missions.map((m, idx) => (
                    <div key={idx} className={`border border-neutral-100 bg-neutral-50/30 flex items-start justify-between gap-4 ${
                      pdfSpacingMode === "compact" ? "p-3 rounded-lg" : "p-4 rounded-xl"
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          m.status === "COMPLETED" ? "bg-emerald-100 text-emerald-600" : "bg-neutral-100 text-neutral-500"
                        }`}>
                          {m.status === "COMPLETED" ? "✓" : idx + 1}
                        </div>
                        <div>
                          <h4 className={`font-bold text-neutral-800 ${
                            pdfSpacingMode === "compact" ? "text-[11px]" : "text-xs"
                          }`}>{m.title}</h4>
                          <p className="text-[10px] text-neutral-500 mt-0.5">{m.description}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          m.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-500"
                        }`}>
                          {m.status === "COMPLETED" ? "완료" : "대기중"}
                        </span>
                        <p className="text-[9px] text-rose-500 font-bold mt-1">회복도 +{m.activationBonus}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2. 대화 세션 기록 */}
            {downloadOptions.includeChatHistory && (downloadOptions.emotion || downloadOptions.rational || downloadOptions.action) && (
              <div className={pdfSpacingMode === "compact" ? "space-y-2.5" : "space-y-4"}>
                <div className="flex items-center gap-2 border-b pb-2 border-neutral-100">
                  <span className="text-rose-500">💬</span>
                  <h3 className="font-display font-extrabold text-sm text-neutral-800">단계별 상담 대화 기록</h3>
                </div>
                <div className={pdfSpacingMode === "compact" ? "space-y-2" : "space-y-3"}>
                  {messages
                    .filter((m) => {
                      if (m.stage === "EMOTIONAL" || !m.stage) return downloadOptions.emotion;
                      if (m.stage === "RATIONAL") return downloadOptions.rational;
                      if (m.stage === "ACTIONABLE") return downloadOptions.action;
                      return true;
                    })
                    .slice(-8) // Keeps report within ideal size range for the latest session
                    .map((m, idx) => {
                      const isUser = m.role === "user";
                      return (
                        <div key={idx} className={`border flex flex-col gap-2 ${
                          pdfSpacingMode === "compact" ? "p-3 rounded-lg" : "p-4 rounded-xl"
                        } ${
                          isUser 
                            ? "bg-neutral-50/50 border-neutral-100" 
                            : "bg-rose-50/10 border-rose-100/30"
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-neutral-500">
                              {isUser ? "나 (사용자)" : "정신체리 (마음 메이트)"}
                            </span>
                            <span className="text-[9px] text-neutral-400 font-mono">{m.timestamp}</span>
                          </div>
                          <p className={`whitespace-pre-wrap leading-relaxed text-neutral-700 ${
                            pdfSpacingMode === "compact" ? "text-[11px]" : "text-xs"
                          }`}>
                            {m.content}
                          </p>
                          {m.card && (
                            <div className="p-3 bg-white border border-rose-100/60 rounded-lg mt-1">
                              <p className="text-[9px] font-bold text-rose-500 uppercase tracking-wider">{m.card.subtitle}</p>
                              <h5 className="text-xs font-bold text-neutral-800 mt-0.5">{m.card.title}</h5>
                              <p className="text-[10px] text-neutral-600 mt-1 leading-relaxed">{m.card.content}</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  }
                </div>
              </div>
            )}

            {/* Footer closing quote */}
            <div className={`border-t border-rose-100 mt-auto text-center ${
              pdfSpacingMode === "compact" ? "pt-4" : "pt-6"
            }`}>
              <p className={`text-neutral-600 font-medium italic leading-relaxed max-w-lg mx-auto ${
                pdfSpacingMode === "compact" ? "text-[10px]" : "text-[11px]"
              }`}>
                &ldquo;생각은 스쳐 지나가는 바람일 뿐입니다. 마음속 혼란스러운 감정에 잠시 가려져 걱정하고 있었던 것뿐이에요. 
                정신체리와 함께 한 걸음씩 마음을 돌보다 보면, 분명 내일은 오늘보다 더 든든하고 편안해질 것입니다.&rdquo;
              </p>
              <p className={`font-bold text-rose-500 ${
                pdfSpacingMode === "compact" ? "mt-2.5 text-[9px]" : "mt-4 text-[10px]"
              }`}>정신체리 드림 🍒</p>
            </div>
          </div>
        </div>

        {/* 30-Second Mindfulness Breathing Exercise Overlay */}
        <BreathingModal
          isOpen={isBreathingOpen}
          onClose={() => setIsBreathingOpen(false)}
          onComplete={() => {
            updateCheckIn();
            // Reward: Give +5% progress!
            setSyncProgress(prev => Math.min(100, prev + 5));
            setInAppToast({
              title: "⚡ 호흡 훈련 완수 보상 완료 🍒",
              desc: "전두엽이 차분하게 조율되어 마음 싱크로율 수치가 +5% 향상되었습니다."
            });
            setTimeout(() => setInAppToast(null), 3500);
          }}
          theme={theme}
        />

        {/* Floating Dopamine Achievement Toasts */}
        <AnimatePresence>
          {dopamineToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, scale: 0.8, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: -25 }}
              exit={{ opacity: 0, scale: 0.85, y: -45 }}
              transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
              style={{
                position: "fixed",
                left: `${toast.x}px`,
                top: `${toast.y}px`,
                transform: "translate(-50%, -100%)",
                zIndex: 99999,
                pointerEvents: "none",
              }}
              className={`px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 border whitespace-nowrap ${
                theme === "midnight"
                  ? "bg-neutral-950/95 border-rose-500/30 text-rose-300 shadow-rose-950/40"
                  : "bg-white/95 border-rose-200 text-rose-600 shadow-rose-100/50"
              }`}
            >
              <span className="text-[11px] font-extrabold tracking-tight font-display flex items-center gap-1.5">
                <span>{toast.text}</span>
              </span>
              <motion.span
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
                className="text-xs"
              >
                🍒
              </motion.span>
            </motion.div>
          ))}
        </AnimatePresence>

      </div>
    </div>
  );
}
