import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllPosts, type BlogPost } from '../utils/blogParser';
import echolabLogo from '../assets/echolab-logo.png';
import './BlogList.css';

function BlogList() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    try {
      const allPosts = getAllPosts();
      setPosts(allPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) {
    return (
      <div className="blog-container">
        <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
          <div className="nav-container">
            <div className="logo">
              <Link to="/">
                <img src={echolabLogo} alt="EchoLab" className="logo-icon" />
                <span className="logo-text">Echo Lab</span>
              </Link>
            </div>
            <div className="nav-links">
              <a href="/#about">About</a>
              <a href="/#features">Features</a>
              <Link to="/blog">Blog</Link>
              <a href="https://calendar.app.google/Ng5gE1kFfL7uxcRz7" target="_blank" rel="noopener noreferrer" className="btn-primary">Book a Call</a>
            </div>
          </div>
        </nav>
        <div className="blog-container">
          <div className="container">
            <h2 className="section-title">Blog</h2>
            <p>Loading posts...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
        <div className="nav-container">
          <div className="logo">
            <Link to="/">
              <img src={echolabLogo} alt="EchoLab" className="logo-icon" />
              <span className="logo-text">Echo Lab</span>
            </Link>
          </div>
          <div className="nav-links">
            <a href="/#about">About</a>
            <a href="/#features">Features</a>
            <Link to="/blog">Blog</Link>
            <a href="https://calendar.app.google/Ng5gE1kFfL7uxcRz7" target="_blank" rel="noopener noreferrer" className="btn-primary">Book a Call</a>
          </div>
        </div>
      </nav>
      <section id="blog" className="blog-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Blog</h2>
            <p className="section-description">
              Stay updated with the latest news and insights from Echo Lab
            </p>
          </div>
        <div className="blog-grid">
          {posts.map((post) => (
            <article key={post.slug} className="blog-card">
              <div className="blog-card-image">
                <img src={post.image} alt={post.title} />
              </div>
              <div className="blog-card-content">
                <div className="blog-card-date">
                  {(() => {
                    const [year, month, day] = post.date.split('-').map(Number);
                    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    });
                  })()}
                </div>
                <h3 className="blog-card-title">{post.title}</h3>
                <p className="blog-card-excerpt">{post.excerpt}</p>
                <Link 
                  to={`/blog/${post.slug}`} 
                  className="blog-read-more"
                >
                  Read More →
                </Link>
              </div>
            </article>
          ))}
        </div>
        </div>
      </section>
    </div>
  );
}

export default BlogList;

