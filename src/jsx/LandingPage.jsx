import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../css/LandingPage.css';

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
  const gameApkUrl = `${import.meta.env.BASE_URL}downloads/drive-the-right-way.apk`;
  const [gameApkAvailable, setGameApkAvailable] = useState(null);
  const [gameApkCheckError, setGameApkCheckError] = useState('');

  useEffect(() => {
    if (location.hash === '#faq') {
      document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
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
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <header className="landing-header">
            <div className="landing-brand">
              <img src={`${import.meta.env.BASE_URL}riteway-logo.png`} alt="" />
              <span>Riteway<br />Driving School</span>
            </div>
            <nav aria-label="Main navigation">
              <a href="#faq">FAQ</a>
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
              {gameApkAvailable
                ? <a className="landing-button landing-button-secondary" href={gameApkUrl} download>Download the game</a>
                : (
                  <button className="landing-button landing-button-secondary" type="button" disabled>
                    {gameApkAvailable === null ? 'Checking game download...' : 'Game APK coming soon'}
                  </button>
                )}
            </div>
            <p className="landing-download-note">
              {gameApkCheckError || (gameApkAvailable
                ? 'Android game APK is ready to download.'
                : 'The Android game download will be posted here soon.')}
            </p>
          </div>
          <p className="landing-footer">Riteway Driving School <span>·</span> Drive the right way</p>
        </div>

        <div className="landing-art">
          <img
            className="landing-scene"
            src={`${import.meta.env.BASE_URL}landing-driving-school.png`}
            alt="Drive the Right Way: a red car in front of Riteway Driving School"
            width="768"
            height="1777"
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
    </main>
  );
}
