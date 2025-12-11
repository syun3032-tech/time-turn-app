#!/bin/bash

# Vercel環境変数設定スクリプト

echo "Vercel環境変数を設定します..."

# NEXT_PUBLIC_GEMINI_API_KEY
echo "AIzaSyAnig2Wbd3eoYgwpc5cUPHNYZ4woh9WBFY" | vercel env add NEXT_PUBLIC_GEMINI_API_KEY production
echo "AIzaSyAnig2Wbd3eoYgwpc5cUPHNYZ4woh9WBFY" | vercel env add NEXT_PUBLIC_GEMINI_API_KEY preview
echo "AIzaSyAnig2Wbd3eoYgwpc5cUPHNYZ4woh9WBFY" | vercel env add NEXT_PUBLIC_GEMINI_API_KEY development

# NEXT_PUBLIC_SUPABASE_URL
echo "https://rgpkzoyzvdohjjgimpat.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production
echo "https://rgpkzoyzvdohjjgimpat.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL preview
echo "https://rgpkzoyzvdohjjgimpat.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL development

# NEXT_PUBLIC_SUPABASE_ANON_KEY
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJncGt6b3l6dmRvaGpqZ2ltcGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODA2MzksImV4cCI6MjA4MDE1NjYzOX0.sMVpTYsPuizDi7tKolualWflkp-kPm_3U8W-nyF1eq0" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJncGt6b3l6dmRvaGpqZ2ltcGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODA2MzksImV4cCI6MjA4MDE1NjYzOX0.sMVpTYsPuizDi7tKolualWflkp-kPm_3U8W-nyF1eq0" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJncGt6b3l6dmRvaGpqZ2ltcGF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODA2MzksImV4cCI6MjA4MDE1NjYzOX0.sMVpTYsPuizDi7tKolualWflkp-kPm_3U8W-nyF1eq0" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development

# NEXT_PUBLIC_MANUS_API_KEY
echo "sk-s7z6I2mLgMulDmuq6QnsT9-TKdEihWQHFqMF-kqaGO71V0DbdWkAuW-Y43MEFyrsm1JFnWoQv3hvT1idR8xLom1RYsmE" | vercel env add NEXT_PUBLIC_MANUS_API_KEY production
echo "sk-s7z6I2mLgMulDmuq6QnsT9-TKdEihWQHFqMF-kqaGO71V0DbdWkAuW-Y43MEFyrsm1JFnWoQv3hvT1idR8xLom1RYsmE" | vercel env add NEXT_PUBLIC_MANUS_API_KEY preview
echo "sk-s7z6I2mLgMulDmuq6QnsT9-TKdEihWQHFqMF-kqaGO71V0DbdWkAuW-Y43MEFyrsm1JFnWoQv3hvT1idR8xLom1RYsmE" | vercel env add NEXT_PUBLIC_MANUS_API_KEY development

echo "環境変数の設定が完了しました！"
echo "再デプロイするには: vercel --prod"
