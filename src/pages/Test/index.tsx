import { Device } from "@apps-in-toss/web-framework";

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
            const res = await Device.getLocation.getPermission();

            alert(res);

            Device.getLocation.openPermissionDialog();
          }}
        >
          {"Device.getLocation permission"}
        </Button>

        <Button
          onClick={async () => {
            const res = await Device.subscribeLocation.getPermission();

            alert(res);

            Device.subscribeLocation.openPermissionDialog();
          }}
        >
          {"Device.subscribeLocation permission"}
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
            initAuth();
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
