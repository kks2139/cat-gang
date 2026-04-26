import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/utils/db/supabase";
import { UserKey } from "@/utils/native";

import { QUERY_KEY } from "./config";

export const useMyCatsQuery = () => {
  return useQuery({
    queryKey: [QUERY_KEY.MY_CATS],
    queryFn: async () => {
      const userKey = await UserKey.getInstance().getKey();

      const { data, error } = await supabase
        .from("own_cats")
        .select("cat_name, position, created_at")
        .eq("user_id", userKey || "");

      if (error) {
        alert(error);
      }

      return data;
    },
    staleTime: 1000 * 60 * 5, // 5분
    retry: 1,
  });
};
