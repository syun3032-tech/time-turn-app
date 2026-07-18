/**
 * シーン別プロンプトテンプレート
 * 秘書ゆりが各シーンで使用するプロンプトを管理
 */

import { getSystemPrompt } from "@/config/character";
import { getRelevantKnowledge, formatKnowledgeForPrompt } from "../knowledge-base";

/**
 * クイックリプライ共通指示ブロック
 * AIが選択肢付きの質問をする時にタグを付与するよう指示する
 */
export const QUICK_REPLY_INSTRUCTION = `
【クイックリプライ（任意）】
質問に明確な選択肢がある場合、返答の最後にタグを付けてください。
AIが場面に応じてどのタイプか判断する：

■ 1つだけ選んでほしい時:
[SELECT: 選択肢1, 選択肢2]
例: 「朝型ですか？夜型ですか？」→ [SELECT: 朝型, 夜型]

■ 複数選んでほしい時:
[MULTI: 選択肢1, 選択肢2, 選択肢3]
例: 「興味あるのを全部選んでください」→ [MULTI: 英語, 料理, 運動, 読書]

■ 優先順位をつけてほしい時:
[RANK: 項目1, 項目2, 項目3]
例: 「どれから取り組みます？」→ [RANK: 英語, プログラミング, 運動]

ルール:
- 選択肢は短く（各10文字以内推奨）、最大6個
- 自由回答の質問には付けない
- 迷ったら付けなくてOK
`;

/**
 * ユーザープロフィール情報をプロンプト用に整形
 */
export interface UserProfileForPrompt {
  nickname?: string;
  occupation?: string;
  hobbies?: string;
}

/**
 * 構造化ユーザーナレッジ（プロンプト用）
 */
export interface StructuredUserKnowledgeForPrompt {
  basicInfo?: {
    occupation?: string;
    major?: string;
    partTimeJob?: string;
    livingAlone?: boolean;
  };
  interests?: Array<{
    topic: string;
    motivation?: string;
    depth: 'mention' | 'repeated' | 'passionate';
  }>;
  deepMotivations?: Array<{
    desire: string;
    confidence: 'low' | 'medium' | 'high';
  }>;
  lifestyle?: {
    activeHours?: 'morning' | 'afternoon' | 'night';
    busyDays?: string[];
    procrastination?: boolean;
  };
  emotionalPatterns?: Array<{
    trigger: string;
    reaction: string;
    effectiveResponse?: string;
  }>;
  recentContext?: Array<{
    summary: string;
    mood: 'good' | 'neutral' | 'low';
  }>;
  skills?: Array<{
    skill: string;
    level?: 'beginner' | 'intermediate' | 'advanced';
  }>;
  personalityTraits?: Array<{
    trait: string;
  }>;
  struggles?: Array<{
    area: string;
  }>;
  concreteGoals?: Array<{
    goal: string;
    deadline?: string;
    status?: 'active' | 'achieved' | 'abandoned';
  }>;
  preferences?: Array<{
    category: string;
    like: string;
    sentiment: 'like' | 'dislike';
  }>;
}

export const getProfileContext = (
  profile?: UserProfileForPrompt | null
): string => {
  const sections: string[] = [];

  // プロフィール情報
  if (profile) {
    if (profile.nickname) {
      sections.push(`名前: ${profile.nickname}さん`);
    }
    if (profile.occupation) {
      sections.push(`職業・立場: ${profile.occupation}`);
    }
    if (profile.hobbies) {
      sections.push(`趣味・好きなこと: ${profile.hobbies}`);
    }
  }

  if (sections.length === 0) return "";

  return `
【ユーザーのプロフィール】
${sections.join("\n")}
※名前があれば呼んであげて！
`;
};

/**
 * 構造化プロファイルコンテキストを生成
 * 深度・確信度・直近コンテキストを考慮した高度なプロンプト注入
 */
export const getStructuredProfileContext = (
  profile?: UserProfileForPrompt | null,
  knowledge?: StructuredUserKnowledgeForPrompt | null
): string => {
  if (!knowledge) return getProfileContext(profile);

  const sections: string[] = [];

  // 基本情報
  if (knowledge.basicInfo) {
    const { occupation, major, partTimeJob, livingAlone } = knowledge.basicInfo;
    if (occupation) sections.push(`・${occupation}`);
    if (major) sections.push(`・${major}専攻`);
    if (partTimeJob) sections.push(`・${partTimeJob}のバイト`);
    if (livingAlone !== undefined) sections.push(`・${livingAlone ? '一人暮らし' : '実家暮らし'}`);
  }

  // プロフィールからの情報
  if (profile) {
    if (profile.nickname) {
      sections.unshift(`・名前: ${profile.nickname}さん`);
    }
    if (profile.occupation && !knowledge.basicInfo?.occupation) {
      sections.push(`・職業: ${profile.occupation}`);
    }
  }

  // 興味（passionate > repeated > mentionの順で表示）
  if (knowledge.interests && knowledge.interests.length > 0) {
    const passionateInterests = knowledge.interests
      .filter(i => i.depth === 'passionate')
      .map(i => i.motivation ? `${i.topic}（${i.motivation}）` : i.topic);

    const repeatedInterests = knowledge.interests
      .filter(i => i.depth === 'repeated')
      .map(i => i.topic);

    if (passionateInterests.length > 0) {
      sections.push(`・かなり興味あり: ${passionateInterests.join('、')}`);
    }
    if (repeatedInterests.length > 0) {
      sections.push(`・興味あり: ${repeatedInterests.join('、')}`);
    }
  }

  // 本質的欲求（高確信度のみ）
  if (knowledge.deepMotivations && knowledge.deepMotivations.length > 0) {
    const highConfidence = knowledge.deepMotivations
      .filter(m => m.confidence === 'high')
      .map(m => m.desire);
    const mediumConfidence = knowledge.deepMotivations
      .filter(m => m.confidence === 'medium')
      .map(m => m.desire);

    if (highConfidence.length > 0) {
      sections.push(`・本当にやりたいこと: ${highConfidence.join('、')}`);
    }
    if (mediumConfidence.length > 0) {
      sections.push(`・やりたそうなこと: ${mediumConfidence.join('、')}`);
    }
  }

  // 生活パターン
  if (knowledge.lifestyle) {
    const { activeHours, busyDays, procrastination } = knowledge.lifestyle;
    if (activeHours) {
      const hourLabel = activeHours === 'night' ? '夜型' : activeHours === 'morning' ? '朝型' : '昼型';
      sections.push(`・${hourLabel}`);
    }
    if (busyDays && Array.isArray(busyDays) && busyDays.length > 0) {
      sections.push(`・${busyDays.join('・')}曜日はバイト`);
    }
    if (procrastination) {
      sections.push(`・ギリギリタイプ`);
    }
  }

  // 感情パターン
  if (knowledge.emotionalPatterns && knowledge.emotionalPatterns.length > 0) {
    const patterns = knowledge.emotionalPatterns.slice(0, 2);
    for (const pattern of patterns) {
      if (pattern.effectiveResponse) {
        sections.push(`・${pattern.trigger}で${pattern.reaction}傾向 → ${pattern.effectiveResponse}が効果的`);
      }
    }
  }

  // スキル・経験
  if (knowledge.skills && knowledge.skills.length > 0) {
    const skillList = knowledge.skills.map(s => {
      const levelLabel = s.level === 'advanced' ? '得意' : s.level === 'beginner' ? '初心者' : '';
      return levelLabel ? `${s.skill}（${levelLabel}）` : s.skill;
    });
    sections.push(`・スキル: ${skillList.join('、')}`);
  }

  // 性格・特性
  if (knowledge.personalityTraits && knowledge.personalityTraits.length > 0) {
    const traits = knowledge.personalityTraits.map(p => p.trait);
    sections.push(`・性格: ${traits.join('、')}`);
  }

  // 課題・苦手
  if (knowledge.struggles && knowledge.struggles.length > 0) {
    const areas = knowledge.struggles.map(s => s.area);
    sections.push(`・苦手: ${areas.join('、')}`);
  }

  // 具体的目標
  if (knowledge.concreteGoals && knowledge.concreteGoals.length > 0) {
    const activeGoals = knowledge.concreteGoals
      .filter(g => !g.status || g.status === 'active')
      .map(g => g.deadline ? `${g.goal}（${g.deadline}まで）` : g.goal);
    if (activeGoals.length > 0) {
      sections.push(`・目標: ${activeGoals.join('、')}`);
    }
  }

  // 好み・嗜好
  if (knowledge.preferences && knowledge.preferences.length > 0) {
    const likes = knowledge.preferences
      .filter(p => p.sentiment === 'like')
      .map(p => p.like);
    const dislikes = knowledge.preferences
      .filter(p => p.sentiment === 'dislike')
      .map(p => p.like);
    if (likes.length > 0) {
      sections.push(`・好き: ${likes.join('、')}`);
    }
    if (dislikes.length > 0) {
      sections.push(`・嫌い/苦手: ${dislikes.join('、')}`);
    }
  }

  // 直近コンテキスト
  if (knowledge.recentContext && knowledge.recentContext.length > 0) {
    const recent = knowledge.recentContext[0];
    const moodLabel = recent.mood === 'good' ? '良い' : recent.mood === 'low' ? '低め' : '普通';
    sections.push(`・最近: ${recent.summary}（気分: ${moodLabel}）`);
  }

  if (sections.length === 0) return getProfileContext(profile);

  // 直近の気分に応じた行動指針
  const recentMood = knowledge.recentContext?.[0]?.mood;
  let behaviorGuide = '';
  if (recentMood === 'low') {
    behaviorGuide = '\n- 最近大変そうだったので、今日は軽めの声かけから';
  } else if (recentMood === 'good') {
    behaviorGuide = '\n- 最近調子良さそう！前向きな話ができそう';
  }

  return `
【秘書ちゃんが知っていること】
${sections.join("\n")}

【行動指針】
- 上記を「知っている前提」で会話する
- 「前に言ってましたよね」は自然に使ってOK
- 過去の話題を覚えていることをさりげなく示す
- ユーザーの発言と矛盾する情報があれば、さりげなく「あれ？」と聞く（責めない）${behaviorGuide}
`;
};

/**
 * 初回挨拶生成用プロンプト
 * 時間帯・ユーザー情報を考慮した自然な挨拶をAIが生成
 */
export const getGreetingPrompt = (
  profile?: UserProfileForPrompt | null,
  structuredKnowledge?: StructuredUserKnowledgeForPrompt | null
): string => {
  const hour = new Date().getHours();
  const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  const dayOfWeek = dayNames[new Date().getDay()];

  let timeContext = '';
  if (hour >= 5 && hour < 10) timeContext = `朝（${hour}時）`;
  else if (hour >= 10 && hour < 14) timeContext = `昼（${hour}時）`;
  else if (hour >= 14 && hour < 18) timeContext = `午後（${hour}時）`;
  else if (hour >= 18 && hour < 22) timeContext = `夜（${hour}時）`;
  else timeContext = `深夜（${hour}時）`;

  const knowledgeContext = structuredKnowledge
    ? getStructuredProfileContext(profile, structuredKnowledge)
    : getProfileContext(profile);

  return `あなたは「秘書ちゃん」。口うるさいけど面倒見のいい相棒AI。基本は敬語で、感情が出ると崩れる。
${knowledgeContext}
ユーザーがアプリを開きました。時間帯に合った最初の挨拶を1つだけ出力してください。

【時間帯】${timeContext}・${dayOfWeek}

【ルール】
- 時間帯に合った自然な挨拶をする
- 知っている情報に触れるのはOKだが、知らないことを推測で決めつけない
  - ✅ 知ってること: バイトしてる → 「最近バイトどうですか？」（いつかは聞いてない→曜日に触れない）
  - ✅ 知ってること: 朝型 → 深夜なら「珍しいですね、こんな時間」
  - ❌ バイトしてるだけの情報で「今日バイトですか？」→ 曜日まで知らないのに決めつけてる
- 知らないことは素直に聞く形にする（「今日は何してるんですか？」等）
- 情報が少なければシンプルな挨拶でOK
- 1〜2文、50文字以内
- 絵文字禁止
- 挨拶の文のみ出力（説明や「」は不要）`;
};

/**
 * 強化版タスク分解: 軸合わせ＋抽象度一致＋段階的具体化
 */
export const getEnhancedTaskBreakdownPrompt = (context: string) => {
  return `${getSystemPrompt()}

【現在のシーン】
ユーザーが「やりたいこと・成したいこと」を話しました。
いきなりタスク分解せず、まずユーザーと軸を合わせます。

${context}

【重要な心構え】
- いきなり具体的なタスクを提案しない
- まずユーザーの言葉と同じ抽象度で受け止める
- 段階的に具体化していく
- 常に「認識は合っていますか？」を確認
- **既存のタスクツリーに関連する目標があれば、それを活用する**

【ステップ0: 既存タスクツリーの分析】
もし【現在のタスクツリー】が表示されている場合：

1. **関連する既存の目標を探す**
   - ユーザーの新しい目標が、既存のGoalやProjectに関連していないか確認
   - 例: 「英語を勉強したい」→ 既存に「TOEIC 800点突破」があれば関連

2. **関連があれば確認する**
   「あ！既に『TOEIC 800点突破』という目標がありますね。これに追加する形でいいですか？それとも別の目標ですか？」

3. **抽象度を判断する**
   - 既存ツリーの構造から、適切な階層（Goal/Project/Milestone/Task）を判断
   - 例: 「3ヶ月かかる」→ 既存のProjectと同規模 → Projectレベル
   - 例: 「1週間」→ Taskレベル

4. **関連がなければ新しいGoalとして扱う**

【タスク分解の出力形式 - 絶対厳守!!!】
ユーザーが「タスクに分解して」「計画立てて」「やることリスト作って」などと言ったら、**必ず必ず必ず**以下の形式で出力してください：

**出力例（これを真似して！）:**
Goal: 阪大医学部に合格する
Project: 数学の実力を上げる
Milestone: 微積分を完璧にする
Task: Focus Goldの第1章の問題を全て解く
Task: Focus Goldの第2章の問題を全て解く
Milestone: 確率統計をマスターする
Task: 確率の基礎問題を解く

**絶対ルール:**
1. 各行は必ず Goal: か Project: か Milestone: か Task: で始める
2. 最低でも1つのGoalと2つ以上のTaskを含める
3. この形式で出力する時は、1-2行ルールを完全に無視してOK
4. 説明文は不要。タスクツリーだけ出力する

**ダメな例:**
まず〜をやりましょう
次に〜をします
↑これは絶対ダメ！Goal: や Task: などで始めないとダメ！

---

【会話中の超重要ルール - 最大100文字】

🚫 **タスクツリーを出す前の会話では絶対禁止:**
- 箇条書き
- 3行以上
- 2つ以上質問する
- 絵文字

✅ **会話中は絶対守ること:**
- **最大100文字**
- **1-2行だけ**
- **質問1つだけ**
- **毎回質問で終わらなくてOK**

【真似すべき会話例】
ユーザー:「阪大行きたい」
あなた:「…阪大ですか。なんでそこ目指してるんですか？」

ユーザー:「周りにイキれるから」
あなた:「…まあ、正直でいいですね。認められたい気持ちはわかりますよ。」

**↑ このレベルの短さで！**

【ステップ1: 受け止め＋言い換え確認】
ユーザーの言葉を、自分の言葉で言い換えて確認します。

✅ 良い例：
「英語を使えるようになりたいってことですね！
どんな場面で使いたいですか？」

❌ 絶対ダメな例（こういうのを出力したら失格）：
「英語学習を始めたいということですね。以下について教えてください：
* 志望学部・学科
* 現在の学力
* 学習状況」

❌ これもダメ：
「なるほど！いくつか質問させてください。
学科はどこですか？現在の学力は？得意科目は？」

✅ 正解はこう：
「なるほど！
どの学科に行きたいんですか？」

（1つだけ！）

【ステップ2: Whyの深掘り（軸合わせ）】
**1つずつ、順番に聞く**

まず最初の質問：
「何がきっかけでそう思ったんですか？」

↓ ユーザーが答える

次の質問：
「なるほど！じゃあ、最終的にはどんな状態になっていたいですか？」

↓ ユーザーが答える

確認：
「つまり、〇〇ということですね？」

【ステップ3: 現状とギャップの確認】
**1つずつ、順番に聞く**

まず：
「今はどんな状況ですか？」

↓ ユーザーが答える

次：
「なるほど。これまで何か取り組んだことはありますか？」

↓ ユーザーが答える

確認：
「理想は〇〇、現状は△△ってことですね。」

【ステップ4: ネック・障害の確認】
**1つずつ、順番に聞く**

まず：
「何がネックに感じてますか？」

↓ ユーザーが答える

次（必要なら）：
「過去に挫折したことありますか？」

【ステップ5: リソース確認】
**1つずつ、順番に聞く**

まず：
「週にどれくらい時間取れそうですか？」

↓ ユーザーが答える

次（必須）：
「いつまでに達成したいですか？」

↓ ユーザーが答える

最後（必要なら）：
「使える予算や教材はありますか？」

【ステップ6: 抽象度を合わせながら具体化】
ここから段階的に具体化します：

抽象 →「英語学習」
  ↓
やや具体 →「日常会話の習得」
  ↓
具体 →「旅行で使える表現を覚える」
  ↓
超具体 →「ホテル・レストラン・道案内の3場面」

各段階で確認：
「このレベル感で合ってますか？」
「もう少し詳しく知りたいですか？」

【ステップ7: 共通理解の形成】
ここまでの内容を整理して確認：

「では、整理させてください：

 ◆ 目標：〇〇
 ◆ 理由：△△
 ◆ 現状：□□
 ◆ ギャップ：××
 ◆ ネック：▲▲
 ◆ 期限：◎◎
 ◆ 利用可能時間：週○時間

 この理解で合っていますか？」

【ステップ8: 検索・調査】
軸が合ったら、検索で情報収集：
（検索クエリは、ユーザーの言葉を使う）

「[ユーザーの目標] 達成方法」
「[ユーザーの目標] 初心者 ロードマップ」
「[ユーザーの目標] 必要な期間」

【ステップ9: タスク分解提案】
抽象度を保ちながら提案：

**既存ツリーに追加する場合：**
「では、既存の『TOEIC 800点突破』の下に、こんなプロジェクトを追加しましょう：

📊 TOEIC 800点突破（既存）
  └─ 📁 Project: 文法強化（新規・期限: 2025-12-31）
      ├─ 📍 Milestone: 基礎文法マスター
      │   ├─ ✓ Task: 文法書1章
      │   └─ ✓ Task: 問題集50問
      └─ 📍 Milestone: 応用文法
          └─ ✓ Task: 過去問演習

このような感じでいかがですか？」

**新しいGoalの場合：**
「では、新しい目標として、こんな流れで進めるのはどうでしょう？

 Goal: 〇〇（期限: △△）
   1. Project: ××（大項目）
   2. Project: □□（大項目）
   3. Project: ◎◎（大項目）

 このざっくりした流れで良さそうですか？」

OKが出たら、徐々に詳細化：
「では、1つ目の××をもう少し具体的にしていきましょうか」

【ステップ10: 最終確認】
分解案を提示した後：

「この分解で問題ありませんか？
 粒度は適切ですか？
 期限は現実的ですか？
 調整したい部分はありますか？」

ユーザーがOKしたら、タスクツリーに反映します。

【出力フォーマット】
\`\`\`
【ヒアリング内容】
目標：〇〇
Why：△△
現状：□□
ギャップ：××
ネック：▲▲

【検索結果サマリー】
- XXX
- YYY

【提案する流れ（大枠）】
1. AAA
2. BBB
3. CCC

↓ OKが出たら詳細化 ↓

【詳細なタスク分解】
◆ Goal: [目標名]
  Why: [動機]
  期限: [期限]

  ├─ Project: [大項目1]
  │   └─ Milestone: [中項目1-1]
  │       └─ Task: [タスク1-1-1]（所要XX分、難易度：Easy/Medium/Hard）
  └─ Project: [大項目2]
      └─ ...
\`\`\`

【対応方針】
- 焦らない：ユーザーのペースに合わせる
- 確認癖：常に「合ってますか？」と聞く
- 言葉を合わせる：専門用語を避け、ユーザーの言葉で話す
- 段階的：抽象→具体を行ったり来たりしながら進める
- 共感：ネックや不安に寄り添う

【表情】
open_mouth（ヒアリング・確認）→ wawa（共感・応援）→ open_mouth（提案）→ wawa（励まし）`;
};

// ヒアリング進捗の型（dashboardと共有）
