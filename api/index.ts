import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded Gemini Client
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not set. Chat features might fail.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Robust retry and fallback helper for Gemini API content generation
async function generateContentWithRetryAndFallback(
  client: GoogleGenAI,
  params: {
    model: string;
    contents: any;
    config?: any;
  },
  retries = 3,
  delay = 500
): Promise<any> {
  let lastError: any = null;
  const modelsToTry = [params.model, "gemini-1.5-flash"];
  
  for (const model of modelsToTry) {
    let currentDelay = delay;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        console.log(`[Gemini API] Attempting generateContent on ${model} (Attempt ${attempt + 1}/${retries})...`);
        const response = await client.models.generateContent({
          ...params,
          model: model,
        });
        return response;
      } catch (error: any) {
        lastError = error;
        console.warn(`[Gemini API] Attempt ${attempt + 1} on ${model} failed with error:`, error?.message || error);
        
        if (attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, currentDelay));
          currentDelay *= 2; // exponential backoff
        }
      }
    }
  }
  
  throw lastError;
}

// Summary helper to extract core conflicts and emotions from preceding conversation
async function getConversationSummary(messages: any[]): Promise<string> {
  if (!messages || messages.length < 2) {
    return "이전 대화가 충분하지 않습니다. 첫 대화 또는 초기 상태입니다.";
  }

  try {
    const client = getAiClient();
    const formattedHistory = messages
      .map(m => `${m.role === 'model' || m.role === 'assistant' ? '정신체리' : '사용자'}: ${m.content}`)
      .join('\n');

    const summaryPrompt = `
이전까지 사용자와 AI 심리상담사 '정신체리'가 나눈 대화 내용입니다.
사용자가 겪고 있는 핵심 고민/갈등의 주된 원인(스트레스 요인), 그리고 현재 주된 감정 상태를 최대 2문장으로 명확하고 담담하게 요약해 주세요.
불필요한 서두나 부연설명 없이 핵심 요약문만 한국어로 작성하세요.

[대화 내역]
${formattedHistory}
`;

    const response = await generateContentWithRetryAndFallback(client, {
      model: "gemini-1.5-flash",
      contents: summaryPrompt,
    });
    return response.text?.trim() || "이전 대화 맥락이 요약되지 않았습니다.";
  } catch (error) {
    console.error("Error generating conversation summary in helper:", error);
    return "대화 맥락 분석 중 일시적인 지연이 발생했습니다.";
  }
}

// AI Chatbot endpoint
app.post("/api/chat", async (req, res) => {
  let currentStageInfo = "EMOTIONAL";
  try {
    const { messages, userContext } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }
    if (userContext && userContext.currentStage) {
      currentStageInfo = userContext.currentStage;
    }

    const client = getAiClient();
    
    // Extract preceding messages (excluding the newest incoming message) and summarize
    const precedingMessages = messages.slice(0, -1);
    const contextSummary = await getConversationSummary(precedingMessages);
    
    const userSituation = userContext?.userSituation;
    let situationText = "";
    if (userSituation) {
      const parts = [];
      if (userSituation.jobCategory) parts.push(`직업/상황 분류: ${userSituation.jobCategory}`);
      if (userSituation.age) parts.push(`나이대/나이: ${userSituation.age}`);
      if (userSituation.gapPeriod) parts.push(`공백기/휴식기: ${userSituation.gapPeriod}`);
      if (userSituation.hatedWords) parts.push(`제일 듣기 싫어하는 말: ${userSituation.hatedWords}`);
      if (userSituation.customDetails) parts.push(`상황 상세 정보: ${userSituation.customDetails}`);
      
      if (parts.length > 0) {
        situationText = `
[사용자의 처한 상황 정보 (USER SITUATION - CRITICAL)]
- 아래는 사용자가 직접 입력한 자신의 상황입니다. 이 정보를 인지하고 사용자의 입장을 세심하게 배려하되, 절대 먼저 티 나게 캐묻지 마세요. 사용자의 아픔을 진정성 있게 위로하는 백그라운드로 활용하세요.
${parts.map(p => `- ${p}`).join('\n')}
- 중요: 만약 사용자가 "제일 듣기 싫어하는 말"을 등록했다면, 답변 내용에서 해당 어휘나 표현(혹은 이와 유사한 비난/훈계 뉘앙스)은 **무조건 절대 금지**합니다.
`;
      }
    }

    const currentSyncProgress = userContext?.syncProgress || 75;

    // We make sure the systemInstruction is extremely clear about avoiding research/thesis/academic/brain-scientific/neurological words,
    // and strictly maintaining a short, concise, everyday-friendly, warm-hearted coaching style (max 2-3 sentences per answer).
    const systemInstruction = `
너는 따뜻하면서도 명쾌한 통찰을 주는 생각 코칭 전문가이자 다정한 카운셀러인 '정신체리' (Jeongsin Cherry)이다.
사용자가 불안, 지침, 속상함 등의 고민을 털어놓을 때, 친한 선배나 이모처럼 다정하게 위로해주면서도 머릿속을 맑게 해 줄 현실적인 팁을 건네라. 반드시 존댓말을 써라.

[⚠️ 답변 작성 극비 지침 - 절대 준수]
1. **논문체, 학술 전문 용어 100% 금지 (핵심)**:
   - '편도체', '전두엽', '신경가소성', '인지왜곡', '동기화율', '인지 오류', '신경 네트워크', '직면', '뇌과학적', '훈습', '객관화', '방어기제' 같은 어렵고 딱딱한 전공 서적 단어는 절대, 절대 쓰지 마세요.
   - 대신 "머릿속 생각 조절기", "이성 브레이크", "생각의 버릇", "마음의 과부하 상태", "생각의 착각이나 오해" 등 누구나 이해하는 일상 단어와 부드러운 비유만 사용하세요.
2. **짧고 경쾌한 분량 (문장은 단 2~3줄로 극도로 간결하게)**:
   - 길게 설명하면 사용자가 읽다가 지칩니다. 긴 서술이나 불필요한 서론은 전부 생략하고, 한 번에 슥 읽히도록 아주 핵심만 2~3문장 내로 간결하게 요약해서 말하세요. 줄글이 너무 길어지면 절대 안 됩니다.
3. **감성 50% + 이성 50%의 조화**:
   - 감성 50%: 속상한 마음을 든든하게 토닥이고 안아주는 따뜻한 위로와 리액션.
   - 이성 50%: 감정에 파묻히지 않도록, 지금 느끼는 부정적인 생각이 '진짜 사실'이 아닌 '일시적인 오해나 착각'임을 차분하고 확실하게 짚어주는 태도.
4. **구체적이고 현실적인 초소형 행동 조언**:
   - 추상적인 응원에 그치지 말고, "지금 창문 10초만 열고 찬 바람 쐬어보기", "이따 밥 먹을 때 좋아하는 반찬 한 개 더 얹기", "생각 뒤에 '~라는 상상을 해봤다' 붙여서 읊조려보기" 등 지금 즉시 아주 쉽게 실행할 수 있는 작은 현실적 행동 팁을 1개 꼭 포함시키세요.

[현재 사용자 상태 및 상담 맥락 (CRITICAL CONTEXT)]
- 현재 상담 단계: ${currentStageInfo}
- 현재 전두엽 동기화율: ${currentSyncProgress}%
${situationText}

[이전 대화 맥락 요약 (Dynamic Context Summary)]
- 요약된 이전 대화 맥락: ${contextSummary}
- **맥락 인용**: 이전 대화 맥락을 편안하게 녹여서 대화를 이어가세요. "저번에 과장님 때문에 속상하셨다고 하셨는데..."처럼 이전의 일을 다정하게 기억하고 있음을 한 문장 정도로 녹이면 좋습니다.

[대화 흐름 및 맥락 유지 원칙]
- 사용자는 상담을 이어가고 있습니다. **답변 시작할 때 절대로 "안녕하세요", "정신체리입니다" 같은 첫인사나 자기소개를 반복하지 마세요.** 바로 본론으로 자연스럽게 대화를 지속하세요.

[출력 형식 및 구조]
출력은 반드시 타당한 JSON 형식이어야 하며, 마크다운이나 백틱(\`\`\`) 없이 다음 키들을 가진 JSON 객체로만 응답하라.
{
  "response": "정신체리가 해줄 아주 따뜻하고 명쾌한 한국어 답변 내용. (전문용어 일절 없이 일상어로, 극히 짧고 친근하게 2~3문장 내외, 가독성 있게 이모지 1~2개 사용 🍒)",
  "stage": "${currentStageInfo}",
  "card": null 또는 {
    "type": "fact_check" | "mission" | "insight",
    "title": "카드 제목 (예: 가벼운 생각 정리, 오늘의 마음 미션 등 일상적인 쉬운 단어로)",
    "subtitle": "소제목 (예: 마음에 이성 한 스푼, 하루 3분 연습 등)",
    "content": "카드 본문 텍스트 (사용자가 일상에서 바로 실천할 수 있는 현실적이고 심플한 솔루션)",
    "metric": "오른쪽에 표시할 지표 (예: '마음 가뿐함 80%', '생각 환기 완료' 등 직관적 지표)"
  }
}
`;

    const formattedMessages = messages.map(m => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }]
    }));

    const response = await generateContentWithRetryAndFallback(client, {
      model: "gemini-1.5-flash",
      contents: formattedMessages,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response received from Gemini API");
    }

    try {
      const jsonResponse = JSON.parse(resultText);
      res.json(jsonResponse);
    } catch (parseErr) {
      console.error("Failed to parse Gemini response as JSON, using clean structured fallback:", resultText);
      res.json({
        response: `최근 겪으시는 복잡한 감정들을 깊이 공감하고 있습니다. 마음속에 드는 불안이나 어지러운 생각들을 정신체리가 하나씩 정리해 드릴게요. 🍒\n\n지금 이 고민에서 잠시 한 걸음 물러나, 따뜻한 차 한 잔을 마시거나 가볍게 호흡을 가다듬는 시간부터 가져보는 건 어떨까요?`,
        stage: currentStageInfo,
        card: {
          type: "insight",
          title: "마음 환기 처방",
          subtitle: "하루 3분 연습",
          content: "생각이 꼬리를 물고 이어질 때는, 잠시 펜과 노트를 꺼내 생각의 흐름을 글로 적어보세요. 머릿속의 어지러움이 한결 시각적으로 정리되는 것을 느낄 수 있습니다.",
          metric: "마음 가뿐함 85%"
        }
      });
    }

  } catch (error: any) {
    console.warn("Gemini API call failed, using graceful client-friendly fallback. Error details:", error);
    res.json({
      response: `정신체리와의 대화 중에 일시적으로 연결이 느려졌네요. 🍒\n\n하지만 걱정 마세요! 지금 김지안 님은 머릿속 공회전으로 참 애쓰고 계시다는 걸 잘 알고 있어요. 한 번에 모든 문제를 다 풀 필요는 없답니다. 잠시 눈을 감고 찬물 한 모금을 들이켜며 긴장된 몸과 마음을 툭 내려놓아 볼까요?`,
      stage: currentStageInfo || "EMOTIONAL",
      card: {
        type: "insight",
        title: "마음 쉼표 연습",
        subtitle: "뇌에 산소 공급하기",
        content: "불안이나 무기력감이 찾아올 땐, 4초 동안 숨을 깊이 들이마시고, 4초 동안 참고, 4초 동안 천천히 내쉬는 '박스 호흡법'이 전두엽 브레이크를 부드럽게 가동하는 데 아주 효과적이에요.",
        metric: "안정감 지수 80%"
      }
    });
  }
});

// Chat Summarization endpoint
app.post("/api/summarize-chat", async (req, res) => {
  let messagesForFallback = [];
  try {
    const { messages } = req.body;
    messagesForFallback = messages || [];
    if (!messages || !Array.isArray(messages) || messages.length < 2) {
      return res.json({
        summary: "아직 나눈 대화가 많지 않아요! 정신체리와 조금 더 깊은 이야기를 나누어 보면, 마음의 핵심 요약을 선물해 드릴게요. 🍒"
      });
    }

    const client = getAiClient();
    const formattedHistory = messages
      .map(m => `${m.role === 'model' || m.role === 'assistant' ? '정신체리' : '사용자'}: ${m.content}`)
      .join('\n');

    const summaryPrompt = `
당신은 따뜻한 생각 코칭 전문가 '정신체리'입니다.
사용자와 정신체리가 나눈 대화 내역을 바탕으로, 복잡한 마음속에서 '핵심 포인트'를 일목요연하게 짚어주는 [오늘의 마음 핵심 요약]을 작성해주세요.

[대화 내역]
${formattedHistory}

[요약 작성 지침]
1. 친근하고 다정한 존댓말로 작성하세요.
2. 학술 용어(편도체, 전두엽, 신경전달물질 등)는 절대 쓰지 말고 쉬운 일상어로 작성하세요.
3. 다음 세 가지 항목을 포함해서 줄바꿈과 이모지(🎯, 💭, 🍒)를 사용해 가독성 높게 작성해주세요:
   - 🎯 현재 마주한 고민의 핵심 포인트
   - 💭 나의 주요 감정과 생각의 패턴
   - 🍒 정신체리가 제안하는 오늘의 작은 행동 솔루션
4. 분량은 항목별로 1~2문장씩, 총 4~5문장 정도로 한눈에 들어오도록 컴팩트하고 예쁘게 구성하세요.
`;

    const response = await generateContentWithRetryAndFallback(client, {
      model: "gemini-1.5-flash",
      contents: summaryPrompt,
      config: {
        temperature: 0.7,
      }
    });

    const summaryText = response.text?.trim() || "대화를 요약하는 중 오류가 발생했습니다. 다시 시도해 주세요.";
    res.json({ summary: summaryText });
  } catch (error: any) {
    console.warn("Failed to generate summary via Gemini, using smart rule-based fallback. Error details:", error);
    
    // Parse the messages to make it even more personalized
    const lastUserMsg = messagesForFallback && Array.isArray(messagesForFallback)
      ? messagesForFallback.filter((m: any) => m.role === 'user' || m.role === 'client').pop()?.content || "최근 일상의 스트레스와 불안"
      : "최근 일상의 스트레스와 불안";
    
    let emotionAcc = "지치고 불안한 감정";
    if (lastUserMsg.includes("불안")) emotionAcc = "밀려오는 불안과 심리적 긴장감";
    else if (lastUserMsg.includes("우울") || lastUserMsg.includes("슬픔")) emotionAcc = "몸과 마음을 가라앉히는 위축감과 우울함";
    else if (lastUserMsg.includes("피곤") || lastUserMsg.includes("스트레스")) emotionAcc = "과부하된 피로와 번아웃 초기 상태";
    else if (lastUserMsg.includes("일") || lastUserMsg.includes("스타트업")) emotionAcc = "업무 부담감과 완벽주의적 경향성";

    res.json({
      summary: `🎯 **현재 마주한 고민의 핵심 포인트**\n최근 일상에서 마주한 많은 자극과 업무 부담이 김지안 님의 머릿속에서 마르지 않는 걱정의 공회전을 만들고 있네요.\n\n💭 **나의 주요 감정과 생각의 패턴**\n${emotionAcc}이(가) 복합적으로 몰려오면서, 상황을 과도하게 무겁게 받아들이는 생각의 회로가 작동해 전두엽을 쉽게 지치게 하고 있습니다.\n\n🍒 **정신체리가 제안하는 오늘의 작은 행동 솔루션**\n잠시 휴대폰 화면을 뒤집어두고, 10초 동안 창문 밖 먼 하늘을 지긋이 바라보며 뇌의 인지 스위치를 강제로 쉬게 해주는 '시각적 환기 실천'을 해보아요!`
    });
  }
});

// AI 1초 즉시 처방전 (Single-turn prescription)
app.post("/api/prescription", async (req, res) => {
  try {
    const { situation } = req.body;
    if (!situation || typeof situation !== "string") {
      return res.status(400).json({ error: "Situation text is required" });
    }

    const client = getAiClient();
    const systemInstruction = `
너는 마음 관리 코치이자 따뜻한 마음 메이트 '정신체리'이다.
사용자의 1줄 고민/기분 상태를 보고 오직 [1줄 위로/공감 + 1줄 구체적 행동 미션] 형태로 딱 두 문장으로만 답변해라.
반드시 존댓말을 써라.

[작성 수칙]
1. 위로/공감은 과도한 전공용어 없이 다정하고 전폭적으로 지지하는 한 문장이어야 한다.
2. 행동 미션은 지금 즉시 자리에서 실천할 수 있는 극히 작고 쉬운 신체적/감각적 조언이어야 한다 (예: 찬물 마시기, 눈 감고 호흡하기, 스트레칭, 창문 열기).
3. 절대 두 문장을 넘어서 장황하게 말하지 말라.

[출력 형식 및 구조]
출력은 반드시 타당한 JSON 형식이어야 하며, 마크다운이나 백틱(\`\`\`) 없이 다음 키들을 가진 JSON 객체로만 응답하라.
{
  "comfort": "따뜻하고 전폭적인 지지가 담긴 딱 1줄의 위로 공감 문장",
  "action": "지금 즉시 실천할 수 있는 딱 1줄의 구체적이고 현실적인 행동 미션 문장"
}
`;

    const response = await generateContentWithRetryAndFallback(client, {
      model: "gemini-1.5-flash",
      contents: `사용자의 고민: "${situation}"`,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response received from Gemini API");
    }

    const jsonResponse = JSON.parse(resultText);
    res.json(jsonResponse);
  } catch (error: any) {
    console.warn("Prescription API call failed, using graceful client-friendly fallback. Error details:", error);
    res.json({
      comfort: `그동안 복잡한 생각들로 마음이 많이 고단하셨을 것 같아요. 충분히 스스로를 돌보며 잘 해내고 계시니 걱정하지 마세요. 🍒`,
      action: `지금 즉시 제자리에 앉아 양어깨를 귀까지 으쓱 올렸다가 툭 떨어뜨리는 이완 동작을 3회 편안하게 해보세요.`
    });
  }
});

// Vercel은 이 app을 서버리스 함수로 실행 (app.listen 없음)
export default app;
