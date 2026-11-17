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
| 지도 | MapLibre GL JS (`maplibre-gl` v6, react-leaflet 없이 직접 사용). 지도 스타일은 자체 제작 `src/assets/no-labels-style.json` (라벨 없음) — 지도 API 키 불필요 |
| 애니메이션 | framer-motion, @number-flow/react |
| 유틸 | classnames, date-fns, camelcase-keys/snakecase-keys |
| AIT SDK | `@apps-in-toss/web-framework` **3.x** (v3 네임스페이스 API 사용) |

## 2. 앱인토스 빌드 환경 (SDK 3.x)

- 설정 파일: `apps-in-toss.config.ts` (2.x의 `granite.config.ts`에서 마이그레이션됨)
  - `appName: "cat-gang"`, `primaryColor: "#3182F6"`, 권한: `geolocation`, `webBundleDir: "dist"`
  - `brand.displayName`/`icon`은 마이그레이션에서 제외됨 (3.x에서 brand deprecated)
- `package.json` 스크립트 (패키지 매니저: **pnpm**):
  - `pnpm dev` → `vite --host` (로컬 5173, devtools mock SDK; `granite dev` 아님)
  - `pnpm build` → `tsc -b && vite build && ait build` (타입체크 + 빌드 + .ait 아티팩트)
  - `pnpm lint` → `eslint .`
  - `pnpm deploy` → `ait deploy`
  - `pnpm update-types` → Supabase DB 타입 재생성 → `src/utils/db/types.ts`
- `@apps-in-toss/devtools`가 devDependencies에 있고 `vite.config.ts` plugins 맨 앞의 `aitDevtools.vite()`가 mock SDK를 제공. `initialState: { deviceModes: { location: "web" } }`로 로컬에서 실제 브라우저 위치(navigator.geolocation) 사용.
- **SDK 3.x 유의사항**: 3.x 번들을 출시하면 2.x로 롤백 불가. CORS Origin 허용 목록에 `https://cat-gang.web.tossmini.com`(실서비스) / `https://cat-gang.private-web.tossmini.com`(QR 웹 테스트) / `https://cat-gang.private-apps.tossmini.com`(앱 테스트) 등록 필요 (Supabase 등 외부 API용). **앱 테스트 Origin은 `private-web`이 아니라 `private-apps`** — Edge Function(2026-11-15 `auth` 함수에 허용 목록 기반 CORS 적용)이나 외부 API CORS에서 이 도메인 빠지면 기기 테스트에서 `FunctionsFetchError` 발생.
- **SDK API는 v3 네임스페이스 사용** (v2 함수형 API는 deprecated): `User.getAnonymousKey()`(에러 시 throw, "ERROR" 반환 없음), `Device.getLocation`/`Device.subscribeLocation`(위치), `Device.triggerHaptic`(햅틱), `Screen.close`(닫기), `Environment.environment`(toss/sandbox). v2 최신 유지 API: `graniteEvent.backEvent`, `Storage.getItem/setItem`, `TossAds`.

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
│                           #   / → Entry(Auth 감싸줌), /find-cat → FindCat, /test → Test, * → /
│                           #   최상단에 "maplibre-gl/dist/maplibre-gl.css" 임포트
│                           #   + useImageRecovery (화면 복귀 시 img src 재할당 — 웹뷰 이미지 깨짐 대응)
│                           #   + RootLayout keep-alive: /find-cat 첫 진입 후엔 라우트를 벗어나도
│                           #     FindCat를 언마운트하지 않고 display 토글로 숨김 (맵 재로딩 방지.
│                           #     캐시 플래그는 view store isFindCatCached. 숨김 중엔 FindCat의
│                           #     useCustomBack/useBrowserBackGuard가 isMapScreen=false로 꺼짐)
├─ pages/                   # 라우트 페이지
│   ├─ Entry/               # 홈 (유저 등록 AddUserDialog)
│   ├─ FindCat/             # 메인 게임 (지도, MyCats, MyInfoDialog, OwnCatInfoDialog)
│   └─ Test/                # 테스트 페이지
├─ components/              # 재사용 컴포넌트 (각 폴더 index.tsx + index.module.scss)
│   ├─ Auth/                # 로그인/인증 게이트 (initAuth 호출)
│   ├─ CloudReveal/         # 맵 첫 진입 리빌 — 구름/안개 오버레이, 로딩 완료 시 양쪽으로 흩어짐
│   ├─ Map/                 # MapLibre 지도 + 게임 로직 전부 포함한 단일 컴포넌트 (하단 §4.5)
│   ├─ Stage/               # 전투 스테이지 (Player — 하위 Status/StatusEffect, Control, Inventory, Effects)
│   ├─ ReactQueryProvider/  # QueryClientProvider
│   ├─ ToastMessage/, Dialog/, Button/, Input/, Loading/, Skeleton/, AdBanner/
│   └─ NavigationBlocker/   # 라우트 이동 차단 (AIT 환경 대응)
├─ hooks/                   # useCustomBack(AIT backEvent), useDayAndNight, useCheckKeypad
├─ queries/                 # React Query 훅 (config.ts에 QUERY_KEY, queryClient)
│   # useAuthMutation, useAddUserMutation, useCatchCatMutation,
│   # useItemQuery/useItemMutation, useMyCatsQuery, useUsersQuery
├─ store/                   # Zustand 스토어 (immer 미들웨어)
│   ├─ cat.ts               # useCatStore (isShowStage, selectedCat, clickedOwnCat)
│   └─ view.ts              # useViewStore (toastMessages, map: MaplibreMap|null,
│                           #   isStopFocusMe, isBattleOn)
├─ styles/_mixins.scss      # Sass 믹스인 (plush-stitch, glass-card — 공통 카드 질감 §5 참고)
├─ assets/
│   ├─ no-labels-style.json # MapLibre 지도 스타일 (자체 제작, 라벨 없음, 낮 테마 기본)
│   ├─ img/character/       # 고양이 캐릭터 cat-1..31.png, cat-me(+walk) 플레이어 이미지
│   └─ img/item/, img/title/, svg/
├─ utils/
│   ├─ native.ts            # AIT SDK 연동 핵심: UserKey 싱글턴(getAnonymousKey),
│   │                       #   getCurrentPosition/watchPosition (권한 흐름 + 개발용 mock 위치)
│   ├─ constants.ts         # isDev, operEnv (AIT 운영 환경 여부 판단; isDev면 null → 브라우저 폴백)
│   ├─ db/supabase.ts       # Supabase 클라이언트 (accessToken 자동 갱신 + Edge Function `auth`)
│   ├─ db/types.ts          # supabase gen types 생성물 (수동 수정 금지)
│   ├─ fetch.ts             # fetchData (snakecase → camelcase 자동 변환)
│   ├─ storage.ts           # localStorage 래퍼 (당일 산책 거리 + 궤적 TodayWalkData)
│   ├─ cats.ts              # catCharacters (31종 고양이: 이름/희귀도/이미지/대사)
│   ├─ helper.ts            # animateMarker, createMarker, distanceInMeters, getPostposition 등
│   └─ constants.ts
└─ vite-env.d.ts, global.d.ts
```

`public/`에는 `maplibre-gl-worker.mjs`(+dev)가 있어야 한다 — Vite 번들 환경에서 maplibre의 `import.meta.url` 기반 worker URL이 깨지므로 `config.WORKER_URL = ${BASE_URL}maplibre-gl-worker.mjs`로 명시 지정한다 (maplibre-gl 버전 업그레이드 시 worker 파일도 갱신 필요).

## 4.5. Map 컴포넌트 (MapLibre) 핵심 구조

`src/components/Map/index.tsx`는 지도 렌더링과 게임 로직(마커, 발자국, 스폰)을 함께 담당한다.

- **구성**: 바깥 `Map`(지도 인스턴스 생성/테마) + 내부 `MapContent`(마커/게임 로직). 지도 인스턴스는 `useViewStore`의 `map`에 등록해 공유.
- **지도 설정**: 기본 줌 18(Leaflet 줌 19 축척과 동일 — MapLibre는 512px 타일이라 같은 줌에서 축척 2배)이며 핀치 줌/회전 활성(min 15, `pitchWithRotate: true`), pitch 30 3D 카메라 + 두 손가락 세로 드래그 피치 조절 활성(상한 55도 — 과도한 기울기 렌더 부하 방지). 손가락 한 개 드래그 회전(`dragRotate`)/스크롤은 비활성, 더블탭(더블클릭) 줌은 활성 — 단 마커 위 더블탭은 `dblclick` 핸들러에서 `preventDefault()`로 게임 동작(전투 시작 등)과의 충돌을 막음. 줌 아웃 시 발자국 간격을 2^(줌차이)배로 보정(`getZoomAwareInterval`). `map.setPadding(bottom 25%)`로 3D 피치에서 캐릭터를 화면 중앙에 유지.
- **3D 지형/하늘**: AWS Terrain Tiles(terrarium DEM, 무료·키 불필요) 소스로 terrain + hillshade, `setSky`로 낮/노을/밤 하늘색. 건물 3D 조명은 `setLight`.
- **낮/밤 다크 테마**: `applyTheme()`이 `useDayAndNight` 기준으로 스타일 레이어 색을 런타임에 치환/복원. 원본 색은 로드 시점에 수집(`ORIGINAL_PAINTS`). `setSky`/`setPaintProperty`는 스타일 로드 완료(`load` 이벤트) 전에 호출하면 에러남.
- **마커**: 전부 DOM element 기반 `Marker` (me/enemy/owned/item 타입 — `createMarker`는 `utils/helper.ts`). 마커 클릭은 `e.originalEvent.target`에서 `[data-marker-container]` 등을 `closest()`로 찾는 MapLibre 방식.
- **발자국 트레일**: 이동 시 7m 간격으로 좌우 번갈아 발자국 마커 생성, 최대 200개(성능 보호), 궤적+거리는 `storage.ts`에 디바운스 저장 후 재접속 시 복원.
- **맵 첫 진입 리빌**: 별도 컴포넌트 `CloudReveal` 담당. 초기 로딩 중 안개 베이스(`.fog-base`, 불투명)가 지도를 완전히 가리고 크고작은 구름(`REVEAL_CLOUDS` 상수, 24뭉치)이 CSS 드리프트로 떠 있다. 로딩+내 위치 이동 완료(`isLoading=false`) 시 구름은 중앙에 가까운 것부터 framer exit(구름별 속도/거리/회전 개별)로 양쪽으로 흩어지고 안개는 페이드아웃된다. `REVEAL_HOLD`(0.5s)만큼 유지 후 걷혀 다크 테마 전환 깜빡임을 가린다. 낮/밤 톤은 `isNight` 클래스로 분기.
- **깃발(잡은 부하) 등급 표시**: `flag-wrapper`에 rare/unique 클래스가 붙어 깃발 색(골드/파랑/보라)·물결 속도·반짝임 별 개수(4/6/8)가 달라진다. `createMarker`에 `catName`을 전달해야 등급 판별됨.
- **깡(전투 티켓)**: 하루 5개 자정 리셋. **소모량은 상대 등급별로 다름** — `KKANG_COST_BY_RARITY` (common 1 / rare 2 / unique 3). 스토어 `consume(amount)`, 잔량 부족 시 팝업에 필요 개수 표시. `getTodayKkang()`은 "오늘 값 없음"을 `null`로 반환(0개와 구분 — 소진 상태 재진입 시 리셋 버그 방지).
- **웹뷰 백그라운드 복귀 대응**: `visibilitychange` visible 시 App의 `useImageRecovery`가 전체 img src를 재할당(재디코드 유도), Map이 `triggerRepaint()`로 캔버스 재렌더 — 화면 복귀 시 이미지/지도 깨짐 방지.
- **immer 주의**: `useViewStore`의 `map`에 MapLibre 인스턴스 저장 시 `as never` 캐스팅으로 immer 프록시를 우회 (GL 내부 구조 보호). MapLibre 인스턴스/마커를 상태에 넣을 땐 항상 이 패턴.

## 5. 핵심 패턴 & 주의사항

- **환경 분기**: `operEnv`(AIT 운영환경, `Environment.environment`)가 있으면 SDK API(`User.getAnonymousKey`, `Device.getLocation`)를, 없으면 브라우저 폴백(`navigator.geolocation`). 새 기능도 이 분기를 따를 것.
- **공통 글래스 카드 스타일 (2026-11-15 확정)**: 전 앱의 카드/패널/버튼/캡슐은 `src/styles/_mixins.scss`의 `@mixin glass-card` 로 질감을 통일한다 (반투명 배경 + blur + 흰 하이라이트 1px + 외곽 그림자). **���상톤은 각 UI의 원래 색을 유지**하며 질감만 공유 �� `glass-card($tint, $border, $radius, $shadow, $blur, $grad-top, $grad-bottom)` 파라미터로 톤을 넣는다 (ex. primary 버튼은 그린 톤, 대화창 내 대사는 주황, 적/시스템은 흰+회색). 런타임에 톤을 바꿔야 하면 믹스인이 노출하는 CSS 변수(`--glass-tint`, `--glass-border`, `--glass-grad-top/bottom` 등)를 재정의한다 (예: Control의 `.enemy`). 사용처: Stage Status/대화창/인벤토리, Dialog.content, Button, ToastMessage, 산책 거리 캡슐, FindCat 플로팅 독/바텀시트, MyCats 리스트 카드, CatBook 슬롯, MyInfoDialog/OwnCatInfoDialog 카드. 새 UI 추가 시에도 이 믹스인을 쓸 것.
- **웹뷰 blur(backdrop-filter) 미지원 (2026-11-15 원인 파악)**: AIT 웹뷰(Android)는 `backdrop-filter`를 **아예 렌더링하지 못한다**. WebGL 캔버스 위에서만 깨지는 게 아니라, 캔버스 없는 Entry 대화상자에서도 블러가 안 되는 게 실측으로 확인됨(코드 쪽 조상 transform/filter 등 원인은 없었음). 유력 배경은 구버전 Android System WebView(backdrop-filter는 WebView 76+ 지원). 따라서:
  - `glass-card` 믹스인에 `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))` 폴백이 있음 — 미지원 환경에선 틴트를 한 겹 더 얹어(알파 합성) 카드 가독성을 확보. **블러는 enhancement로 취급**하고, blur 없이도 카드가 읽히게 설계할 것.
  - 이 폴백을 쓰려면 glass-card 사용처에서 믹스인 뒤에 `background:`를 재선언하지 말 것(폴백을 덮어씀 — 변수만 바꾸면 background는 자동 반영됨).
  - 지원 기기에서도 WebGL 캔버스 위 backdrop-filter는 Chromium 회귀로 안 될 수 있어 `FindCat`의 `.map canvas`에 투명 `background-image`를 그려 backdrop 캡처를 유도하는 우회가 있음.
  - 데스크톱 브라우저(`pnpm dev`)에서는 블러가 정상이라 이 문제가 안 보임 — 웹뷰 관련 스타일 검증은 반드시 QR 테스트 기기에서.
- **스킬 문서 갱신**: 이처럼 확정된 디자인 시스템/공통 규칙이 생기면 이 SKILL.md에도 반영한다.
- **유저 식별**: `UserKey.getInstance().getKey()` 싱글턴 사용. Supabase 인증은 익명키 → Edge Function `auth` → JWT (만료 60초 전 자동 갱신, 중복 호출 dedupe).
- **DB 키 컨벤션**: 요청은 snake_case로 나가고(`snakecase-keys`) 응답은 camelCase로 변환(`camelcase-keys`). Supabase 타입(`db/types.ts`)은 snake_case 그대로임에 유의.
- **경로 별칭**: `@/` → `src/` (vite alias).
- **import 정렬**: `simple-import-sort`가 error 레벨. react-hooks exhaustive-deps도 error + autofix.
- **React Compiler 활성화**: useMemo/useCallback 남발 불필요. 컴포넌트는 순수하게 유지(렌더 중 변이 금지).
- **AIT SDK 필수 규칙**: 사용자 대면 텍스트는 해요체, 다크패턴 금지, 결제는 IAP/TossPay, 광고는 TossAds, 스토리지는 SDK `Storage` 우선. 상세는 `.agents/skills/apps-in-toss/SKILL.md` 및 `.agents/rules/apps-in-toss.md` 참고 (폴더명이 `.agents`임에 유의).
- **환경변수** (`.env.local`, 커밋되지 않음): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. 지도는 키 불필요(자체 스타일 + 무료 DEM 타일). `VITE_KKO_MAP_KEY`는 타입 선언에만 남아있고 사용처 없음(Leaflet/Kakao 잔재 — 제거 후보).

## 6. 작업 마무리 체크리스트 (필수)

코드 작업/수정 후에는 반드시 아래를 순서대로 실행해 문제가 없는지 확인:

1. `pnpm lint` — 에러 0 확인 (unused-imports, import-sort, hooks 규칙)
2. `pnpm build` — tsc 타입체크 + vite 빌드 성공 확인
3. 실패하면 수정 후 재실행. 통과 전까지 작업을 완료로 보고하지 않는다.
