/**
 * FLIMIX interface copy — Mongolian is the default UI language.
 * Central dictionary so copy stays consistent across the app.
 */
export const t = {
  // Navigation
  home: "Нүүр",
  movies: "Кино",
  series: "Цуврал",
  categories: "Ангилал",
  search: "Хайлт",
  myList: "Миний жагсаалт",
  continueWatching: "Үргэлжлүүлэн үзэх",
  newReleases: "Шинээр нэмэгдсэн",
  trending: "Түгээмэл",
  comingSoon: "Тун удахгүй",

  // Actions
  watchNow: "Одоо үзэх",
  watchTrailer: "Трейлер үзэх",
  signUp: "Бүртгүүлэх",
  signIn: "Нэвтрэх",
  signOut: "Гарах",
  choosePlan: "Багц сонгох",
  pay: "Төлбөр төлөх",
  addToList: "Жагсаалтад нэмэх",
  removeFromList: "Жагсаалтаас хасах",
  nextEpisode: "Дараагийн анги",
  skipIntro: "Оршил алгасах",
  retry: "Дахин оролдох",
  save: "Хадгалах",
  cancel: "Цуцлах",
  confirm: "Баталгаажуулах",
  edit: "Засах",
  delete: "Устгах",
  back: "Буцах",
  seeAll: "Бүгдийг үзэх",
  loadMore: "Цааш үзэх",

  // Account
  myAccount: "Миний бүртгэл",
  watchHistory: "Үзсэн түүх",
  favorites: "Дуртай",
  profiles: "Профайл",
  devices: "Төхөөрөмж",
  subscription: "Багц",
  paymentHistory: "Төлбөрийн түүх",
  security: "Аюулгүй байдал",
  email: "Имэйл",
  password: "Нууц үг",
  forgotPassword: "Нууц үгээ мартсан уу?",
  resetPassword: "Нууц үг сэргээх",
  displayName: "Харагдах нэр",

  // Catalog
  genre: "Төрөл",
  country: "Улс",
  year: "Он",
  duration: "Үргэлжлэх хугацаа",
  ageRating: "Насны ангилал",
  cast: "Жүжигчид",
  director: "Найруулагч",
  subtitles: "Хадмал",
  audio: "Дуу",
  quality: "Чанар",
  season: "Бүлэг",
  episode: "Анги",
  similarTitles: "Төстэй контент",
  mongolianCinema: "Монгол кино",
  internationalCinema: "Гадаад кино",
  sortNewest: "Шинэ эхэндээ",
  sortPopular: "Түгээмэл",
  sortRating: "Үнэлгээгээр",
  sortTitle: "Нэрээр",

  // States
  loading: "Ачаалж байна...",
  emptyList: "Жагсаалт хоосон байна",
  noResults: "Илэрц олдсонгүй",
  errorGeneric: "Алдаа гарлаа. Дахин оролдоно уу.",
  offline: "Интернэт холболт тасалдсан байна",
  notFound: "Хуудас олдсонгүй",
  contentUnavailable: "Энэ контент одоогоор боломжгүй байна",
  subscriptionExpired: "Таны багцын хугацаа дууссан байна",
  subscriptionRequired: "Энэ контентыг үзэхийн тулд багц идэвхжүүлнэ үү",
  ageRestricted: "Энэ контент насны хязгаарлалттай",
  rightsExpired: "Энэ контентын эрх дууссан байна",
  deviceLimit: "Төхөөрөмжийн хязгаарт хүрсэн байна",

  // Subscription
  monthlyPlan: "Сарын багц",
  perMonth: "/сар",
  renewalDate: "Сунгагдах огноо",
  cancelSubscription: "Багц цуцлах",
  paymentPending: "Төлбөр хүлээгдэж байна",
  paymentPaid: "Төлбөр амжилттай",
  paymentFailed: "Төлбөр амжилтгүй",

  // Search
  searchPlaceholder: "Кино, цуврал, жүжигчин хайх...",
  recentSearches: "Сүүлийн хайлтууд",
  trendingSearches: "Түгээмэл хайлтууд",

  // Auth
  emailVerification: "Имэйл баталгаажуулалт",
  acceptTerms: "Үйлчилгээний нөхцөлийг зөвшөөрч байна",
  continueWithGoogle: "Google-ээр нэвтрэх",
  alreadyHaveAccount: "Бүртгэлтэй юу?",
  noAccountYet: "Бүртгэл байхгүй юу?",

  // Footer / legal
  termsOfService: "Үйлчилгээний нөхцөл",
  privacyPolicy: "Нууцлалын бодлого",
  copyrightPolicy: "Зохиогчийн эрхийн бодлого",
  contentRemoval: "Контент хасуулах хүсэлт",
  refundPolicy: "Буцаан олголтын бодлого",
  childSafety: "Хүүхдийн аюулгүй байдал",
  faq: "Түгээмэл асуулт",
  allRightsReserved: "Бүх эрх хуулиар хамгаалагдсан",
} as const;

export type UiLabelKey = keyof typeof t;

/** Format seconds as "1ц 45м" */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}м`;
  return `${h}ц ${m}м`;
}

/** Format tugrik amounts: 14900 -> "14,900₮" */
export function formatMnt(amount: number): string {
  return `${amount.toLocaleString("en-US")}₮`;
}
