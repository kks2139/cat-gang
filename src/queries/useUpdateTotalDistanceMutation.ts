import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/utils/db/supabase";
import { UserKey } from "@/utils/native";

interface RequestData {
  distance: number;
}

/**
 * 총 산책거리(m)를 서버에 동기화한다.
 * RPC가 greatest(total_distance, p_distance)로 갱신하므로 절대값 전송에도
 * 멱등하고 값이 줄지 않는다.
 */
export const useUpdateTotalDistanceMutation = () => {
  return useMutation<undefined, Error, RequestData>({
    mutationFn: async ({ distance }) => {
      const userKey = await UserKey.getInstance().getKey();

      const { error } = await supabase.rpc("update_total_distance", {
        p_user_id: userKey || "",
        p_distance: distance,
      });

      if (error) {
        throw error;
      }

      return undefined;
    },
    retry: false,
  });
};
