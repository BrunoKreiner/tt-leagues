import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

const HamburgerButton = ({ isOpen, onClick }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="md:hidden h-8 w-8 p-0 flex items-center justify-center hover:bg-transparent active:bg-transparent focus-visible:ring-0 focus:outline-none relative top-[1px]"
      aria-label={isOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={isOpen}
    >
      {isOpen ? (
        <X className="w-6 h-6 text-gray-200" />
      ) : (
        <Menu className="w-6 h-6 text-gray-200" />
      )}
    </Button>
  );
};

export default HamburgerButton;