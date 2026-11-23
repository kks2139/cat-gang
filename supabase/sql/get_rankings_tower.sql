-- 랭킹 RPC에 캣 타워 지표 추가 (2026-11-24)
-- get_rankings에 tower_height(총 타워 높이 합), tower_count(보유 타워 수)를 추가한다.
-- Supabase 대시보드 SQL 에디터에서 실행 후 `pnpm update-types`로 types.ts 재생성.
--
-- 주의: 기존 함수와 반환 타입이 달라지므로 drop 후 재생성한다.
-- 타워 높이는 height_at 스냅샷 기준(붙이기/떼기/이동/완공 시점 저장)이라
-- 스냅샷 사이의 성장은 랭킹에 늦게 반영된다.

drop function if exists public.get_rankings();

create function public.get_rankings()
returns table (
  user_id text,
  name text,
  book_count bigint,
  minion_count bigint,
  total_distance numeric,
  tower_height numeric,
  tower_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    u.user_id,
    u.name,
    (
      select count(distinct oc.cat_name)
      from public.own_cats oc
      where oc.user_id = u.user_id
    )::bigint as book_count,
    (
      select count(oc.cat_name)
      from public.own_cats oc
      where oc.user_id = u.user_id
    )::bigint as minion_count,
    u.total_distance::numeric as total_distance,
    (
      select coalesce(sum(ct.height_at), 0)
      from public.cat_towers ct
      where ct.user_id = u.user_id
    )::numeric as tower_height,
    (
      select count(*)
      from public.cat_towers ct
      where ct.user_id = u.user_id
    )::bigint as tower_count
  from public.users u;
$$;

grant execute on function public.get_rankings() to anon, authenticated;
