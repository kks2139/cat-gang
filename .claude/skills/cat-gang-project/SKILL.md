---
name: cat-gang-project
description: cat-gang(냥만시대) 프로젝트 작업 시 참고. 앱인토스 미니앱의 전체 구조, 기술 스택, 빌드/린트 명령, 핵심 패턴과 주의사항을 정리한 프로젝트 종합 가이드.
---

# cat-gang (냥만시대) 프로젝트 가이드

토스 앱인토스(Apps in Toss)에 들어갈 위치 기반 고양이 수집 게임 미니앱.
**코드 작업 전 이 스킬을 먼저 확인하고, 작업 후에는 반드시 lint + build 검증을 수행한다.**

## 1. 기술 스택

| 항목 | 내용 |
| :--- | :--- |
| 프레임워크 | React 19 + TypeScript + Vite 8 (CSR 전용, SSR 불가) |
| React Compiler | `babel-plugin-react-compiler` + `@rolldown/plugin-babel` 로 활성화 (`vite.config.ts`) |
| 스타일 | Sass (`sass-embedded`) + CSS Modules (`*.module.scss`), 전역은 `src/globals.scss` |
| 상태 | Zustand + immer (`src/store/`) |
| 서버 상태 | TanStack React Query (`src/queries/`) |
| 백엔드 | Supabase (`@supabase/supabase-js`, Edge Function `auth` 로 JWT 발급) |
| 지도 | Leaflet + react-leaflet (Kakao Map 키: `VITE_KKO_MAP_KEY`) |
| 애니메이션 | framer-motion, @number-flow/react |
| AIT SDK | `@apps-in-toss/web-framework` **2.x (Granite)** |

## 2. 앱인토스 빌드 환경 (SDK 2.x / Granite)

- 설정 파일: `granite.config.ts` (SDK 3.x의 `apps-in-toss.config.ts`가 아님)
  - `brand.displayName: "냥만시대"`, `outdir: "dist"`, 권한: `geolocation`
  - `web.commands.build: "tsc -b && vite build"` → **`ait build` 가 tsc 타입체크 + vite 빌드를 모두 수행**
- `package.json` 스크립트 (패키지 매니저: **pnpm**):
  - `pnpm dev` → granite dev (로컬 5173, 토스 샌드박스 연동)
  - `pnpm build` → `ait build` (배포용 번들)
  - `pnpm lint` → `eslint .`
  - `pnpm deploy` → `ait deploy`
  - `pnpm update-types` → Supabase DB 타입 재생성 → `src/utils/db/types.ts`
- `.granite/app.json`, `.vercel.json`, `vercel.json` 도 빌드/배포 관련 세팅.

## 3. Supabase DB (무료 티어) 구조 & 세팅

- **요금제**: 무료 티어. 프로젝트가 일시정지(paused)되면 대시보드에서 리슴(Resume) 필요 — **리슴 중에는 REST API 호출이 5xx(512 등)로 실패**하니 에러 원인으로 의심할 것. 리슴은 즉시 반영되지 않고 시간이 걸린다.
- **테이블** (3개, 전부 `public` 스키마. 구조의 원본은 `src/utils/db/types.ts` — 수동 수정 금지, `pnpm update-types`로 재생성):

  | 테이블 | 컬럼 | 용도 / 접근 패턴 |
  | :--- | :--- | :--- |
  | `users` | `user_id`(text), `name`, `crying`, `created_at` | 유저 프로필(고양이 이름/울음소리). `user_id`로 필터 + `maybeSingle()` |
  | `own_cats` | `user_id`(text), `cat_name`, `position`(json: `{lat, lng}`), `created_at` | 잡은 고양이 목록. 유저당 여러 행. `user_id`로 필터 (select는 `cat_name, position, created_at`) |
  | `items` | `user_id`(text), `gukbab`, `fish`, `catnip`, `created_at` | 유저 보유 아이템 수. `user_id`로 필터 + `maybeSingle()` |

  - `user_id`는 uuid가 아니라 **AIT 익명 키(`getAnonymousKey`) 텍스트 값**이다.
  - PK/외래키 제약은 REST(types.ts)에 노출되지 않음 — 제약·RLS 정책 확인은 Supabase 대시보드에서.
  - 레포의 `supabase/` 디렉터리에는 로컬 함수 소스가 없음(연결된 프로젝트 메타만 있음). **Edge Function `auth`는 대시보드에서 관리** 중이므로 수정 시 주의.

- **인증 흐름**: publishable 키(`sb_publishable_...`)로 클라이언트 생성 → Edge Function `auth`에 `{ userKey }` 전송 → JWT 수신 → `accessToken` 옵션으로 만료 60초 전 자동 갱신. `initAuth()`를 앱 시작 시 1회 호출.
- **컬럼 추가/변경 시**: 대시보드에서 테이블 수정 → `pnpm update-types` 실행 → 관련 쿼리 훅(`src/queries/`)과 타입 인터페이스 업데이트.

## 4. 디렉터리 구조

```
src/
├─ main.tsx                 # 진입점 (globals.scss 임포트)
├─ App.tsx                  # react-router-dom v7 createBrowserRouter
│                           #   / → Entry(Auth 감싸줌), /find-cat → FindCat, /test → Test
├─ pages/                   # 라우트 페이지
│   ├─ Entry/               # 홈 (유저 등록 AddUserDialog)
│   └─ FindCat/             # 메인 게임 (지도, MyCats, MyInfoDialog, OwnCatInfoDialog)
├─ components/              # 재사용 컴포넌트
│   ├─ Auth/                # 로그인/인증 게이트 (initAuth 호출)
│   ├─ Map/                 # Leaflet 지도 래퍼 (SkyLayer, ZoomButton)
│   ├─ Stage/               # 게임 스테이지 (Player, Control, Inventory, Effects)
│   ├─ ReactQueryProvider/  # QueryClientProvider
│   ├─ ToastMessage/, Dialog/, Button/, Input/, Loading/, Skeleton/, AdBanner/
│   └─ NavigationBlocker/   # 라우트 이동 차단 (AIT 환경 대응)
├─ hooks/                   # useCustomBack(AIT backEvent), useDayAndNight, useCheckKeypad
├─ queries/                 # React Query 훅 (config.ts에 QUERY_KEY, queryClient)
│   # useAuthMutation, useAddUserMutation, useCatchCatMutation,
│   # useItemQuery/useItemMutation, useMyCatsQuery, useUsersQuery
├─ store/                   # Zustand 스토어
│   ├─ cat.ts               # useCatStore (스테이지/선택된 고양이)
│   └─ view.ts              # useViewStore (토스트, Leaflet map 인스턴스, 전투 상태)
├─ styles/_mixins.scss      # Sass 믹스인
├─ utils/
│   ├─ native.ts            # AIT SDK 연동 핵심: UserKey 싱글턴(getAnonymousKey),
│   │                       #   getCurrentPosition/watchPosition (권한 흐름 + 개발용 mock 위치)
│   ├─ constants.ts         # isDev, operEnv (AIT 운영 환경 여부 판단)
│   ├─ db/supabase.ts       # Supabase 클라이언트 (accessToken 자동 갱신 + Edge Function `auth`)
│   ├─ db/types.ts          # supabase gen types 생성물 (수동 수정 금지)
│   ├─ fetch.ts             # fetchData (snakecase → camelcase 자동 변환)
│   ├─ storage.ts           # localStorage 래퍼 (당일 걸음거리)
│   ├─ cats.ts, helper.ts, constants.ts
│   └─ ...
└─ vite-env.d.ts, global.d.ts
```

## 5. 핵심 패턴 & 주의사항

- **환경 분기**: `operEnv`(AIT 운영환경)가 있으면 SDK API(`getAnonymousKey`, `getCurrentLocation`)를, 없으면 브라우저 폴백(`navigator.geolocation`). 새 기능도 이 분기를 따를 것.
- **유저 식별**: `UserKey.getInstance().getKey()` 싱글턴 사용. Supabase 인증은 익명키 → Edge Function `auth` → JWT (만료 60초 전 자동 갱신, 중복 호출 dedupe).
- **DB 키 컨벤션**: 요청은 snake_case로 나가고(`snakecase-keys`) 응답은 camelCase로 변환(`camelcase-keys`). Supabase 타입(`db/types.ts`)은 snake_case 그대로임에 유의.
- **경로 별칭**: `@/` → `src/` (vite alias).
- **import 정렬**: `simple-import-sort`가 error 레벨. react-hooks exhaustive-deps도 error + autofix.
- **React Compiler 활성화**: useMemo/useCallback 남발 불필요. 컴포넌트는 순수하게 유지(렌더 중 변이 금지).
- **AIT SDK 필수 규칙**: 사용자 대면 텍스트는 해요체, 다크패턴 금지, 결제는 IAP/TossPay, 광고는 TossAds, 스토리지는 SDK `Storage` 우선. 상세는 `.agents/skills/apps-in-toss/SKILL.md` 및 `.agents/rules/apps-in-toss.md` 참고 (폴더명이 `.agents`임에 유의).
- **환경변수** (`.env.local`, 커밋되지 않음): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_KKO_MAP_KEY`.

## 6. 작업 마무리 체크리스트 (필수)

코드 작업/수정 후에는 반드시 아래를 순서대로 실행해 문제가 없는지 확인:

1. `pnpm lint` — 에러 0 확인 (unused-imports, import-sort, hooks 규칙)
2. `pnpm build` — tsc 타입체크 + vite 빌드 성공 확인
3. 실패하면 수정 후 재실행. 통과 전까지 작업을 완료로 보고하지 않는다.
