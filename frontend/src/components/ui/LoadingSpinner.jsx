import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ size = 'default', className = '' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    default: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  // Use min-h-[200px] by default to vertically center in page-level contexts.
  // Callers can override via className (e.g. small inline spinners pass their own height).
  const hasHeight = /\b(min-h-|h-)\[/.test(className) || /\bmin-h-/.test(className);
  const heightClass = hasHeight ? '' : (size === 'sm' ? '' : 'min-h-[200px]');

  return (
    <div className={`flex items-center justify-center ${heightClass} ${className}`}>
      <Loader2 className={`animate-spin text-blue-400 ${sizeClasses[size]}`} />
    </div>
  );
};

export default LoadingSpinner;

