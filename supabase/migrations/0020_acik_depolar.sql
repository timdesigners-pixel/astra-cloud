-- Çerçeveli uygulamaların (Oynatma, Pinterest, Dosya Yöneticisi) herkese açık okunan salt-okunur veri depoları.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('apps', 'apps', true, 52428800, array['application/json']),
  ('dosyalar', 'dosyalar', true, 10485760, array['text/html', 'application/json', 'text/plain', 'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf', 'text/css', 'text/javascript', 'text/markdown'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
