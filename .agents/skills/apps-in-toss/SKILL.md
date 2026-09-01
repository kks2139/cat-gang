---
name: apps-in-toss
description: >-
  앱인토스(Apps in Toss, AIT) 미니앱 개발, 수정, 기능 추가, UI/UX 디자인, SDK 연동 및 심사 준비 시 사용하는 가이드입니다.
  토스 앱인토스 프로젝트 작업 시작 전 반드시 확인해야 하는 아키텍처 원칙, SDK 3.x/2.x 표준 API 사용법, UI/UX 및 다크패턴 방지 정책,
  UX 라이팅 규칙(해요체), 네비게이션/SafeArea 처리, 배포 및 심사 체크리스트를 제공합니다.
---

# 앱인토스 (Apps in Toss) 개발 종합 가이드

앱인토스(AIT) 플랫폼에서 실행되는 웹뷰 기반 미니앱을 개발·수정할 때 AI와 개발자가 작업 시작 전 항상 확인하고 준수해야 하는 핵심 지침입니다.

---

## ⚡ 작업 시작 전 필수 점검 (Pre-Task Checklist)

모든 작업(코드 생성, 수정, 리팩토링, 기획 등) 전에 아래 7가지 핵심 원칙을 먼저 확인하세요:

1. **렌더링 방식 확인**: SSR(서버사이드 렌더링)은 절대 사용할 수 없습니다. 반드시 **CSR(Client-Side Rendering)** 또는 **SSG(정적 사이트 생성)**로 구현해야 합니다.
2. **보안 및 스크립트 실행 제한**: `eval()`, 외부 동적 스크립트 삽입, `window.location.replace`를 통한 임의 외부 리다이렉트는 금지됩니다.
3. **스토리지 및 식별자**:
   - 사용자 식별은 `User.getAnonymousKey()` 또는 토스 로그인(`TossAuth.login()`)을 사용합니다.
   - 영속 데이터는 `@apps-in-toss/web-framework`의 `Storage` API(`Storage.getItem`, `Storage.setItem`)를 사용합니다.
4. **결제 및 광고 수단 규정**:
   - 디지털/가상 상품(인앱 아이템, 구독, 재화 등) → **인앱 결제 (`IAP`)**만 허용
   - 실물 상품/서비스 배송 → **토스페이 (`TossPay`)**만 허용 (타사 PG, 일반 카드결제 금지)
   - 광고 → **앱인토스 공식 광고 (`TossAds`)**만 허용 (외부 광고 SDK 직접 탑재 금지)
5. **다크패턴 절대 금지**:
   - 앱 진입 즉시 바텀시트/팝업 띄우기 금지
   - 뒤로가기 시 이탈 방지용 바텀시트/팝업 금지
   - 나갈 수 없는 닫기 버튼 없는 화면(트랩) 금지 (다이얼로그 취소 버튼은 항상 **'닫기'**로 명시)
   - 행동 유도 없는 모호한 CTA 또는 뜬금없는 전면 광고 노출 금지
6. **UX 라이팅 (토스 톤앤매너)**:
   - **해요체 100% 필수** (`~합니다/하십시오` ❌ ➔ `~해요/~해 보세요` ⭕)
   - 능동형 및 긍정형 문장 위주 작성 (`~되었어요` ❌ ➔ `~했어요` ⭕, `안 돼요` ❌ ➔ `~하면 할 수 있어요` ⭕)
   - 불필요한 과도한 경어 및 한자어 나열 지양 (`~시겠어요?` ❌ ➔ `~해요` ⭕)
7. **Safe Area & 테마**:
   - 상단 노치/Dynamic Island 및 하단 홈 바 영역 침범 방지 (`SafeArea` API 또는 SafeArea 대응 레이아웃 적용)
   - 미니앱 기본 테마는 **라이트 모드(Light Mode)**를 기준으로 구현

---

## 🛠️ 기술 스택 & 설정 파일 표준

### 1. 설정 파일 버전별 규격

앱인토스는 **SDK 3.x**와 **SDK 2.x (Granite)**가 존재합니다:

| 항목 | SDK 2.x (Legacy Granite) | SDK 3.x (최신 표준) |
| :--- | :--- | :--- |
| **설정 파일명** | `granite.config.ts` | `apps-in-toss.config.ts` |
| **브랜드 설정** | `brand: { displayName, primaryColor, icon }` | `brand: { primaryColor }` (콘솔에서 이름/아이콘 관리) |
| **웹뷰 옵션** | `webViewProps: { type: 'game' \| 'partner', ... }` | `webView: { ... }` (`type` 속성 삭제) |
| **빌드 산출물 폴더** | `outdir: 'dist'` | `webBundleDir: 'dist'` |
| **빌드/실행 커맨드** | `granite.config.ts` 내 `web.commands` | `package.json` 스크립트로 이동 (`vite build && ait build`) |
| **로컬 테스트** | 샌드박스 앱 연동 | 로컬 브라우저 + `@apps-in-toss/devtools` 플러그인 |

#### SDK 3.x 표준 `apps-in-toss.config.ts` 예시
```typescript
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'my-app',
  brand: {
    primaryColor: '#3182F6',
  },
  webView: {
    bounces: true,
    pullToRefreshEnabled: true,
    overScrollMode: 'never',
  },
  navigationBar: {
    withBackButton: true,
    withHomeButton: false,
    withTitle: true,
  },
  permissions: [],
  webBundleDir: 'dist',
});
```

---

## 📦 Client SDK 핵심 API 요약 (`@apps-in-toss/web-framework`)

자세한 API 목록과 예제 코드는 [상세 SDK API 레퍼런스](./references/sdk-api.md)를 참고하세요.

### 1. 사용자 식별 (`User`)
```typescript
import { User } from '@apps-in-toss/web-framework';

// 비로그인 익명 고유 식별키 조회
const { hash, type } = await User.getAnonymousKey();
```

### 2. 기기 로컬 스토리지 (`Storage`)
브라우저 `localStorage` 대신 SDK `Storage`를 사용하면 버전 마이그레이션 및 앱인토스 샌드박스 환경에서 데이터가 안전하게 보존됩니다.
```typescript
import { Storage } from '@apps-in-toss/web-framework';

await Storage.setItem({ key: 'user_score', value: JSON.stringify({ score: 100 }) });
const scoreData = await Storage.getItem({ key: 'user_score' });
await Storage.removeItem({ key: 'user_score' });
```

### 3. 화면 제어 (`Screen`) & 안전영역 (`SafeArea`)
```typescript
import { Screen, SafeArea } from '@apps-in-toss/web-framework';

// 화면 닫기
await Screen.close();

// Safe Area 여백 조회 및 구독
const insets = await SafeArea.get(); // { top, bottom, left, right }
const unsubscribe = SafeArea.subscribe((insets) => {
  console.log('Safe area changed:', insets);
});
```

### 4. 네비게이션 바 커스텀 (`NavigationBar` & `partner`)
- 상단 네비게이션 바는 기본으로 제공되며, 우측에 더보기(⋯), 닫기(X)가 배치됩니다.
- 우측 액세서리 버튼은 **모노톤 아이콘 1개만** 추가 가능합니다.
```typescript
import { partner, tdsEvent } from '@apps-in-toss/web-framework';

partner.addAccessoryButton({
  id: 'bookmark',
  title: '북마크',
  icon: { name: 'icon-bookmark-mono' },
});

const cleanup = tdsEvent.addEventListener('navigationAccessoryEvent', {
  onEvent: ({ id }) => {
    if (id === 'bookmark') {
      // 액션 실행
    }
  },
});
```

### 5. 공유 (`Share`)
- 공유 링크는 반드시 `intoss://` 스킴을 사용해야 합니다 (`intoss-private://` ❌).
```typescript
import { Share } from '@apps-in-toss/web-framework';

await Share.sendMessage({
  title: '친구야 같이 하자!',
  text: '지금 접속하면 특별 선물을 드려요.',
  link: 'intoss://cat-gang/invite?code=ABC123',
});
```

---

## 🎨 UI/UX & 다크패턴 방지 규칙

자세한 디자인 가이드와 토스 디자인 시스템(TDS) 정보는 [UI/UX & 브랜딩 상세 가이드](./references/ux-guidelines.md)를 참고하세요.

### 1. 절대 금지되는 5대 다크패턴
1. **진입 즉시 바텀시트/팝업 노출**: 서비스 로딩 직후 마케팅/알림 동의 바텀시트 금지.
2. **뒤로가기 방해 바텀시트**: 사용자가 뒤로가기를 누를 때 이탈 방지용 동의/혜택 바텀시트 금지.
3. **선택지 박탈 (트랩 화면)**: 오직 1개의 버튼만 두고 닫거나 거절할 수 없게 만드는 UI 금지.
4. **예상치 못한 광고**: 혜택 받기 버튼을 눌렀는데 사전 고지 없이 전면 광고가 뜨는 동작 금지 (광고 시청 여부를 명확히 인지시켜야 함).
5. **모호한 CTA**: '확인', '계속' 등 버튼 클릭 시 무엇이 일어나는지 모호한 라벨 금지 ➔ '쿠폰 받기', '결제하기', '결과 확인하기'처럼 명확하게 작성.

### 2. 하단 탭바 규칙
- 탭바를 구성할 때는 토스 메인 하단 탭과 혼동되지 않도록 **플로팅(Floating) 탭바 형태**로 구현합니다.
- 탭 개수는 최소 2개 ~ 최대 5개로 제한합니다.

---

## ✍️ UX 라이팅 가이드 (토스 보이스앤톤)

1. **해요체 필수 적용**:
   - `완료되었습니다` ❌ ➔ `완료했어요` ⭕
   - `확인하십시오` ❌ ➔ `확인해 보세요` ⭕
   - `접수되었습니다` ❌ ➔ `접수했어요` ⭕
2. **능동적이고 간결한 표현**:
   - `~되었어요` ❌ ➔ `~했어요` ⭕
   - `~되어요` ❌ ➔ `~돼요` ⭕
   - `~시겠어요?`, `~시나요?`, `~께` ❌ ➔ `~해요`, `~에게` ⭕
3. **긍정적 커뮤니케이션**:
   - `조회된 내역이 없습니다` ❌ ➔ `아직 내역이 없어요` ⭕
   - `결제할 수 없습니다` ❌ ➔ `결제 수단을 등록하면 결제할 수 있어요` ⭕
4. **다이얼로그 버튼 라벨**:
   - 취소/닫기 성격의 왼쪽 버튼은 **'닫기'**로 표기 (사용자가 진행 중인 작업 전체가 취소된다고 오해하는 것을 방지).

---

## 📋 출시 및 심사 정책 (Policies & Checklist)

자세한 카테고리별 정책(게임, 비게임, 만남, 중고거래 등)은 [정책 & 심사 체크리스트](./references/policies-and-checklist.md)를 참고하세요.

- **외부 앱 설치 유도 금지**: "자사 전용 앱을 설치하면 더 많은 기능 제공" 등의 문구 및 링크 금지.
- **외부 웹 결제 링크 금지**: 앱인토스 내에서 모든 결제/기능 흐름이 완결되어야 함.
- **생성형 AI 사용 시 의무**:
  - 서비스 진입 또는 최초 AI 기능 사용 시 사전 고지 필수.
  - 생성된 결과물에 AI 산출물임을 나타내는 뱃지/라벨/워터마크 표시 필수.
- **안드로이드 하드웨어 백버튼**: 백버튼 터치 시 뒤로가기 또는 정상 종료 처리.

---

## 📚 상세 레퍼런스 문서 목록

- [SDK API 레퍼런스 (도메인별 상세 API)](./references/sdk-api.md)
- [UI/UX 디자인 및 UX 라이팅 가이드](./references/ux-guidelines.md)
- [서비스 오픈 정책 및 출시 체크리스트](./references/policies-and-checklist.md)
