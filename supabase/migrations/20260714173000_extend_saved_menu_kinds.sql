alter type public.menu_kind add value if not exists 'home_bento';

alter table public.saved_menus
  drop constraint if exists saved_menus_image_status_check;

alter table public.saved_menus
  add constraint saved_menus_image_status_check
  check (image_status in ('pending', 'ready', 'failed', 'none'));
