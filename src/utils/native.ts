import {
  Accuracy,
  Device,
  GetCurrentLocationPermissionError,
  type LocationCoords,
  StartUpdateLocationPermissionError,
  User,
} from "@apps-in-toss/web-framework";

import { isDev, operEnv } from "./constants";
import { wait } from "./helper";

export class UserKey {
  private static instance: UserKey;
  private key: string;

  private constructor() {
    this.key = "";
  }

  static getInstance() {
    if (!UserKey.instance) {
      UserKey.instance = new UserKey();
    }

    return UserKey.instance;
  }

  async getKey() {
    if (this.key) {
      return this.key;
    }

    if (!operEnv) {
      return "test";
    }

    try {
      // v3: 성공 시 { type: 'HASH', hash }, 실패 시 throw (UNSUPPORTED_APP_VERSION / UNKNOWN_ERROR)
      const res = await User.getAnonymousKey();

      this.key = res.hash;

      return this.key;
    } catch (e) {
      const err = e as Error;

      console.error(`${err.name} : ${err.message}`);
    }
  }
}

let mockLocation: LocationCoords | null = null;

export const setMockLocation = (lat: number, lng: number) => {
  if (!isDev) {
    return;
  }

  mockLocation = {
    latitude: lat,
    longitude: lng,
    altitude: 0,
    accuracy: 0,
    altitudeAccuracy: 0,
    heading: 0,
  } as LocationCoords;
};

const getGeolocation = () => {
  return new Promise<LocationCoords | undefined>((res) => {
    navigator.geolocation.getCurrentPosition(
      (e) => {
        const { latitude, longitude } = e.coords;

        res({
          latitude,
          longitude,
          altitude: 0,
          accuracy: 0,
          altitudeAccuracy: 0,
          heading: 0,
        });
      },
      () => res(undefined),
      { enableHighAccuracy: true },
    );
  });
};

export const getCurrentPosition = async () => {
  if (mockLocation) {
    return mockLocation;
  }

  if (!operEnv) {
    return await getGeolocation();
  }

  try {
    let status = await Device.getLocation.getPermission();

    if (status !== "allowed") {
      const result = await Device.getLocation.openPermissionDialog();

      if (result === "allowed") {
        status = "allowed";
      } else {
        await wait(500);
        status = await Device.getLocation.getPermission();
      }
    }

    if (status !== "allowed") {
      console.warn("Location permission not granted by user.");
      return;
    }

    const response = await Device.getLocation({
      accuracy: Accuracy.BestForNavigation,
    });

    return response.coords;
  } catch (error: unknown) {
    if (error instanceof GetCurrentLocationPermissionError) {
      console.error("위치 권한이 필요합니다. 설정에서 허용해주세요.");
    }

    console.error("Device.getLocation 에러:", error);
  }
};

export const watchPosition = async (
  onChanged: (coords: LocationCoords) => void,
) => {
  try {
    let status = await Device.subscribeLocation.getPermission();

    if (status !== "allowed") {
      const result = await Device.subscribeLocation.openPermissionDialog();

      if (result === "allowed") {
        status = "allowed";
      } else {
        await wait(500);
        status = await Device.subscribeLocation.getPermission();
      }
    }

    if (status !== "allowed") {
      return;
    }

    const unsubscribe = Device.subscribeLocation({
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
          console.error("Device.subscribeLocation onError:", error);
        }
      },
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  } catch (error) {
    console.error("Device.subscribeLocation 에러:", error);
  }
};
