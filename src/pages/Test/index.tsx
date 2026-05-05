import {
  getCurrentLocation,
  startUpdateLocation,
} from "@apps-in-toss/web-framework";

import Button from "@/components/Button";
import { useUsersQuery } from "@/queries/useUsersQuery";
import { initAuth } from "@/utils/db/supabase";
import { getCurrentPosition, UserKey, watchPosition } from "@/utils/native";

export default function Test() {
  const { refetch: fetchUser } = useUsersQuery({ enabled: false });

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
            const res = await UserKey.getInstance().getKey();

            alert(res);
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

        <Button
          onClick={async () => {
            const userKey = await UserKey.getInstance().getKey();
            const token = await initAuth(userKey || "");

            console.log(token);
          }}
        >
          토큰 받기
        </Button>

        <Button
          onClick={async () => {
            fetchUser();
          }}
        >
          유저 조회
        </Button>
      </div>
    </div>
  );
}
