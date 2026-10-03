# LIMINAL ARCHIVES

現実の隙間に存在する、どこでもない場所の記録。ルミナルスペース／バックルームズ的な、
無人でノスタルジックな空間の「視覚資料」を収集・公開する静的サイトです。

**最大の特徴は、人の手を介さず毎日新しい記録が自動で追加される点です。**
GitHub Actions が定期的に起動し、スクリプトが新しい空間データ（タイトル・説明文・
手続き的に生成された抽象ビジュアル）を生成して `data/spaces.json` に追記し、
GitHub Pages へ自動で再デプロイします。

## 技術構成

- フロントエンド: Vanilla HTML / CSS / JavaScript（ビルドツール不要）
- データ: `data/spaces.json`（JSON、スクリプトが直接読み書き）
- 自動生成: `scripts/generate-space.js`（Node.js 標準モジュールのみ、依存パッケージ無し）
- 自動更新・公開: GitHub Actions + GitHub Pages

## ディレクトリ構成

```
.
├── index.html              # トップページ
├── css/style.css           # ダークトーンのスタイル
├── js/main.js              # ギャラリー描画・フィルタリング・モーダル
├── data/spaces.json        # 記録データ（自動生成スクリプトが追記）
├── scripts/generate-space.js  # 新しい記録を生成するスクリプト
└── .github/workflows/
    ├── daily-update.yml    # 毎日の自動生成 + コミット + デプロイ
    └── deploy.yml          # main への通常push時の即時デプロイ
```

## 記録（レコード）のデータ構造

`data/spaces.json` は次の形式を持ちます。

```json
{
  "nextSeq": 13,
  "updatedAt": "2026-10-03T15:00:00.000Z",
  "entries": [
    {
      "id": "LA-0012",
      "title": "待合室の記録",
      "category": "indoor",
      "categoryLabel": "屋内",
      "recordedAt": "2026-10-03T15:00:00.000Z",
      "description": "待合室。点滅する蛍光灯の光が壁を舐めている。...",
      "tags": ["無人", "既視感", "蛍光灯"],
      "visual": "data:image/svg+xml;utf8,..."
    }
  ]
}
```

- `category` は `corridor`（廊下）/ `indoor`（屋内）/ `outdoor`（屋外）/ `night`（夜間）の4種。
- `visual` は外部画像ファイル・APIを使わず、スクリプトが手続き的に生成した抽象SVGを
  Data URI として埋め込んだものです（API利用コストや画像権利の問題を避けるための設計）。

## 自動更新の仕組み

### 1. 生成スクリプト（`scripts/generate-space.js`）

- 場所・照明・空気感・ディテールの語彙プールからランダムに組み合わせて、
  重複しにくい説明文とタイトルを生成します。
- カテゴリに応じた配色・構図で、その場で抽象的な「視覚資料」SVGを生成します
  （外部画像APIなし、追加の依存パッケージなしで動作）。
- `data/spaces.json` の先頭に新しい記録を追加し、`MAX_ENTRIES`（既定400件）を
  超えた古い記録は自動的に間引かれます。

ローカルでの実行:

```bash
node scripts/generate-space.js            # 1件生成
node scripts/generate-space.js --count 5  # 5件生成
```

npm スクリプト経由でも実行できます。

```bash
npm run generate
```

### 2. GitHub Actions（`.github/workflows/daily-update.yml`）

- `cron: "0 15 * * *"`（UTC）= 日本時間 毎日 0:00 に自動実行。
- `generate` ジョブが `generate-space.js` を実行し、変更があれば
  `data/spaces.json` をコミット・push します。
- 続く `deploy` ジョブが `actions/upload-pages-artifact` と
  `actions/deploy-pages` を使ってサイト全体を GitHub Pages に再デプロイします。
- `workflow_dispatch` にも対応しており、Actions タブから手動実行し、
  生成件数（`count`）を指定することも可能です。

### 3. 通常デプロイ（`.github/workflows/deploy.yml`）

- `main` ブランチへの通常の push（コードの手動修正など）があった際にも
  即座に GitHub Pages への再デプロイを行います。

## GitHub Pages の設定方法

1. GitHub 上でこのリポジトリを作成し、push します。
2. リポジトリの **Settings → Pages** を開き、**Source** を
   「GitHub Actions」に設定します。
3. **Settings → Actions → General → Workflow permissions** で
   「Read and write permissions」を有効にします
   （`daily-update.yml` が `data/spaces.json` をコミットするために必要）。
4. `main` ブランチに push すると `deploy.yml` が走り、初回デプロイが行われます。
5. 以降は毎日 UTC 15:00（JST 0:00）に `daily-update.yml` が自動実行され、
   新しい記録が追加・公開されます。Actions タブから `workflow_dispatch` で
   いつでも手動実行することもできます。

## ローカルでの動作確認手順

Node.js（v18以上推奨）がインストールされていれば、ビルド不要でそのまま確認できます。

```bash
# 1. 任意の静的サーバーでプレビュー（例: npx serve）
npx serve .

# もしくは Python の簡易サーバーでも確認可能
python3 -m http.server 8080
```

ブラウザで `http://localhost:3000`（serveの場合）または
`http://localhost:8080`（Pythonの場合）を開くと、トップページと
ギャラリー、カテゴリフィルター（廊下/屋内/屋外/夜間）が確認できます。

新しい記録を試しに追加したい場合は、上記の生成スクリプトを実行してから
ブラウザをリロードしてください。

```bash
node scripts/generate-space.js --count 3
```

## デザイン方針

- ダークトーン固定（`css/style.css` の `:root` にCSSカスタムプロパティとして集約）。
- 蛍光灯の明滅・グレインノイズ・スキャンラインなど、ルミナルスペース特有の
  「既視感のある無人空間」の不気味さを演出。
- カテゴリ（廊下/屋内/屋外/夜間）によるギャラリーのフィルタリング機能付き。
- モバイル〜デスクトップまでのレスポンシブ対応（CSS Grid + `auto-fill`）。

## 注意事項

- `visual` に埋め込まれる画像は実写ではなく、すべてスクリプトによる
  手続き的生成（procedural generation）によるフィクションの抽象図像です。
- 本サイトのテキスト記録もすべてテンプレート・ランダム生成によるフィクションであり、
  実在する場所・人物とは関係ありません。
