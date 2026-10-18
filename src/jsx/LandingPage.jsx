import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../css/LandingPage.css';

const schoolMapUrl = 'https://www.bing.com/maps/default.aspx?v=2&where1=14.6597533%2C%20120.9797944&name=Unit%20D%20%2364%20JP%20Bautista%20Street%2C%20Barangay%2079%2C%20Caloocan%2C%20Philippines%2C%201400';

const faqs = [
  {
    question: 'How do I sign in?',
    answer: 'Choose Log in and use the email and password assigned to your school account. If you do not have an account, contact your school administrator.',
  },
  {
    question: 'What should I do if I forgot my password?',
    answer: 'Click Forgot password on the sign-in page, enter your account email, and follow the reset link sent to your email.',
  },
  {
    question: 'Are you LTO-accredited?',
    answer: 'Yes. Accredited driving schools are certified by the Land Transportation Office (LTO). You can verify a school’s accreditation on the LTO official website.',
  },
  {
    question: 'What are the achievement badges on my profile dashboard?',
    answer: 'These badges represent achievements collected in the driving game. Badges are earned in the game and appear there for students and instructors to see.',
  },
];

export default function LandingPage() {
  const location = useLocation();
  const gameApkUrl = `${import.meta.env.BASE_URL}downloads/intro2driving.apk`;
  const [gameApkAvailable, setGameApkAvailable] = useState(null);
  const [gameApkCheckError, setGameApkCheckError] = useState('');

  useEffect(() => {
    const sectionId = location.hash.slice(1);
    if (['about', 'faq', 'download', 'contact'].includes(sectionId)) {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
      document.getElementById(sectionId)?.scrollIntoView({ behavior });
    }
  }, [location.hash]);

  useEffect(() => {
    let active = true;
    fetch(gameApkUrl, { method: 'HEAD' })
      .then((response) => {
        const contentType = response.headers.get('content-type') || '';
        if (active) setGameApkAvailable(response.ok && !contentType.includes('text/html'));
      })
      .catch(() => {
        if (active) {
          setGameApkCheckError('The game download could not be checked. Please try again later.');
          setGameApkAvailable(false);
        }
      });
    return () => { active = false; };
  }, [gameApkUrl]);

  return (
    <main className="public-landing">
      <section className="landing-hero" id="about" aria-labelledby="landing-title">
        <div className="landing-copy">
          <header className="landing-header">
            <div className="landing-brand">
              <img src={`${import.meta.env.BASE_URL}riteway-logo.png`} alt="" />
              <span>Riteway<br />Driving School</span>
            </div>
            <nav aria-label="Main navigation">
              <a href="#about">About</a>
              <a href="#faq">FAQ</a>
              <a href="#contact">Contact</a>
              <a className="landing-nav-download" href="#download">Download</a>
              <Link className="landing-nav-login" to="/login">Log in</Link>
            </nav>
          </header>

          <div className="landing-intro">
            <p className="landing-eyebrow">LEARN WITH CONFIDENCE</p>
            <h1 id="landing-title">Drive the<br /><span>right way.</span></h1>
            <p className="landing-description">
              Your journey to safer driving starts here. Learn, practice, and keep track of your progress with Riteway.
            </p>
            <div className="landing-actions">
              <Link className="landing-button landing-button-primary" to="/login">Log in to your portal</Link>
              <a className="landing-button landing-button-secondary" href="#download">Download the game</a>
            </div>
            <p className="landing-download-note">
              {gameApkCheckError || (gameApkAvailable
                ? 'Intro2driving is ready to download for Android.'
                : 'Intro2driving for Android is coming soon.')}
            </p>
          </div>
          <p className="landing-footer">Riteway Driving School <span>·</span> Drive the right way</p>
        </div>

        <div className="landing-art">
          <img
            className="landing-scene"
            src={`${import.meta.env.BASE_URL}landing-driving-school.png`}
            alt="Drive the Right Way: a red car in front of Riteway Driving School"
            width="1312"
            height="1873"
            fetchPriority="high"
            decoding="async"
          />
        </div>
      </section>

      <section className="landing-faq" id="faq" aria-labelledby="faq-title">
        <div className="landing-faq-heading">
          <p className="landing-eyebrow">NEED A HAND?</p>
          <h2 id="faq-title">Frequently asked questions</h2>
          <p>Quick answers to help you get started.</p>
        </div>
        <div className="landing-faq-list">
          {faqs.map(({ question, answer }) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
        <Link className="landing-faq-login" to="/login">Ready to get started? Log in</Link>
      </section>

      <div className="landing-school-sections">
        <section className="landing-download" id="download" aria-labelledby="download-title">
          <div className="landing-game-panel">
            <div className="landing-download-copy">
              <div className="landing-game-brand">
                <img src={`${import.meta.env.BASE_URL}riteway-logo.png`} alt="" width="56" height="56" />
                <div>
                  <p>Intro2driving</p>
                  <span>BY RITEWAY DRIVING SCHOOL</span>
                </div>
              </div>
              <h2 id="download-title">A new way to<br /><span>learn the road.</span></h2>
              <p className="landing-game-description">
                A little play. A little practice. Get ready for the road with Intro2driving,
                the Android driving game from Riteway.
              </p>
              <div className="landing-game-platform"><span aria-hidden="true">↓</span> ANDROID GAME <span aria-hidden="true">/</span> APK DOWNLOAD</div>
              {gameApkAvailable
                ? <a className="landing-apk-button" href={gameApkUrl} download="Intro2driving.apk"><span aria-hidden="true">↓</span> Download for Android</a>
                : (
                  <button className="landing-apk-button" type="button" disabled aria-describedby="landing-apk-status">
                    <span aria-hidden="true">↓</span>
                    {gameApkAvailable === null ? 'Checking availability…' : 'Coming soon for Android'}
                  </button>
                )}
              <p className="landing-apk-status" id="landing-apk-status" role="status">
                {gameApkCheckError || (gameApkAvailable === null
                  ? 'Checking the Intro2driving download…'
                  : gameApkAvailable
                    ? 'Your next drive is ready. Download the APK to get started.'
                    : 'Our next stop: Android. The APK will be available here soon.')}
              </p>
            </div>

            <div className="landing-game-art" aria-hidden="true">
              <div className="landing-game-art-heading"><span className="landing-art-marker" /> THE ROAD IS JUST THE BEGINNING</div>
              <svg className="landing-practice-road" viewBox="0 0 420 430" fill="none">
                <path d="M440 365H125C85 365 65 345 65 305V245C65 205 85 185 125 185H295C335 185 355 165 355 125V-20" stroke="#fff" strokeOpacity=".09" strokeWidth="72" />
                <path d="M440 365H125C85 365 65 345 65 305V245C65 205 85 185 125 185H295C335 185 355 165 355 125V-20" stroke="#fff" strokeOpacity=".55" strokeWidth="2" strokeDasharray="10 12" />
                <circle cx="65" cy="282" r="12" fill="#fff" />
                <circle cx="65" cy="282" r="5" fill="#0561ef" />
                <circle cx="355" cy="64" r="12" fill="#fff" />
                <circle cx="355" cy="64" r="5" fill="#e51e2a" />
                <g transform="translate(183 164)">
                  <rect x="12" y="-4" width="16" height="7" rx="2" fill="#071c48" />
                  <rect x="45" y="-4" width="16" height="7" rx="2" fill="#071c48" />
                  <rect x="12" y="35" width="16" height="7" rx="2" fill="#071c48" />
                  <rect x="45" y="35" width="16" height="7" rx="2" fill="#071c48" />
                  <rect width="74" height="38" rx="12" fill="#e51e2a" />
                  <path d="M24 5h21l9 5v18l-9 5H24l-5-7V12l5-7Z" fill="#f7fbff" />
                  <path d="m45 6 9 5v16l-9 5V6Z" fill="#9cc9fa" />
                  <path d="M25 8h16v22H25z" fill="#b91b2c" />
                  <path d="M68 8v6m0 10v6" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                </g>
                <path d="m140 185-6-5m6 5-6 5m6-5h-15M355 105l-5 6m5-6 5 6m-5-6v15" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="landing-game-art-caption">
                <p>Small steps.<br /><strong>More confidence.</strong></p>
              </div>
              <span className="landing-game-art-brand">RITEWAY <span>→</span></span>
            </div>
          </div>

          <div className="landing-install-heading">
            <h3>From download to your first drive.</h3>
            <p>Your quick start, once the game arrives.</p>
          </div>
          <ol className="landing-download-steps">
            <li>
              <span className="landing-step-number" aria-hidden="true">01</span>
              <div><h4>Get the game</h4><p>Download the Intro2driving APK to your Android phone when it becomes available.</p></div>
            </li>
            <li>
              <span className="landing-step-number" aria-hidden="true">02</span>
              <div><h4>Make it yours</h4><p>Open the file to install. If prompted, allow your browser to install the game.</p></div>
            </li>
            <li>
              <span className="landing-step-number" aria-hidden="true">03</span>
              <div><h4>Take the wheel</h4><p>Launch Intro2driving and start your driving practice.</p></div>
            </li>
          </ol>
        </section>

        <section className="landing-contact" id="contact" aria-labelledby="contact-title">
          <div className="landing-contact-heading">
            <p className="landing-eyebrow">LET’S GET YOU ON THE ROAD</p>
            <h2 id="contact-title">Contact the school</h2>
            <p className="landing-section-description">
              Visit our Caloocan branch to learn more. Already a student?{' '}
              <Link to="/login">Log in to your portal</Link> to send the school a message.
            </p>
          </div>
          <dl className="landing-contact-details">
            <div>
              <dt>School</dt>
              <dd>Riteway Driving School - Caloocan</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>
                <address>
                  <a href={schoolMapUrl} target="_blank" rel="noopener noreferrer">
                    Unit D #64 JP Bautista Street, Barangay 79, Caloocan, Philippines, 1400
                    <span className="landing-map-link">View on map <span aria-hidden="true">↗</span><span className="landing-sr-only"> (opens in a new tab)</span></span>
                  </a>
                </address>
              </dd>
            </div>
          </dl>
        </section>

        <footer className="landing-site-footer">
          <div>
            <p>© {new Date().getFullYear()} Riteway Driving School - Caloocan.</p>
            <a href="#about">Back to top <span aria-hidden="true">↑</span></a>
          </div>
        </footer>
      </div>
    </main>
  );
}
