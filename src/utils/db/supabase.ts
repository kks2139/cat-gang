import { createClient } from "@supabase/supabase-js";

import { UserKey } from "../native";
import type { Database } from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// 인증 토큰 요청을 위한 별도의 클라이언트 (무한 루프 방지)
const authClient = createClient<Database>(supabaseUrl, supabasePublishableKey);

let accessToken: string | null = null;

const isTokenExpired = (token: string) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const now = Math.floor(Date.now() / 1000);

    return payload.exp - now < 60;
  } catch {
    return true;
  }
};

const fetchToken = async (): Promise<string | null> => {
  const userKey = await UserKey.getInstance().getKey();

  if (!userKey) {
    return null;
  }

  // authClient를 사용하여 재귀 호출 방지
  const { data, error } = await authClient.functions.invoke("auth", {
    body: { userKey },
  });

  if (error) {
    console.error("Failed to invoke auth function:", error);
    throw error;
  }

  if (!data?.token) {
    throw new Error("No token returned from auth function");
  }

  return data.token as string;
};

export const supabase = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
  {
    accessToken: async () => {
      if (!accessToken || isTokenExpired(accessToken)) {
        accessToken = await fetchToken();
      }

      return accessToken ?? "";
    },
  },
);

// 앱 시작 시 호출하는 초기화 함수
export const initAuth = async () => {
  accessToken = await fetchToken();

  return accessToken;
};

