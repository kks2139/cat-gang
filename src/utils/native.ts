import {
  Accuracy,
  getCurrentLocation,
  type LocationCoords,
  startUpdateLocation,
  StartUpdateLocationPermissionError,
} from "@apps-in-toss/web-framework";

import { wait } from "./helper";

export const getCurrentPosition = async () => {
  try {
    let status = await getCurrentLocation.getPermission();

    if (status !== "allowed") {
      const result = await getCurrentLocation.openPermissionDialog();

      if (result === "allowed") {
        status = "allowed";
      } else {
        await wait(500);
        status = await getCurrentLocation.getPermission();
      }
    }

    if (status !== "allowed") {
      console.warn("Location permission not granted by user.");
      return;
    }

    const response = await getCurrentLocation({
      accuracy: Accuracy.BestForNavigation,
    });

    return response.coords;
  } catch (error: unknown) {
    if (error instanceof StartUpdateLocationPermissionError) {
      console.error("위치 권한이 필요합니다. 설정에서 허용해주세요.");
    }
  }
};

export const watchPosition = async (
  onChanged: (coords: LocationCoords) => void,
) => {
  try {
    let status = await startUpdateLocation.getPermission();

    if (status !== "allowed") {
      const result = await startUpdateLocation.openPermissionDialog();

      if (result === "allowed") {
        status = "allowed";
      } else {
        await wait(500);
        status = await startUpdateLocation.getPermission();
      }
    }

    if (status !== "allowed") {
      return;
    }

    const unsubscribe = startUpdateLocation({
      options: {
        accuracy: Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 5,
      },
      onEvent: (location) => {
        onChanged(location.coords);
      },
      onError: (error) => {
        if (error instanceof StartUpdateLocationPermissionError) {
          console.error("watchPosition error:", error);
        }
      },
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  } catch (error) {
    console.error("watchPosition setup error:", error);
  }
};
