import { Link } from 'react-router-dom'
import heroPhoto from '../assets/fcaa2d02-5523-4e23-b660-656f0c8e0eea.jpg'
import storyPhoto from '../assets/f15f1334-c156-4182-9500-87acae77f6e2.jpg'
import infoPhoto from '../assets/d336ad11-89cc-48ea-b1f0-0b53cef877b8.jpg'
import galleryBacklit from '../assets/f8465e2b-cc8c-4ece-ba30-7f6d97183f94.jpg'
import galleryPortrait from '../assets/019f4b71-54ab-4770-b9ec-eb99c7b02036.jpg'
import galleryCheekKiss from '../assets/d982c42b-696c-494e-8b03-02186cdeb177.jpg'
import galleryDip from '../assets/d61d070b-3781-4ea9-9949-c9b50272db20.jpg'
import galleryRing from '../assets/c7e247fc-cbb7-40a4-b78c-c583eb73b609.jpg'
import galleryHands from '../assets/61da3cf8-c618-49c7-bcf5-f21c77e268ec.jpg'
import galleryHighFive from '../assets/2c30ff7d-604d-40cb-ad01-e8141e1c4f31.jpg'
import gallerySitting from '../assets/2bd4f1fd-b6e8-4b93-b8f9-fb9f1c688ccb.jpg'

const quickActions = [
  { label: 'Visszajelzés', description: 'RSVP a nagy napra', to: '/rsvp', type: 'route' },
  { label: 'Menetrend', description: 'A nap programja', href: '#schedule', type: 'anchor' },
  { label: 'Fontos infók', description: 'Helyszín és tudnivalók', href: '#important-info', type: 'anchor' },
  { label: 'Dress code', description: 'Az esküvő stílusa', href: '#dress-code', type: 'anchor' },
]

const storyMilestones = [
  {
    year: '2019',
    title: 'Ahol minden kezdődött',
    text: 'Egy baráti társaságban ismerkedtünk meg, és már az első beszélgetés is órákig tartott.',
  },
  {
    year: '2021',
    title: 'Az első közös utazás',
    text: 'Egy erdei kiránduláson jöttünk rá, hogy a csendben is jó együtt lenni.',
  },
  {
    year: '2025',
    title: 'Az igen',
    text: 'Egy naplementés séta végén, a fák között tettük fel életünk legszebb kérdését.',
  },
  {
    year: '2027',
    title: 'A nagy nap',
    text: 'Most pedig szeretnénk, ha ti is velünk lennétek, amikor kimondjuk a boldogító igent.',
  },
]

const schedulePreview = [
  { time: '15:00', title: 'Vendégvárás', text: 'Érkezés, üdvözlő ital és fotózkodás a kertben.' },
  { time: '16:00', title: 'Szertartás', text: 'A ceremónia a fák alatt, meghitt hangulatban.' },
  { time: '18:00', title: 'Vacsora', text: 'Közös ünnepi vacsora és pohárköszöntők.' },
  { time: '21:00', title: 'Buli', text: 'Zene, tánc és önfeledt mulatozás késő éjszakáig.' },
]

const infoCards = [
  {
    title: 'Időpont',
    text: '2027. június 5., szombat. A szertartás 16:00-kor kezdődik, kérünk, érkezzetek időben.',
  },
  {
    title: 'Helyszín',
    text: 'Az esküvő egy erdő szélén álló birtokon lesz. A pontos címet és térképet hamarosan itt találjátok.',
  },
  {
    title: 'Parkolás',
    text: 'A helyszínen ingyenes parkolási lehetőség áll rendelkezésre a vendégek számára.',
  },
  {
    title: 'Szállás',
    text: 'A távolabbról érkezőknek szállást szervezünk a közelben. A részleteket a visszajelzés után egyeztetjük.',
  },
]

const dressCodeSwatches = [
  { name: 'Erdőzöld', color: '#2d4726' },
  { name: 'Mohaárnyalat', color: '#50693d' },
  { name: 'Meleg barna', color: '#6a4a1c' },
  { name: 'Homokbézs', color: '#d7c8a7' },
  { name: 'Óarany', color: '#a77c20' },
]

const galleryImages = [
  { src: galleryBacklit, alt: 'Lilla és Norbi naplementében a tónál' },
  { src: galleryPortrait, alt: 'Lilla és Norbi közös portré' },
  { src: galleryCheekKiss, alt: 'Norbi arcon csókolja Lillát' },
  { src: galleryDip, alt: 'Lilla és Norbi játékos pillanata' },
  { src: galleryRing, alt: 'Az eljegyzési gyűrű közeli képe' },
  { src: galleryHands, alt: 'Lilla és Norbi kézen fogva a tónál' },
  { src: galleryHighFive, alt: 'Lilla és Norbi a fűz alatt a tóparton' },
  { src: gallerySitting, alt: 'Lilla és Norbi egy fa alatt ülve' },
]

export default function HomePage() {
  return (
    <main>
      <section id="hero" className="hero">
        <div
          className="hero-bg"
          style={{ backgroundImage: `url(${heroPhoto})` }}
          aria-hidden="true"
        />
        <div className="hero-overlay" aria-hidden="true" />

        <div className="hero-content hero-content-centered">
          <p className="eyebrow">Enchanted forest wedding</p>
          <h1>Lilla &amp; Norbi</h1>
          <p className="wedding-date">2027. június 5.</p>
          <p className="hero-lead">
            Két ember, egy erdő és egy ígéret. Szeretettel hívunk, hogy velünk
            ünnepeld életünk legszebb napját.
          </p>
          <div className="hero-cta">
            <Link className="btn-primary" to="/rsvp">
              Visszajelzés
            </Link>
            <a className="btn-ghost" href="#invitation">
              Tovább
            </a>
          </div>
        </div>
      </section>

      <section id="invitation" className="invitation-section">
        <div className="invitation-card">
          <p className="eyebrow">Meghívó</p>
          <h2>Kedves Vendégeink!</h2>
          <p>
            Nagy örömmel osztjuk meg veletek, hogy összekötjük az életünket. Egy
            meghitt, erdei hangulatú napra készülünk, ahol a legfontosabb emberek
            vesznek körül minket.
          </p>
          <p>
            Ezen az oldalon minden fontos tudnivalót összegyűjtöttünk: a nap
            menetrendjét, a helyszínt, a dress code-ot és a visszajelzés
            lehetőségét. Kérünk, nézz körül, és jelezd, hogy számíthatunk-e rád.
          </p>
          <p className="invitation-signature">Szeretettel, Lilla &amp; Norbi</p>
        </div>
      </section>

      <section id="quick-actions" className="quick-actions" aria-label="Gyors elérés">
        {quickActions.map((action) =>
          action.type === 'route' ? (
            <Link className="quick-action" to={action.to} key={action.label}>
              <span className="quick-action-title">{action.label}</span>
              <span className="quick-action-text">{action.description}</span>
            </Link>
          ) : (
            <a className="quick-action" href={action.href} key={action.label}>
              <span className="quick-action-title">{action.label}</span>
              <span className="quick-action-text">{action.description}</span>
            </a>
          ),
        )}
      </section>

      <section id="story" className="editorial-section">
        <div className="editorial-media">
          <img src={storyPhoto} alt="Lilla és Norbi a fűzfa alatt a tóparton" />
        </div>
        <div className="editorial-body">
          <p className="eyebrow">A történetünk</p>
          <h2>Az út idáig</h2>
          <ol className="story-timeline">
            {storyMilestones.map((milestone) => (
              <li key={milestone.year}>
                <span className="story-year">{milestone.year}</span>
                <div>
                  <h3>{milestone.title}</h3>
                  <p>{milestone.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="important-info" className="editorial-section is-reversed">
        <div className="editorial-media">
          <img src={infoPhoto} alt="Lilla és Norbi ölelkezve a tónál" />
        </div>
        <div className="editorial-body">
          <p className="eyebrow">Vendéginformációk</p>
          <h2>Fontos információk</h2>
          <div className="info-grid">
            {infoCards.map((card) => (
              <article className="info-card" key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="schedule" className="content-section schedule-section">
        <p className="eyebrow">A nap menete</p>
        <h2>Menetrend</h2>
        <p className="section-lead">
          Így alakul majd a nagy nap. A végleges időpontokat a helyszínen és itt
          is megerősítjük.
        </p>
        <ol className="schedule-preview">
          {schedulePreview.map((item) => (
            <li key={item.time}>
              <span className="schedule-time">{item.time}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="dress-code" className="content-section dresscode-section">
        <p className="eyebrow">Hangulat</p>
        <h2>Dress code</h2>
        <p className="section-lead">
          Az esküvő témája enchanted forest. Kérünk, öltözzetek az erdő
          színvilágához: természetes zöldek, meleg barnák, bézs árnyalatok és
          finom arany részletek. A talpig fehéret a menyasszonynak tartogatjuk.
        </p>
        <div className="swatch-grid">
          {dressCodeSwatches.map((swatch) => (
            <figure className="swatch" key={swatch.name}>
              <span className="swatch-color" style={{ background: swatch.color }} />
              <figcaption>{swatch.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="gallery" className="content-section gallery-section">
        <p className="eyebrow">Galéria</p>
        <h2>Pillanatok</h2>
        <p className="section-lead">
          Néhány kedvenc közös képünk. Az esküvő után ide kerülnek majd a nap
          legszebb fotói is.
        </p>
        <div className="gallery-track" aria-label="Lapozható képgaléria" tabIndex="0">
          {galleryImages.map((image) => (
            <figure className="gallery-card" key={image.alt}>
              <img src={image.src} alt={image.alt} />
            </figure>
          ))}
        </div>
      </section>
    </main>
  )
}
