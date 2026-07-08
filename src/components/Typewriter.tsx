import React, { useState, useEffect, useRef } from "react";

interface TypewriterProps {
  text: string;
  speed?: number; // ms per character
  onComplete?: () => void;
}

export const Typewriter: React.FC<TypewriterProps> = ({ text, speed = 12, onComplete }) => {
  const [displayedText, setDisplayedText] = useState("");
  const completedRef = useRef(false);

  useEffect(() => {
    let index = 0;
    setDisplayedText("");
    completedRef.current = false;
    
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText((prev) => prev + text.charAt(index));
        index++;
      } else {
        clearInterval(interval);
        if (!completedRef.current) {
          completedRef.current = true;
          if (onComplete) onComplete();
        }
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return <span className="whitespace-pre-wrap">{displayedText}</span>;
};
