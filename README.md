# LIMINAL ARCHIVES

現実の隙間に存在する、どこでもない場所の記録。ルミナルスペース／バックルームズ的な、
無人でノスタルジックな空間の「視覚資料」を収集・公開する静的サイトです。

**最大の特徴は、人の手を介さず毎日新しい記録が自動で追加される点です。**
GitHub Actions が定期的に起動し、スクリプトが Wikimedia Commons から
「ルミナルスペースらしい」実写真を取得し、生成した説明文とあわせて
`data/spaces.json` に追記、GitHub Pages へ自動で再デプロイします。

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
      "visual": "https://upload.wikimedia.org/wikipedia/commons/....jpg",
      "attribution": {
        "creator": "撮影者名",
        "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
        "sourceUrl": "https://commons.wikimedia.org/wiki/File:....jpg",
        "provider": "Wikimedia Commons"
      }
    }
  ]
}
```

- `category` は `corridor`（廊下）/ `indoor`（屋内）/ `outdoor`（屋外）/ `night`（夜間）の4種。
- `visual` は Wikimedia Commons（CCライセンス・パブリックドメイン画像のリポジトリ）
  から検索・取得した実写真の直リンクです。
- `attribution` には撮影者・ライセンス・出典ページの情報が入り、サイトの詳細モーダルに
  表示されます（CCライセンスの表示義務に対応するため）。

## 自動更新の仕組み

### 1. 生成スクリプト（`scripts/generate-space.js`）

- 場所・照明・空気感・ディテールの語彙プールからランダムに組み合わせて、
  重複しにくい説明文とタイトルを生成します。
- カテゴリ（廊下/屋内/屋外/夜間）に応じた英語の検索クエリで
  **Wikimedia Commons API**（登録・APIキー不要）を検索し、
  「ルミナルスペースらしい」実写真を1枚取得します。
  - 事件・事故・暴力・災害等に関連する報道写真を避けるため、
    タイトルに対するブロックリストでのフィルタリングを行っています。
  - 同じ画像を再利用しないよう、既存レコードの画像URLと重複しない
    候補のみを選びます。
  - ライセンス表示義務に対応するため、撮影者・ライセンス名・出典URLを
    `attribution` として記録に含めます。
- `data/spaces.json` の先頭に新しい記録を追加し、`MAX_ENTRIES`（既定400件）を
  超えた古い記録は自動的に間引かれます。

> 補足: 当初 Pexels / Pixabay のAPIキー発行を試みましたが、
> 執筆時点で新規キー発行が停止中でした。また Openverse API は
> クラウドフレアのボット判定によりCI環境からのアクセスがブロックされたため、
> 登録不要かつボット対策の影響を受けにくい Wikimedia Commons API を採用しています。

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

- `visual` の写真は Wikimedia Commons 上で CCライセンスまたはパブリックドメインとして
  公開されている実写真です。各記録の詳細モーダルに撮影者・ライセンス・出典へのリンクを
  表示し、ライセンス表示義務に対応しています。
- タイトル・説明文はテンプレート・ランダム生成によるフィクションであり、
  写真に写っている実際の場所・施設・人物とは関係ありません。
- ブロックリストによるフィルタリングは完全ではないため、万が一不適切な画像が
  表示された場合は `scripts/generate-space.js` の `BLOCKLIST_KEYWORDS` に
  キーワードを追加し、該当レコードを `data/spaces.json` から削除してください。
