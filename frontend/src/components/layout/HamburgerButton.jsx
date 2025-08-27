import { Button } from '@/components/ui/button';

const HamburgerButton = ({ isOpen, onClick }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="md:hidden h-10 w-10 p-0 rounded-md hover:bg-muted transition-colors"
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={isOpen}
    >
      <div className="w-6 h-6 relative">
        {/* Top line */}
        <span 
          className={`absolute h-0.5 w-6 bg-current transform transition-all duration-300 ease-in-out ${
            isOpen ? 'rotate-45 translate-y-2.5' : '-translate-y-1'
          }`} 
        />
        {/* Middle line */}
        <span 
          className={`absolute h-0.5 w-6 bg-current transform transition-all duration-300 ease-in-out ${
            isOpen ? 'opacity-0' : 'opacity-100'
          }`} 
        />
        {/* Bottom line */}
        <span 
          className={`absolute h-0.5 w-6 bg-current transform transition-all duration-300 ease-in-out ${
            isOpen ? '-rotate-45 translate-y-2.5' : 'translate-y-1'
          }`} 
        />
      </div>
    </Button>
  );
};

export default HamburgerButton;