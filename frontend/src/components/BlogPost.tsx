import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPostBySlug, type BlogPost } from '../utils/blogParser';
import echolabLogo from '../assets/echolab-logo.png';
import './BlogPost.css';

function BlogPostComponent() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (slug) {
      try {
        const foundPost = getPostBySlug(slug);
        setPost(foundPost);
      } catch (error) {
        console.error('Error loading post:', error);
      } finally {
        setLoading(false);
      }
    }
  }, [slug]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (loading) {
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
              <a href="https://calendar.app.google/TBoLz96A9MSa8fhx6" target="_blank" rel="noopener noreferrer" className="btn-primary">Book a Call</a>
            </div>
          </div>
        </nav>
        <div className="blog-post-container">
          <div className="container">
            <p>Loading post...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
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
              <a href="https://calendar.app.google/TBoLz96A9MSa8fhx6" target="_blank" rel="noopener noreferrer" className="btn-primary">Book a Call</a>
            </div>
          </div>
        </nav>
        <div className="blog-post-container">
          <div className="container">
            <h1>Post not found</h1>
            <Link to="/blog" className="back-link">← Back to Blog</Link>
          </div>
        </div>
      </div>
    );
  }

  // Simple markdown-like parsing for headers and paragraphs
  const parseContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactElement[] = [];
    let currentParagraph: string[] = [];
    let key = 0;

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join(' ').trim();
        if (text) {
          elements.push(<p key={key++}>{text}</p>);
        }
        currentParagraph = [];
      }
    };

    lines.forEach((line) => {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('# ')) {
        flushParagraph();
        elements.push(<h1 key={key++}>{trimmed.substring(2)}</h1>);
      } else if (trimmed.startsWith('## ')) {
        flushParagraph();
        elements.push(<h2 key={key++}>{trimmed.substring(3)}</h2>);
      } else if (trimmed.startsWith('### ')) {
        flushParagraph();
        elements.push(<h3 key={key++}>{trimmed.substring(4)}</h3>);
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        flushParagraph();
        elements.push(<li key={key++}>{trimmed.substring(2)}</li>);
      } else if (trimmed === '') {
        flushParagraph();
      } else {
        currentParagraph.push(trimmed);
      }
    });

    flushParagraph();

    return elements;
  };

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
            <a href="https://calendar.app.google/TBoLz96A9MSa8fhx6" target="_blank" rel="noopener noreferrer" className="btn-primary">Book a Call</a>
          </div>
        </div>
      </nav>
      <div className="blog-post-container">
        <div className="container">
          <Link to="/blog" className="back-link">← Back to Blog</Link>
          
          <article className="blog-post">
          <div className="blog-post-header">
            <div className="blog-post-date">
              {(() => {
                const [year, month, day] = post.date.split('-').map(Number);
                return new Date(year, month - 1, day).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
              })()}
            </div>
            <h1 className="blog-post-title">{post.title}</h1>
            {post.image && (
              <div className="blog-post-image">
                <img src={post.image} alt={post.title} />
              </div>
            )}
          </div>
          
          <div className="blog-post-content">
            {parseContent(post.content)}
          </div>
        </article>
      </div>
    </div>
    </div>
  );
}

export default BlogPostComponent;

