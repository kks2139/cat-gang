import {
  getCurrentLocation,
  startUpdateLocation,
} from "@apps-in-toss/web-framework";

import Button from "@/components/Button";
import { getCurrentPosition, UserKey, watchPosition } from "@/utils/native";

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
      </div>
    </div>
  );
}
