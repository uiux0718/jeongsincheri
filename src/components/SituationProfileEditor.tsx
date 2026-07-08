import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { User, Sparkles, Check, Plus, X, Heart, MessageSquare, Briefcase, Calendar, AlertCircle } from "lucide-react";
import { UserSituation } from "../types";

interface SituationProfileEditorProps {
  initialSituation: UserSituation;
  onSave: (updated: UserSituation) => void;
  theme: "cherry" | "midnight";
  isCompact?: boolean;
}

export const SituationProfileEditor: React.FC<SituationProfileEditorProps> = ({
  initialSituation,
  onSave,
  theme,
  isCompact = false,
}) => {
  const [jobCategory, setJobCategory] = useState(initialSituation.jobCategory || "");
  const [age, setAge] = useState(initialSituation.age || "");
  const [gapPeriod, setGapPeriod] = useState(initialSituation.gapPeriod || "");
  const [customDetails, setCustomDetails] = useState(initialSituation.customDetails || "");
  
  // Manage hated words as an array of tags for high-end feel
  const [hatedWordsList, setHatedWordsList] = useState<string[]>(() => {
    if (!initialSituation.hatedWords) return [];
    return initialSituation.hatedWords
      .split(",")
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
  });
  
  const [customHatedInput, setCustomHatedInput] = useState("");

  const jobOptions = ["취업준비생", "직장인", "대학생/대학원생", "프리랜서", "주부", "휴직/퇴사 상태", "기타"];
  const ageOptions = ["10대", "20대", "30대", "40대", "50대 이상"];
  const gapOptions = ["없음", "3개월 미만", "3~6개월", "6개월~1년", "1년~2년", "2년 이상"];
  
  const popularHatedPhrases = [
    "열심히 하면 다 돼",
    "요즘 뭐하고 지내?",
    "남들도 다 겪는 일이야",
    "네가 노력이 부족해서 그래",
    "언제 취업할래?",
    "더 늦기 전에 아무 데나 가",
    "네 나이 때는 참 좋을 때다",
  ];

  // Sync state if initialSituation changes (e.g., loaded from cloud after initial load)
  useEffect(() => {
    setJobCategory(initialSituation.jobCategory || "");
    setAge(initialSituation.age || "");
    setGapPeriod(initialSituation.gapPeriod || "");
    setCustomDetails(initialSituation.customDetails || "");
    if (initialSituation.hatedWords) {
      setHatedWordsList(
        initialSituation.hatedWords
          .split(",")
          .map((w) => w.trim())
          .filter((w) => w.length > 0)
      );
    } else {
      setHatedWordsList([]);
    }
  }, [initialSituation]);

  const handleAddCustomHated = () => {
    const trimmed = customHatedInput.trim();
    if (!trimmed) return;
    if (!hatedWordsList.includes(trimmed)) {
      setHatedWordsList((prev) => [...prev, trimmed]);
    }
    setCustomHatedInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomHated();
    }
  };

  const handleRemoveHated = (word: string) => {
    setHatedWordsList((prev) => prev.filter((w) => w !== word));
  };

  const togglePopularHated = (phrase: string) => {
    if (hatedWordsList.includes(phrase)) {
      setHatedWordsList((prev) => prev.filter((w) => w !== phrase));
    } else {
      setHatedWordsList((prev) => [...prev, phrase]);
    }
  };

  const handleSaveClick = () => {
    const updated: UserSituation = {
      jobCategory,
      age,
      gapPeriod,
      hatedWords: hatedWordsList.join(", "),
      customDetails,
    };
    onSave(updated);
  };

  const isDark = theme === "midnight";

  return (
    <div
      id="situation-profile-editor"
      className={`rounded-2xl border p-5 transition-all duration-300 ${
        isDark
          ? "bg-neutral-800/60 border-neutral-700/80 text-neutral-100"
          : "bg-white border-rose-100 shadow-sm"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div
          className={`p-1.5 rounded-xl ${
            isDark ? "bg-rose-950/40 text-rose-400" : "bg-rose-50 text-rose-600"
          }`}
        >
          <User className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold font-display">나의 맞춤형 마음 상태 프로필</h4>
          <p className="text-[10px] text-neutral-400 mt-0.5 leading-relaxed">
            나의 상황과 가장 듣기 싫은 말을 등록해두면, 정신체리가 상담 시 100% 반영하여 답변합니다.
          </p>
        </div>
      </div>

      <div className="space-y-4 text-xs">
        {/* Row 1: Job and Age in Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Job Category */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-500 flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5" />
              직업 / 상황 분류
            </label>
            <div className="flex flex-wrap gap-1.5">
              {jobOptions.map((opt) => {
                const isSelected = jobCategory === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setJobCategory(opt)}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "bg-rose-500 border-rose-500 text-white font-bold"
                        : isDark
                        ? "bg-neutral-900/40 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                        : "bg-neutral-50 border-neutral-150 text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Age Group */}
          <div className="space-y-1.5">
            <label className="font-bold text-neutral-500 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              나이대
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ageOptions.map((opt) => {
                const isSelected = age === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAge(opt)}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
                      isSelected
                        ? "bg-rose-500 border-rose-500 text-white font-bold"
                        : isDark
                        ? "bg-neutral-900/40 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                        : "bg-neutral-50 border-neutral-150 text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 2: Gap Period */}
        <div className="space-y-1.5 pt-1">
          <label className="font-bold text-neutral-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            공백기 / 이직 준비 기간 (휴식기)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {gapOptions.map((opt) => {
              const isSelected = gapPeriod === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setGapPeriod(opt)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
                    isSelected
                      ? "bg-rose-500 border-rose-500 text-white font-bold"
                      : isDark
                      ? "bg-neutral-900/40 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                      : "bg-neutral-50 border-neutral-150 text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Words I Hate to Hear (듣기 싫은 말) */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <label className="font-bold text-rose-500 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              가장 듣기 싫은 말 (위로가 되지 않는 말)
            </label>
            <span className="text-[9px] text-neutral-400">정신체리가 이 단어를 절대 피해 갑니다</span>
          </div>

          {/* Quick Select Popular Pharses */}
          <div className="bg-neutral-50/50 dark:bg-neutral-900/30 p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-800">
            <p className="text-[10px] text-neutral-400 mb-1.5 font-bold">💡 터치하여 간편 선택:</p>
            <div className="flex flex-wrap gap-1.5">
              {popularHatedPhrases.map((phrase) => {
                const isSelected = hatedWordsList.includes(phrase);
                return (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => togglePopularHated(phrase)}
                    className={`px-2 py-1 rounded-md text-[10px] transition-all border cursor-pointer ${
                      isSelected
                        ? "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 font-bold"
                        : "bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-100 dark:border-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {phrase}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Hated Input & Active Tags */}
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="직접 입력 (예: 요즘 바빠?, 결혼은 언제 해?)"
                value={customHatedInput}
                onChange={(e) => setCustomHatedInput(e.target.value)}
                onKeyDown={handleKeyPress}
                className={`flex-1 px-3 py-2 rounded-xl text-[11px] border focus:outline-none transition-all ${
                  isDark
                    ? "bg-neutral-900 border-neutral-800 text-neutral-100 focus:border-rose-500"
                    : "bg-white border-neutral-200 text-neutral-800 focus:border-rose-500"
                }`}
              />
              <button
                type="button"
                onClick={handleAddCustomHated}
                className="px-3.5 bg-neutral-900 dark:bg-rose-700 hover:opacity-90 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Hated Words Tags Display */}
            {hatedWordsList.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {hatedWordsList.map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-fade-in"
                  >
                    {word}
                    <button
                      type="button"
                      onClick={() => handleRemoveHated(word)}
                      className="hover:bg-rose-600 rounded-full p-0.5 transition-colors cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5 text-white" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-neutral-400 leading-relaxed pl-1">
                ※ 등록된 금지어가 없습니다. 등록하면 훈계나 지적 대신 따뜻한 지지를 전달합니다.
              </p>
            )}
          </div>
        </div>

        {/* Row 4: Custom Details (Textarea) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center">
            <label className="font-bold text-neutral-500 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              구체적인 고민이나 나의 심정 (선택)
            </label>
            <span className="text-[9px] text-neutral-400">자세할수록 고도화된 답변이 가능합니다</span>
          </div>
          <textarea
            rows={3}
            placeholder="상황에 대해 구체적인 고민이나 마음을 적어주세요. (예: 개발자 3년차인데 최근 번아웃이 와서 이직을 고민하고 있습니다. 자존감이 많이 깎인 상태입니다.)"
            value={customDetails}
            onChange={(e) => setCustomDetails(e.target.value)}
            className={`w-full px-3 py-2 rounded-xl text-[11px] border focus:outline-none transition-all resize-none leading-relaxed ${
              isDark
                ? "bg-neutral-900 border-neutral-800 text-neutral-100 focus:border-rose-500"
                : "bg-white border-neutral-200 text-neutral-800 focus:border-rose-500"
            }`}
          />
        </div>

        {/* Save Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSaveClick}
            className={`w-full py-3 rounded-xl font-bold transition-all active:scale-95 text-white flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/10 cursor-pointer ${
              isDark ? "bg-rose-700 hover:bg-rose-800" : "bg-rose-500 hover:bg-rose-600"
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>개인화 마음 프로필 설정 저장</span>
          </button>
        </div>
      </div>
    </div>
  );
};
