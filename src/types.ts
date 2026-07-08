export type Stage = "EMOTIONAL" | "RATIONAL" | "ACTIONABLE";

export interface UserSituation {
  jobCategory: string;
  age: string;
  gapPeriod: string;
  hatedWords: string;
  customDetails: string;
}

export interface MessageCard {
  type: "fact_check" | "mission" | "insight";
  title: string;
  subtitle: string;
  content: string;
  metric?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  stage?: Stage;
  card?: MessageCard | null;
}

export interface DailyMission {
  id: string;
  title: string;
  description: string;
  status: "ACTIVE" | "COMPLETED" | "PENDING";
  activationBonus: number;
  icon: string;
}

export interface WeeklyLog {
  day: string;
  active: boolean;
  intensity: "high" | "medium" | "low" | "none";
}

export interface CbtPracticeLog {
  id: string;
  missionId: string;
  missionTitle: string;
  timestamp: string;
  inputs: Record<string, string>;
}

