-- Phool Ghar seed data. Idempotent: safe to run repeatedly (supabase db reset runs it automatically;
-- in the SQL editor run it after all migrations). Contains no users, secrets or real customer data.
-- Money is integer paise. Catalogue rows below are generated from src/data/products.ts (rupees x 100).

insert into public.categories (slug, name, blurb, image_url, sort, active) values
  ('pooja', 'Pooja Flowers', 'Marigold, jasmine, lotus and rose for the daily altar.', '/img/marigold-field.jpg', 10, true),
  ('bouquets', 'Bouquets', 'Hand-tied for birthdays, anniversaries and thank-yous.', '/img/bouquet-peach.jpg', 20, true),
  ('cut', 'Cut Flowers', 'Stems for your vase, table and reception counter.', '/img/roses-pink.jpg', 30, true),
  ('addons', 'Add-ons', 'Cards, vases and small gifts to go with your flowers.', '/img/roses-soft.jpg', 90, true)
on conflict (slug) do update set name = excluded.name, blurb = excluded.blurb, image_url = excluded.image_url, sort = excluded.sort;

insert into public.products (slug, name, tagline, description, category_id, image_url, gallery, price_paise, per_day_paise, tag, care, active, sort)
select v.slug, v.name, v.tagline, v.description, c.id, v.image_url, v.gallery::jsonb, v.price_paise, v.per_day_paise, v.tag, v.care, true, v.sort
from (values
  ('pooja-mix', 'Pooja Mix', 'Marigold, rose petals and tulsi-ready sprigs', 'The all-rounder altar pack. A fresh mix of marigold, rose petals and seasonal blooms, picked the evening before and packed in breathable paper.', 'pooja', '/img/marigold-field.jpg', '["/img/marigold-field.jpg","/img/marigold-garden.jpg","/img/marigold-bloom.jpg"]', 14900, 6000, 'Best seller', 'Sprinkle with water and keep in a cool corner. Best used the same morning.', 10),
  ('marigold-orange', 'Marigold Orange', 'Full, deep-orange genda blooms', 'Dense, fragrant orange marigolds from Maharashtra farms. Ideal for garlands, toran and the morning pooja.', 'pooja', '/img/hero-marigold.jpg', '["/img/hero-marigold.jpg","/img/marigold-garden.jpg"]', 12900, 5400, null, 'Keep stems loose, not pressed. Store away from direct sun.', 20),
  ('marigold-yellow', 'Marigold Yellow', 'Bright yellow, lightly scented', 'Golden yellow marigolds, hand-sorted for even petals. A staple for festivals and shop-front offerings.', 'pooja', '/img/yellow-bloom.jpg', '["/img/yellow-bloom.jpg","/img/marigold-bloom.jpg"]', 12900, 5400, null, 'Lasts a full day at room temperature when kept dry.', 30),
  ('jasmine-mogra', 'Mogra Strings', 'Hand-strung jasmine, still in bud', 'Fragrant mogra buds strung by hand the same morning. They open on the altar through the day.', 'pooja', '/img/jasmine-hands.jpg', '["/img/jasmine-hands.jpg"]', 11900, 4900, 'Fragrant', 'Keep the string slightly damp in a steel box lined with a cloth.', 40),
  ('lotus-offering', 'Lotus Offering Set', 'Fresh lotus buds and petals', 'A temple-grade set of lotus buds and loose petals, ready for abhishek and special occasions.', 'pooja', '/img/lotus-petals.jpg', '["/img/lotus-petals.jpg","/img/lotus-buds.jpg"]', 24900, null::integer, 'Festival', 'Keep buds in shallow water and use within a day.', 50),
  ('rose-petal-pooja', 'Rose Petal Pooja Pack', 'Soft pink petals, no stems', 'Loose, freshly plucked rose petals for offerings, rangoli and decorations.', 'pooja', '/img/roses-soft.jpg', '["/img/roses-soft.jpg","/img/roses-pink.jpg"]', 15900, 5900, null, 'Spread in a shallow tray and mist lightly.', 60),
  ('peach-garden-bouquet', 'Peach Garden Bouquet', 'Garden roses, waxflower and foliage', 'A loose, romantic bouquet of peach garden roses with wild fillers, hand-tied and wrapped in recycled paper.', 'bouquets', '/img/bouquet-peach.jpg', '["/img/bouquet-peach.jpg","/img/roses-cream.jpg"]', 149900, null::integer, 'Gift favourite', 'Trim stems at an angle and change the water every second day.', 70),
  ('blush-rose-wrap', 'Blush Rose Wrap', 'Pink roses in a paper wrap', 'A generous wrap of pink roses and soft fillers. Arrives ready to gift.', 'bouquets', '/img/bouquet-pink.jpg', '["/img/bouquet-pink.jpg","/img/roses-pink.jpg"]', 129900, null::integer, null, 'Keep in cool water, away from fruit and direct sun.', 80),
  ('cream-rose-vase', 'Cream Rose Bunch', 'Ten cream roses for a vase', 'Ten long-stemmed cream roses, a clean look for a table or reception desk. Also available as a weekly office plan.', 'cut', '/img/roses-cream.jpg', '["/img/roses-cream.jpg","/img/roses-soft.jpg"]', 109900, 8000, 'Office plan', 'Re-cut stems every two days; add flower food to the water.', 90),
  ('pink-rose-bunch', 'Pink Rose Bunch', 'Full-blown pink garden roses', 'Lush, full pink roses for a statement vase. Bought by the bunch, delivered fresh.', 'cut', '/img/roses-pink.jpg', '["/img/roses-pink.jpg","/img/roses-soft.jpg"]', 89900, null::integer, null, 'Remove lower leaves and keep the vase out of draughts.', 100),
  ('shevanti-mix', 'Shevanti Mix', 'White, yellow and purple shevanti', 'Layered shevanti blooms in soft whites, yellows and purples. Long-lasting and lightly scented, a favourite for daily pooja.', 'pooja', '/img/marigold-bloom.jpg', '["/img/marigold-bloom.jpg","/img/yellow-bloom.jpg"]', 16900, 7000, null, 'Keep dry and cool. Lasts well through the day.', 110),
  ('red-rose-buds', 'Red Rose Buds', 'Fresh rose buds for the altar', 'Tight red rose buds that open slowly on the altar. Picked the evening before and packed in breathable paper.', 'pooja', '/img/roses-soft.jpg', '["/img/roses-soft.jpg","/img/roses-pink.jpg"]', 17900, 7000, null, 'Mist lightly and keep out of direct sun.', 120),
  ('festival-garland', 'Marigold Garland', 'Hand-strung, three lengths', 'A full marigold garland, strung by hand the night before. Ideal for torans, deities, vehicles and celebrations.', 'pooja', '/img/marigold-garden.jpg', '["/img/marigold-garden.jpg","/img/hero-marigold.jpg"]', 34900, null::integer, 'Festival', 'Hang in a shaded spot and sprinkle with water in the morning.', 130),
  ('greeting-card', 'Handwritten Greeting Card', 'Your message, written by hand', 'A textured card with your message handwritten by our team and tucked into the wrap.', 'addons', '/img/roses-soft.jpg', '["/img/roses-soft.jpg"]', 4900, null::integer, null, 'Delivered with your order.', 200),
  ('ceramic-vase', 'Ceramic Bud Vase', 'A small matte vase for table or desk', 'A hand-glazed ceramic bud vase, sized for a bunch of cut flowers or a few roses.', 'addons', '/img/roses-cream.jpg', '["/img/roses-cream.jpg"]', 39900, null::integer, null, 'Wipe clean with a soft cloth.', 210),
  ('mithai-box', 'Mithai Box (250 g)', 'Fresh sweets from a local halwai', 'A 250 g box of assorted sweets, packed the same morning for gifting with flowers.', 'addons', '/img/marigold-bloom.jpg', '["/img/marigold-bloom.jpg"]', 29900, null::integer, null, 'Best eaten within two days.', 220),
  ('scented-candle', 'Jasmine Soy Candle', 'A small hand-poured soy candle', 'A small hand-poured soy candle with a soft jasmine scent. Burns for about twenty hours.', 'addons', '/img/jasmine-hands.jpg', '["/img/jasmine-hands.jpg"]', 34900, null::integer, null, 'Trim the wick to 5 mm before each burn.', 230),
  ('lotus-bud-bunch', 'Lotus Bud Bunch', 'Ten fresh lotus buds', 'A bunch of ten lotus buds with long stems, ready for pooja, decor or gifting.', 'cut', '/img/lotus-buds.jpg', '["/img/lotus-buds.jpg","/img/lotus-petals.jpg"]', 39900, null::integer, null, 'Stand the stems in shallow water and use within a day.', 140)
) as v(slug, name, tagline, description, category_slug, image_url, gallery, price_paise, per_day_paise, tag, care, sort)
join public.categories c on c.slug = v.category_slug
on conflict (slug) do update set name = excluded.name, tagline = excluded.tagline, description = excluded.description,
  category_id = excluded.category_id, image_url = excluded.image_url, gallery = excluded.gallery,
  price_paise = excluded.price_paise, per_day_paise = excluded.per_day_paise, tag = excluded.tag, care = excluded.care, sort = excluded.sort;

insert into public.product_variants (product_id, variant_key, label, note, multiplier)
select p.id, v.variant_key, v.label, v.note, v.multiplier
from public.products p
cross join (values
  ('small', 'Small', 'Single altar', 0.70::numeric),
  ('regular', 'Regular', 'Family altar', 1.00::numeric),
  ('large', 'Large', 'Shop or office', 1.60::numeric)
) as v(variant_key, label, note, multiplier)
on conflict (product_id, variant_key) do update set label = excluded.label, note = excluded.note, multiplier = excluded.multiplier;

insert into public.plan_periods (days, label, discount_pct, active) values
  (7, 'Weekly', 0.00, true),
  (15, 'Fortnight', 5.00, true),
  (30, 'Monthly', 10.00, true)
on conflict (days) do update set label = excluded.label, discount_pct = excluded.discount_pct;

-- ---------------------------------------------------------------- delivery slots
insert into public.delivery_slots (id, label, start_time, end_time, capacity, subscription_ok, active, sort) values
  ('early',   '5:00 to 6:30 AM', '05:00', '06:30', 60, true,  true, 10),
  ('morning', '6:30 to 8:00 AM', '06:30', '08:00', 80, true,  true, 20),
  ('evening', '5:00 to 7:00 PM', '17:00', '19:00', 60, false, true, 30)
on conflict (id) do update set label = excluded.label, start_time = excluded.start_time, end_time = excluded.end_time,
  subscription_ok = excluded.subscription_ok, sort = excluded.sort;

-- ---------------------------------------------------------------- delivery zones (sample; edit to your real coverage)
insert into public.delivery_zones (pincode, city, area, fee_paise, active) values
  ('411001', 'Pune', 'Camp and Sadashiv Peth',   4900, true),
  ('411004', 'Pune', 'Deccan Gymkhana',          4900, true),
  ('411005', 'Pune', 'Shivajinagar',             4900, true),
  ('411007', 'Pune', 'Aundh',                    4900, true),
  ('411014', 'Pune', 'Viman Nagar and Kharadi',  5900, true),
  ('411028', 'Pune', 'Hadapsar',                 5900, true),
  ('411038', 'Pune', 'Kothrud',                  4900, true),
  ('411045', 'Pune', 'Baner',                    5900, true),
  ('411057', 'Pune', 'Hinjewadi',                6900, true),
  ('400001', 'Mumbai', 'Fort',                   5900, true),
  ('400050', 'Mumbai', 'Bandra West',            6900, true),
  ('400053', 'Mumbai', 'Andheri West',           6900, true),
  ('400069', 'Mumbai', 'Andheri East',           6900, true),
  ('400092', 'Mumbai', 'Borivali West',          7900, true)
on conflict (pincode) do update set city = excluded.city, area = excluded.area, fee_paise = excluded.fee_paise;

-- ---------------------------------------------------------------- settings (jsonb values)
insert into public.app_settings (key, value) values
  ('cutoff_time', '"21:00"'),
  ('free_delivery_for_subscription', 'true'),
  ('min_order_paise', '9900'),
  ('store_name', '"Phool Ghar"'),
  ('support_whatsapp', '""'),
  ('gst_percent', '0'),
  ('min_lead_minutes', '180')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- coupons
-- percent: value is a percentage; flat: value is paise
insert into public.coupons (code, kind, value, min_order_paise, max_uses, per_user_limit, applies_to, first_order_only, description, active) values
  ('FIRST10',     'percent', 10,    19900,  null, 1, 'all',          true,  '10 percent off your first order',               true),
  ('FLAT100',     'flat',    10000, 99900,  null, 5, 'one_time',     false, 'Rs 100 off orders above Rs 999',                true),
  ('SUBSCRIBE50', 'flat',    5000,  80000,  500,  1, 'subscription', false, 'Rs 50 off a daily flower plan',                true)
on conflict (code) do nothing;
