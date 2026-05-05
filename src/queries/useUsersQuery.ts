import { useQuery } from "@tanstack/react-query";

import { MyCat } from "@/utils/cats";
import { supabase } from "@/utils/db/supabase";
import { UserKey } from "@/utils/native";

import { QUERY_KEY } from "./config";

interface Result {
  id: number;
  name: string;
  crying: string;
  created_at: string;
}

export const useUsersQuery = ({
  enabled = true,
}: { enabled?: boolean } = {}) => {
  const queryData = useQuery({
    enabled,
    queryKey: [QUERY_KEY.USERS],
    queryFn: async () => {
      const userKey = await UserKey.getInstance().getKey();

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("user_id", userKey || "")
        .maybeSingle<Result>();

      if (error) {
        console.error(
          `${error.message}, ${error.cause}, ${error.name}, ${error.code}`,
        );
      }

      if (data) {
        MyCat.getInstance().setMyCat(data.name, data.crying);
      }

      return data;
    },
    staleTime: Infinity,
    retry: false,
  });

  return queryData;
};
