# lilla_norbi

Köszöntünk az esküvői honlapunkon!

## Fejlesztés

```bash
npm install
npm run dev
```

A fejlesztői szerver: `http://localhost:5173/lilla_norbi/`

## TODO

### Videó (hero)

- [ ] **Hero save-the-date videó** (`HomePage.jsx` → `heroVideoSrc`) — az álló (Instagram) videót töltsd fel Supabase Storage-ba (public `wedding-media` bucket), és illeszd be a publikus URL-t a `heroVideoSrc` konstansba. Amíg üres, a hero a poszter fotót (`heroPoster`) mutatja.

### Képek

A jegyesfotók már be vannak építve, de néhány helyen ideiglenes kép áll, vagy még hiányzik a végleges tartalom.

- [ ] **Történet állomások képei** (`HomePage.jsx` → `storyMilestones` `image` mezői) — jelenleg **ideiglenes jegyesfotók** (`storyMet`, `storyTravel`, `storyProposal`, `storyBigDay`); cseréld le a mérföldkövekhez illő valódi fotókra
- [ ] **Fontos információk szekció** (`HomePage.jsx` → `infoPhoto`) — jelenleg jegyesfotó van; ide **helyszín-/birtokfotó** kell (épület, kert, ceremónia helye, térképhez illő kép)
- [ ] **Hero poszter** (`HomePage.jsx` → `heroPoster`) — a videó betöltéséig / hiányában látszó kép; opcionálisan cserélhető
- [ ] **Bejelentkezés / regisztráció / RSVP / profil háttér** (`index.css` → `fc0f1266.jpg`) — jegyesfotó háttérként; opcionálisan dedikált, kevésbé személyes hangulatkép
- [ ] **Részletfotók** (még nincs helyük az oldalon) — gyűrűk közeli, virág/csokor, dekor, meghívó, terítés; későbbi editorial szekciókhoz vagy galériához
- [ ] **Esküvő napi fotók** — az esküvő után a galériába (`HomePage.jsx` → `galleryImages`)

### Szövegek (agent által írt, ellenőrizendő / cserélendő)

Mind a `src/pages/HomePage.jsx` fájlban.

**Hero**
- [ ] Eyebrow: „Összeházasodunk”
- [ ] Bevezető: „Két ember, egy erdő és egy ígéret. Szeretettel hívunk, hogy velünk ünnepeld életünk legszebb napját.”

**Meghívó**
- [ ] Teljes meghívószöveg (2 bekezdés + aláírás)

**Gyors elérés**
- [ ] Kártyák alcímei: „RSVP a nagy napra”, „A nap programja”, „Helyszín és tudnivalók”, „Az esküvő stílusa”

**A történetünk** (`storyMilestones`)
- [ ] 2019 — „Ahol minden kezdődött” + szöveg
- [ ] 2021 — „Az első közös utazás” + szöveg
- [ ] 2025 — „Az igen” + szöveg
- [ ] 2027 — „A nagy nap” + szöveg

**Fontos információk** (`infoCards`)
- [ ] Időpont szöveg (dátum, szertartás 16:00)
- [ ] Helyszín szöveg — „erdő szélén álló birtok”, „pontos cím és térkép hamarosan”
- [ ] Parkolás szöveg
- [ ] Szállás szöveg
- [ ] Nászajándék szöveg (jókívánságok borítékban)

**Menetrend** (`schedulePreview` + bevezető)
- [ ] Bevezető: „Így alakul majd a nagy nap…”
- [ ] 15:00 — Vendégvárás + leírás
- [ ] 16:00 — Szertartás + leírás
- [ ] 18:00 — Vacsora + leírás
- [ ] 21:00 — Buli + leírás

**Dress code**
- [ ] Teljes dress code szöveg (enchanted forest téma, színek, fehér ruha)
- [ ] Színminta nevek: Erdőzöld, Mohaárnyalat, Meleg barna, Homokbézs, Óarany (és a színkódok, ha nem illenek a végleges palettához)

**Galéria**
- [ ] Bevezető: „Néhány kedvenc közös képünk. Az esküvő után…”

### Email címek

- [ ] `src/components/Layout.jsx` — lábléc: `lilla@example.com` → valódi cím
- [ ] `src/components/Layout.jsx` — lábléc: `norbi@example.com` → valódi cím
