import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: string;
  className?: string;
  fullPage?: boolean;
  centered?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = '1.5rem', 
  className = '', 
  fullPage = false,
  centered = false 
}) => {
  const spinner = (
    <span 
      className={`loading-spinner ${className}`} 
      style={{ width: size, height: size }} 
    />
  );

  if (fullPage) {
    return (
      <div className="spinner-container-full">
        {spinner}
      </div>
    );
  }

  if (centered) {
    return (
      <div className="spinner-container-centered">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default LoadingSpinner;
