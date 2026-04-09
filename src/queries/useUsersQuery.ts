import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/utils/supabase";

import { QUERY_KEY } from "./config";

interface User {
  id: number;
  name: string;
  crying: string;
  created_at: string;
}

export const useUsersQuery = () => {
  return useQuery({
    enabled: false,
    queryKey: [QUERY_KEY.USERS],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", 1) // 유저 아이디로 교체
        .single<User>();

      if (error) {
        alert(error);
      }

      return data;
    },
  });
};
