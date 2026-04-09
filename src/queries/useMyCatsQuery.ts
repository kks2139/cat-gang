import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/utils/db/supabase";

import { QUERY_KEY } from "./config";

export const useMyCatsQuery = () => {
  return useQuery({
    queryKey: [QUERY_KEY.MY_CATS],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("own_cats")
        .select("cat_name, position, created_at")
        .eq("user_id", 1);

      if (error) {
        alert(error);
      }

      return data;
    },
    staleTime: 1000 * 60 * 5,
  });
};
