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

      <div className="landing-dark-sections">
        <section className="landing-download" id="download" aria-labelledby="download-title">
          <div className="landing-download-copy">
            <p className="landing-eyebrow">LEARN. PLAY. DRIVE.</p>
            <h2 id="download-title">Download our game</h2>
            <p className="landing-section-description">
              Take the next step with <strong>Intro2driving</strong>, our driving game for Android.
              Install it directly from the APK file when it becomes available.
            </p>
            <p className="landing-steps-intro">Get started in three steps:</p>
            <ol className="landing-download-steps">
              <li>
                <span className="landing-step-number" aria-hidden="true">1</span>
                <p>Once available, tap <strong>Download APK</strong> on your Android phone.</p>
              </li>
              <li>
                <span className="landing-step-number" aria-hidden="true">2</span>
                <p>Open the downloaded file. If Android asks, allow installs from your browser.</p>
              </li>
              <li>
                <span className="landing-step-number" aria-hidden="true">3</span>
                <p>Open <strong>Intro2driving</strong> and start practicing.</p>
              </li>
            </ol>
          </div>

          <div className="landing-download-card">
            <div className="landing-download-card-inner">
              <p className="landing-game-name">Intro2driving</p>
              <div className="landing-qr-placeholder">
                <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
                  <rect x="19" y="5" width="26" height="54" rx="5" stroke="currentColor" strokeWidth="3" />
                  <path d="M27 11h10M28 52h8M32 21v20m-8-8 8 8 8-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <strong>Ready for your next drive?</strong>
                <span>QR code coming soon</span>
              </div>
              {gameApkAvailable
                ? <a className="landing-apk-button" href={gameApkUrl} download="Intro2driving.apk">Download APK</a>
                : (
                  <button className="landing-apk-button" type="button" disabled aria-describedby="landing-apk-status">
                    {gameApkAvailable === null ? 'Checking availability…' : 'Download APK · Coming soon'}
                  </button>
                )}
              <p className="landing-android-note">Android phones only</p>
            </div>
          </div>
          <p className="landing-apk-status" id="landing-apk-status" role="status">
            {gameApkCheckError || (gameApkAvailable === null
              ? 'Checking the Intro2driving download…'
              : gameApkAvailable
                ? 'Intro2driving is ready. Download the APK to get started.'
                : 'Intro2driving is on the way. The APK download will be available here soon.')}
          </p>
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
