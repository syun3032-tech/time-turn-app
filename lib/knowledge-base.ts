/**
 * 目標カテゴリ別の知識ベース
 * よくある目標に対する専門知識を提供
 */

export interface GoalKnowledge {
  category: string;
  keywords: string[];  // この目標を検出するキーワード
  recommendedSteps: string[];  // おすすめのステップ（順番が重要）
  commonMistakes: string[];  // よくある失敗・注意点
  tips: string[];  // 成功のコツ
  estimatedDuration?: string;  // 目安の期間
}

export const KNOWLEDGE_BASE: GoalKnowledge[] = [
  // === 語学・資格 ===
  {
    category: "英語学習",
    keywords: ["英語", "TOEIC", "TOEFL", "英会話", "English"],
    recommendedSteps: [
      "現在のレベルを把握する（模試やテストを受ける）",
      "毎日の学習習慣を作る（最初は15分でOK）",
      "基礎単語・文法を固める",
      "リスニングとスピーキングを並行して鍛える",
      "実践の機会を作る（オンライン英会話など）",
    ],
    commonMistakes: [
      "いきなり難しい教材から始める",
      "インプットだけでアウトプットしない",
      "完璧主義で続かなくなる",
    ],
    tips: [
      "毎日少しでも触れることが大事",
      "好きなコンテンツ（映画、音楽）で学ぶと続く",
      "間違いを恐れずに話す・書く",
    ],
    estimatedDuration: "TOEIC 100点アップに3〜6ヶ月",
  },
  {
    category: "プログラミング学習",
    keywords: ["プログラミング", "コード", "エンジニア", "開発", "アプリ", "Web", "Python", "JavaScript"],
    recommendedSteps: [
      "作りたいものを1つ決める",
      "必要な言語・技術を選ぶ",
      "基礎構文を一通り学ぶ（1-2週間）",
      "チュートリアルで小さいものを作る",
      "自分のプロジェクトを始める",
      "エラーと格闘しながら完成させる",
    ],
    commonMistakes: [
      "チュートリアル地獄（ずっと勉強だけして作らない）",
      "完璧に理解しようとして進まない",
      "いきなり大きなものを作ろうとする",
    ],
    tips: [
      "まず動くものを作る、綺麗にするのは後",
      "エラーメッセージをちゃんと読む",
      "GitHubで他の人のコードを見る",
      "分からなかったらすぐ調べる・質問する",
    ],
    estimatedDuration: "基礎習得に1-3ヶ月、実用レベルに6ヶ月〜1年",
  },
  {
    category: "資格試験",
    keywords: ["資格", "試験", "合格", "検定", "受験"],
    recommendedSteps: [
      "試験日を決めて申し込む（先にコミット）",
      "出題範囲と傾向を把握する",
      "テキストを1周する",
      "過去問を解く（最低3年分）",
      "弱点を重点的に復習",
      "本番形式で時間を計って練習",
    ],
    commonMistakes: [
      "申し込まずにダラダラ勉強する",
      "テキストを完璧にしてから過去問に行こうとする",
      "得意分野ばかり勉強する",
    ],
    tips: [
      "過去問は最強の教材",
      "間違えた問題を繰り返す",
      "試験直前は新しいことより復習",
    ],
  },
  // === 大学受験 ===
  {
    category: "大学受験",
    keywords: ["大学", "受験", "入試", "志望校", "模試", "偏差値", "共通テスト"],
    recommendedSteps: [
      "志望校を決めて必要な科目・配点を確認",
      "現在の実力を模試で把握",
      "基礎固め（教科書レベルを完璧に）",
      "問題集で応用力をつける",
      "過去問演習（10年分が目安）",
      "弱点補強と本番シミュレーション",
    ],
    commonMistakes: [
      "基礎をおろそかにして応用に手を出す",
      "苦手科目を後回しにする",
      "模試の結果に一喜一憂しすぎる",
    ],
    tips: [
      "基礎の反復が最も大事",
      "過去問は傾向を知るために早めに見る",
      "睡眠と健康管理も受験の一部",
    ],
    estimatedDuration: "本格的な受験勉強は1-2年",
  },
  // === 健康・フィットネス ===
  {
    category: "ダイエット・筋トレ",
    keywords: ["ダイエット", "痩せ", "筋トレ", "運動", "体重", "筋肉", "ジム"],
    recommendedSteps: [
      "現状を記録する（体重、体脂肪率、写真）",
      "無理のない目標を設定（月2-3kg減が健康的）",
      "食事を見直す（極端な制限はNG）",
      "運動習慣を作る（週2-3回から）",
      "定期的に記録・振り返り",
    ],
    commonMistakes: [
      "極端な食事制限でリバウンド",
      "短期間で結果を求めすぎる",
      "運動だけで食事を変えない",
    ],
    tips: [
      "継続できる方法を選ぶ",
      "体重より見た目や体調で判断",
      "たまにはご褒美も大事",
    ],
    estimatedDuration: "習慣化に1-2ヶ月、目に見える変化に3-6ヶ月",
  },
  // === 副業・キャリア ===
  {
    category: "副業・フリーランス",
    keywords: ["副業", "フリーランス", "独立", "起業", "稼ぐ", "収入"],
    recommendedSteps: [
      "自分のスキル・経験を棚卸し",
      "市場調査（何が求められているか）",
      "小さく始める（最初は単価より経験）",
      "実績を作ってポートフォリオに",
      "単価を上げる・クライアントを増やす",
    ],
    commonMistakes: [
      "準備に時間をかけすぎて始めない",
      "最初から大きく稼ごうとする",
      "本業に支障が出るほど無理する",
    ],
    tips: [
      "まず1円でもいいから稼いでみる",
      "SNSやブログで発信すると仕事が来やすい",
      "既存のスキルを活かすのが近道",
    ],
  },
  // === 創作・クリエイティブ ===
  {
    category: "創作活動",
    keywords: ["小説", "イラスト", "漫画", "音楽", "動画", "YouTube", "作品"],
    recommendedSteps: [
      "作りたいものを1つ決める",
      "完成形をイメージする",
      "まず1作品を最後まで完成させる",
      "フィードバックをもらう",
      "改善して次の作品へ",
    ],
    commonMistakes: [
      "インプットばかりでアウトプットしない",
      "完璧を目指して完成しない",
      "最初から長編に挑戦する",
    ],
    tips: [
      "完成させることが最優先",
      "他人の評価より自分の成長を見る",
      "定期的に発表する場を作る",
    ],
  },
];

/**
 * 目標文からマッチする知識ベースを取得
 */
export function getRelevantKnowledge(goalText: string): GoalKnowledge | null {
  const lowerGoal = goalText.toLowerCase();

  for (const knowledge of KNOWLEDGE_BASE) {
    for (const keyword of knowledge.keywords) {
      if (lowerGoal.includes(keyword.toLowerCase())) {
        return knowledge;
      }
    }
  }

  return null;
}

/**
 * 知識ベースをプロンプト用に整形
 */
export function formatKnowledgeForPrompt(knowledge: GoalKnowledge): string {
  const sections: string[] = [];

  sections.push(`【${knowledge.category}の専門知識】`);

  sections.push(`\n■ おすすめのステップ（この順番が大事！）`);
  knowledge.recommendedSteps.forEach((step, i) => {
    sections.push(`${i + 1}. ${step}`);
  });

  sections.push(`\n■ よくある失敗（これは避けて！）`);
  knowledge.commonMistakes.forEach(mistake => {
    sections.push(`・${mistake}`);
  });

  sections.push(`\n■ 成功のコツ`);
  knowledge.tips.forEach(tip => {
    sections.push(`・${tip}`);
  });

  if (knowledge.estimatedDuration) {
    sections.push(`\n■ 目安の期間: ${knowledge.estimatedDuration}`);
  }

  sections.push(`\n※この知識を参考に、ユーザーの状況に合わせたタスク分解をしてください。`);

  return sections.join('\n');
}
