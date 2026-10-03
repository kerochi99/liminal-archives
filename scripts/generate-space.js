#!/usr/bin/env node
/**
 * LIMINAL ARCHIVES — 自動記録生成スクリプト
 *
 * data/spaces.json に新しい「視覚資料（レコード）」を1件以上生成・追記する。
 * 外部API・依存パッケージ無しで動作する（Node.js標準モジュールのみ使用）。
 *
 * 使い方:
 *   node scripts/generate-space.js            # 1件生成
 *   node scripts/generate-space.js --count 3  # 3件生成
 */

const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "data", "spaces.json");
const MAX_ENTRIES = 400; // 肥大化防止のため古い記録から間引く

const CATEGORIES = ["corridor", "indoor", "outdoor", "night"];

const CATEGORY_LABEL = {
  corridor: "廊下",
  indoor: "屋内",
  outdoor: "屋外",
  night: "夜間",
};

// ---- 語彙プール（カテゴリ別に雰囲気を変える） ----------------------------

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

// ---- 手続き的SVG「視覚資料」生成 -----------------------------------------
// 外部画像無しで、カテゴリごとに異なる抽象的な図像をその場で生成する。

function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildSvg(category, seed) {
  const rand = seededRandom(seed);
  const w = 480, h = 320;
  const palette = {
    corridor: ["#2a2420", "#4a3f2f", "#d9c27a"],
    indoor: ["#1c1f22", "#35393d", "#c9b26a"],
    outdoor: ["#141a1e", "#2b3a33", "#8fae8a"],
    night: ["#0d0f14", "#1b2230", "#e0a23a"],
  }[category];

  let shapes = "";

  // 奥行きを示す遠近の矩形（廊下/通路の消失点表現）
  const vanishX = w / 2 + (rand() - 0.5) * 60;
  const vanishY = h / 2 + (rand() - 0.5) * 40;
  const rings = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < rings; i++) {
    const t = i / rings;
    const rw = w * (1 - t * 0.85);
    const rh = h * (1 - t * 0.85);
    const x = vanishX - rw / 2;
    const y = vanishY - rh / 2;
    const opacity = (0.08 + t * 0.5).toFixed(2);
    shapes += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="none" stroke="${palette[2]}" stroke-opacity="${opacity}" stroke-width="1"/>`;
  }

  // 光源（蛍光灯/ランプ）の帯
  const lights = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < lights; i++) {
    const lx = rand() * w;
    const ly = rand() * h * 0.6;
    const lw = 40 + rand() * 90;
    shapes += `<rect x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" width="${lw.toFixed(1)}" height="4" fill="${palette[2]}" opacity="${(0.3 + rand() * 0.5).toFixed(2)}"/>`;
  }

  // ノイズ粒子（グレイン感）
  let noise = "";
  for (let i = 0; i < 60; i++) {
    const nx = rand() * w;
    const ny = rand() * h;
    noise += `<circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="0.6" fill="#ffffff" opacity="${(rand() * 0.07).toFixed(3)}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    <defs>
      <radialGradient id="vgt" cx="50%" cy="45%" r="75%">
        <stop offset="0%" stop-color="${palette[1]}"/>
        <stop offset="100%" stop-color="${palette[0]}"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#vgt)"/>
    ${shapes}
    ${noise}
    <rect width="${w}" height="${h}" fill="#000000" opacity="0.08"/>
  </svg>`;
}

// ---- レコード生成本体 -----------------------------------------------------

function generateEntry(existingIds, seqNumber) {
  const category = pick(CATEGORIES);
  const place = pick(PLACE_NOUNS[category]);
  const lighting = pick(LIGHTING);
  const atmosphere = pick(ATMOSPHERE);
  const detail = pick(DETAILS);
  const tags = pickMany(TAGS_POOL, 2 + Math.floor(Math.random() * 3));

  let id;
  do {
    id = `LA-${pad(seqNumber, 4)}`;
    seqNumber++;
  } while (existingIds.has(id));

  const now = new Date();
  const svg = buildSvg(category, Date.now() % 100000 + Math.floor(Math.random() * 100000));
  const dataUri = "data:image/svg+xml;utf8," + encodeURIComponent(svg);

  return {
    entry: {
      id,
      title: `${place}の記録`,
      category,
      categoryLabel: CATEGORY_LABEL[category],
      recordedAt: now.toISOString(),
      description: `${place}。${lighting}。${atmosphere}。${detail}。`,
      tags,
      visual: dataUri,
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

function main() {
  const args = process.argv.slice(2);
  let count = 1;
  const countIdx = args.indexOf("--count");
  if (countIdx !== -1 && args[countIdx + 1]) {
    count = Math.max(1, parseInt(args[countIdx + 1], 10) || 1);
  }

  const { entries, nextSeq } = loadData();
  const existingIds = new Set(entries.map((e) => e.id));
  let seq = nextSeq;

  const created = [];
  for (let i = 0; i < count; i++) {
    const { entry, nextSeq: ns } = generateEntry(existingIds, seq);
    seq = ns;
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

main();
