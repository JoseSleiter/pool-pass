-- Child-only bookings: adults may be 0, but every reservation needs >= 1 person.
alter table public.reservations drop constraint reservations_adults_check;
alter table public.reservations add constraint reservations_adults_check check (adults >= 0);
alter table public.reservations add constraint reservations_party_check check (adults + children >= 1);
