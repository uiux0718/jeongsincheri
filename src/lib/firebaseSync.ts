import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { ChatMessage, DailyMission, Stage, UserSituation, CbtPracticeLog } from "../types";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(p => ({
        providerId: p.providerId,
        email: p.email
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Get or create unique session ID for the user to ensure data persistence across refreshes
export function getSessionId(): string {
  // If user is authenticated, we MUST use their UID as the sessionId for secure cloud association
  if (auth?.currentUser) {
    return auth.currentUser.uid;
  }

  try {
    let sessionId = localStorage.getItem("jc_session_id");
    if (!sessionId) {
      sessionId = "session_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem("jc_session_id", sessionId);
    }
    return sessionId;
  } catch (e) {
    console.error("Failed to access localStorage for session ID:", e);
    return "session_fallback_" + Date.now();
  }
}

export interface ChatSessionData {
  messages: ChatMessage[];
  currentStage: Stage;
  syncProgress: number;
  missions: DailyMission[];
  currentNeuralState: "overheated" | "neutral" | "synced";
  userSituation?: UserSituation;
  completionHistory?: Record<string, number>;
  cbtLogs?: CbtPracticeLog[];
}

// Save conversation and app state to Firestore & LocalStorage for dual resilience
export async function saveSessionState(data: ChatSessionData) {
  const sessionId = getSessionId();
  const path = `chat_sessions/${sessionId}`;
  const timestamp = new Date().toISOString();
  
  // 1. Back up to LocalStorage immediately as a reactive local cache
  try {
    localStorage.setItem("jc_messages", JSON.stringify(data.messages));
    localStorage.setItem("jc_current_stage", data.currentStage);
    localStorage.setItem("jc_sync_progress", data.syncProgress.toString());
    localStorage.setItem("jc_missions", JSON.stringify(data.missions));
    localStorage.setItem("jc_current_neural_state", data.currentNeuralState);
    if (data.userSituation) {
      localStorage.setItem("jc_user_situation", JSON.stringify(data.userSituation));
    } else {
      localStorage.removeItem("jc_user_situation");
    }
    if (data.completionHistory) {
      localStorage.setItem("jc_completion_history", JSON.stringify(data.completionHistory));
    }
    if (data.cbtLogs) {
      localStorage.setItem("jc_cbt_logs", JSON.stringify(data.cbtLogs));
    }
    localStorage.setItem("jc_updated_at", timestamp);
  } catch (err) {
    console.error("[Local Storage Sync Error] Failed to write local cache:", err);
  }

  // 2. Synchronize with Firestore database
  try {
    const docRef = doc(db, "chat_sessions", sessionId);
    await setDoc(docRef, {
      messages: data.messages,
      currentStage: data.currentStage,
      syncProgress: data.syncProgress,
      missions: data.missions,
      currentNeuralState: data.currentNeuralState,
      userSituation: data.userSituation || null,
      completionHistory: data.completionHistory || null,
      cbtLogs: data.cbtLogs || null,
      updatedAt: timestamp
    }, { merge: true });
    console.log(`[Firestore Sync] Successfully saved chat session: ${sessionId}`);
  } catch (error) {
    console.error("[Firestore Sync Error] Failed to save to Firestore. Local cache remains active:", error);
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Load conversation and app state from Firestore, with robust LocalStorage fallback and sophisticated data-merging
export async function loadSessionState(): Promise<ChatSessionData | null> {
  const sessionId = getSessionId();
  const path = `chat_sessions/${sessionId}`;

  let localData: (ChatSessionData & { updatedAt?: string }) | null = null;
  let remoteData: (ChatSessionData & { updatedAt?: string }) | null = null;

  // 1. Try reading from LocalStorage
  try {
    const savedMessages = localStorage.getItem("jc_messages");
    if (savedMessages) {
      const parsedMessages = JSON.parse(savedMessages) as ChatMessage[];
      const currentStage = (localStorage.getItem("jc_current_stage") as Stage) || "EMOTIONAL";
      const syncProgress = parseInt(localStorage.getItem("jc_sync_progress") || "75", 10);
      const savedMissions = localStorage.getItem("jc_missions");
      const missions = savedMissions ? (JSON.parse(savedMissions) as DailyMission[]) : [];
      const currentNeuralState = (localStorage.getItem("jc_current_neural_state") as "overheated" | "neutral" | "synced") || "neutral";
      const savedSituation = localStorage.getItem("jc_user_situation");
      const userSituation = savedSituation ? (JSON.parse(savedSituation) as UserSituation) : undefined;
      const savedHistory = localStorage.getItem("jc_completion_history");
      const completionHistory = savedHistory ? (JSON.parse(savedHistory) as Record<string, number>) : undefined;
      const savedCbtLogs = localStorage.getItem("jc_cbt_logs");
      const cbtLogs = savedCbtLogs ? (JSON.parse(savedCbtLogs) as CbtPracticeLog[]) : [];
      const updatedAt = localStorage.getItem("jc_updated_at") || undefined;

      localData = {
        messages: parsedMessages,
        currentStage: (currentStage === "EMOTIONAL" || currentStage === "RATIONAL" || currentStage === "ACTIONABLE") ? currentStage : "EMOTIONAL",
        syncProgress: isNaN(syncProgress) ? 75 : syncProgress,
        missions,
        currentNeuralState,
        userSituation,
        completionHistory,
        cbtLogs,
        updatedAt
      };
    }
  } catch (e) {
    console.error("[Local Storage Read Error] Failed to read cached state:", e);
  }

  // 2. Try reading from Firestore
  try {
    const docRef = doc(db, "chat_sessions", sessionId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      remoteData = {
        messages: data.messages || [],
        currentStage: data.currentStage || "EMOTIONAL",
        syncProgress: typeof data.syncProgress === "number" ? data.syncProgress : 75,
        missions: data.missions || [],
        currentNeuralState: data.currentNeuralState || "neutral",
        userSituation: data.userSituation || undefined,
        completionHistory: data.completionHistory || undefined,
        cbtLogs: data.cbtLogs || [],
        updatedAt: data.updatedAt || undefined
      };
      console.log(`[Firestore Sync] Successfully retrieved chat session from Firestore: ${sessionId}`);
    }
  } catch (error) {
    console.warn("[Firestore Sync Error] Could not fetch from Firestore, will fallback or use local:", error);
  }

  // 3. Perform a robust, multi-layer merge if both data sources are present
  let resolvedData: (ChatSessionData & { updatedAt?: string }) | null = null;

  if (localData && remoteData) {
    console.log("[Sync Merge] Both LocalStorage and Firestore data exist. Executing merge rules.");
    
    // Compare timestamps if available
    const localTime = localData.updatedAt ? new Date(localData.updatedAt).getTime() : 0;
    const remoteTime = remoteData.updatedAt ? new Date(remoteData.updatedAt).getTime() : 0;

    if (localTime > 0 && remoteTime > 0) {
      if (localTime > remoteTime) {
        console.log(`[Sync Merge] Local storage is newer (${localData.updatedAt} > ${remoteData.updatedAt}). Using LocalStorage data.`);
        resolvedData = localData;
      } else if (remoteTime > localTime) {
        console.log(`[Sync Merge] Firestore database is newer (${remoteData.updatedAt} > ${localData.updatedAt}). Using Firestore data.`);
        resolvedData = remoteData;
      }
    }

    // If timestamps are missing/equal, or to be absolutely secure against content loss, 
    // we perform a deep structural fallback merge
    if (!resolvedData) {
      console.log("[Sync Merge] Timestamps absent, equal, or inconclusive. Merging structurally.");

      // Merge messages (de-duplicate by ID, sort chronologically by timestamp)
      const mergedMessagesMap = new Map<string, ChatMessage>();
      [...localData.messages, ...remoteData.messages].forEach(msg => {
        if (msg && msg.id) {
          const existing = mergedMessagesMap.get(msg.id);
          if (!existing || (!existing.card && msg.card)) {
            mergedMessagesMap.set(msg.id, msg);
          }
        }
      });
      const mergedMessages = Array.from(mergedMessagesMap.values())
        .sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeA - timeB;
        });

      // Merge missions (de-duplicate by ID, preserve completed status)
      const mergedMissionsMap = new Map<string, DailyMission>();
      [...localData.missions, ...remoteData.missions].forEach(m => {
        if (m && m.id) {
          const existing = mergedMissionsMap.get(m.id);
          if (!existing) {
            mergedMissionsMap.set(m.id, m);
          } else if (m.status === "COMPLETED" || existing.status === "COMPLETED") {
            existing.status = "COMPLETED";
          }
        }
      });
      const mergedMissions = Array.from(mergedMissionsMap.values());

      // Merge completion history
      const mergedHistory = { 
          ...(localData.completionHistory || {}), 
          ...(remoteData.completionHistory || {}) 
      };

      // Merge CBT Logs
      const mergedCbtLogsMap = new Map<string, CbtPracticeLog>();
      [...(localData.cbtLogs || []), ...(remoteData.cbtLogs || [])].forEach(log => {
        if (log && log.id) {
          mergedCbtLogsMap.set(log.id, log);
        }
      });
      const mergedCbtLogs = Array.from(mergedCbtLogsMap.values());

      // Determine the most advanced neural state, stage, and progress
      const resolvedStage = (localData.currentStage === "ACTIONABLE" || remoteData.currentStage === "ACTIONABLE") 
        ? "ACTIONABLE" 
        : (localData.currentStage === "RATIONAL" || remoteData.currentStage === "RATIONAL") 
          ? "RATIONAL" 
          : "EMOTIONAL";

      const resolvedNeuralState = (localData.currentNeuralState === "synced" || remoteData.currentNeuralState === "synced")
        ? "synced"
        : (localData.currentNeuralState === "neutral" || remoteData.currentNeuralState === "neutral")
          ? "neutral"
          : "overheated";

      const resolvedProgress = Math.max(localData.syncProgress, remoteData.syncProgress);

      // Situation
      const resolvedSituation = localData.userSituation || remoteData.userSituation;

      resolvedData = {
        messages: mergedMessages,
        currentStage: resolvedStage,
        syncProgress: resolvedProgress,
        missions: mergedMissions,
        currentNeuralState: resolvedNeuralState,
        userSituation: resolvedSituation,
        completionHistory: mergedHistory,
        cbtLogs: mergedCbtLogs,
        updatedAt: localTime > remoteTime ? localData.updatedAt : remoteData.updatedAt
      };
    }
  } else if (localData) {
    console.log("[Sync Merge] Only LocalStorage data exists. Promoting to resolved state.");
    resolvedData = localData;
  } else if (remoteData) {
    console.log("[Sync Merge] Only Firestore data exists. Promoting to resolved state.");
    resolvedData = remoteData;
  }

  // 4. If we successfully resolved data, make sure both LocalStorage and Firestore are fully updated with it
  if (resolvedData) {
    const updatedTimestamp = resolvedData.updatedAt || new Date().toISOString();
    
    // Save to LocalStorage immediately
    try {
      localStorage.setItem("jc_messages", JSON.stringify(resolvedData.messages));
      localStorage.setItem("jc_current_stage", resolvedData.currentStage);
      localStorage.setItem("jc_sync_progress", resolvedData.syncProgress.toString());
      localStorage.setItem("jc_missions", JSON.stringify(resolvedData.missions));
      localStorage.setItem("jc_current_neural_state", resolvedData.currentNeuralState);
      if (resolvedData.userSituation) {
        localStorage.setItem("jc_user_situation", JSON.stringify(resolvedData.userSituation));
      } else {
        localStorage.removeItem("jc_user_situation");
      }
      if (resolvedData.completionHistory) {
        localStorage.setItem("jc_completion_history", JSON.stringify(resolvedData.completionHistory));
      }
      if (resolvedData.cbtLogs) {
        localStorage.setItem("jc_cbt_logs", JSON.stringify(resolvedData.cbtLogs));
      }
      localStorage.setItem("jc_updated_at", updatedTimestamp);
    } catch (err) {
      console.error("[Sync Merge] Failed to write resolved state to LocalStorage:", err);
    }

    // Push back to Firestore if remote is outdated or missing
    try {
      const docRef = doc(db, "chat_sessions", sessionId);
      await setDoc(docRef, {
        messages: resolvedData.messages,
        currentStage: resolvedData.currentStage,
        syncProgress: resolvedData.syncProgress,
        missions: resolvedData.missions,
        currentNeuralState: resolvedData.currentNeuralState,
        userSituation: resolvedData.userSituation || null,
        completionHistory: resolvedData.completionHistory || null,
        cbtLogs: resolvedData.cbtLogs || null,
        updatedAt: updatedTimestamp
      }, { merge: true });
    } catch (err) {
      console.error("[Sync Merge] Failed to push resolved state back to Firestore:", err);
    }

    return resolvedData;
  }

  return null;
}

// Migrate guest data (local cache or existing session doc) to the newly authenticated user's account
export async function migrateGuestToUser(userUid: string) {
  try {
    // 1. Get the current guest session ID
    const guestSessionId = localStorage.getItem("jc_session_id");
    if (!guestSessionId || guestSessionId === userUid) {
      return; // Already migrated or no guest session existed
    }

    console.log(`[Migration] Starting data migration from Guest (${guestSessionId}) to User (${userUid})`);

    // 2. Fetch remote Guest data if possible, otherwise use local cache
    let guestData: ChatSessionData | null = null;
    try {
      const docRef = doc(db, "chat_sessions", guestSessionId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const d = docSnap.data();
        guestData = {
          messages: d.messages || [],
          currentStage: d.currentStage || "EMOTIONAL",
          syncProgress: typeof d.syncProgress === "number" ? d.syncProgress : 75,
          missions: d.missions || [],
          currentNeuralState: d.currentNeuralState || "neutral",
          userSituation: d.userSituation || undefined,
          completionHistory: d.completionHistory || undefined,
          cbtLogs: d.cbtLogs || undefined
        };
      }
    } catch (err) {
      console.warn("[Migration] Could not load Guest session from Firestore, using local storage cache:", err);
    }

    // 3. Fallback to local storage cache if Firestore Guest doc doesn't exist
    if (!guestData) {
      const savedMessages = localStorage.getItem("jc_messages");
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        const currentStage = (localStorage.getItem("jc_current_stage") as Stage) || "EMOTIONAL";
        const syncProgress = parseInt(localStorage.getItem("jc_sync_progress") || "75", 10);
        const savedMissions = localStorage.getItem("jc_missions");
        const missions = savedMissions ? JSON.parse(savedMissions) : [];
        const currentNeuralState = (localStorage.getItem("jc_current_neural_state") as any) || "neutral";
        const savedSituation = localStorage.getItem("jc_user_situation");
        const userSituation = savedSituation ? JSON.parse(savedSituation) : undefined;
        const savedHistory = localStorage.getItem("jc_completion_history");
        const completionHistory = savedHistory ? JSON.parse(savedHistory) : undefined;
        const savedCbtLogs = localStorage.getItem("jc_cbt_logs");
        const cbtLogs = savedCbtLogs ? JSON.parse(savedCbtLogs) : undefined;

        guestData = {
          messages: parsedMessages,
          currentStage,
          syncProgress: isNaN(syncProgress) ? 75 : syncProgress,
          missions,
          currentNeuralState,
          userSituation,
          completionHistory,
          cbtLogs
        };
      }
    }

    if (!guestData) {
      console.log("[Migration] No guest data found to migrate.");
      return;
    }

    // 4. Fetch the existing User data if any, to merge guest data with user data! (Sophisticated merge)
    let userData: ChatSessionData | null = null;
    try {
      const userDocRef = doc(db, "chat_sessions", userUid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const d = userDocSnap.data();
        userData = {
          messages: d.messages || [],
          currentStage: d.currentStage || "EMOTIONAL",
          syncProgress: typeof d.syncProgress === "number" ? d.syncProgress : 75,
          missions: d.missions || [],
          currentNeuralState: d.currentNeuralState || "neutral",
          userSituation: d.userSituation || undefined,
          completionHistory: d.completionHistory || undefined,
          cbtLogs: d.cbtLogs || undefined
        };
      }
    } catch (err) {
      console.warn("[Migration] Could not load existing User session from Firestore:", err);
    }

    let mergedData: ChatSessionData = { ...guestData };

    if (userData) {
      console.log("[Migration] Merging Guest data into existing User cloud data.");
      
      // Merge messages (de-duplicate by ID, sort chronologically)
      const mergedMessagesMap = new Map<string, ChatMessage>();
      [...userData.messages, ...guestData.messages].forEach(msg => {
        if (msg && msg.id) {
          mergedMessagesMap.set(msg.id, msg);
        }
      });
      const mergedMessages = Array.from(mergedMessagesMap.values()).sort((a, b) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      // Merge missions (de-duplicate by ID, preserve completed status)
      const mergedMissionsMap = new Map<string, DailyMission>();
      [...userData.missions, ...guestData.missions].forEach(m => {
        if (m && m.id) {
          const existing = mergedMissionsMap.get(m.id);
          if (!existing) {
            mergedMissionsMap.set(m.id, m);
          } else if (m.status === "COMPLETED" || existing.status === "COMPLETED") {
            existing.status = "COMPLETED";
          }
        }
      });

      // Merge completion history
      const mergedHistory = {
        ...(userData.completionHistory || {}),
        ...(guestData.completionHistory || {})
      };

      // Merge CBT Logs
      const mergedCbtLogsMap = new Map<string, CbtPracticeLog>();
      [...(userData.cbtLogs || []), ...(guestData.cbtLogs || [])].forEach(log => {
        if (log && log.id) {
          mergedCbtLogsMap.set(log.id, log);
        }
      });

      mergedData = {
        messages: mergedMessages,
        currentStage: guestData.currentStage === "ACTIONABLE" || userData.currentStage === "ACTIONABLE" ? "ACTIONABLE" : guestData.currentStage === "RATIONAL" || userData.currentStage === "RATIONAL" ? "RATIONAL" : "EMOTIONAL",
        syncProgress: Math.max(guestData.syncProgress, userData.syncProgress),
        missions: Array.from(mergedMissionsMap.values()),
        currentNeuralState: guestData.currentNeuralState === "synced" || userData.currentNeuralState === "synced" ? "synced" : "neutral",
        userSituation: guestData.userSituation || userData.userSituation,
        completionHistory: mergedHistory,
        cbtLogs: Array.from(mergedCbtLogsMap.values())
      };
    }

    // 5. Save the merged data under the User's UID doc in Firestore
    const userDocRef = doc(db, "chat_sessions", userUid);
    await setDoc(userDocRef, {
      ...mergedData,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // 6. Delete the old Guest document from Firestore to clean up
    try {
      const guestDocRef = doc(db, "chat_sessions", guestSessionId);
      await deleteDoc(guestDocRef);
      console.log(`[Migration] Deleted old Guest Firestore document: ${guestSessionId}`);
    } catch (err) {
      console.warn("[Migration] Failed to delete guest document from Firestore (may be restricted by security rules):", err);
    }

    // 7. Update local storage with the new user state and update session ID
    localStorage.setItem("jc_session_id", userUid);
    localStorage.setItem("jc_messages", JSON.stringify(mergedData.messages));
    localStorage.setItem("jc_current_stage", mergedData.currentStage);
    localStorage.setItem("jc_sync_progress", mergedData.syncProgress.toString());
    localStorage.setItem("jc_missions", JSON.stringify(mergedData.missions));
    localStorage.setItem("jc_current_neural_state", mergedData.currentNeuralState);
    if (mergedData.userSituation) {
      localStorage.setItem("jc_user_situation", JSON.stringify(mergedData.userSituation));
    }
    if (mergedData.completionHistory) {
      localStorage.setItem("jc_completion_history", JSON.stringify(mergedData.completionHistory));
    }
    if (mergedData.cbtLogs) {
      localStorage.setItem("jc_cbt_logs", JSON.stringify(mergedData.cbtLogs));
    }

    console.log(`[Migration] Successfully completed migration from Guest to User UID: ${userUid}`);
  } catch (error) {
    console.error("[Migration Error] Critical error during data migration:", error);
  }
}

// Delete conversation and app state from Firestore & LocalStorage to respect user's right to be forgotten
export async function deleteSessionState() {
  const sessionId = getSessionId();
  const guestSessionId = localStorage.getItem("jc_session_id");

  // 1. Delete from Firestore first (for current active session)
  if (sessionId) {
    const path = `chat_sessions/${sessionId}`;
    try {
      const docRef = doc(db, "chat_sessions", sessionId);
      await deleteDoc(docRef);
      console.log(`[Firestore Sync] Successfully deleted active session document: ${sessionId}`);
    } catch (error) {
      console.error(`[Firestore Sync Error] Failed to delete document ${sessionId} from Firestore:`, error);
      // Even if Firestore fails, we should proceed with local clearance to guarantee reset
    }
  }

  // 2. Delete guest session from Firestore if different and exists
  if (guestSessionId && guestSessionId !== sessionId) {
    const path = `chat_sessions/${guestSessionId}`;
    try {
      const docRef = doc(db, "chat_sessions", guestSessionId);
      await deleteDoc(docRef);
      console.log(`[Firestore Sync] Successfully deleted alternative guest session document: ${guestSessionId}`);
    } catch (error) {
      console.error(`[Firestore Sync Error] Failed to delete guest document ${guestSessionId} from Firestore:`, error);
    }
  }

  // 3. Clear all local storage keys
  clearLocalSessionKeys();
}

export function clearLocalSessionKeys() {
  try {
    const keysToRemove = [
      "jc_session_id",
      "jc_messages",
      "jc_current_stage",
      "jc_sync_progress",
      "jc_missions",
      "jc_current_neural_state",
      "jc_user_situation",
      "jc_last_insight_date",
      "jc_cbt_logs",
      "jc_completion_history"
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));
    localStorage.setItem("jc_current_view", "onboarding");
    localStorage.setItem("jc_active_tab", "missions");
  } catch (err) {
    console.error("Failed to clear local storage session keys:", err);
  }
}
