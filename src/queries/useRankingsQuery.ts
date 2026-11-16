import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/utils/db/supabase";
import { UserKey } from "@/utils/native";

import { QUERY_KEY } from "./config";

export interface RankingRow {
  user_id: string;
  name: string;
  /** 서로 다른 잡은 고양이 수 (도감 수집률 = book_count / 31) */
  book_count: number;
  /** 잡은 고양이 총 마릿수 */
  minion_count: number;
  /** 총 누적 산책 거리 (m) */
  total_distance: number;
}

export interface RankingsData {
  rows: RankingRow[];
  /** 내 유저 키 (랭킹에서 내 행 하이라이트용) */
  myUserId: string;
}

export const useRankingsQuery = ({
  enabled = true,
}: { enabled?: boolean } = {}) => {
  return useQuery<RankingsData>({
    enabled,
    queryKey: [QUERY_KEY.RANKINGS],
    queryFn: async () => {
      const userKey = await UserKey.getInstance().getKey();

      const { data, error } = await supabase.rpc("get_rankings");

      if (error) {
        console.error(error);
      }

      return {
        rows: (data ?? []) as unknown as RankingRow[],
        myUserId: userKey || "",
      };
    },
    staleTime: 1000 * 60,
    retry: 1,
  });
};
