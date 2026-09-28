-- Close the booking capacity race: a before-insert trigger locks the event's
-- row and rejects the insert when the event already has `capacity` bookings,
-- so two concurrent requests can't both take the last seat.

create or replace function public.enforce_booking_capacity()
returns trigger
language plpgsql
as $$
declare
  event_capacity integer;
begin
  select capacity into event_capacity
    from public.events
   where id = new.event_id
     for update;

  if event_capacity is not null then
    if (select count(*) from public.bookings where event_id = new.event_id) >= event_capacity then
      raise exception 'event_fully_booked';
    end if;
  end if;

  return new;
end;
$$;

create trigger bookings_enforce_capacity
  before insert on public.bookings
  for each row execute function public.enforce_booking_capacity();
