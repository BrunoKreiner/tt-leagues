import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

const HamburgerButton = ({ isOpen, onClick }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="md:hidden h-10 w-10 p-0 flex items-center justify-center hover:bg-transparent active:bg-transparent focus-visible:ring-0 focus:outline-none touch-manipulation"
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={isOpen}
    >
      {isOpen ? <X className="w-5 h-5 text-[var(--fg)]" /> : <Menu className="w-5 h-5 text-[var(--fg)]" />}
    </Button>
  );
};

export default HamburgerButton;
