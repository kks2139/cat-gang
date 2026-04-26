import {
  getAnonymousKey,
  getCurrentLocation,
  startUpdateLocation,
} from "@apps-in-toss/web-framework";

import Button from "@/components/Button";
import { getCurrentPosition, watchPosition } from "@/utils/native";

export default function Test() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        rowGap: "10px",
        padding: "10px",
      }}
    >
      <h1 style={{ fontWeight: "bold", fontSize: "20px" }}>테스트 페이지</h1>

      <div>
        <Button
          onClick={async () => {
            try {
              const res = await getAnonymousKey();

              if (!res) {
                alert("지원하지 않는 앱 버전이에요.");
                return;
              }

              if (res === "ERROR") {
                alert("사용자 키 조회 중 오류가 발생했어요.");
                return;
              }

              if (res.type === "HASH") {
                alert(`사용자 키: ${res.hash}`);
                // 여기에서 사용자 키를 사용해 데이터를 관리할 수 있어요.
              }
            } catch (e) {
              const err = e as Error;

              alert(`${err.name} : ${err.message}`);
            }
          }}
        >
          {"getAnonymousKey()"}
        </Button>

        <Button
          onClick={async () => {
            const res = await getCurrentLocation.getPermission();

            alert(res);

            getCurrentLocation.openPermissionDialog();
          }}
        >
          {"getCurrentLocation permission"}
        </Button>

        <Button
          onClick={async () => {
            const res = await startUpdateLocation.getPermission();

            alert(res);

            startUpdateLocation.openPermissionDialog();
          }}
        >
          {"startUpdateLocation permission"}
        </Button>

        <Button
          onClick={async () => {
            const res = await getCurrentPosition();

            alert(`${res?.latitude}, ${res?.longitude}`);
          }}
        >
          {"getCurrentLocation()"}
        </Button>

        <Button
          onClick={async () => {
            const cancelWatch = await watchPosition((coords) => {
              alert(`${coords.latitude}, ${coords.longitude}`);
            });

            setTimeout(() => {
              // cancelWatch?.();
              console.log(cancelWatch);
            }, 2000);
          }}
        >
          {"watchPosition()"}
        </Button>
      </div>
    </div>
  );
}
