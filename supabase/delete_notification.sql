-- Delete own in-app notifications. Idempotent.

create or replace function public.delete_my_notification(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.notifications
  where id = p_notification_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.delete_my_notification(uuid) from public;
grant execute on function public.delete_my_notification(uuid) to authenticated;

drop policy if exists "Notifications delete by owner" on public.notifications;
create policy "Notifications delete by owner"
  on public.notifications for delete
  to authenticated
  using (user_id = auth.uid());
