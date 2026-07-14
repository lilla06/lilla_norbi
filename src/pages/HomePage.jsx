import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Monogram from '../components/Monogram'
import { supabase } from '../lib/supabase'
import heroPoster from '../assets/fcaa2d02-5523-4e23-b660-656f0c8e0eea.jpg'
import infoPhoto from '../assets/d336ad11-89cc-48ea-b1f0-0b53cef877b8.jpg'
import storyMet from '../assets/3474ed38-0961-44d5-89f0-27b60ba81180.jpg'
import storyTravel from '../assets/dec6824b-8d3d-4294-966c-b8c0e519e7c5.jpg'
import storyProposal from '../assets/59be6e4a-8845-44a3-9c36-749da124c984.jpg'
import storyBigDay from '../assets/a365840d-f406-4cee-bbd8-b20b75672936.jpg'
import galleryBacklit from '../assets/f8465e2b-cc8c-4ece-ba30-7f6d97183f94.jpg'
import galleryPortrait from '../assets/019f4b71-54ab-4770-b9ec-eb99c7b02036.jpg'
import galleryCheekKiss from '../assets/d982c42b-696c-494e-8b03-02186cdeb177.jpg'
import galleryDip from '../assets/d61d070b-3781-4ea9-9949-c9b50272db20.jpg'
import galleryRing from '../assets/c7e247fc-cbb7-40a4-b78c-c583eb73b609.jpg'
import galleryHands from '../assets/61da3cf8-c618-49c7-bcf5-f21c77e268ec.jpg'
import galleryHighFive from '../assets/2c30ff7d-604d-40cb-ad01-e8141e1c4f31.jpg'
import gallerySitting from '../assets/2bd4f1fd-b6e8-4b93-b8f9-fb9f1c688ccb.jpg'

// A Supabase Storage-ra feltöltött álló (Instagram) save-the-date videó
// nyilvános URL-je. Amíg üres, a hero a poszter fotót mutatja.
const heroVideoSrc =
  'https://aqlhjwejodudvfuhmcmi.supabase.co/storage/v1/object/public/wedding_media/save%20the%20date3_compressed2.mp4'

const WEDDING_DATE = new Date(2027, 5, 5, 14, 30, 0)

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
    image: storyMet,
    imageAlt: 'Lilla és Norbi egymást átölelve',
  },
  {
    year: '2021',
    title: 'Az első közös utazás',
    text: 'Egy erdei kiránduláson jöttünk rá, hogy a csendben is jó együtt lenni.',
    image: storyTravel,
    imageAlt: 'Lilla és Norbi egymás szemébe nézve',
  },
  {
    year: '2025',
    title: 'Az igen',
    text: 'Egy naplementés séta végén, a fák között tettük fel életünk legszebb kérdését.',
    image: storyProposal,
    imageAlt: 'Norbi megcsókolja Lilla kezét, látszik az eljegyzési gyűrű',
  },
  {
    year: '2027',
    title: 'A nagy nap',
    text: 'Most pedig szeretnénk, ha ti is velünk lennétek, amikor kimondjuk a boldogító igent.',
    image: storyBigDay,
    imageAlt: 'Lilla és Norbi táncolva a tóparton',
  },
]

// Éjfél utáni időpontokat (06:00 előtt) a nap végére soroljuk, hogy a
// menetrend valós idősorrendben jelenjen meg.
function scheduleMinutes(time) {
  const [hours, minutes] = (time || '').split(':').map(Number)
  const total = (hours || 0) * 60 + (minutes || 0)

  return total < 360 ? total + 1440 : total
}

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
  {
    title: 'Nászajándék',
    text: 'A legnagyobb ajándék számunkra, hogy velünk ünnepeltek. Ha mégis meglepnétek minket, jókívánságaitokat egy borítékban hálásan fogadjuk.',
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

function pad(value) {
  return String(value).padStart(2, '0')
}

function getTimeLeft(target) {
  const diff = target.getTime() - Date.now()

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true }
  }

  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    isPast: false,
  }
}

function Countdown() {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(WEDDING_DATE))

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTimeLeft(getTimeLeft(WEDDING_DATE))
    }, 1000)

    return () => clearInterval(intervalId)
  }, [])

  if (timeLeft.isPast) {
    return <p className="countdown-past">Végre elérkezett a nagy nap!</p>
  }

  const items = [
    { value: timeLeft.days, label: 'Nap' },
    { value: pad(timeLeft.hours), label: 'Óra' },
    { value: pad(timeLeft.minutes), label: 'Perc' },
    { value: pad(timeLeft.seconds), label: 'Másodperc' },
  ]

  return (
    <div className="countdown" aria-label="Visszaszámlálás az esküvőig">
      {items.map((item) => (
        <div className="countdown-item" key={item.label}>
          <span className="countdown-value">{item.value}</span>
          <span className="countdown-label">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function useScrollReveal() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('.reveal'))

    if (elements.length === 0) {
      return undefined
    }

    if (
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      elements.forEach((element) => element.classList.add('is-visible'))
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )

    elements.forEach((element) => observer.observe(element))

    return () => observer.disconnect()
  }, [])
}

export default function HomePage() {
  useScrollReveal()
  const [scheduleItems, setScheduleItems] = useState([])
  const [isSchedulePublished, setIsSchedulePublished] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(true)
  const [isVideoPaused, setIsVideoPaused] = useState(false)
  const heroVideoRef = useRef(null)

  function playVideo() {
    const video = heroVideoRef.current

    if (!video) {
      return
    }

    const playResult = video.play()

    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(() => {})
    }
  }

  // A React nem mindig állítja be a `muted` attribútumot a DOM-on, ezért
  // ref-en keresztül biztosítjuk, majd elindítjuk a lejátszást. Enélkül a
  // mobil böngészők „nem némítottnak” látják a videót és blokkolják az autoplayt.
  // Emellett figyeljük a lejátszás állapotát, és ha megáll, megjelenítjük a
  // lejátszás gombot; láthatóvá váláskor pedig megpróbáljuk újraindítani.
  useEffect(() => {
    const video = heroVideoRef.current

    if (!video) {
      return
    }

    video.muted = true
    video.defaultMuted = true

    function tryPlay() {
      const playResult = video.play()

      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(() => {})
      }
    }

    function handlePlaying() {
      setIsVideoPaused(false)
    }

    function handlePause() {
      setIsVideoPaused(true)
    }

    function handleEnded() {
      tryPlay()
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible' && video.paused) {
        tryPlay()
      }
    }

    video.addEventListener('play', handlePlaying)
    video.addEventListener('playing', handlePlaying)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)
    document.addEventListener('visibilitychange', handleVisibility)

    tryPlay()

    return () => {
      video.removeEventListener('play', handlePlaying)
      video.removeEventListener('playing', handlePlaying)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  function toggleVideoSound() {
    const video = heroVideoRef.current

    if (!video) {
      return
    }

    const nextMuted = !video.muted

    video.muted = nextMuted
    setIsVideoMuted(nextMuted)

    // Némítás feloldásakor a böngésző megkövetelheti az újraindítást,
    // ezért biztosítjuk, hogy fut a lejátszás.
    if (!nextMuted) {
      const playResult = video.play()

      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch(() => {})
      }
    }
  }

  useEffect(() => {
    let isActive = true

    async function loadPublicSchedule() {
      const [scheduleResult, settingsResult] = await Promise.all([
        supabase
          .from('schedule_items')
          .select('event_time, title, is_public')
          .eq('is_public', true),
        supabase
          .from('site_settings')
          .select('schedule_published')
          .eq('id', 1)
          .maybeSingle(),
      ])

      if (!isActive) {
        return
      }

      setIsSchedulePublished(settingsResult.data?.schedule_published ?? false)

      const { data, error } = scheduleResult

      if (error || !data) {
        return
      }

      const items = data
        .map((item) => ({
          time: (item.event_time || '').slice(0, 5),
          title: item.title,
        }))
        .sort((a, b) => scheduleMinutes(a.time) - scheduleMinutes(b.time))

      setScheduleItems(items)
    }

    loadPublicSchedule()

    return () => {
      isActive = false
    }
  }, [])

  const showSchedule = isSchedulePublished && scheduleItems.length > 0

  return (
    <main>
      <section id="hero" className="hero">
        <div className="hero-inner">
          <div className="hero-media">
            <div className="hero-frame">
              {heroVideoSrc ? (
                <>
                  <video
                    ref={heroVideoRef}
                    className="hero-video"
                    autoPlay
                    muted
                    loop
                    playsInline
                    poster={heroPoster}
                  >
                    <source src={heroVideoSrc} type="video/mp4" />
                  </video>
                  <div className="hero-caption" aria-hidden="true">
                    <span className="hero-caption-eyebrow">Összeházasodunk</span>
                    <span className="hero-caption-title">Lilla &amp; Norbi</span>
                    <span className="hero-caption-date">2027. június 5.</span>
                  </div>
                  <button
                    type="button"
                    className={`hero-sound-toggle ${isVideoMuted ? 'is-muted' : ''}`}
                    onClick={toggleVideoSound}
                    aria-pressed={!isVideoMuted}
                    aria-label={isVideoMuted ? 'Hang bekapcsolása' : 'Hang némítása'}
                  >
                    <span className="hero-sound-icon" aria-hidden="true">
                      {isVideoMuted ? (
                        <svg viewBox="0 0 24 24">
                          <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
                          <path
                            d="M16 9.5l5 5m0-5l-5 5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24">
                          <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
                          <path
                            d="M16 8.5a4 4 0 010 7M18.5 6a7 7 0 010 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </span>
                  </button>
                  {isVideoPaused && (
                    <button
                      type="button"
                      className="hero-play-button"
                      onClick={playVideo}
                      aria-label="Videó lejátszása"
                    >
                      <span className="hero-play-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M8 5.2v13.6L19 12z" fill="currentColor" />
                        </svg>
                      </span>
                    </button>
                  )}
                </>
              ) : (
                <img className="hero-video" src={heroPoster} alt="Lilla és Norbi" />
              )}
            </div>
          </div>

          <div className="hero-panel">
            <Monogram />
            <p className="eyebrow">Összeházasodunk</p>
            <h1>Lilla &amp; Norbi</h1>
            <p className="wedding-date">2027. június 5.</p>
            <Countdown />
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
        </div>
      </section>

      <section id="invitation" className="invitation-section reveal">
        <div className="invitation-card">
          <Monogram />
          <p className="eyebrow">Meghívó</p>
          <h2>Kedves Vendégeink!</h2>
          <div className="gold-divider">
            <span>&#10022;</span>
          </div>
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

      <section id="quick-actions" className="quick-actions reveal" aria-label="Gyors elérés">
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

      <section id="story" className="content-section story-section reveal">
        <div className="section-head">
          <p className="eyebrow">A történetünk</p>
          <h2>Az út idáig</h2>
          <div className="gold-divider">
            <span>&#10022;</span>
          </div>
        </div>
        <ol className="story-list">
          {storyMilestones.map((milestone) => (
            <li className="story-item reveal" key={milestone.year}>
              <div className="story-photo">
                <img src={milestone.image} alt={milestone.imageAlt} loading="lazy" />
              </div>
              <div className="story-copy">
                <span className="story-year">{milestone.year}</span>
                <h3>{milestone.title}</h3>
                <p>{milestone.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="important-info" className="editorial-section is-reversed reveal">
        <div className="editorial-media">
          <img src={infoPhoto} alt="Lilla és Norbi ölelkezve a tónál" loading="lazy" />
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

      <section id="schedule" className="content-section schedule-section reveal">
        <div className="section-head">
          <p className="eyebrow">A nap menete</p>
          <h2>Menetrend</h2>
          <div className="gold-divider">
            <span>&#10022;</span>
          </div>
          <p className="section-lead">
            Így alakul majd a nagy nap. A végleges időpontokat a helyszínen és itt
            is megerősítjük.
          </p>
        </div>
        {!showSchedule ? (
          <p className="section-lead">
            Hamarosan jönnek a részletek.
          </p>
        ) : (
          <ol className="schedule-preview">
            {scheduleItems.map((item) => (
              <li key={`${item.time}-${item.title}`}>
                <span className="schedule-time">{item.time}</span>
                <div>
                  <h3>{item.title}</h3>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section id="dress-code" className="content-section dresscode-section reveal">
        <div className="section-head">
          <p className="eyebrow">Hangulat</p>
          <h2>Dress code</h2>
          <div className="gold-divider">
            <span>&#10022;</span>
          </div>
          <p className="section-lead">
            Az esküvő témája enchanted forest. Kérünk, öltözzetek az erdő
            színvilágához: természetes zöldek, meleg barnák, bézs árnyalatok és
            finom arany részletek. A talpig fehéret a menyasszonynak tartogatjuk.
          </p>
        </div>
        <div className="swatch-grid">
          {dressCodeSwatches.map((swatch) => (
            <figure className="swatch" key={swatch.name}>
              <span className="swatch-color" style={{ background: swatch.color }} />
              <figcaption>{swatch.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="gallery" className="content-section gallery-section reveal">
        <div className="section-head">
          <p className="eyebrow">Galéria</p>
          <h2>Pillanatok</h2>
          <div className="gold-divider">
            <span>&#10022;</span>
          </div>
          <p className="section-lead">
            Néhány kedvenc közös képünk. Az esküvő után ide kerülnek majd a nap
            legszebb fotói is.
          </p>
        </div>
        <div className="gallery-track" aria-label="Lapozható képgaléria" tabIndex="0">
          {galleryImages.map((image) => (
            <figure className="gallery-card" key={image.alt}>
              <img src={image.src} alt={image.alt} loading="lazy" />
            </figure>
          ))}
        </div>
      </section>
    </main>
  )
}
