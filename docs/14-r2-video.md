# 14 — Cloudflare R2 видео дамжуулалт (HLS + Worker)

FLIMIX-ийн кинонууд ffmpeg-ээр HLS болгон хөрвүүлэгдэж, **PRIVATE** Cloudflare R2
bucket-д хадгалагдана. Үзэгчид рүү Cloudflare Worker (`workers/r2-video/`)
дамжуулж өгөх бөгөөд Worker нь app-ийн үүсгэсэн HMAC токеныг шалгана.
R2 ↔ Worker хоорондын урсгал **үнэгүй** (egress zero), эх хадгалалтын URL
хэзээ ч ил гардаггүй.

Холбогдох файлууд:

| Юу | Хаана |
| --- | --- |
| App талын URL гарын үсэг | `src/lib/video/r2.ts` |
| Worker (токен шалгагч + R2 proxy) | `workers/r2-video/` |
| Transcode скрипт (Windows) | `scripts/transcode-hls.ps1` |
| DB migration (`r2` provider) | `supabase/migrations/0009_r2_provider.sql`, `SETUP-R2.sql` |

## Гарын үсгийн схем (токен)

```
https://{R2_VIDEO_HOST}/{token}/{expires}{hls_path}

token   = base64url( HMAC_SHA256( R2_TOKEN_SECRET, `${dirPath}:${expires}` ) )
dirPath = hls_path-ийн эцэг хавтас, төгсгөлийн "/"-тэй (жиш. /movies/tom-yum/)
expires = unix секунд (одоо + PLAYBACK_URL_TTL_SECONDS)
```

HLS playlist доторх сегментүүд харьцангуй (relative) замтай тул бүх хүсэлт
ижил `/{token}/{expires}/` угтвар дор ирнэ. Worker хүссэн файлын эцэг
хавтаснуудыг (гүнээс дээш) нэг бүрчлэн HMAC-аар шалгаж, аль нэг нь таарвал
зөвшөөрнө — тиймээс дэд хавтас дахь variant playlist, сегментүүд мөн ижил
токеноор нээгдэнэ.

## 1. Cloudflare акаунт + R2 идэвхжүүлэх

1. [dash.cloudflare.com](https://dash.cloudflare.com) дээр акаунт үүсгэнэ
   (эсвэл нэвтэрнэ). `flimix.mn` домэйн Cloudflare дээр байвал custom domain
   холбоход амар.
2. Зүүн цэснээс **R2 Object Storage** → **Enable R2** (картын мэдээлэл асууж
   магадгүй ч 10 GB хүртэл үнэгүй, egress үргэлж үнэгүй).
3. **Create bucket** → нэр: `flimix-videos`, location: Automatic (эсвэл APAC).
4. **ЧУХАЛ:** bucket-ийг public болгохгүй! Settings → Public access →
   **бүгд унтраалттай** байх ёстой. R2.dev subdomain-ийг ч идэвхжүүлэхгүй.

## 2. R2 API token (S3 credentials) + rclone

Файл хуулахад rclone (S3 protocol) ашиглана.

1. R2 хуудасны баруун дээд **Manage R2 API Tokens** → **Create API Token**:
   - Permissions: **Object Read & Write**
   - Specify bucket: `flimix-videos`
   - Үүссэн **Access Key ID**, **Secret Access Key**, **Account ID**-г хуулж авна.
2. [rclone](https://rclone.org/downloads/) суулгаад `%USERPROFILE%\.config\rclone\rclone.conf`
   (эсвэл `rclone config file` гэж байрлалыг нь харна) дотор:

   ```ini
   [r2]
   type = s3
   provider = Cloudflare
   access_key_id = <ACCESS_KEY_ID>
   secret_access_key = <SECRET_ACCESS_KEY>
   endpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   acl = private
   no_check_bucket = true
   ```

3. Шалгах: `rclone lsd r2:` → `flimix-videos` харагдах ёстой.

## 3. Worker deploy

```powershell
cd workers/r2-video
npm install
npx wrangler login                      # хөтөч нээгдэж Cloudflare-т нэвтэрнэ

# Токений нууц түлхүүр үүсгэх (Git Bash / WSL / OpenSSL):
openssl rand -hex 32
# Гарсан утгыг Worker-ийн secret болгоно (асуухад нь paste хийнэ):
npx wrangler secret put R2_TOKEN_SECRET

npx wrangler deploy
```

Дараа нь custom domain холбоно (bucket-ийг БИШ, Worker-ийг!):

- Cloudflare dashboard → **Workers & Pages** → `flimix-r2-video` →
  **Settings → Domains & Routes → Add → Custom domain** → `video.flimix.mn`.
- Эсвэл `wrangler.toml` доторх `routes` жишээг тайлбараас гаргаж deploy хийнэ
  (домэйн Cloudflare zone байх шаардлагатай).

Шалгах: `https://video.flimix.mn/x/1/x.m3u8` → **410** (хугацаа дууссан)
буцвал Worker ажиллаж байна.

## 4. Vercel env

Vercel → Project → Settings → Environment Variables:

| Нэр | Утга |
| --- | --- |
| `R2_VIDEO_HOST` | `video.flimix.mn` (scheme-гүй, зөвхөн hostname) |
| `R2_TOKEN_SECRET` | Worker-т тавьсан нууцтай **яг ижил** утга |
| `PLAYBACK_URL_TTL_SECONDS` | (өмнө нь байгаа) жиш. `3600` |

Нэмсний дараа **Redeploy** хийхээ мартуузай — env өөрчлөлт шинэ deploy шаардана.

Мөн Supabase дээр `r2` provider утгыг нэмнэ (нэг удаа):

```sql
alter type public.video_provider add value if not exists 'r2';
```

(`supabase db push` эсвэл SQL editor дээр `SETUP-R2.sql`-ийг ажиллуулна.)

## 5. Кино нэмэх урсгал

```powershell
# 1) Transcode (ffmpeg PATH дээр байх ёстой)
.\scripts\transcode-hls.ps1 -Input "D:\masters\tom-yum.mkv" -Slug tom-yum

# 2) R2 руу хуулах
rclone copy ./hls-out/tom-yum r2:flimix-videos/movies/tom-yum --transfers 8 --progress

# 3) Шалгах
rclone ls r2:flimix-videos/movies/tom-yum | head
```

4) Админ (`/admin/content`) дээр киноны формд video asset холбоно:

| Талбар | Утга |
| --- | --- |
| Провайдер | **Cloudflare R2** (`r2`) |
| Провайдерын видео ID | `tom-yum` (slug) |
| HLS зам | `/movies/tom-yum/master.m3u8` |
| Чанарууд | 360p, 480p, 720p, 1080p |
| Төлөв | ready |

Цувралын ангиудад мөн адил — HLS замыг жишээ нь
`/series/{slug}/s01e01/master.m3u8` гэх мэтээр хавтаслаж болно; токен
хавтасны түвшинд гарын үсэг зурдаг тул ямар ч гүнтэй зам ажиллана
(зам `master.m3u8`-аар төгссөн байхад л хангалттай).

## 6. Зардал

- **Egress (гадагш урсгал): $0.** R2-ийн гол давуу тал — үзэгчид хэдэн ч TB
  үзсэн дамжуулалтын төлбөр байхгүй.
- **Хадгалалт:** эхний 10 GB үнэгүй, цаашид ~$0.015/GB-сар
  (1080p кино ~3–5 GB → 100 кино ≈ 400 GB ≈ $6/сар).
- **Worker requests:** Free plan-д өдөрт 100,000 хүсэлт үнэгүй. Кино үзэхэд
  ~10 сек тутам 1 сегмент = 2 цагийн кино ≈ 1,200 хүсэлт/үзэлт. Edge cache
  оноход R2 read-үүд ч хэмнэгдэнэ. Хэрэглээ өссөн үед Workers Paid ($5/сар,
  10 сая хүсэлт) руу шилжинэ.
- **R2 Class A/B үйлдлүүд:** rclone upload (Class A) сая үйлдэл тутам ~$4.5,
  read (Class B) ~$0.36 — кинонд бараг мэдрэгдэхгүй.

## 7. Troubleshooting

| Шинж тэмдэг | Шалтгаан / засвар |
| --- | --- |
| **403 Invalid token** | Vercel-ийн `R2_TOKEN_SECRET` ба Worker-ийн secret таарахгүй байна. Хоёуланг нь дахин тавьж, Vercel-ийг redeploy, Worker-ийг `wrangler deploy` хийнэ. Мөн `hls_path` `/`-ээр эхэлж `master.m3u8`-аар төгсөж буйг шалгана. |
| **410 Link expired** | URL-ийн хугацаа дууссан. Player хуудсыг refresh хийхэд шинэ URL авна; байнга гарвал `PLAYBACK_URL_TTL_SECONDS`-ийг уртасгана (жиш. 14400 = 4 цаг — киноны нийт үргэлжлэхээс урт байх нь зүйтэй). |
| **404 Not found** | Объект R2-д алга. `rclone ls r2:flimix-videos/movies/{slug}`-аар зам, том/жижиг үсгийг шалгана. Админ дахь HLS зам bucket доторх бодит замтай яг таарах ёстой. |
| **CORS алдаа (console)** | Worker бүх хариултад `Access-Control-Allow-Origin: *` тавьдаг. Хэрэв гарвал Worker хуучин хувилбар байж магадгүй — `wrangler deploy` дахин хийнэ. Мөн URL нь Worker-ийн domain руу (bucket руу шууд биш) очиж буйг шалгана. |
| **Тоглохгүй, playlist татагдаж байгаа ч** | `hls-out` доторх `master.m3u8` variant замуудыг (`1080p/index.m3u8`) зөв заасан эсэхийг нээж харна; transcode-ыг `hls-out/{slug}` дотроос нь ажиллуулдаг тул скриптийг өөрчлөхгүй ашиглана. |
| **Worker log харах** | `npx wrangler tail flimix-r2-video` — бодит цагийн хүсэлт/алдаа. |
