# Vercel環境変数設定

以下のURLにアクセスして環境変数を設定してください：

**設定URL**: https://vercel.com/syunsukes-projects/time-turn-app/settings/environment-variables

## 設定する環境変数

以下の4つの環境変数を **Production**, **Preview**, **Development** すべてに追加してください：

### 1. NEXT_PUBLIC_GEMINI_API_KEY
```
AIzaSyAnig2Wbd3eoYgwpc5cUPHNYZ4woh9WBFY
```

### 2. NEXT_PUBLIC_SUPABASE_URL
```
https://rgpkzoyzvdohjjgimpat.supabase.co
```

### 3. NEXT_PUBLIC_SUPABASE_ANON_KEY
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJncGt6b3l6dmRvaGpqZ2ltcGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODA2MzksImV4cCI6MjA4MDE1NjYzOX0.sMVpTYsPuizDi7tKolualWflkp-kPm_3U8W-nyF1eq0
```

### 4. NEXT_PUBLIC_MANUS_API_KEY
```
sk-s7z6I2mLgMulDmuq6QnsT9-TKdEihWQHFqMF-kqaGO71V0DbdWkAuW-Y43MEFyrsm1JFnWoQv3hvT1idR8xLom1RYsmE
```

## 設定手順

1. 上記URLにアクセス
2. 各環境変数について：
   - 「Add New」ボタンをクリック
   - Key: 環境変数名を入力
   - Value: 値を入力
   - Environments: Production, Preview, Development すべてにチェック
   - 「Save」をクリック
3. すべて設定したら、再デプロイ：
   ```bash
   cd "/Users/matsumotoshuntasuku/TimeTurn 11:17/time-turn-app"
   vercel --prod
   ```

## 確認方法

設定後、以下のコマンドで環境変数が正しく設定されているか確認できます：
```bash
vercel env ls
```
