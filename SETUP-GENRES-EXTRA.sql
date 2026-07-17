-- FLIMIX: нэмэлт жанрууд (Supabase SQL editor дээр ажиллуулна)
-- Давхардвал алгасна (on conflict do nothing) — олон удаа ажиллуулж болно.
insert into public.genres (slug, name_mn, name_en) values
  ('war',       'Дайны',            'War'),
  ('history',   'Түүхэн',           'History'),
  ('mystery',   'Нууцлаг',          'Mystery'),
  ('adventure', 'Аяллын',           'Adventure'),
  ('musical',   'Мюзикл',           'Musical'),
  ('sport',     'Спортын',          'Sport'),
  ('biography', 'Намтарчилсан',     'Biography'),
  ('western',   'Вестерн',          'Western'),
  ('noir',      'Нуар',             'Film-Noir'),
  ('short',     'Богино хэмжээний', 'Short'),
  ('kids',      'Хүүхдийн',         'Kids'),
  ('anime',     'Анимэ',            'Anime'),
  ('melodrama', 'Мелодрам',         'Melodrama'),
  ('detective', 'Мөрдөгчийн',       'Detective'),
  ('action',    'Тулаант',          'Action'),
  ('war-battle','Дайн тулаан',      'War & Battle'),
  ('fantasy',   'Уран зөгнөлт-фэнтези', 'Fantasy'),
  ('romance',   'Романтик',         'Romance'),
  ('disaster',  'Гамшгийн',         'Disaster'),
  ('superhero', 'Супер баатрын',    'Superhero'),
  ('martial-arts', 'Тулааны урлагийн', 'Martial Arts'),
  ('psychological', 'Сэтгэл зүйн',  'Psychological'),
  ('teen',      'Өсвөр үеийн',      'Teen'),
  ('reality',   'Реалити',          'Reality')
on conflict do nothing;

select slug, name_mn from public.genres order by name_mn;
