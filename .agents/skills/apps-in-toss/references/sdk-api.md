# 앱인토스 Client SDK 도메인 API 레퍼런스

`@apps-in-toss/web-framework`에서 제공하는 도메인 기반 Client SDK API 명세 및 예제 코드 모음입니다.

---

## 1. User (사용자)

사용자를 식별하거나 동의 기반 개인정보, 연령 범위를 조회합니다.

### 1-1. `User.getAnonymousKey()`
비로그인 상태에서도 사용자를 구분할 수 있는 고유 익명 해시 키를 반환합니다.
- **반환값**: `Promise<{ hash: string; type: 'HASH' }>`
- **최소 지원 버전**: 토스앱 5.232.0 이상

```typescript
import { User } from '@apps-in-toss/web-framework';

async function initUser() {
  try {
    const { hash } = await User.getAnonymousKey();
    console.log('익명 사용자 식별키:', hash);
    return hash;
  } catch (error) {
    console.error('사용자 키 발급 실패:', error);
  }
}
```

### 1-2. `User.getConsentedData()`
사용자가 사전에 동의한 개인정보 데이터를 가져옵니다.

### 1-3. `User.getDeclaredAgeRange()`
사용자의 선언된 연령대 정보(iOS 등)를 조회합니다.

---

## 2. Storage (로컬 스토리지)

모바일 기기 로컬에 문자열 데이터를 안전하게 보관하고 읽습니다. SDK 3.x 마이그레이션 환경 및 웹뷰 샌드박스에서 안정적인 데이터 유지를 위해 `localStorage` 대신 권장됩니다.

```typescript
import { Storage } from '@apps-in-toss/web-framework';

// 데이터 저장
await Storage.setItem({ key: 'settings', value: JSON.stringify({ bgm: true, vibration: true }) });

// 데이터 조회
const dataStr = await Storage.getItem({ key: 'settings' });
const settings = dataStr ? JSON.parse(dataStr) : null;

// 특정 키 삭제
await Storage.removeItem({ key: 'settings' });

// 전체 데이터 삭제
await Storage.clearItems();
```

---

## 3. Screen (화면 제어)

화면 닫기, 꺼짐 방지, 캡처 차단, 화면 회전, 스와이프 뒤로가기를 제어합니다.

```typescript
import { Screen } from '@apps-in-toss/web-framework';

// 1. 미니앱 화면 닫기 (종료)
await Screen.close();

// 2. 화면 항상 켜짐 (게임/영상 재생 중 화면 꺼짐 방지)
await Screen.setAwakeMode({ enabled: true });

// 3. 보안 모드 (화면 캡처/녹화 차단)
await Screen.setSecure({ enabled: true });

// 4. iOS 스와이프 뒤로가기 제스처 활성화/비활성화
await Screen.setIosSwipeBack({ enabled: false });

// 5. 화면 방향 설정 ('portrait' | 'landscape' | 'unspecified')
await Screen.setOrientation({ orientation: 'portrait' });
```

---

## 4. SafeArea (안전영역)

노치, 카메라 홀, Dynamic Island, 하단 홈 인디케이터 등으로 인해 화면이 가려지지 않도록 패딩 값을 조회하고 변경을 구독합니다.

```typescript
import { SafeArea } from '@apps-in-toss/web-framework';

// 단건 조회
const insets = await SafeArea.get();
// insets: { top: number; bottom: number; left: number; right: number }

// 변경 실시간 구독 (화면 회전이나 인셋 변화 시 호출)
const unsubscribe = SafeArea.subscribe((insets) => {
  document.documentElement.style.setProperty('--safe-area-top', `${insets.top}px`);
  document.documentElement.style.setProperty('--safe-area-bottom', `${insets.bottom}px`);
});

// 컴포넌트 언마운트 시
// unsubscribe();
```

---

## 5. NavigationBar & Partner (상단 바 커스터마이징)

상단 네비게이션 바는 기본으로 제공되며, 우측에 1개의 모노톤 액세서리 버튼을 동적으로 추가할 수 있습니다.

```typescript
import { partner, tdsEvent } from '@apps-in-toss/web-framework';

// 액세서리 버튼 등록 (모노톤 아이콘만 허용)
partner.addAccessoryButton({
  id: 'my-ranking-btn',
  title: '랭킹',
  icon: {
    name: 'icon-trophy-mono',
  },
});

// 버튼 클릭 이벤트 리스너 등록
const cleanup = tdsEvent.addEventListener('navigationAccessoryEvent', {
  onEvent: ({ id }) => {
    if (id === 'my-ranking-btn') {
      // 랭킹 모달 열기 등 액션 수행
    }
  },
});

// 페이지 이탈 시 정리
window.addEventListener('pagehide', () => {
  cleanup();
});
```

---

## 6. TossAuth (토스 로그인 & 인증)

토스 계정으로 로그인하거나 서명 검증을 진행합니다.

```typescript
import { TossAuth } from '@apps-in-toss/web-framework';

// 토스 로그인 연동 여부 확인
const { isIntegrated } = await TossAuth.isIntegrated();

// 토스 로그인 실행 (인가 코드 발급)
const { code } = await TossAuth.login();
// 발급된 인가 코드를 파트너사 서버로 전달하여 AccessToken 교환
```

---

## 7. TossPay & IAP (결제)

> ⚠️ **결제 수단 구분 원칙 (필수 준수)**:
> - **실물 상품/배송 상품**: `TossPay` 사용 (토스페이먼츠 PG 및 타사 결제 금지)
> - **디지털 상품/인앱 재화/구독**: `IAP` (인앱 결제) 사용

### 7-1. TossPay (실물 결제)
```typescript
import { TossPay } from '@apps-in-toss/web-framework';

// 단건 결제 인증창 호출
const authResult = await TossPay.authorize({
  payToken: 'SERVER_GENERATED_PAY_TOKEN',
});

// 정기 결제 인증창 호출
const subResult = await TossPay.authorizeSubscription({
  subscriptionToken: 'SERVER_GENERATED_SUB_TOKEN',
});
```

### 7-2. IAP (인앱 결제)
```typescript
import { IAP } from '@apps-in-toss/web-framework';

// 1. 판매 상품 목록 조회
const products = await IAP.getProductItemList();

// 2. 단건 상품 구매 주문 생성
const order = await IAP.createOneTimePurchaseOrder({
  sku: 'item_gem_100',
  orderId: 'partner_order_12345',
});

// 3. 상품 지급 완료 처리 (반드시 지급 후 호출해야 완료됨)
await IAP.completeProductGrant({
  orderId: order.orderId,
});
```

---

## 8. TossAds & GoogleAdMob (인앱 광고)

광고는 반드시 **사전 로딩(Pre-load)** 후 적절한 시점에 표시하며, 광고 재생 중에는 앱 내 배경음악을 일시정지해야 합니다.

```typescript
import { TossAds } from '@apps-in-toss/web-framework';

// 1. 전면형/보상형 광고 사전 로딩
await TossAds.loadFullScreenAd({
  placementId: 'AD_PLACEMENT_ID',
});

// 2. 광고 재생 (사용자가 보상 획득 행동을 명확히 인지했을 때)
const result = await TossAds.showFullScreenAd({
  placementId: 'AD_PLACEMENT_ID',
});

if (result.rewarded) {
  // 보상 지급 로직 실행
}
```

---

## 9. Analytics (행동 로그 & 지표 수집)

```typescript
import { Analytics } from '@apps-in-toss/web-framework';

// 화면 진입
Analytics.screen({ screenName: 'MainLobby' });

// 버튼 클릭
Analytics.click({ buttonName: 'GameStart' });

// 노출 감지
Analytics.impression({ itemName: 'Banner_SpecialPromo' });

// 커스텀 이벤트 로그
Analytics.log({
  eventName: 'stage_clear',
  parameters: { stage: 3, score: 2500 },
});
```

---

## 10. Share (공유)

공유 딥링크는 반드시 `intoss://` 스킴을 사용합니다 (`intoss-private://` 사용 금지).

```typescript
import { Share } from '@apps-in-toss/web-framework';

// 메시지 공유창 띄우기
await Share.sendMessage({
  title: '냥만시대 함께해요!',
  text: '지금 고양이 영역을 확장하고 선물을 받아보세요.',
  link: 'intoss://cat-gang/invite?ref=user123',
});

// 토스 공유 링크 생성
const { url } = await Share.createLink({
  path: '/invite',
  params: { ref: 'user123' },
});
```

---

## 11. Device & Permissions (기기 기능 및 권한)

```typescript
import { Device, Permissions } from '@apps-in-toss/web-framework';

// 햅틱 진동 피드백
await Device.triggerHaptic({ type: 'success' }); // 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'

// 권한 확인 및 요청
const hasLocationPermission = await Permissions.getPermission({ name: 'geolocation' });
if (!hasLocationPermission) {
  await Permissions.requestPermission({ name: 'geolocation' });
}

// 위치 정보 조회
const location = await Device.getLocation();

// 외부 URL 열기 (법률 고지 등 허용된 외부 링크에 한함)
await Device.openURL({ url: 'https://terms.example.com/privacy' });
```

---

## 12. Review & Notification & Promotion

```typescript
import { Review, Notification, Promotion } from '@apps-in-toss/web-framework';

// 인앱 리뷰 요청 (사용자가 만족을 느낀 긍정적 시점에만 호출)
await Review.request();

// 알림 수신 동의 요청 (진입 즉시 금지, 맥락 있는 시점에 호출)
await Notification.requestAgreement();

// 프로모션 친구 초대 창 열기
await Promotion.openContactsInvite({
  promotionId: 'PROMO_123',
});
```
