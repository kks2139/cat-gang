import { useQuery } from "@tanstack/react-query";

import { fetchData } from "@/utils/fetch";

import { QUERY_KEY } from "./config";

interface ResponseData {
  id: number;
  name: string;
  createdAt: string;
}

export const useUsersQuery = () => {
  return useQuery({
    enabled: false,
    queryKey: [QUERY_KEY.USERS],
    queryFn: () => {
      return fetchData<ResponseData>({
        method: "GET",
        url: "/api/users",
        params: { id: 1 },
      });
    },
  });
};
