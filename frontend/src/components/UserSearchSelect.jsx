import { useState, useEffect, useMemo } from 'react';
import { usersAPI } from '@/services/api';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Reusable searchable user select component
 * Provides real-time filtering as user types
 */
export default function UserSearchSelect({ 
  value, 
  onValueChange, 
  placeholder = 'Search users...',
  disabled = false,
  excludeUserIds = [],
  className
}) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch users with debounced search
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const { data } = await usersAPI.getAll({ 
          page: 1, 
          limit: 100,
          search: searchQuery.trim() || undefined
        });
        // Filter out excluded users
        const filtered = (data.users || []).filter(
          user => !excludeUserIds.includes(user.id)
        );
        setUsers(filtered);
      } catch (error) {
        console.error('Failed to load users:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately if search is empty, debounce otherwise
    if (!searchQuery.trim()) {
      fetchUsers();
      return undefined;
    } else {
      const timer = setTimeout(() => {
        fetchUsers();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, excludeUserIds]);

  // Find selected user
  const selectedUser = useMemo(() => {
    if (!value) return null;
    return users.find(u => u.id === parseInt(value));
  }, [value, users]);

  const displayValue = selectedUser 
    ? `${selectedUser.username}${selectedUser.first_name || selectedUser.last_name ? ` (${[selectedUser.first_name, selectedUser.last_name].filter(Boolean).join(' ')})` : ''}`
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          <span className={cn("truncate", !selectedUser && "text-muted-foreground")}>
            {displayValue}
          </span>
          <div className="flex items-center gap-1">
            {selectedUser && (
              <X
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onValueChange(null);
                  setSearchQuery('');
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search by username, name, or email..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Loading users...' : searchQuery ? 'No users found' : 'Type to search users'}
            </CommandEmpty>
            <CommandGroup>
              {users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={`${user.username} ${user.first_name || ''} ${user.last_name || ''} ${user.email || ''}`}
                  onSelect={() => {
                    onValueChange(user.id);
                    setOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === String(user.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{user.username}</span>
                    {(user.first_name || user.last_name || user.email) && (
                      <span className="text-xs text-muted-foreground">
                        {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

