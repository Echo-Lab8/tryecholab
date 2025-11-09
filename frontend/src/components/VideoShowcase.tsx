import { useRef, useEffect } from 'react';
import './VideoShowcase.css';

interface Video {
  id: string;
  url: string;
  thumbnail?: string;
}

interface VideoShowcaseProps {
  videos: Video[];
}

export const VideoShowcase = ({ videos }: VideoShowcaseProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clone first few items and append them to the end for seamless loop
    const videoElements = container.querySelectorAll('.video-item');
    const clonedElements = Array.from(videoElements)
      .slice(0, Math.min(3, videoElements.length))
      .map(el => el.cloneNode(true));
    
    clonedElements.forEach(el => container.appendChild(el));
  }, [videos]);

  const handleVideoInView = (video: HTMLVideoElement) => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play();
          } else {
            video.pause();
            video.currentTime = 0;
          }
        });
      },
      { threshold: 0.6 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  };

  useEffect(() => {
    const videoElements = document.querySelectorAll('.video-item video');
    videoElements.forEach(video => handleVideoInView(video as HTMLVideoElement));
  }, [videos]);

  return (
    <div className="video-showcase-container">
      <div className="video-scroll-container" ref={containerRef}>
        {videos.map((video) => (
          <div key={video.id} className="video-item">
            <video
              src={video.url}
              loop
              muted
              playsInline
              poster={video.thumbnail}
              className="shorts-video"
            />
          </div>
        ))}
      </div>
    </div>
  );
};