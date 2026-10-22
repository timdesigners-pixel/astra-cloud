# v15.9.1

Dava eşleştirmesi mevcut kayıt RPC’sinin tür / mahkeme / dosya kimliğiyle aynı özeti kullanır; önizlemede mevcut davalar doğru tanınır. 0029 veritabanı göçü eklenmiştir.

Kütüphane dahil kayıt listeleri artık ilk 1.000 satırla sınırlanmaz. Büyük listeler filtreleri koruyarak, kimlikle kararlı sıralanmış sayfalar halinde okunur. 4.207 kayıt, sonraki sayfa hatası ve boş liste testleri eklendi.

Astra Cloud 15.9.0

- Preserves the latest GitHub main branch and its existing migration CLI and tests.
- Adds the System Settings import panel with server-side preview, conflict checks and an atomic financial/legal/library import.
- Repeated imports do not create duplicate records or overwrite changes made by the user.
- Repository snapshots can be prepared outside the repository with tools/build-astra-package.mjs. Personal records are not embedded in this source release or the web bundle.
- The existing debt simulator continues to work before the new migration is applied; imported minimum payments are used after migration 0028.

Live activation requires applying supabase/migrations/0028_astra_os_aktarim.sql with an authorized Supabase connection, publishing the frontend and signing in through the application's PIN screen. This GitHub release does not claim that the live database was migrated. See docs/ASTRA-OS-CANLI-GECIS.md for the exact sequence and source-data mapping limits.
