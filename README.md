# 짤랑짤랑 웹앱 🪙 - 설치 가이드

## 📋 전체 순서
1. Supabase 설정 (DB + 로그인)
2. 코드에 키 입력
3. Vercel로 인터넷에 올리기

---

## STEP 1: Supabase 설정

### 1-1. 가입 및 프로젝트 생성
1. https://supabase.com 접속 → 무료 가입
2. **New Project** 클릭
3. 이름: `zzalrang`, 비밀번호: 기억할 비밀번호 입력
4. Region: **Northeast Asia (Seoul)** 선택
5. **Create Project** 클릭 (1~2분 대기)

### 1-2. 데이터베이스 테이블 만들기
1. 왼쪽 메뉴 → **SQL Editor** 클릭
2. **New Query** 클릭
3. `supabase_schema.sql` 파일의 내용을 전부 복사해서 붙여넣기
4. **Run** 버튼 클릭 → "Success" 확인

### 1-3. 키 복사하기
1. 왼쪽 메뉴 → **Settings** → **API** 클릭
2. 아래 두 가지를 복사해 두세요:
   - **Project URL**: `https://xxxx.supabase.co` 형태
   - **anon public key**: `eyJ...` 로 시작하는 긴 문자열

---

## STEP 2: 코드에 키 입력

프로젝트 폴더에서 `.env` 파일을 만들고 아래 내용 입력:

```
VITE_SUPABASE_URL=https://여기에-본인-URL.supabase.co
VITE_SUPABASE_ANON_KEY=여기에-본인-anon-key
```

---

## STEP 3: 로컬에서 테스트 (선택)

터미널(명령 프롬프트)에서:
```bash
npm install
npm run dev
```
브라우저에서 http://localhost:5173 열기

---

## STEP 4: Vercel로 인터넷에 올리기

### 4-1. GitHub에 올리기
1. https://github.com 가입
2. **New Repository** → 이름: `zzalrang` → Create
3. 터미널에서:
```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/본인아이디/zzalrang.git
git push -u origin main
```

### 4-2. Vercel 배포
1. https://vercel.com 가입 (GitHub 계정으로 로그인)
2. **New Project** → GitHub에서 `zzalrang` 선택
3. **Environment Variables** 섹션에서:
   - `VITE_SUPABASE_URL` 입력
   - `VITE_SUPABASE_ANON_KEY` 입력
4. **Deploy** 클릭!
5. 완료되면 `https://zzalrang-xxxx.vercel.app` 같은 주소가 생겨요 🎉

---

## ❓ 막히는 부분이 있으면 언제든 물어보세요!
# zzalrang
