import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import echolabLogo from '../assets/echolab-logo.png'

function Home() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [prompt, setPrompt] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

    return (
    <div className="app">
      {/* Navigation */}
      <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
        <div className="nav-container">
          <div className="logo">
            <Link to="/">
              <img src={echolabLogo} alt="EchoLab" className="logo-icon" />
              <span className="logo-text">Echo Lab</span>
            </Link>
          </div>
          <div className="nav-links">
            <a href="#about">About</a>
            <a href="#features">Features</a>
            <Link to="/blog">Blog</Link>
            {/* <a href="#contact">Contact</a> */}
            <a href="https://calendar.app.google/Ng5gE1kFfL7uxcRz7" target="_blank" rel="noopener noreferrer" className="btn-primary">Book a Call</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="hero" className="hero">
        <div className="hero-background">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
        </div>
        <div className="hero-content">
          <div className="hero-badge">
            <span>✨ AI-Powered Video & Audio Generation</span>
          </div>
          <h1 className="hero-title">
            Create Any Video By Chatting With
            <span className="gradient-text"> Echo</span>
          </h1>
          <p className="hero-description">
            Echo Lab lets anyone of all backgrounds generate high-quality videos faster than ever before, powered by the best video tools
          </p>
          <div style={{display: 'flex', justifyContent: 'center', marginTop: 24, width: '100%'}}>
            <div style={{width: '100%', maxWidth: 980, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14}}>
              <div style={{width: '100%', display: 'flex', justifyContent: 'center'}}>
                <div style={{display: 'flex', width: '100%', maxWidth: 820}}>
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (prompt.trim()) navigate('/video', { state: { prompt: prompt.trim(), autoGenerate: true } })
                      }
                    }}
                    placeholder="Ask something, e.g. 'Explain quantum entanglement in 20s'"
                    style={{flex: 1, padding: '16px 18px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 18, height: 56}}
                  />
                  <button
                    onClick={() => { if (prompt.trim()) navigate('/video', { state: { prompt: prompt.trim(), autoGenerate: true } }) }}
                    className="btn-primary"
                    aria-label="Generate video"
                    style={{width: 64, marginLeft: 10, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20}}
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="hero-cta">
            <a href="https://calendar.app.google/Ng5gE1kFfL7uxcRz7" target="_blank" rel="noopener noreferrer" className="btn-primary btn-large">Book a Call</a>
            <a href="https://www.youtube.com/@tryecho" target="_blank" rel="noopener noreferrer" className="btn-secondary btn-large">Watch Demo</a>
          </div>
          {/* <div className="hero-stats">
            <div className="stat">
              <div className="stat-value">99.9%</div>
              <div className="stat-label">Accuracy</div>
            </div>
            <div className="stat">
              <div className="stat-value">10x</div>
              <div className="stat-label">Faster</div>
            </div>
            <div className="stat">
              <div className="stat-value">24/7</div>
              <div className="stat-label">Available</div>
            </div>
          </div> */}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about">
        <div className="container">
          <div className="about-content">
            <div className="about-text">
              <h2 className="section-title">Our Mission</h2>
              <p className="about-description bolded-description"><strong>Everyone can be a filmmaker</strong></p>
              <p className="about-description">
                The best AI video models should be in the hands of everyone, not just those with technical expertise or big budgets. 
              </p> 
              <p className="about-description">
                At Echo Lab, our mission is to democratize access to powerful video generation tools, enabling anyone to create high-quality videos with just a few words.
              </p>
              {/* <div className="about-features">
                <div className="about-feature">
                  <span className="check-icon">✓</span>
                  <span>No technical expertise required</span>
                </div>
                <div className="about-feature">
                  <span className="check-icon">✓</span>
                  <span>Enterprise-grade security</span>
                </div>
                <div className="about-feature">
                  <span className="check-icon">✓</span>
                  <span>Scalable infrastructure</span>
                </div>
              </div> */}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Powerful Features</h2>
            <p className="section-description">
              Creates your videos by integrating the best video tools
            </p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎬</div>
              <h3 className="feature-title">Video Processing</h3>
              <p className="feature-description">
                Automatically processes, stitches, and enhances video scenes with AI-powered tools
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎙️</div>
              <h3 className="feature-title">Audio Transcription</h3>
              <p className="feature-description">
                Transcribes the video with industry-leading accuracy and multiple language support
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📝</div>
              <h3 className="feature-title">Smart Captions</h3>
              <p className="feature-description">
                Generates professional, time-synced captions that enhance accessibility and engagement
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔊</div>
              <h3 className="feature-title">Voice Synthesis</h3>
              <p className="feature-description">
                Creates natural-sounding voiceovers and dubbing in multiple voices and languages
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🎨</div>
              <h3 className="feature-title">Scene Stitching</h3>
              <p className="feature-description">
                Seamlessly combines multiple video scenes with intelligent transitions
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3 className="feature-title">Lightning Fast</h3>
              <p className="feature-description">
                Processes large files in minutes, not hours, with our optimized AI pipeline
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Let Your Imagination Run Wild?</h2>
            <p className="cta-description">
              {/* Join thousands of creators using EchoLab to streamline their workflow */}
            </p>
            <a href="https://calendar.app.google/Ng5gE1kFfL7uxcRz7" target="_blank" rel="noopener noreferrer" className="btn-primary btn-large">Book a Call</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <div className="logo">
                <img src={echolabLogo} alt="EchoLab" className="logo-icon" />
                <span className="logo-text">EchoLab</span>
              </div>
              <p className="footer-description">
                Create videos in seconds by chatting with AI
              </p>
            </div>
            <div className="footer-section">
              <h4 className="footer-title">Product</h4>
              <a href="#features">Features</a>
              <a href="#pricing">Pricing</a>
              <a href="#docs">Documentation</a>
            </div>
            <div className="footer-section">
              <h4 className="footer-title">Company</h4>
              <a href="#about">About</a>
              <Link to="/blog">Blog</Link>
              <a href="#careers">Careers</a>
            </div>
            <div className="footer-section">
              <h4 className="footer-title">Support</h4>
              <a href="#contact">Contact</a>
              <a href="#help">Help Center</a>
              <a href="#status">Status</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 EchoLab. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home

