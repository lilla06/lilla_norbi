function createDummyImage(title, primaryColor, secondaryColor, accentColor) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${primaryColor}" />
          <stop offset="62%" stop-color="${secondaryColor}" />
          <stop offset="100%" stop-color="#f5eddf" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="24%" r="38%">
          <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.72" />
          <stop offset="100%" stop-color="${accentColor}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="760" fill="url(#sky)" />
      <rect width="1200" height="760" fill="url(#glow)" />
      <circle cx="880" cy="150" r="92" fill="${accentColor}" opacity="0.82" />
      <path d="M0 640 C160 540 290 600 440 512 C620 404 762 560 936 456 C1048 388 1136 420 1200 380 L1200 760 L0 760 Z" fill="#24351f" opacity="0.82" />
      <path d="M0 690 C180 610 340 650 510 590 C710 520 870 650 1200 520 L1200 760 L0 760 Z" fill="#2d4726" opacity="0.78" />
      <g opacity="0.84">
        <path d="M130 620 l64 -220 l64 220 Z" fill="#1d341d" />
        <path d="M250 650 l82 -300 l82 300 Z" fill="#1b2f1b" />
        <path d="M980 635 l72 -260 l72 260 Z" fill="#1d341d" />
        <path d="M1080 674 l92 -340 l92 340 Z" fill="#172b18" />
      </g>
      <text x="60" y="92" fill="#fff8e7" font-family="Georgia, serif" font-size="44" opacity="0.94">${title}</text>
      <text x="62" y="142" fill="${accentColor}" font-family="Arial, sans-serif" font-size="22" letter-spacing="5">DUMMY IMAGE</text>
    </svg>
  `

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const homepageImages = {
  hero: {
    src: createDummyImage('Kozos pillanat az erdoben', '#1f3b25', '#6a4a1c', '#d4af37'),
    alt: 'Dummy kep Lillarol es Norbirol erdei hangulatban',
    caption: 'Ide kerülhet egy kedvenc közös fotó rólatok.',
  },
  info: {
    src: createDummyImage('Helyszin es hangulat', '#24351f', '#8b6f47', '#caa74d'),
    alt: 'Dummy kep az eskuvoi helyszin hangulatarol',
  },
  dressCode: {
    src: createDummyImage('Dress code inspiracio', '#50693d', '#d7c8a7', '#a77c20'),
    alt: 'Dummy kep zold barna bezs es arany dress code inspiracioval',
  },
}

const galleryImages = [
  {
    title: 'Erdei fenyek',
    src: createDummyImage('Erdei fenyek', '#1f3b25', '#4e3d2a', '#d4af37'),
    alt: 'Dummy galeriakep erdei fenyekkel',
  },
  {
    title: 'Arany reszletek',
    src: createDummyImage('Arany reszletek', '#6a4a1c', '#f5eddf', '#d4af37'),
    alt: 'Dummy galeriakep arany es bezs reszletekkel',
  },
  {
    title: 'Moha es level',
    src: createDummyImage('Moha es level', '#2d4726', '#c7d3a6', '#a77c20'),
    alt: 'Dummy galeriakep mohas leveles hangulattal',
  },
  {
    title: 'Esti meseerdo',
    src: createDummyImage('Esti meseerdo', '#172b18', '#50693d', '#d4af37'),
    alt: 'Dummy galeriakep esti erdei hangulattal',
  },
]

const imagePlan = [
  {
    title: 'Tartalmi képek rólatok',
    amount: '6-8 kép',
    description: 'közös portrék, jegyesfotók, természetes nevetős pillanatok',
  },
  {
    title: 'Hero / nyitókép',
    amount: '1 erős fő kép',
    description: 'vízszintes, jó minőségű fotó, amin bőven van tér a szöveg körül',
  },
  {
    title: 'Háttérképek vagy textúrák',
    amount: '3-4 darab',
    description: 'erdő, levelek, moha, fényfüzér vagy arany részletek',
  },
  {
    title: 'Dekoratív szekcióképek',
    amount: '4-6 kép',
    description: 'helyszín, részletek, virágok, meghívó- vagy dekorhangulat',
  },
  {
    title: 'Galéria',
    amount: '8-12 kép',
    description: 'lapozható válogatás a kedvenc közös képekből',
  },
]

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-art" aria-hidden="true">
          <span className="moon" />
          <span className="tree tree-left" />
          <span className="tree tree-center" />
          <span className="tree tree-right" />
        </div>

        <div className="hero-layout">
          <div className="hero-content">
            <p className="eyebrow">Enchanted forest wedding</p>
            <h1>Lilla & Norbi</h1>
            <p className="wedding-date">2027. június 5.</p>
            <p>
              Szeretettel várunk az esküvői weboldalunkon. A részletek hamarosan
              érkeznek.
            </p>
          </div>

          <figure className="hero-photo-card">
            <img src={homepageImages.hero.src} alt={homepageImages.hero.alt} />
            <figcaption>{homepageImages.hero.caption}</figcaption>
          </figure>
        </div>
      </section>

      <section className="image-break" aria-label="Esküvői hangulatkép">
        <img src={homepageImages.info.src} alt={homepageImages.info.alt} />
        <div>
          <p className="eyebrow">Képes hangulat</p>
          <h2>Erdei fények, meleg részletek</h2>
          <p>
            Ezek a dummy képek később könnyen lecserélhetők valódi fotókra,
            miközben a layout már készen áll a képes tartalomra.
          </p>
        </div>
      </section>

      <section id="important-info" className="content-section">
        <p className="eyebrow">Vendéginformációk</p>
        <h2>Fontos információk</h2>
        <p>
          Itt fogjuk összegyűjteni a helyszínnel, időpontokkal, parkolással és
          egyéb praktikus tudnivalókkal kapcsolatos részleteket.
        </p>
      </section>

      <section className="photo-story-grid" aria-label="Dekoratív képek">
        <figure>
          <img src={homepageImages.dressCode.src} alt={homepageImages.dressCode.alt} />
          <figcaption>Színpaletta és dress code inspiráció.</figcaption>
        </figure>
        <figure>
          <img src={galleryImages[0].src} alt={galleryImages[0].alt} />
          <figcaption>Finom textúrák a szekciók közé.</figcaption>
        </figure>
      </section>

      <section id="dress-code" className="content-section">
        <p className="eyebrow">Hangulat</p>
        <h2>Dress code</h2>
        <p>
          Az esküvő témája enchanted forest: természetes zöldek, meleg barnák,
          bézs árnyalatok és visszafogott arany részletek illenek majd a
          hangulathoz.
        </p>
      </section>

      <section className="content-section gallery-section">
        <p className="eyebrow">Galéria</p>
        <h2>Lapozható képes válogatás</h2>
        <p>
          Egyelőre dummy képekkel töltve. Később ide kerülhetnek a kedvenc közös
          fotóitok, eljegyzési képek vagy hangulatképek.
        </p>

        <div className="gallery-track" aria-label="Lapozható képgaléria" tabIndex="0">
          {galleryImages.map((image) => (
            <figure className="gallery-card" key={image.title}>
              <img src={image.src} alt={image.alt} />
              <figcaption>{image.title}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="content-section image-plan-section">
        <p className="eyebrow">Képtartalom javaslat</p>
        <h2>Milyen képeket érdemes majd összegyűjteni?</h2>
        <div className="image-plan-grid">
          {imagePlan.map((item) => (
            <article key={item.title}>
              <span>{item.amount}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
