# 福岡シニア賃貸横断サーチ / home-select2

定年後に福岡市または周辺地域で、夫婦2人暮らし向けの一時的な賃貸物件を探すための静的サイトです。

## 目的

- 60歳定年後に福岡市、または福岡市周辺へ一時的に住むための賃貸候補を横断検索する
- 優先エリアは西区・早良区・城南区、その次に南区・中央区・博多区・東区、さらに糸島市など周辺地域
- 高齢者相談可、2人入居可、2LDK以上、管理費込み家賃10万円以下を中心に確認する
- 検索結果カードから、物件名・画像・住所・ボタンのどこを押してもリンク先へ移動できるようにする

## 対象サイト

- エイブル
- アットホーム
- ふれんず
- ホームメイト
- UR賃貸住宅

## ファイル構成

```text
/
├─ index.html
├─ styles.css
├─ app.js
├─ data/
│  ├─ properties.json
│  └─ sources.json
├─ scripts/
│  └─ validate-data.mjs
├─ .github/workflows/
│  ├─ pages.yml
│  └─ validate-data.yml
└─ README.md
```

## 現在の状態

この版は、実データ取得に進む前段階のJSON読み込み型モックアップです。
`app.js` に物件データを直書きせず、`data/properties.json` と `data/sources.json` を読み込んで表示します。

## データ設計

### data/sources.json

横断検索対象サイトの一覧です。

必須項目:

- `id`
- `name`
- `description`
- `url`

### data/properties.json

検索結果カードに表示する物件・検索導線データです。

必須項目:

- `id`
- `title`
- `source`
- `sourceId`
- `status`
- `address`
- `area`
- `areaGroup`
- `type`
- `rent`
- `rentLabel`
- `layout`
- `layoutLabel`
- `walk`
- `walkLabel`
- `score`
- `tags`
- `note`
- `listingUrl`
- `sourceUrl`

## 検証

次のコマンドでJSONの必須項目とURLを確認できます。

```bash
node scripts/validate-data.mjs
```

GitHub Actionsの `Validate property data` でも、push時に同じ検証を実行します。

## 実装時の重要ルール

- 物件ごとに `listingUrl` を必ず持たせる
- 画像、物件名、住所、ボタンをすべて `listingUrl` にリンクする
- URL未取得の物件は表示しない、または「リンク要確認」と明示する
- サ高住、老人ホーム、介護施設は賃貸物件とは分けて扱う
- 各サイトから取得したデータは、まず `data/properties.json` の形式に正規化する
