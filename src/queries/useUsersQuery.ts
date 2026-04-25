import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/utils/db/supabase";

import { QUERY_KEY } from "./config";

interface Result {
  id: number;
  name: string;
  crying: string;
  created_at: string;
}

export const useUsersQuery = () => {
  return useQuery({
    queryKey: [QUERY_KEY.USERS],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", 1) // TODO: 유저 아이디로 교체
        .single<Result>();

      if (error) {
        alert(error);
      }

      return data;
    },
    staleTime: Infinity,
  });
};
