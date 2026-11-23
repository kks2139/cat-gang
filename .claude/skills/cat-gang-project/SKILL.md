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
- **테이블** (4개, 전부 `public` 스키마. 구조의 원본은 `src/utils/db/types.ts` — 수동 수정 금지, `pnpm update-types`로 재생성):

  | 테이블 | 컬럼 | 용도 / 접근 패턴 |
  | :--- | :--- | :--- |
  | `users` | `user_id`(text), `name`, `crying`, `created_at` | 유저 프로필(고양이 이름/울음소리). `user_id`로 필터 + `maybeSingle()` |
  | `own_cats` | `user_id`(text), `cat_name`, `position`(json: `{lat, lng}`), `created_at` | 잡은 고양이 목록. 유저당 여러 행. `user_id`로 필터 (select는 `cat_name, position, created_at`) |
  | `items` | `user_id`(text), `gukbab`, `fish`, `catnip`, `created_at` | 유저 보유 아이템 수. `user_id`로 필터 + `maybeSingle()` |
  | `cat_towers` | `user_id`(text PK), `position`(json), `height_at`(float), `attached_keys`(json: string[]), `updated_at`, `created_at` | 캣 타워 상태. 유저당 1행, upsert. 생성 SQL은 `supabase/sql/cat_towers.sql` (2026-11-19) |

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
│   ├─ db/catTower.ts       # 캣 타워 상태 조회/저장 (cat_towers 테이블 upsert)
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
- **캣 타워 (2026-11-19 추가, 2026-11-20 개편·디자인 개선, **2026-11-24 다중 타워 개편**)**: 부하를 붙여 키우는 3D 지물. 유저당 여러 개를 보유한다 — 완공 타워는 남고 건설중(완공 안 된) 타워는 동시에 1개뿐(`store/catTower.ts`의 `getActiveTower`). DB는 2026-11-24에 PK를 `user_id`→`id`(uuid)로 교체하고 완공 시각 `completed_at` 컬럼을 추가(`supabase/sql/cat_towers_multi.sql`) — 완공 소요 시간 = completed_at − created_at. **완공 규칙**: 높이 상한 `TOWER_MAX_HEIGHT` 1000m 도달 시 완공 — 모든 부하 일중단(`attachedKeys` 비움 = 휴식) + 완공 시각 기록 + 저장. 완공 축하 연출은 `pages/FindCat/TowerCelebration`(컨페티 화면 가득 + 메시지 팝, 3.5초 자동 종료), 노출 여부는 Storage `TOWER_CELEBRATED`(타워별 1회 — `utils/storage.ts`의 getCelebratedTowerIds/markTowerCelebrated, FindCat이 `completedAt` 있고 미노출인 타워를 감지해 재생). 감지(대기열 등록)는 맵이 숨겨진 동안에도 진행되지만 **노출 시작은 맵 화면이 실제 보일 때만**(`isMapScreen` 가드) — keep-alive로 맵 밖에서 완공돼도 재진입 시 보인다. 노출 시 맵 진입 리빌이 진행 중이면 가려지므로, 리빌 종료(`view store`의 `isMapRevealDone` — Map의 CloudReveal `onExitComplete`에서 세팅)를 기다렸으면 리빌 후 1.5초 뒤에 띄운다(대기 중 리빌을 겪었는지는 ref로 동적 판단 — 감지 시점 고정 플래그는 맵 밖 완공 케이스를 놓침). 노출 전에 **축하 대상 타워로 카메라를 먼저 이동**(`focusTower` flyTo 800ms)하고 도착 뒤 메시지가 나온다 — 멀리 있어도 완공 타워가 보인 채 축하된다. **다중 타워 렌더링**: CatTower.tsx는 한 소스에 모든 타워 지물을 합쳐 그리고 각 지물에 `tid`(타워 id) 프로퍼티를 심는다 — 레이어는 공용이라 색은 tid match 표현식으로 타워별 테마를 반영하고, 클릭 히트도 tid로 어느 타워인지 판정한다. 높이 라벨/공사 모션/팝업은 타워별(라벨 마커는 id 맵으로 관리, 공사 모션은 부하 붙은 타워 1개, 팝업은 동시 1개 + `popupTowerId`). 이동 모션도 대상 타워 지물만 다시 그리고 나머지는 고정. `store/catTower.ts`(상태/성장 계산 — 부하 1마리당 30분에 1m 지속 성장(붙일 때 즉시 보너스는 2026-11-20 삭제), **등급별 기여도 배수 `TOWER_CONTRIBUTION_BY_RARITY`(common 1 / rare 1.5 / unique 2, 2026-11-20) — 부하 키에서 `lastIndexOf("_")`로 이름을 추출해 희귀도 판별**, 앱 종료 중에도 소급) + `components/Map/CatTower.tsx`(지도 렌더링). **타워 본체는 fill-extrusion GeoJSON 레이어**(기초 지반(흙) `cat-tower-foundation` / 몸통 `cat-tower-3d` / 가지 `cat-tower-branch` / 둥지 발판 `cat-tower-nest` / 꼭대기 발판 `cat-tower-perch`)라 기울기/회전/줌에 함께 변형되고, 높이 뱃지는 DOM 마커(`globals.scss`의 `.cat-tower-label`)로 **기초 지반 앞쪽(남측) 하단에 안내판처럼 표시**. **몸통/기초는 실제 높이의 1/5(`TOWER_VISUAL_HEIGHT_RATIO`)로 축소 렌더**, **가지·둥지·발바닥 마크는 축소하면 몇 픽셀밖에 안 돼 실제 크기(미터) 렌더(축소 예외)** — 가지 부착 높이만 축소 스케일로 몸통 위에 붙인다. 점수(badge/라벨/팝업)는 실제 높이 그대로. 형태는 **원목 가지 캣트리**(2026-11-20 사각 캣트리에서 개편) — 16각 근사 원기둥 몸통 + 실제 높이 10m부터 20m 간격으로 꼭대기 여유 5m를 남기고 계속 황금각 방향 가지 발생(개수 상한 없음, 2026-11-23 — 기존 상한 6개라 타워가 크게 자라면 저층에만 발판이 몰리는 문제. 가지 길이·둥지 반경은 선형 감쇠 대신 하한으로 수렴하는 기하 감쇠라 개수가 많아져도 안전)(계단식 오프셋 세로 기둥 3조각 근사 — fill-extrusion은 기울기 밀기 불가) + 가지 끝 둥지 발판 + 원형 꼭대기 발판(흰 발바닥 마크). **몸통 색은 실제 10m마다 어두운/밝은 갈색 교대 밴드** — fill-extrusion 색은 지물당 1회 평가라 지물 안에서 높이별 변화가 불가능하므로, 몸통을 밴드 단위(축소 2m) 지물로 쪼개고 `band`(0/1) 프로퍼티로 색 선택(`trunkBandColor`). `step` 표현식 트릭은 안 됨(몸통 전체가 꼭대기 색 하나로 칠해짐). **건물 위 배치는 금지** — 타워가 건물에 묻히는 문제(MapLibre 특성: 모든 fill-extrusion이 하나의 3D 패스에서 실제 깊이 테스트, 레이어 순서 무관)를 게임 규칙으로 푼다. 위치 지정 클릭 시 **기초 지반(중심+원반 원주 8점)이 건물에 걸치면 토스트로 거부**(`isOnBuilding` — `querySourceFeatures`(`openmaptiles`/`building`) + PIP 판정, 카메라 독립적. `queryRenderedFeatures`는 기울어진 카메라에서 앞 건물에 오판정됨). **기초 지반은 원형 원반(2026-11-24, 기존 오각에서 변경 — `TOWER_FOUNDATION_M`이 원반 반경, 가장자리 거리는 `FOUNDATION_EDGE_M`=반경. 색도 고정 갈색에서 테마 파생 어두운 톤(`towerFoundationColor` — trunkA를 darken 0.72/밤 0.8)으로 변경)**. 옥상 얹기/건물 페이드 방식은 검토 후 폐기(2026-11-20). 위치 지정 모드(`isPlacingTower`, 새로 세우기/이동 공용 + `isMoveTower` 구분)에선 100m 반경 원(`cat-tower-zone-*`) 내 탭으로 세우고 — **구역 중심은 새로 세우기는 내 캐릭터 위치, 이동은 타워 현재 위치(2026-11-24)**. 이동 구역 판정/펄스/카메라 진입(`TOWER_MOVE_VIEW_ZOOM` 17·pitch 30으로 타워로 easeTo) 모두 타워 기준이라 캐릭터와 타워가 멀어도 타워 근처로 옮길 수 있다(기존엔 캐릭터 기준이라 멀리 있으면 100m 제한 토스트로 막혔음). **중앙→가장자리로 퍼지는 파동 효과는 WebGL 지물 대신 DOM/CSS 펄스**(`.cat-tower-zone-pulse` — map.project로 구역 경계 화면 반경(px)을 계산해 `--pulse-r` CSS 변수로 링 크기 맞춤, `move` 이벤트로 갱신. 지물을 프레임마다 다시 그리는 rAF 방식은 웹뷰에서 렉이 걸려 폐기 — DOM/CSS 애니메이션은 합성 스레드라 맵 렌더 비용 0. 애니메이션은 내부 요소에 둘 것), **이때 캐릭터 이동(drawMe 얼림), 타 마커 클릭, 도크/상단/내위치 버튼까지 모두 잠김**. 타워 클릭은 바텀시트가 아닌 **타워 옆 팝업 정보창**(DOM 마커 + `createPortal`, `globals.scss`의 `.cat-tower-popup`; 기본정보/작업중 수/작업고양이 추가(시트 `cats` 모드)/위치 옮기기 — **제거 기능은 2026-11-20 삭제**)이 뜬다 — 팝업 내 클릭은 `.cat-tower-popup` closest 가드로 지도 클릭과 분리. **타워 클릭 시 카메라 포커스 연출(2026-11-20)**: 팝업을 열며 `easeTo`로 타워 중심 이동 + 카메라를 지면 가까이(피치 최대 `TOWER_VIEW_PITCH` 55도) 내리고 기본 상한(18)보다 한 단계 높은 줌(`TOWER_VIEW_ZOOM` 19 — 포커스 동안만 `setMaxZoom(19)`)으로 줌인. **포커스 동안 dragPan을 잠가 타워를 화면 중심에 고정**하고 줌/회전/피치는 중심(타워) 기준으로만 움직인다. **포커스 동안에만 마우스 전용 동작을 연다**(데스크톱 테스트용): `dragRotate.enable()`(우클릭/ctrl+드래그 궤도 회전), `scrollZoom.enable({ around: "center" })`(휠 줌 중심 고정), `doubleClickZoom.disable()`(커서 기준 줌이라 중심 흘러감). 팝오버가 사라지면(모든 닫힘 경로가 `closePopup` 단일 진입) `cameraSnapshotRef`에 저장해둔 직전 카메라(중심/줌/피치/회전)로 복귀 easeTo 후 `moveend`에서 자동 위치 추적을 원래 값으로 복원 — 포커스 진입 시 `setIsStopFocusMe(true)`를 먼저 호출하지 않으면 다음 위치 갱신에 카메라가 도로 끌려온다. **"위치 옮기기"는 팝오버를 닫고 클릭 이벤트 완료 후(`setTimeout(0)` + `suppressNextClickRef`로 같은 클릭 무시) `startMoving()`** — 같은 클릭이 지도 클릭으로도 전달돼 팝오버 자리로 곧바로 이동되는 버그 방지. **DOM 마커 래퍼에 transform 애니메이션을 걸면 maplibre의 배치용 인라인 transform을 덮어써 좌측상단에 고정되는 함정**이 있으니 애니메이션은 내부 요소에 둘 것. 이동 완료 시 0→목표높이 easeOutCubic 자라남 모션. **공사중 모션(2026-11-20)**: 부하가 1마리라도 붙어 일하는 동안(`attachedKeys.length > 0`) 기초 지반 바깥 테두리에 먼지 구름 8개가 균등배치(+지터)로 계속 피어오르고(`.cat-tower-work-dust` — radial-gradient 뭉게 구름, 2.6s 주기 상승), 망치 1개가 주변(반경 4~8m)을 3.6초마다 돌아다니며 망치질한다(`.cat-tower-work-hammer` — 자리 이동 시 `style.animation` 리셋으로 새 자리에서 처음부터 스윙). 전부 DOM 마커 + CSS 모션, 부하가 없으면 표시 안 함. **낮/밤 팔레트**: `useDayAndNight`로 `isNight` 시 타워 레이어 색을 밝은(발광 느낌) 팔레트로 `setPaintProperty` 교체 — 타워 레이어는 스타일 JSON 다크 오버라이드(`DARK_PAINT_OVERRIDES`) 대상이 아니므로 CatTower가 직접 관리. 타워/기초 지반/발판 클릭은 `queryRenderedFeatures` 히트 판정. **포커스 중 한 손가락 궤도(2026-11-23)**: dragPan이 꺼진 한 손가락 드래그를 캔버스 터치 리스너로 직접 받아 `setBearing`/`setPitch`로 바꾼다(그랩 방식 — 좌우=중심축 궤도 회전, 세로=피치, `FOCUS_ORBIT_*` 상수. 두 손가락은 maplibre 기본에 맡김). **중심 고정(2026-11-23)**: 핀치 줌은 두 손가락 중점 기준이라 카메라 중심이 타워에서 어긋나 궤도 회전축이 흐트러지므로, 포커스 중 `moveend`마다 중심이 `FOCUS_RECENTER_EPS_M`(0.5m) 이상 벗어났으면 현재 줌/피치/회전 유지한 채 타워 중심으로 `easeTo` 되돌린다(팝업 마커가 살아있을 때만 — 복귀 애니메이션과 충돌 방지). **위치 옮기기 진입 시 내 캐릭터 위치로 `easeTo`**(zoom 17/pitch 30 — 타워와 멀어도 캐릭터를 찾아 헤매지 않게). **가지+둥지 높이 보정(2026-11-23)**: `BRANCH_STACK_M`(가지 세그먼트+둥지 두께 합) + 여유가 꼭대기 발판 base(visualHeight) 아래로 들어오는 동안만 가지 생성 — 마지막 발판이 꼭대기 발판과 같은 높이가 되거나 뚫고 나오지 않음(기존 고정 5m headroom은 축소 스케일 계산과 어긋나 뚫림). **꾸미기(2026-11-23)**: 팝업에 꾸미기 버튼 → `CatTowerSheet` `decor` 모드에서 색 테마 선택 — **이때 팝업/타워 포커스를 유지**하고 시트 배경만 옅게(`.decor-overlay`) 깔아 고른 색이 포커스된 타워에 실시간 반영된다. 테마는 `utils/catTowerThemes.ts` `TOWER_THEMES` 13종(원목 + 비비드 무지개 7색 빨주노초파남보 + 파스텔 4색 + 블랙, 각 낮/밤 팔레트. 레이어 초기 색은 add 시점, 이후 변경은 낮/밤 전환 effect가 `setPaintProperty`로 theme 의존 재적용). 색은 Supabase `cat_towers.color`(text, 기본 'oak')에 저장 — SQL은 `supabase/sql/cat_towers_color.sql`(대시보드 실행 후 `pnpm update-types`). 컬럼 추가 전 환경에선 fetch/upsert가 color를 빼고 폴백한다. **로컬 마우스 조작(2026-11-23)**: 맵 기본 설정의 `dragRotate`도 `isDev`에서만 활성(우클릭/ctrl+드래그로 회전·기울기) — 휠 줌(`scrollZoom: isDev`)과 같은 패턴이며 CatTower의 포커스 토글도 이 상태를 기준으로 복원한다. 상태는 **Supabase `cat_towers` 테이블**(`utils/db/catTower.ts`의 fetchCatTowers(목록)/saveCatTower — place/attach/detach/moveTo/완공 시점에만 저장. 컬럼 부재 에러에 따라 id/completed_at → color 3단 폴백, 마이그레이션 전 단일 타워 행은 `t{created_at}` 임시 id). **하단 캣 타워 버튼(2026-11-24)**: badge는 높이가 아니라 보유 타워 수(N동), 클릭은 목록 시트를 연다(타워로 이동하는 동작은 목록 클릭으로 이동). 관리 시트는 `pages/FindCat/CatTowerSheet` (`mode: "list" | "cats" | "decor"`, 딥 바이올렛 + 어두운 반투명 카드/버튼 톤 — 2026-11-20 핑크 톤에서 다듬음) — `list`는 내 캣타워 목록(높이 NumberFlow + 완공(소요시간)/건설중 배지 + "새 캣타워 건설" 버튼은 건설중 타워가 없을 때만), 행 클릭 시 시트를 닫고 해당 타워로 `flyTo` 포커싱. 팝업의 작업고양이 추가(`cats` 모드)는 건설중 타워에만 노출(완공 타워 팝업에선 버튼 숨김). `@types/geojson`은 미설치라 지물 데이터 타입은 CatTower.tsx 내 로컬 정의 사용.
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
