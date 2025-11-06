
'use client';

import { useEffect, useRef } from 'react';

export function StarsBackground() {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const container = canvasRef.current;
    const starCount = 200;
    const stars: HTMLDivElement[] = [];

    // Clear existing stars
    container.innerHTML = '';

    // Create stars
    for (let i = 0; i < starCount; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      
      // Random size
      const size = Math.random() * 2 + 1;
      star.style.width = `${size}px`;
      star.style.height = `${size}px`;
      
      // Random position
      star.style.left = `${Math.random() * 100}%`;
      star.style.top = `${Math.random() * 100}%`;
      
      // Random animation duration and delay
      const duration = Math.random() * 3 + 2;
      const delay = Math.random() * 2;
      star.style.animationDuration = `${duration}s`;
      star.style.animationDelay = `${delay}s`;
      
      // Add opacity variation
      star.style.opacity = `${Math.random() * 0.7 + 0.3}`;
      
      container.appendChild(star);
      stars.push(star);
    }

    // Animate stars moving downward
    stars.forEach((star, index) => {
      const moveDuration = Math.random() * 50 + 50; // 50-100s
      const delay = Math.random() * 10;
      
      star.style.animation = `twinkle ${Math.random() * 3 + 2}s linear infinite, moveStar ${moveDuration}s linear ${delay}s infinite`;
    });

    return () => {
      container.innerHTML = '';
    };
  }, []);

  return <div ref={canvasRef} className="stars-background" />;
}
