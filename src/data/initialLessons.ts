import { DayLesson } from '../types/japanese';

export const INITIAL_LESSONS: DayLesson[] = [
  {
    dayNumber: 1,
    title: "Polite Existence & Identity",
    topic: "Identity & Basic Polite Copula",
    completed: true,
    grammar: {
      title: "です (Polite 'is / am / are')",
      summary: "Declares identity or state politely in standard Japanese.",
      structure: "Noun + は + Noun + です",
      explanation: "は (written 'ha' but pronounced 'wa') marks the topic of the sentence. です acts as the polite copula meaning 'is / am / are'.",
      negativeForm: "ではありません (dewa arimasen) / じゃありません (ja arimasen)",
      questionForm: "Add か (ka) at the end: 〜ですか？",
      notes: [
        "The particle は is written with the hiragana は (ha) but pronounced 'wa'.",
        "Japanese sentences do not require an explicit subject when obvious from context."
      ],
      examples: [
        {
          japanese: "私は学生です。",
          reading: "わたしは がくせいです。",
          english: "I am a student.",
          breakdown: "私 (I) + は (topic) + 学生 (student) + です (am)"
        },
        {
          japanese: "これは水ではありません。",
          reading: "これは みずでは ありません。",
          english: "This is not water.",
          breakdown: "これ (this) + は + 水 (water) + ではありません (is not)"
        },
        {
          japanese: "日本人ですか？",
          reading: "にほんじんですか？",
          english: "Are you Japanese?",
          breakdown: "日本人 (Japanese person) + です + か (question)"
        }
      ]
    },
    kanji: {
      character: "人",
      meaning: "Person / Human",
      strokes: 2,
      radical: "人 (person)",
      onyomi: ["ジン", "ニン"],
      kunyomi: ["ひと"],
      compounds: [
        { word: "日本人", reading: "にほんじん", meaning: "Japanese person" },
        { word: "外国人", reading: "がいこくじん", meaning: "Foreigner" },
        { word: "三人", reading: "さんにん", meaning: "Three people" },
        { word: "人気", reading: "にんき", meaning: "Popularity" },
        { word: "人間", reading: "にんげん", meaning: "Human being" }
      ],
      rendakuNote: "Rendaku is rare here; memorize which words use ジン vs ニン vs ひと.",
      memoryTip: "Looks like a person walking forward with two legs."
    },
    vocab: [
      { id: "d1-1", day: 1, japanese: "私", reading: "わたし", meaning: "I / Me", category: "Pronoun" },
      { id: "d1-2", day: 1, japanese: "あなた", reading: "あなた", meaning: "You", category: "Pronoun" },
      { id: "d1-3", day: 1, japanese: "学生", reading: "がくせい", meaning: "Student", category: "People" },
      { id: "d1-4", day: 1, japanese: "先生", reading: "せんせい", meaning: "Teacher / Master", category: "People" },
      { id: "d1-5", day: 1, japanese: "本", reading: "ほん", meaning: "Book", category: "Objects" },
      { id: "d1-6", day: 1, japanese: "水", reading: "みず", meaning: "Water", category: "Nature" },
      { id: "d1-7", day: 1, japanese: "猫", reading: "ねこ", meaning: "Cat", category: "Animals" },
      { id: "d1-8", day: 1, japanese: "犬", reading: "いぬ", meaning: "Dog", category: "Animals" },
      { id: "d1-9", day: 1, japanese: "日本", reading: "にほん", meaning: "Japan", category: "Places" },
      { id: "d1-10", day: 1, japanese: "人", reading: "ひと", meaning: "Person", category: "People" }
    ],
    naturalPhrase: {
      phrase: "はじめまして",
      reading: "はじめまして",
      meaning: "Nice to meet you (for the first time)",
      context: "Used strictly when meeting someone for the first time."
    },
    pattern: "Topic + は + Description + です",
    cultureCorner: "In natural Japanese, calling someone 'あなた' (you) can sound detached or overly direct. When you know someone's name or title (like 先生 or 田中さん), always use their name instead!"
  },
  {
    dayNumber: 2,
    title: "Possession & Connection",
    topic: "The Linking Particle の & Nature Words",
    completed: true,
    grammar: {
      title: "の (Possession / Connection / Description)",
      summary: "Connects two nouns together, like an apostrophe-s ('s) or 'of'.",
      structure: "Noun A + の + Noun B",
      explanation: "Noun A modifies or owns Noun B. Can indicate possession (my book), origin (Japanese car), or attribute (teacher's name).",
      examples: [
        {
          japanese: "私の本です。",
          reading: "わたしの ほんです。",
          english: "It is my book.",
          breakdown: "私 (me) + の (possession) + 本 (book)"
        },
        {
          japanese: "日本の車です。",
          reading: "にほんの くるまです。",
          english: "It is a Japanese car.",
          breakdown: "日本 (Japan) + の (origin) + 車 (car)"
        },
        {
          japanese: "先生の名前は何ですか？",
          reading: "せんせいの なまえは なんですか？",
          english: "What is the teacher's name?",
          breakdown: "先生 (teacher) + の + 名前 (name)"
        }
      ]
    },
    kanji: {
      character: "水",
      meaning: "Water",
      strokes: 4,
      radical: "水 (water) / 氵 (sanzui)",
      onyomi: ["スイ"],
      kunyomi: ["みず"],
      compounds: [
        { word: "水曜日", reading: "すいようび", meaning: "Wednesday" },
        { word: "水泳", reading: "すいえい", meaning: "Swimming" },
        { word: "水道", reading: "すいどう", meaning: "Water supply / tap water" },
        { word: "香水", reading: "こうすい", meaning: "Perfume" },
        { word: "水分", reading: "すいぶん", meaning: "Moisture / hydration" }
      ],
      rendakuNote: "Usually stays 'sui' in compounds, but standalone uses the Kun'yomi 'mizu'.",
      memoryTip: "Depicts splashing droplets of water streaming around a central ripple."
    },
    vocab: [
      { id: "d2-1", day: 2, japanese: "水", reading: "みず", meaning: "Water", category: "Nature" },
      { id: "d2-2", day: 2, japanese: "火", reading: "ひ", meaning: "Fire", category: "Nature" },
      { id: "d2-3", day: 2, japanese: "山", reading: "やま", meaning: "Mountain", category: "Nature" },
      { id: "d2-4", day: 2, japanese: "川", reading: "かわ", meaning: "River", category: "Nature" },
      { id: "d2-5", day: 2, japanese: "空", reading: "そら", meaning: "Sky", category: "Nature" },
      { id: "d2-6", day: 2, japanese: "雨", reading: "あめ", meaning: "Rain", category: "Nature" },
      { id: "d2-7", day: 2, japanese: "花", reading: "はな", meaning: "Flower", category: "Nature" },
      { id: "d2-8", day: 2, japanese: "木", reading: "き", meaning: "Tree / Wood", category: "Nature" },
      { id: "d2-9", day: 2, japanese: "石", reading: "いし", meaning: "Stone / Rock", category: "Nature" },
      { id: "d2-10", day: 2, japanese: "土", reading: "つち", meaning: "Soil / Earth", category: "Nature" }
    ],
    naturalPhrase: {
      phrase: "どうぞ",
      reading: "どうぞ",
      meaning: "Please go ahead / Here you are",
      context: "Used when offering something to someone or inviting them to proceed."
    },
    pattern: "Native words use Kun'yomi alone; multi-kanji compounds often use On'yomi.",
    cultureCorner: "The elements of nature (火, 水, 木, 金, 土) correspond to the days of the week in Japanese (Tuesday to Saturday), just like the Norse gods or celestial planets in Western languages!"
  },
  {
    dayNumber: 3,
    title: "Inclusion & School Life",
    topic: "The Particle も ('Also/Too') & Learning",
    completed: true,
    grammar: {
      title: "も ('Also / Too')",
      summary: "Replaces the topic marker は to mean 'also' or 'too'.",
      structure: "Noun + も + [Predicate]",
      explanation: "も directly replaces は or が. Never say '私はも'; say '私も'. It expresses that the same statement applies to another subject.",
      notes: [
        "Never combine は and も (❌ 私はも → ✅ 私も).",
        "Can also be used twice for 'both A and B' (AもBも)."
      ],
      examples: [
        {
          japanese: "私も学生です。",
          reading: "わたしも がくせいです。",
          english: "I am also a student.",
          breakdown: "私 + も (also) + 学生 + です"
        },
        {
          japanese: "猫も犬も好きです。",
          reading: "ねこも いぬも すきです。",
          english: "I like both cats and dogs.",
          breakdown: "猫 + も + 犬 + も + 好き + です"
        }
      ]
    },
    kanji: {
      character: "学",
      meaning: "Study / Learn",
      strokes: 8,
      radical: "子 (child)",
      onyomi: ["ガク"],
      kunyomi: ["まな・ぶ"],
      compounds: [
        { word: "学校", reading: "がっこう", meaning: "School (note sokuonka っ!)" },
        { word: "学生", reading: "がくせい", meaning: "Student" },
        { word: "大学", reading: "だいがく", meaning: "University" },
        { word: "文学", reading: "ぶんがく", meaning: "Literature" },
        { word: "学習", reading: "がくしゅう", meaning: "Study / learning" },
        { word: "学ぶ", reading: "まなぶ", meaning: "To learn (verb)" }
      ],
      rendakuNote: "Notice sokuonka: がく + こう = がっこう (double consonant).",
      memoryTip: "A child (子) under a roof with sparks of knowledge flying up."
    },
    vocab: [
      { id: "d3-1", day: 3, japanese: "学校", reading: "がっこう", meaning: "School", category: "School" },
      { id: "d3-2", day: 3, japanese: "学生", reading: "がくせい", meaning: "Student", category: "School" },
      { id: "d3-3", day: 3, japanese: "先生", reading: "せんせい", meaning: "Teacher", category: "School" },
      { id: "d3-4", day: 3, japanese: "教室", reading: "きょうしつ", meaning: "Classroom", category: "School" },
      { id: "d3-5", day: 3, japanese: "本", reading: "ほん", meaning: "Book", category: "School" },
      { id: "d3-6", day: 3, japanese: "勉強", reading: "べんきょう", meaning: "Study", category: "School" },
      { id: "d3-7", day: 3, japanese: "宿題", reading: "しゅくだい", meaning: "Homework", category: "School" },
      { id: "d3-8", day: 3, japanese: "ノート", reading: "のーと", meaning: "Notebook", category: "School" },
      { id: "d3-9", day: 3, japanese: "鉛筆", reading: "えんぴつ", meaning: "Pencil", category: "School" },
      { id: "d3-10", day: 3, japanese: "消しゴム", reading: "けしごむ", meaning: "Eraser", category: "School" }
    ],
    naturalPhrase: {
      phrase: "へぇ〜",
      reading: "へぇー",
      meaning: "Whoa / Really? / Is that so!",
      context: "A classic Japanese aizuchi reaction showing mild surprise and genuine interest in what the speaker just said."
    },
    pattern: "Kanji root 学 triggers words related to learning, education, and academia.",
    cultureCorner: "Aizuchi (相槌) are conversational listener responses like 'へぇ〜', 'そうなんだ', and 'なるほど'. Staying completely silent while someone talks in Japanese can make them worry you aren't listening!"
  },
  {
    dayNumber: 4,
    title: "Desire & Food",
    topic: "Desire Marker 〜たい & Meal Words",
    completed: true,
    grammar: {
      title: "〜たい (Want to do)",
      summary: "Expresses personal desire to perform an action.",
      structure: "Verb [ます-stem] + たい",
      explanation: "Take the polite ます form of a verb, drop the ます, and attach たい. Acts grammatically like an い-adjective!",
      negativeForm: "〜たくない (takunai) — drop い, add くない",
      notes: [
        "する (to do) → したい (want to do)",
        "Primarily expresses YOUR OWN desire. Asking someone directly '〜たいですか？' can sound slightly blunt; natural Japanese softens this.",
        "Drop 'あなた' when asking questions."
      ],
      examples: [
        {
          japanese: "水を飲みたいです。",
          reading: "みずを のみたいです。",
          english: "I want to drink water.",
          breakdown: "水 + を + 飲み (stem of 飲みます) + たい + です"
        },
        {
          japanese: "今は食べたくないです。",
          reading: "いまは たべたくないです。",
          english: "I don't want to eat right now.",
          breakdown: "今 (now) + は + 食べたくない (don't want to eat) + です"
        }
      ]
    },
    kanji: {
      character: "食",
      meaning: "Eat / Food",
      strokes: 9,
      radical: "食 (food/eat)",
      onyomi: ["ショク", "ジキ"],
      kunyomi: ["た・べる", "く・う"],
      compounds: [
        { word: "食べる", reading: "たべる", meaning: "To eat (polite/standard)" },
        { word: "食事", reading: "しょくじ", meaning: "Meal" },
        { word: "食堂", reading: "しょくどう", meaning: "Dining hall / cafeteria" },
        { word: "食品", reading: "しょくひん", meaning: "Food products" },
        { word: "食料", reading: "しょくりょう", meaning: "Food supplies / rations" },
        { word: "食欲", reading: "しょくよく", meaning: "Appetite" },
        { word: "日本食", reading: "にほんしょく", meaning: "Japanese cuisine" }
      ],
      rendakuNote: "食う (くう) is rough/colloquial; stick to 食べる (たべる) for polite everyday speech.",
      memoryTip: "A person with a mouth gathering food under a protective pavilion."
    },
    vocab: [
      { id: "d4-1", day: 4, japanese: "食べる", reading: "たべる", meaning: "To eat", category: "Food" },
      { id: "d4-2", day: 4, japanese: "食べ物", reading: "たべもの", meaning: "Food", category: "Food" },
      { id: "d4-3", day: 4, japanese: "ご飯", reading: "ごはん", meaning: "Cooked rice / Meal", category: "Food" },
      { id: "d4-4", day: 4, japanese: "朝ご飯", reading: "あさごはん", meaning: "Breakfast", category: "Food" },
      { id: "d4-5", day: 4, japanese: "昼ご飯", reading: "ひるごはん", meaning: "Lunch", category: "Food" },
      { id: "d4-6", day: 4, japanese: "晩ご飯", reading: "ばんごはん", meaning: "Dinner", category: "Food" },
      { id: "d4-7", day: 4, japanese: "飲む", reading: "のむ", meaning: "To drink", category: "Food" },
      { id: "d4-8", day: 4, japanese: "水", reading: "みず", meaning: "Water", category: "Food" },
      { id: "d4-9", day: 4, japanese: "美味しい", reading: "おいしい", meaning: "Delicious / Tasty", category: "Food" },
      { id: "d4-10", day: 4, japanese: "お腹", reading: "おなか", meaning: "Stomach / Belly", category: "Body" }
    ],
    naturalPhrase: {
      phrase: "めっちゃ",
      reading: "めっちゃ",
      meaning: "Super / Totally / Extremely (very casual)",
      context: "Super common Kansai-origin slang word used like 'so' or 'super' before adjectives: めっちゃ美味しい！ (Super delicious!)"
    },
    pattern: "ご飯 = meal/rice. Combine Time + ご飯 (朝 morning + ご飯 = 朝ご飯 breakfast).",
    cultureCorner: "Before meals, Japanese people say 'いただきます' (I humbly receive), and after finishing, 'ごちそうさまでした' (Thank you for the feast/all the hard work)."
  },
  {
    dayNumber: 5,
    title: "Direct Objects & Seeing",
    topic: "Direct Object Marker を & Visual Verbs",
    completed: true,
    grammar: {
      title: "を (Direct Object Marker)",
      summary: "Marks the direct object of an action verb.",
      structure: "Object + を + Verb",
      explanation: "Written with を but pronounced 'o' (identical to お in standard modern Japanese). It indicates the thing being directly acted upon.",
      notes: [
        "Pronunciation ≈ お (o).",
        "Contrast を vs は: は establishes the topic or contrasting element, while を marks the direct target of the action."
      ],
      examples: [
        {
          japanese: "映画を見ます。",
          reading: "えいがを みます。",
          english: "I watch a movie.",
          breakdown: "映画 (movie) + を (object) + 見ます (watch)"
        },
        {
          japanese: "写真を見たいです。",
          reading: "しゃしんを みたいです。",
          english: "I want to see the photo.",
          breakdown: "写真 (photo) + を + 見たい (want to see) + です"
        }
      ]
    },
    kanji: {
      character: "見",
      meaning: "See / Look / View",
      strokes: 7,
      radical: "見 (see)",
      onyomi: ["ケン"],
      kunyomi: ["み・る", "み・える", "み・せる"],
      compounds: [
        { word: "見る", reading: "みる", meaning: "To see / watch (transitive)" },
        { word: "見える", reading: "みえる", meaning: "To be visible / can see" },
        { word: "見せる", reading: "みせる", meaning: "To show (something to someone)" },
        { word: "意見", reading: "いけん", meaning: "Opinion" },
        { word: "発見", reading: "はっけん", meaning: "Discovery" },
        { word: "見学", reading: "けんがく", meaning: "Study tour / field observation" },
        { word: "見物", reading: "けんぶつ", meaning: "Sightseeing" }
      ],
      rendakuNote: "Example of rendaku: 花火 (はな + ひ → はなび).",
      memoryTip: "An eye (目) resting atop two legs (儿), walking around observing the world."
    },
    vocab: [
      { id: "d5-1", day: 5, japanese: "見る", reading: "みる", meaning: "To see / watch", category: "Action" },
      { id: "d5-2", day: 5, japanese: "見える", reading: "みえる", meaning: "To be visible", category: "Action" },
      { id: "d5-3", day: 5, japanese: "見せる", reading: "みせる", meaning: "To show", category: "Action" },
      { id: "d5-4", day: 5, japanese: "映画", reading: "えいが", meaning: "Movie", category: "Media" },
      { id: "d5-5", day: 5, japanese: "写真", reading: "しゃしん", meaning: "Photograph", category: "Media" },
      { id: "d5-6", day: 5, japanese: "景色", reading: "けしき", meaning: "Scenery / View", category: "Nature" },
      { id: "d5-7", day: 5, japanese: "目", reading: "め", meaning: "Eye", category: "Body" },
      { id: "d5-8", day: 5, japanese: "顔", reading: "かお", meaning: "Face", category: "Body" },
      { id: "d5-9", day: 5, japanese: "花", reading: "はな", meaning: "Flower", category: "Nature" },
      { id: "d5-10", day: 5, japanese: "花火", reading: "はなび", meaning: "Fireworks", category: "Culture" }
    ],
    naturalPhrase: {
      phrase: "え、ほんと？ / マジ？",
      reading: "え、ほんと？ / まじ？",
      meaning: "Wait, really? / For real?",
      context: "Everyday conversational surprise. 'ほんと？' is friendly polite; 'マジ？' is super casual among close friends."
    },
    pattern: "Verb families: 見る (intentional action) vs 見える (spontaneous perception) vs 見せる (cause another to see).",
    cultureCorner: "Japanese fireworks (花火, literally 'flower fire') are a signature highlight of Japanese summers, where people wear yukata, drink ramune, and gather on riverbanks."
  },
  {
    dayNumber: 6,
    title: "Ongoing Actions & Movement",
    topic: "The Progressive/State 〜ている & Movement Verbs",
    completed: true,
    grammar: {
      title: "〜ている (Progressive & Continuing State)",
      summary: "Describes an ongoing action right now OR a continuing state resulting from a past change.",
      structure: "Verb [て-form] + いる",
      explanation: "Has two core senses: 1) Action in progress (食べている = is eating right now); 2) Resulting state that continues (知っている = knows; 住んでいる = lives in; 結婚している = is married).",
      examples: [
        {
          japanese: "今、ご飯を食べている。",
          reading: "いま、ごはんを たべている。",
          english: "I am eating a meal right now.",
          breakdown: "今 (now) + ご飯 (meal) + を + 食べている (am eating)"
        },
        {
          japanese: "東京に住んでいます。",
          reading: "とうきょうに すんでいます。",
          english: "I live in Tokyo (continuing state).",
          breakdown: "東京 + に (location) + 住んでいます (live)"
        }
      ]
    },
    kanji: {
      character: "行",
      meaning: "Go / Conduct",
      strokes: 6,
      radical: "行 (walk/movement)",
      onyomi: ["コウ", "ギョウ", "アン"],
      kunyomi: ["い・く", "ゆ・く", "おこな・う"],
      compounds: [
        { word: "行く", reading: "いく", meaning: "To go" },
        { word: "銀行", reading: "ぎんこう", meaning: "Bank" },
        { word: "行動", reading: "こうどう", meaning: "Action / behavior" },
        { word: "行事", reading: "ぎょうじ", meaning: "Event / ceremony" },
        { word: "行う", reading: "おこなう", meaning: "To carry out / perform" }
      ],
      rendakuNote: "Special irregular て-form: 行く becomes 行って (itte), not いいて!",
      memoryTip: "Depicts an ancient crossroads intersection where paths cross."
    },
    vocab: [
      { id: "d6-1", day: 6, japanese: "行く", reading: "いく", meaning: "To go", category: "Movement" },
      { id: "d6-2", day: 6, japanese: "来る", reading: "くる", meaning: "To come", category: "Movement" },
      { id: "d6-3", day: 6, japanese: "帰る", reading: "かえる", meaning: "To return / go home", category: "Movement" },
      { id: "d6-4", day: 6, japanese: "歩く", reading: "あるく", meaning: "To walk", category: "Movement" },
      { id: "d6-5", day: 6, japanese: "走る", reading: "はしる", meaning: "To run", category: "Movement" },
      { id: "d6-6", day: 6, japanese: "電車", reading: "でんしゃ", meaning: "Train", category: "Transit" },
      { id: "d6-7", day: 6, japanese: "駅", reading: "えき", meaning: "Station", category: "Transit" },
      { id: "d6-8", day: 6, japanese: "学校", reading: "がっこう", meaning: "School", category: "Places" },
      { id: "d6-9", day: 6, japanese: "家", reading: "いえ / うち", meaning: "House / Home", category: "Places" },
      { id: "d6-10", day: 6, japanese: "道", reading: "みち", meaning: "Road / Street / Way", category: "Places" }
    ],
    naturalPhrase: {
      phrase: "どうしよう？",
      reading: "どうしよう？",
      meaning: "What should I do? / Oh no, what now?",
      context: "Used when facing an unexpected dilemma or unsure how to handle a situation."
    },
    pattern: "Verb chain evolution: 行く (plain) → 行きます (polite) → 行きたい (want) → 行って (te) → 行っている (progressive).",
    cultureCorner: "When leaving home, Japanese say '行ってきます' ('I'm going and I will return'). Those staying reply '行ってらっしゃい' ('Please go and come back safely')."
  },
  {
    dayNumber: 7,
    title: "Means, Method & Location",
    topic: "The Particle で (Means & Action Location) & Writing",
    completed: true,
    grammar: {
      title: "で (Means, Method & Location of Action)",
      summary: "Marks the tool, method, vehicle, or the location where an action takes place.",
      structure: "Means/Location + で + Action",
      explanation: "で has two major roles: 1) Means/tool: 電車で行きます (go by train), 箸で食べます (eat with chopsticks); 2) Location of an dynamic action: 学校で勉強します (study at school). Contrast with に, which marks stationary existence or a destination.",
      notes: [
        "に = destination (学校に行く) or stationary existence (学校にいる).",
        "で = place where an active event happens (学校で勉強する)."
      ],
      examples: [
        {
          japanese: "電車で行きます。",
          reading: "でんしゃで いきます。",
          english: "I will go by train.",
          breakdown: "電車 (train) + で (by means of) + 行きます (go)"
        },
        {
          japanese: "図書館で本を読みます。",
          reading: "としょかんで ほんを よみます。",
          english: "I read books at the library.",
          breakdown: "図書館 (library) + で (at) + 本 (book) + を + 読みます"
        }
      ]
    },
    kanji: {
      character: "書",
      meaning: "Write / Document",
      strokes: 10,
      radical: "曰 (say)",
      onyomi: ["ショ"],
      kunyomi: ["か・く"],
      compounds: [
        { word: "書く", reading: "かく", meaning: "To write" },
        { word: "書店", reading: "しょてん", meaning: "Bookstore" },
        { word: "辞書", reading: "じしょ", meaning: "Dictionary" },
        { word: "書類", reading: "しょるい", meaning: "Documents" },
        { word: "読書", reading: "どくしょ", meaning: "Reading books" },
        { word: "書道", reading: "しょどう", meaning: "Calligraphy (way of writing)" }
      ],
      rendakuNote: "て-form: 書く becomes 書いて (kaite) with 'i' sound change (i-onbin).",
      memoryTip: "A brush held upright in a hand, making strokes on paper."
    },
    vocab: [
      { id: "d7-1", day: 7, japanese: "書く", reading: "かく", meaning: "To write", category: "Action" },
      { id: "d7-2", day: 7, japanese: "書店", reading: "しょてん", meaning: "Bookstore", category: "Places" },
      { id: "d7-3", day: 7, japanese: "辞書", reading: "じしょ", meaning: "Dictionary", category: "Learning" },
      { id: "d7-4", day: 7, japanese: "書類", reading: "しょるい", meaning: "Documents / Papers", category: "Work" },
      { id: "d7-5", day: 7, japanese: "読書", reading: "どくしょ", meaning: "Reading (books)", category: "Hobby" },
      { id: "d7-6", day: 7, japanese: "図書館", reading: "としょかん", meaning: "Library", category: "Places" },
      { id: "d7-7", day: 7, japanese: "学校", reading: "がっこう", meaning: "School", category: "Places" },
      { id: "d7-8", day: 7, japanese: "教室", reading: "きょうしつ", meaning: "Classroom", category: "Places" },
      { id: "d7-9", day: 7, japanese: "駅", reading: "えき", meaning: "Train station", category: "Transit" },
      { id: "d7-10", day: 7, japanese: "公園", reading: "こうえん", meaning: "Park", category: "Places" }
    ],
    naturalPhrase: {
      phrase: "わからない / わかんない",
      reading: "わからない / わかんない",
      meaning: "I don't understand / I don't know",
      context: "'わかんない' is the ultra-common casual contracted form among friends and young people."
    },
    pattern: "Location + で = action location; Location + に = destination or static existence.",
    cultureCorner: "'わからない' means 'I can't grasp/comprehend it', whereas '知らない' means 'I lack that information/it's none of my business'. Saying '知らない' to a polite question can sound surprisingly cold or dismissive!"
  },
  {
    dayNumber: 8,
    title: "Reasons & Causes",
    topic: "The Conjunction から (Because / Since) & Reading",
    completed: true,
    grammar: {
      title: "から (Because / Since)",
      summary: "Connects a reason to its result.",
      structure: "Reason + から、Result",
      explanation: "Japanese syntax puts the reason FIRST: [Reason] から、[Result]. だから (da kara) at the start of a sentence means 'Therefore' or 'That's why'.",
      notes: [
        "In Japanese, the cause precedes the effect.",
        "Can also end a sentence to gently state an excuse: 時間がないから… (Because I don't have time...)"
      ],
      examples: [
        {
          japanese: "日本語が好きだから、勉強します。",
          reading: "にほんごが すきだから、べんきょうします。",
          english: "Because I like Japanese, I study it.",
          breakdown: "日本語 (Japanese) + が + 好き (like) + だから (because) + 勉強します"
        },
        {
          japanese: "忙しいから、行かない。",
          reading: "いそがしいから、いかない。",
          english: "Since I'm busy, I won't go.",
          breakdown: "忙しい (busy) + から (since) + 行かない (won't go)"
        }
      ]
    },
    kanji: {
      character: "読",
      meaning: "Read",
      strokes: 14,
      radical: "言 (words/speech)",
      onyomi: ["ドク", "トク", "トウ"],
      kunyomi: ["よ・む"],
      compounds: [
        { word: "読む", reading: "よむ", meaning: "To read" },
        { word: "読書", reading: "どくしょ", meaning: "Reading books" },
        { word: "読者", reading: "どくしゃ", meaning: "Reader" },
        { word: "音読", reading: "おんどく", meaning: "Reading aloud" },
        { word: "朗読", reading: "ろうどく", meaning: "Recitation" },
        { word: "読解", reading: "どっかい", meaning: "Reading comprehension (sokuonka!)" }
      ],
      rendakuNote: "て-form: 読む becomes 読んで (yonde) with nasal sound change (hatsuonbin).",
      memoryTip: "The speech radical (言) on the left: pronouncing words aloud from a scroll."
    },
    vocab: [
      { id: "d8-1", day: 8, japanese: "読む", reading: "よむ", meaning: "To read", category: "Action" },
      { id: "d8-2", day: 8, japanese: "読書", reading: "どくしょ", meaning: "Reading books", category: "Hobby" },
      { id: "d8-3", day: 8, japanese: "読者", reading: "どくしゃ", meaning: "Reader", category: "People" },
      { id: "d8-4", day: 8, japanese: "本", reading: "ほん", meaning: "Book", category: "Media" },
      { id: "d8-5", day: 8, japanese: "辞書", reading: "じしょ", meaning: "Dictionary", category: "Learning" },
      { id: "d8-6", day: 8, japanese: "新聞", reading: "しんぶん", meaning: "Newspaper", category: "Media" },
      { id: "d8-7", day: 8, japanese: "文章", reading: "ぶんしょう", meaning: "Sentence / Text", category: "Learning" },
      { id: "d8-8", day: 8, japanese: "言葉", reading: "ことば", meaning: "Word / Language", category: "Learning" },
      { id: "d8-9", day: 8, japanese: "意味", reading: "いみ", meaning: "Meaning", category: "Learning" },
      { id: "d8-10", day: 8, japanese: "質問", reading: "しつもん", meaning: "Question", category: "Learning" }
    ],
    naturalPhrase: {
      phrase: "なるほど",
      reading: "なるほど",
      meaning: "I see! / That makes sense!",
      context: "A widespread listener phrase expressing realization and understanding. Note: best avoided when speaking upwards to a high superior or boss."
    },
    pattern: "[Reason] + から、[Result] — always reason first, consequence second.",
    cultureCorner: "The Kanji 読 consists of 言 (words) and 売 (sell/trade) — exchanging ideas through written speech."
  },
  {
    dayNumber: 9,
    title: "Contrast & Softening",
    topic: "The Conjunction 〜けど (But / Although) & Talking",
    completed: true,
    grammar: {
      title: "〜けど (But / Although / Softener)",
      summary: "Connects contrasting clauses, or trails off at the end to soften a statement.",
      structure: "Clause A + けど、Clause B",
      explanation: "More casual and conversational than が (ga). Can also hang unfinished at the end of a sentence (〜けど…) to soften what you say, invite the other person to respond, or express hesitation without sounding blunt.",
      notes: [
        "けど vs でも: でも starts a fresh sentence ('However...'), whereas けど links two clauses together directly.",
        "Unfinished sentence (〜けど…) is a cornerstone of Japanese politeness and indirectness."
      ],
      examples: [
        {
          japanese: "日本語を勉強しているけど、まだ難しいです。",
          reading: "にほんごを べんきょうしているけど、まだ むずかしいです。",
          english: "I am studying Japanese, but it is still difficult.",
          breakdown: "勉強している (studying) + けど (but) + まだ (still) + 難しい (difficult)"
        },
        {
          japanese: "行きたいけど…",
          reading: "いきたいけど…",
          english: "I'd like to go, but... (trailing off politely).",
          breakdown: "行きたい (want to go) + けど (softening hesitation)"
        }
      ]
    },
    kanji: {
      character: "話",
      meaning: "Talk / Speak / Story",
      strokes: 13,
      radical: "言 (words)",
      onyomi: ["ワ"],
      kunyomi: ["はな・す", "はなし"],
      compounds: [
        { word: "話す", reading: "はなす", meaning: "To speak / talk" },
        { word: "話", reading: "はなし", meaning: "Story / conversation / talk" },
        { word: "電話", reading: "でんわ", meaning: "Telephone (electric speech)" },
        { word: "会話", reading: "かいわ", meaning: "Conversation" },
        { word: "話題", reading: "わだい", meaning: "Topic of conversation" }
      ],
      rendakuNote: "て-form: 話す becomes 話して (hanashite).",
      memoryTip: "The words radical (言) plus tongue (舌): using your tongue to produce spoken words."
    },
    vocab: [
      { id: "d9-1", day: 9, japanese: "話す", reading: "はなす", meaning: "To speak / talk", category: "Action" },
      { id: "d9-2", day: 9, japanese: "話", reading: "はなし", meaning: "Story / Talk", category: "Communication" },
      { id: "d9-3", day: 9, japanese: "電話", reading: "でんわ", meaning: "Telephone", category: "Tech" },
      { id: "d9-4", day: 9, japanese: "会話", reading: "かいわ", meaning: "Conversation", category: "Communication" },
      { id: "d9-5", day: 9, japanese: "話題", reading: "わだい", meaning: "Topic", category: "Communication" },
      { id: "d9-6", day: 9, japanese: "聞く", reading: "きく", meaning: "To listen / hear / ask", category: "Action" },
      { id: "d9-7", day: 9, japanese: "聞こえる", reading: "きこえる", meaning: "To be audible / can hear", category: "Action" },
      { id: "d9-8", day: 9, japanese: "声", reading: "こえ", meaning: "Voice", category: "Body" },
      { id: "d9-9", day: 9, japanese: "質問", reading: "しつもん", meaning: "Question", category: "Communication" },
      { id: "d9-10", day: 9, japanese: "答える", reading: "こたえる", meaning: "To answer", category: "Action" }
    ],
    naturalPhrase: {
      phrase: "そうだけど…",
      reading: "そうだけど…",
      meaning: "That's true, but...",
      context: "Used to gently acknowledge what the other person said while hinting at a counterpoint without aggressive confrontation."
    },
    pattern: "聞く can mean both 'listen' and 'ask' depending on context! (先生に聞く = ask the teacher).",
    cultureCorner: "Japanese speakers frequently leave sentences trailing off with 〜けど or 〜から so the listener can fill in the implicit social context, avoiding harsh direct refusals."
  },
  {
    dayNumber: 10,
    title: "Subject Spotlight & Preferences",
    topic: "The Subject Marker が with Ability, Perception & Likes",
    completed: true,
    grammar: {
      title: "が (Subject Marker / Spotlight)",
      summary: "Puts the spotlight on the specific subject, especially with ability, perception, and preference.",
      structure: "[Target] + が + [Adjective / Potential / Perception]",
      explanation: "While は sets up a broad topic/stage, が pinpoints the exact actor or target of perception/desire. Words like 好き (like), 分かる (understand), 聞こえる (can hear), 見える (can see), 上手 (good at) naturally take が!",
      notes: [
        "日本語が分かります (I understand Japanese — not を).",
        "声が聞こえます (A voice is audible).",
        "猫が好きです (I like cats — not を)."
      ],
      examples: [
        {
          japanese: "日本語が好きです。",
          reading: "にほんごが すきです。",
          english: "I like Japanese.",
          breakdown: "日本語 + が (subject marker) + 好き (like) + です"
        },
        {
          japanese: "鳥の声が聞こえます。",
          reading: "とりの こえが きこえます。",
          english: "I can hear the sound of birds.",
          breakdown: "鳥の (birds') + 声 (voice) + が + 聞こえます (audible)"
        }
      ]
    },
    kanji: {
      character: "好",
      meaning: "Like / Fond / Favorable",
      strokes: 6,
      radical: "女 (woman)",
      onyomi: ["コウ"],
      kunyomi: ["す・く", "この・む"],
      compounds: [
        { word: "好き", reading: "すき", meaning: "Like / fond of (な-adjective)" },
        { word: "大好き", reading: "だいすき", meaning: "Love / like very much" },
        { word: "好きな", reading: "すきな", meaning: "Favorite / liked (prenominal)" },
        { word: "好む", reading: "このむ", meaning: "To prefer / like (literary verb)" }
      ],
      rendakuNote: "好き is a な-adjective in Japanese: 好きな本 (favorite book).",
      memoryTip: "A woman (女) holding her beloved child (子) — embodying affection and fondness."
    },
    vocab: [
      { id: "d10-1", day: 10, japanese: "好き", reading: "すき", meaning: "Liked / Fond of", category: "Emotion" },
      { id: "d10-2", day: 10, japanese: "大好き", reading: "だいすき", meaning: "Loved / Very fond of", category: "Emotion" },
      { id: "d10-3", day: 10, japanese: "嫌い", reading: "きらい", meaning: "Disliked / Hate", category: "Emotion" },
      { id: "d10-4", day: 10, japanese: "大嫌い", reading: "だいきらい", meaning: "Hated / Loathed", category: "Emotion" },
      { id: "d10-5", day: 10, japanese: "分かる", reading: "わかる", meaning: "To understand", category: "State" },
      { id: "d10-6", day: 10, japanese: "聞こえる", reading: "きこえる", meaning: "To be audible", category: "Perception" },
      { id: "d10-7", day: 10, japanese: "見える", reading: "みえる", meaning: "To be visible", category: "Perception" },
      { id: "d10-8", day: 10, japanese: "必要", reading: "ひつよう", meaning: "Necessary / Needed", category: "State" },
      { id: "d10-9", day: 10, japanese: "上手", reading: "じょうず", meaning: "Skillful / Good at", category: "Skill" },
      { id: "d10-10", day: 10, japanese: "下手", reading: "へた", meaning: "Unskillful / Bad at", category: "Skill" }
    ],
    naturalPhrase: {
      phrase: "そうだね / そうですね",
      reading: "そうだね / そうですね",
      meaning: "Yeah, that's right / I agree",
      context: "'そうだね' among friends, 'そうですね' in polite conversation. Essential agreement filler."
    },
    pattern: "が pairs consistently with state/perception predicates: 好き, 分かる, 上手, 聞こえる.",
    cultureCorner: "Directly calling yourself '上手' (good at) sounds boastful in Japan! Instead, learners stay humble: 'まだまだです' (I still have a long way to go)."
  },
  {
    dayNumber: 11,
    title: "Verb Negatives & Returning",
    topic: "Plain Negative 〜ない & Returning Home",
    completed: true,
    grammar: {
      title: "Verb Negative 「〜ない」 (Plain Form)",
      summary: "The informal/plain negative form for all Japanese verbs.",
      structure: "う-verbs: final u → a + ない | る-verbs: drop る + ない",
      explanation: "Rules: 1) る-verbs (ichidan): drop る and add ない (食べる → 食べない); 2) う-verbs (godan): shift the final -u sound to its -a vowel row and add ない (書く → 書かない, 読む → 読まない); 3) Exception: ある → ない; する → しない; 来る → こない.",
      negativeForm: "Past negative: drop い, add かった (食べなかった = didn't eat)",
      notes: [
        "ない behaves grammatically like an い-adjective!",
        "In casual speech, 食べていない (not eating) compresses into 食べてない."
      ],
      examples: [
        {
          japanese: "今日は本を読まない。",
          reading: "きょうは ほんを よまない。",
          english: "I won't read books today.",
          breakdown: "今日 (today) + は + 本 + を + 読まない (u→a + nai)"
        },
        {
          japanese: "まだ朝ご飯を食べてない。",
          reading: "まだ あさごはんを たべてない。",
          english: "I haven't eaten breakfast yet.",
          breakdown: "まだ (yet) + 朝ご飯 + を + 食べてない (casual progressive negative)"
        }
      ]
    },
    kanji: {
      character: "帰",
      meaning: "Return Home / Go Back",
      strokes: 10,
      radical: "巾 (cloth) / 刂",
      onyomi: ["キ"],
      kunyomi: ["かえ・る", "かえ・す"],
      compounds: [
        { word: "帰る", reading: "かえる", meaning: "To return / go home" },
        { word: "帰す", reading: "かえす", meaning: "To let someone return / send home" },
        { word: "帰宅", reading: "きたく", meaning: "Returning home (noun)" },
        { word: "帰国", reading: "きこく", meaning: "Returning to one's home country" }
      ],
      rendakuNote: "帰る is a godan verb: 帰らない (kaeranai), 帰ります (kaerimasu), 帰って (kaette).",
      memoryTip: "Traces arriving back at one's hearth and hanging up travel cloths."
    },
    vocab: [
      { id: "d11-1", day: 11, japanese: "帰る", reading: "かえる", meaning: "To return / go home", category: "Movement" },
      { id: "d11-2", day: 11, japanese: "帰す", reading: "かえす", meaning: "To send home", category: "Action" },
      { id: "d11-3", day: 11, japanese: "帰宅", reading: "きたく", meaning: "Returning home", category: "Living" },
      { id: "d11-4", day: 11, japanese: "帰国", reading: "きこく", meaning: "Returning to one's country", category: "Travel" },
      { id: "d11-5", day: 11, japanese: "待つ", reading: "まつ", meaning: "To wait", category: "Action" },
      { id: "d11-6", day: 11, japanese: "待たない", reading: "またない", meaning: "To not wait", category: "Action" },
      { id: "d11-7", day: 11, japanese: "分かる", reading: "わかる", meaning: "To understand", category: "Cognition" },
      { id: "d11-8", day: 11, japanese: "分からない", reading: "わからない", meaning: "To not understand", category: "Cognition" },
      { id: "d11-9", day: 11, japanese: "忘れる", reading: "わすれる", meaning: "To forget", category: "Cognition" },
      { id: "d11-10", day: 11, japanese: "覚える", reading: "おぼえる", meaning: "To remember / memorize", category: "Cognition" }
    ],
    naturalPhrase: {
      phrase: "まだ (mada)",
      reading: "まだ",
      meaning: "Still / Not yet",
      context: "Answer 'まだ' when asked if you have done something yet: もう食べた？ (Did you eat already?) → まだ (Not yet)."
    },
    pattern: "All ない forms conjugate like regular い-adjectives (ない → なかった).",
    cultureCorner: "When returning home, you shout 'ただいま' ('I'm back'). People inside answer warmly: 'おかえり' (casual) or 'おかえりなさい' (polite)."
  },
  {
    dayNumber: 12,
    title: "Chaining Desires & Change",
    topic: "Chaining 〜たい + から/けど & 〜たくなる (Coming to want)",
    completed: true,
    grammar: {
      title: "Chaining 〜たい with Connectors & 〜たくなる",
      summary: "Combining desire forms with causal connectors, and describing the onset of desire.",
      structure: "〜たい + から / けど | 〜たくなる (start wanting)",
      explanation: "Because 〜たい behaves like an い-adjective, you can directly connect it: 行きたいから (because I want to go), 食べたいけど (I want to eat, but...). Adding なる (to become) creates 〜たくなる: 'come to want' or 'start feeling like'.",
      examples: [
        {
          japanese: "日本に行きたいから、日本語を勉強している。",
          reading: "にほんに いきたいから、にほんごを べんきょうしている。",
          english: "Because I want to go to Japan, I am studying Japanese.",
          breakdown: "日本 + に + 行きたい + から + 日本語 + を + 勉強している"
        },
        {
          japanese: "ラーメンを見たら、食べたくなる。",
          reading: "らーめんを みたら、たべたくなる。",
          english: "When I see ramen, I start wanting to eat it.",
          breakdown: "ラーメン + 見たら + 食べたくなる (come to want to eat)"
        }
      ]
    },
    kanji: {
      character: "来",
      meaning: "Come / Next / Future",
      strokes: 7,
      radical: "木 (tree/grain)",
      onyomi: ["ライ"],
      kunyomi: ["く・る", "きた・る"],
      compounds: [
        { word: "来る", reading: "くる", meaning: "To come (irregular verb)" },
        { word: "来ます", reading: "きます", meaning: "Come (polite)" },
        { word: "来ない", reading: "こない", meaning: "Not come (irregular negative)" },
        { word: "来週", reading: "らいしゅう", meaning: "Next week" },
        { word: "来月", reading: "らいげつ", meaning: "Next month" },
        { word: "来年", reading: "らいねん", meaning: "Next year" }
      ],
      rendakuNote: "Irregular verb readings: くる (dictionary), きます (polite), こない (negative), きたい (want to come).",
      memoryTip: "Originally depicted a stalk of wheat/grain arriving from afar across fields."
    },
    vocab: [
      { id: "d12-1", day: 12, japanese: "来る", reading: "くる", meaning: "To come", category: "Movement" },
      { id: "d12-2", day: 12, japanese: "来ます", reading: "きます", meaning: "To come (polite)", category: "Movement" },
      { id: "d12-3", day: 12, japanese: "来ない", reading: "こない", meaning: "To not come", category: "Movement" },
      { id: "d12-4", day: 12, japanese: "来たい", reading: "きたい", meaning: "Want to come", category: "Desire" },
      { id: "d12-5", day: 12, japanese: "来週", reading: "らいしゅう", meaning: "Next week", category: "Time" },
      { id: "d12-6", day: 12, japanese: "来月", reading: "らいげつ", meaning: "Next month", category: "Time" },
      { id: "d12-7", day: 12, japanese: "来年", reading: "らいねん", meaning: "Next year", category: "Time" },
      { id: "d12-8", day: 12, japanese: "なる", reading: "なる", meaning: "To become", category: "Change" },
      { id: "d12-9", day: 12, japanese: "なるほど", reading: "なるほど", meaning: "I see / Indeed", category: "Reaction" },
      { id: "d12-10", day: 12, japanese: "最近", reading: "さいきん", meaning: "Recently / Lately", category: "Time" }
    ],
    naturalPhrase: {
      phrase: "そうなるよ / そうなるんだ",
      reading: "そうなるよ / そうなるんだ",
      meaning: "That's how it turns out / That's naturally what happens",
      context: "Explains inevitable results or affirms the natural flow of consequences."
    },
    pattern: "Prefixing 来 (ライ) creates 'next' time frames: 来週 (week), 来月 (month), 来年 (year).",
    cultureCorner: "Extreme Japanese compression: casual conversations between close friends can consist of just single words with rising intonation: '来る？' (Coming?) → 'うん。' (Yep)."
  },
  {
    dayNumber: 13,
    title: "Ability & Potential Form",
    topic: "The Potential Form (Can Do) & Strength",
    completed: true,
    grammar: {
      title: "Potential Form (Can do / Ability)",
      summary: "Transforms verbs to mean 'can do' or 'capable of doing'.",
      structure: "る-verbs: drop る + られる | う-verbs: final u → e + る | する → できる | くる → こられる",
      explanation: "Conjugation rules: 1) る-verbs: 食べる → 食べられる (can eat); 2) う-verbs: 行く → 行ける (can go), 読む → 読める (can read), 話す → 話せる (can speak); 3) Irregulars: する → できる, 来る → 来られる (こられる).",
      notes: [
        "The object of a potential verb is usually marked with が instead of を: 本が読めます (I can read books).",
        "Polite potential uses regular ます: 行ける → 行けます, できる → できます."
      ],
      examples: [
        {
          japanese: "日本語が少し話せます。",
          reading: "にほんごが すこし はなせます。",
          english: "I can speak a little Japanese.",
          breakdown: "日本語 + が + 少し (a little) + 話せます (potential polite)"
        },
        {
          japanese: "一人で行ける？",
          reading: "ひとりで いける？",
          english: "Can you go by yourself?",
          breakdown: "一人で (by oneself) + 行ける (can go?)"
        }
      ]
    },
    kanji: {
      character: "力",
      meaning: "Power / Strength / Ability",
      strokes: 2,
      radical: "力 (power)",
      onyomi: ["リョク", "リキ"],
      kunyomi: ["ちから"],
      compounds: [
        { word: "努力", reading: "どりょく", meaning: "Effort / endeavor" },
        { word: "能力", reading: "のうりょく", meaning: "Ability / capability" },
        { word: "協力", reading: "きょうりょく", meaning: "Cooperation" },
        { word: "電力", reading: "でんりょく", meaning: "Electric power" },
        { word: "全力", reading: "ぜんりょく", meaning: "Full power / all one's might" },
        { word: "実力", reading: "じつりょく", meaning: "True ability / merit" },
        { word: "力持ち", reading: "ちからもち", meaning: "Strong person" }
      ],
      rendakuNote: "Usually read as リョク in multi-kanji compound nouns, and ちから on its own.",
      memoryTip: "Depicts a flexed muscular forearm, tensed and showing strength."
    },
    vocab: [
      { id: "d13-1", day: 13, japanese: "力", reading: "ちから", meaning: "Power / Strength", category: "Ability" },
      { id: "d13-2", day: 13, japanese: "努力", reading: "どりょく", meaning: "Effort / Hard work", category: "Ability" },
      { id: "d13-3", day: 13, japanese: "能力", reading: "のうりょく", meaning: "Ability / Capacity", category: "Ability" },
      { id: "d13-4", day: 13, japanese: "協力", reading: "きょうりょく", meaning: "Cooperation", category: "Society" },
      { id: "d13-5", day: 13, japanese: "全力", reading: "ぜんりょく", meaning: "All one's strength / Best", category: "Ability" },
      { id: "d13-6", day: 13, japanese: "実力", reading: "じつりょく", meaning: "Actual ability / True skill", category: "Ability" },
      { id: "d13-7", day: 13, japanese: "力持ち", reading: "ちからもち", meaning: "Strong person", category: "People" },
      { id: "d13-8", day: 13, japanese: "強い", reading: "つよい", meaning: "Strong / Powerful", category: "Adjective" },
      { id: "d13-9", day: 13, japanese: "弱い", reading: "よわい", meaning: "Weak", category: "Adjective" },
      { id: "d13-10", day: 13, japanese: "できる", reading: "できる", meaning: "Can do / To be able to", category: "Ability" }
    ],
    naturalPhrase: {
      phrase: "できる？ / できますか？",
      reading: "できる？ / できますか？",
      meaning: "Can you do it? / Is it possible?",
      context: "Super versatile check of ability, feasibility, or asking if something can be managed."
    },
    pattern: "Verb conjugation spectrum: 行きたい (want) → 行ける (can) → 行けない (cannot) → 行きたくない (don't want) → 行きたくなる (start wanting).",
    cultureCorner: "'努力' (effort/doryoku) is one of the most culturally revered virtues in Japan, celebrated in sports, manga (Shonen Jump motto: Friendship, Effort, Victory), and everyday life."
  }
];

export const CORE_PATTERNS_SUMMARY = [
  "Particles learned: は (wa), の, も, を, に, で, から, けど, が, か",
  "Polite copula: です / ではありません / でした",
  "Desire: 〜たい / 〜たくない / 〜たくなる",
  "Progressive & State: 〜ている (eating now / living in Tokyo)",
  "Plain Negative: 〜ない (ichidan drop る, godan u→a+ない)",
  "Potential Form: 〜える / 〜られる / できる (can do)",
  "Connectors: から (reason first), けど (contrast & polite softening), だから",
  "Reading rules: On'yomi in compounds, Kun'yomi standalone",
  "Sound changes: Sokuonka (っ), Onbin (書いて, 読んで), limited rendaku",
  "Syntactic habits: Subject dropping, implicit context, が with perception and preference"
];
