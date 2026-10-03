#!/usr/bin/env node
/**
 * LIMINAL ARCHIVES — 自動記録生成スクリプト
 *
 * Wikimedia Commons API（登録・APIキー不要、クラウドフレアのボット対策も無く
 * CIからの自動実行に適している）から「ルミナルスペースらしい」実写真を取得し、
 * 生成した説明文とあわせて data/spaces.json に新しい記録として追記する。
 *
 * （補足: Pexels/Pixabayは新規キー発行停止中、OpenverseはCloudflareの
 *  ボット判定でCI環境からのアクセスがブロックされたため、両者を避けて
 *  Wikimedia Commons を採用している）
 *
 * 使い方:
 *   node scripts/generate-space.js            # 1件生成
 *   node scripts/generate-space.js --count 3  # 3件生成
 */

const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "data", "spaces.json");
const MAX_ENTRIES = 400; // 肥大化防止のため古い記録から間引く
const COMMONS_ENDPOINT = "https://commons.wikimedia.org/w/api.php";

// 検索結果からセンシティブ・無関係な報道写真等を除外するブロックリスト
const BLOCKLIST_KEYWORDS = [
  "crime", "police", "fbi", "murder", "epstein", "disaster", "accident",
  "war", "dead", "corpse", "assault", "raid", "doj", "shooting", "terror",
  "attack", "bomb", "wildfire", "flood", "earthquake", "victim", "funeral",
  "grave", "cemetery", "morgue", "autopsy", "massacre", "hostage", "riot",
  "protest", "gun", "weapon", "explosion", "casualty", "combat",
];

// 人物が主題になりがちな検索結果を避けるための追加除外語
const PEOPLE_EXCLUSION_KEYWORDS = [
  "portrait", "person", "people", "soldier", "military", "wedding",
  "ceremony", "parade", "man", "woman", "crowd", "group photo", "team photo",
];

// 画像として扱って良い拡張子（PDFやTIFFのスキャン文書等を除外）
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

function hasAllowedExtension(url) {
  const clean = url.split("?")[0].toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => clean.endsWith(ext));
}

const CATEGORIES = ["corridor", "indoor", "outdoor", "night"];

const CATEGORY_LABEL = {
  corridor: "廊下",
  indoor: "屋内",
  outdoor: "屋外",
  night: "夜間",
};

// ---- カテゴリ別の画像検索クエリ（英語の方がヒット率・質ともに良い） -------

const IMAGE_QUERIES = {
  corridor: [
    "empty hallway",
    "empty corridor building",
    "empty school corridor",
    "empty hotel hallway",
    "empty hospital corridor",
    "empty office corridor",
  ],
  indoor: [
    "empty indoor swimming pool",
    "abandoned mall interior",
    "empty waiting room",
    "empty ballroom",
    "empty office interior",
    "empty indoor hall",
    "empty classroom",
  ],
  outdoor: [
    "empty parking lot",
    "empty parking garage",
    "abandoned playground",
    "empty plaza",
    "empty courtyard",
    "empty footbridge",
  ],
  night: [
    "empty convenience store night",
    "empty gas station night",
    "empty street night",
    "empty train station night",
    "empty diner night",
  ],
};

// ---- 語彙プール（説明文生成用） -------------------------------------------

const PLACE_NOUNS = {
  corridor: ["廊下", "連絡通路", "非常階段の踊り場", "渡り廊下", "地下通路", "機械室前の通路", "避難経路", "控室へ続く通路"],
  indoor: ["待合室", "宴会場", "教室", "オフィスフロア", "ロビー", "更衣室", "休憩室", "展示ホール", "プールの更衣室", "図書室"],
  outdoor: ["駐車場", "中庭", "遊歩道", "屋上庭園", "団地の広場", "バス停", "公園の東屋", "空き地", "歩道橋"],
  night: ["コンビニの店内", "ガソリンスタンド", "深夜の高速道路サービスエリア", "終電後のプラットフォーム", "無人の駅前広場", "夜間診療の待合室", "24時間営業の洗濯店"],
};

const LIGHTING = [
  "点滅する蛍光灯の光が壁を舐めている",
  "どこから来るのか分からない黄味がかった照明が満ちている",
  "照明は生きているが、誰も使っていない",
  "ナトリウムランプの橙色の光だけが頼りだ",
  "蛍光灯のうち数本が切れ、明暗のまだらを作っている",
  "非常口の緑色の light だけが静かに灯っている",
  "照明は規則的に明滅し、低い電子音を発している",
];

const ATMOSPHERE = [
  "空気はわずかに湿り、埃とカーペットの匂いが混ざっている",
  "どこかでBGMが途切れがちに流れているが、曲名は分からない",
  "時間の感覚が失われるほど静かで、ただ照明の低い音だけが響く",
  "先ほどまで誰かがいたような温度が、椅子やカウンターに残っている",
  "壁紙は褪色し、同じ模様が永遠に繰り返されているように見える",
  "どの方向を見ても、出口は見当たらない",
  "床のタイルは妙に反射し、歩くたびに軽い耳鳴りのような音を立てる",
  "空調の送風音だけが、空間の広さを物語っている",
];

const DETAILS = [
  "壁には擦り切れた案内図が貼られているが、現在地を示す印はない",
  "自動販売機の灯りだけが異様に鮮やかに浮いている",
  "隅に放置された椅子が一つ、誰かを待つように並んでいる",
  "天井のタイルに雨染みのような跡が規則的に並んでいる",
  "床に落ちた一枚のチラシだけが、唯一の時間の手がかりだ",
  "ガラス越しに見える向こうの部屋にも、同じ光景が続いている",
  "観葉植物の造花が、埃をかぶったまま佇んでいる",
  "時計の針は動いているように見えるが、何度確認しても同じ時刻を指す",
];

const TAGS_POOL = [
  "無人", "ノスタルジア", "蛍光灯", "既視感", "静寂", "反復構造", "時間断絶",
  "退色", "昭和レトロ", "業務用空間", "夢の記憶", "深夜", "空調音", "レムナント",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickMany(arr, n) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function pad(num, len) {
  return String(num).padStart(len, "0");
}

// ---- Wikimedia Commonsから「視覚資料」を取得 ------------------------------

function stripHtml(html) {
  if (!html) return null;
  return html.replace(/<[^>]*>/g, "").trim() || null;
}

function isSafeTitle(title) {
  const lower = title.toLowerCase();
  return !BLOCKLIST_KEYWORDS.some((kw) => lower.includes(kw));
}

async function fetchImageForCategory(category, usedUrls) {
  const queries = [...IMAGE_QUERIES[category]];
  // クエリをシャッフルして順に試す（1つ目で十分な新規候補が無ければ次へ）
  for (let i = queries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queries[i], queries[j]] = [queries[j], queries[i]];
  }

  const exclusionTerms = [...BLOCKLIST_KEYWORDS.slice(0, 5), ...PEOPLE_EXCLUSION_KEYWORDS]
    .map((kw) => `-${kw}`)
    .join(" ");

  for (const query of queries) {
    const url = new URL(COMMONS_ENDPOINT);
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", `${query} ${exclusionTerms}`);
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "20");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|extmetadata|size");
    url.searchParams.set("iiurlwidth", "900");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    let json;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "liminal-archives-bot/1.0 (personal static site; contact via GitHub repo)" },
      });
      if (!res.ok) continue;
      json = await res.json();
    } catch (err) {
      continue; // ネットワークエラー時は次のクエリへ
    }

    const pages = Object.values((json.query || {}).pages || {});
    const candidates = pages
      .map((p) => ({ page: p, info: (p.imageinfo || [])[0] }))
      .filter(({ page, info }) => {
        if (!info || !info.url) return false;
        if (!hasAllowedExtension(info.url)) return false; // PDF/TIFF等のスキャン文書を除外
        if (usedUrls.has(info.url)) return false;
        if (!isSafeTitle(page.title || "")) return false;
        if ((info.width || 0) < 500) return false; // 小さすぎる画像を除外
        return true;
      })
      .sort((a, b) => (a.page.index || 0) - (b.page.index || 0)); // 検索関連度順

    if (candidates.length === 0) continue;

    // 関連度の高い上位候補からランダムに選ぶ（無関係な結果の混入を抑える）
    const topCandidates = candidates.slice(0, 8);
    const { info } = pick(topCandidates);
    const meta = info.extmetadata || {};
    const creator = stripHtml(meta.Artist && meta.Artist.value) || "不明";
    const license = (meta.LicenseShortName && meta.LicenseShortName.value) || "License unknown";
    const licenseUrl = (meta.LicenseUrl && meta.LicenseUrl.value) || null;

    return {
      url: info.url,
      creator,
      license,
      licenseUrl,
      sourceUrl: info.descriptionurl || null,
      provider: "Wikimedia Commons",
    };
  }

  return null; // 全クエリで新規候補が見つからなかった
}

// ---- レコード生成本体 -----------------------------------------------------

async function generateEntry(existingIds, seqNumber, usedUrls) {
  const category = pick(CATEGORIES);
  const place = pick(PLACE_NOUNS[category]);
  const lighting = pick(LIGHTING);
  const atmosphere = pick(ATMOSPHERE);
  const detail = pick(DETAILS);
  const tags = pickMany(TAGS_POOL, 2 + Math.floor(Math.random() * 3));

  const image = await fetchImageForCategory(category, usedUrls);
  if (!image) {
    return { entry: null, nextSeq: seqNumber };
  }
  usedUrls.add(image.url);

  let id;
  do {
    id = `LA-${pad(seqNumber, 4)}`;
    seqNumber++;
  } while (existingIds.has(id));

  const now = new Date();

  return {
    entry: {
      id,
      title: `${place}の記録`,
      category,
      categoryLabel: CATEGORY_LABEL[category],
      recordedAt: now.toISOString(),
      description: `${place}。${lighting}。${atmosphere}。${detail}。`,
      tags,
      visual: image.url,
      attribution: {
        creator: image.creator,
        license: image.license,
        licenseUrl: image.licenseUrl,
        sourceUrl: image.sourceUrl,
        provider: image.provider,
      },
    },
    nextSeq: seqNumber,
  };
}

function loadData() {
  if (!fs.existsSync(DATA_PATH)) {
    return { nextSeq: 1, entries: [] };
  }
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  if (Array.isArray(raw)) {
    return { nextSeq: raw.length + 1, entries: raw };
  }
  return { nextSeq: raw.nextSeq || raw.entries.length + 1, entries: raw.entries || [] };
}

function saveData(entries, nextSeq) {
  const payload = {
    nextSeq,
    updatedAt: new Date().toISOString(),
    entries,
  };
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

async function main() {
  const args = process.argv.slice(2);
  let count = 1;
  const countIdx = args.indexOf("--count");
  if (countIdx !== -1 && args[countIdx + 1]) {
    count = Math.max(1, parseInt(args[countIdx + 1], 10) || 1);
  }

  const { entries, nextSeq } = loadData();
  const existingIds = new Set(entries.map((e) => e.id));
  const usedUrls = new Set(entries.map((e) => e.visual).filter(Boolean));
  let seq = nextSeq;

  const created = [];
  for (let i = 0; i < count; i++) {
    const { entry, nextSeq: ns } = await generateEntry(existingIds, seq, usedUrls);
    seq = ns;
    if (!entry) {
      console.warn("[generate-space] 画像候補が見つからず、1件スキップしました");
      continue;
    }
    existingIds.add(entry.id);
    entries.unshift(entry); // 新しい記録を先頭に
    created.push(entry.id);
  }

  // 肥大化防止: 古い記録を間引く
  const trimmed = entries.slice(0, MAX_ENTRIES);

  saveData(trimmed, seq);

  console.log(`[generate-space] ${created.length}件の記録を追加しました: ${created.join(", ")}`);
  console.log(`[generate-space] 合計レコード数: ${trimmed.length}`);
}

main().catch((err) => {
  console.error("[generate-space] 致命的エラー:", err);
  process.exit(1);
});
