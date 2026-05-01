import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/utils/db/supabase";
import { UserKey } from "@/utils/native";

import { QUERY_KEY } from "./config";

interface ResponseData {
  gukbab: number;
  fish: number;
  catnip: number;
}

export const useItemQuery = () => {
  const queryData = useQuery({
    queryKey: [QUERY_KEY.ITEMS],
    queryFn: async () => {
      const userKey = await UserKey.getInstance().getKey();

      const { data, error } = await supabase
        .from("items")
        .select("gukbab, fish, catnip")
        .eq("user_id", userKey || "")
        .maybeSingle<ResponseData>();

      if (error) {
        console.error(
          `${error.message}, ${error.cause}, ${error.name}, ${error.code}`,
        );
      }

      return data;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  return queryData;
};
