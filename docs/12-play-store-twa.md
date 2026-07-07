# FLIMIX — Play Store (TWA) гаргах заавар

## 1. Урьдчилсан нөхцөл
- flimix.mn домэйн Vercel дээр холбогдсон, HTTPS ажиллаж байгаа
- Play Console акаунт ($25)

## 2. Апп үүсгэх (өөрийн компьютер дээр)
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://flimix.mn/manifest.webmanifest
# Асуултууд: package id = mn.flimix.app, нэр = FLIMIX
bubblewrap build
```
Гарц: `app-release-bundle.aab` (Play Console-д оруулах файл) ба гарын үсгийн түлхүүр (`android.keystore` — НАЙДВАРТАЙ ХАДГАЛ, алдвал апп шинэчлэх боломжгүй болно).

## 3. Fingerprint-ээ авах
```bash
bubblewrap fingerprint list
# эсвэл:
keytool -list -v -keystore android.keystore -alias android
```
`SHA256:` мөрийн утгыг (AA:BB:CC:... хэлбэртэй) хуулж ав.

## 4. assetlinks.json шинэчлэх
`public/.well-known/assetlinks.json` доторх `REPLACE_WITH_YOUR_SHA256_FINGERPRINT`-ийг
жинхэнэ fingerprint-ээрээ солиод commit + push. Deploy дууссаны дараа
https://flimix.mn/.well-known/assetlinks.json дээр харагдаж байгааг шалга.
Энэ таарахгүй бол апп нээгдэхдээ дээрээ хөтчийн мөртэй (URL bar) гарна.

Жич: Play Console-ийн "App signing" ашиглавал Google апп-ыг ӨӨРИЙН түлхүүрээр
дахин гарын үсэглэдэг — тэр үед Play Console → Setup → App integrity →
App signing key certificate доторх SHA-256-г assetlinks.json-д нэмнэ
(хоёр fingerprint зэрэг байж болно, массив тул таслалаар нэмнэ).

## 5. Play Console листинг
- Апп нэр: FLIMIX, хэл: Монгол
- Тайлбар, 512x512 icon (public/icons/icon-512.png ашиглаж болно),
  1024x500 feature graphic, утасны 2+ дэлгэцийн зураг
- Privacy policy URL: https://flimix.mn/legal/privacy
- Контентын үнэлгээ + Data safety маягтууд
- .aab upload → Review
