'use client';

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyPress: (e: KeyboardEvent<HTMLInputElement>) => void;
  members: User[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function MentionInput({
  value,
  onChange,
  onKeyPress,
  members,
  placeholder,
  disabled,
  className,
}: MentionInputProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const mentionListRef = useRef<HTMLDivElement>(null);

  // Filter members based on search
  const filteredMembers = members.filter((member) =>
    member.name.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  // Reset mention index when filtered list changes
  useEffect(() => {
    setMentionIndex(0);
  }, [mentionSearch]);

  // Scroll selected item into view
  useEffect(() => {
    if (showMentions && mentionListRef.current) {
      const selectedItem = mentionListRef.current.children[mentionIndex] as HTMLElement;
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [mentionIndex, showMentions]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setCursorPosition(cursorPos);
    onChange(newValue);

    // Check if we should show mention suggestions
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionSearch(mentionMatch[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionSearch('');
    }
  };

  const insertMention = (member: User) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);

    // Find where the @ starts
    const mentionStartMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionStartMatch) {
      const mentionStart = textBeforeCursor.length - mentionStartMatch[0].length;
      const newValue =
        value.slice(0, mentionStart) +
        `@${member.name} ` +
        textAfterCursor;

      onChange(newValue);
      setShowMentions(false);
      setMentionSearch('');

      // Focus back on input
      setTimeout(() => {
        inputRef.current?.focus();
        const newCursorPos = mentionStart + member.name.length + 2; // +2 for @ and space
        inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showMentions && filteredMembers.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setMentionIndex((prev) =>
            prev < filteredMembers.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setMentionIndex((prev) =>
            prev > 0 ? prev - 1 : filteredMembers.length - 1
          );
          break;
        case 'Enter':
          if (showMentions) {
            e.preventDefault();
            insertMention(filteredMembers[mentionIndex]);
            return;
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowMentions(false);
          break;
        case 'Tab':
          if (showMentions) {
            e.preventDefault();
            insertMention(filteredMembers[mentionIndex]);
            return;
          }
          break;
      }
    }

    // Only call original onKeyPress if we're not handling mentions
    if (!showMentions || e.key !== 'Enter') {
      onKeyPress(e);
    }
  };

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Delay hiding to allow click on mention item
          setTimeout(() => setShowMentions(false), 150);
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full bg-transparent border-0 text-white placeholder:text-slate-500 focus:outline-none focus:ring-0',
          className
        )}
      />

      {/* Mention Suggestions Popup */}
      {showMentions && filteredMembers.length > 0 && (
        <div
          ref={mentionListRef}
          className="absolute bottom-full left-0 mb-2 w-72 max-h-48 overflow-y-auto bg-[#131d2e] rounded-lg shadow-lg border border-slate-700 z-50"
        >
          <div className="p-2">
            <p className="text-xs text-slate-400 uppercase font-semibold px-2 py-1">
              Members matching @{mentionSearch}
            </p>
            {filteredMembers.map((member, index) => (
              <button
                key={member.id}
                className={cn(
                  'flex items-center gap-3 w-full p-2 rounded text-left transition-colors',
                  index === mentionIndex
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-slate-700/50 text-slate-200'
                )}
                onClick={() => insertMention(member)}
                onMouseEnter={() => setMentionIndex(index)}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.avatar} />
                  <AvatarFallback className="bg-blue-500 text-white text-xs">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  {member.role && (
                    <p className={cn(
                      'text-xs truncate',
                      index === mentionIndex ? 'text-white/70' : 'text-slate-400'
                    )}>
                      {member.role}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No matches message */}
      {showMentions && filteredMembers.length === 0 && mentionSearch && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-[#131d2e] rounded-lg shadow-lg border border-slate-700 z-50 p-4 text-center">
          <p className="text-sm text-slate-400">No members found matching @{mentionSearch}</p>
        </div>
      )}
    </div>
  );
}

// Helper function to render message content with highlighted mentions
export function renderMessageWithMentions(content: string, members: User[], currentUserId?: string) {
  // Match @Name patterns (supports multi-word names)
  const mentionRegex = /@([A-Za-z]+(?:\s+[A-Za-z]+)*)/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const mentionedName = match[1];
    const mentionedMember = members.find(
      (m) => m.name.toLowerCase() === mentionedName.toLowerCase()
    );

    if (mentionedMember) {
      const isCurrentUser = mentionedMember.id === currentUserId;
      parts.push(
        <span
          key={match.index}
          className={cn(
            'px-1 rounded font-medium cursor-pointer hover:underline',
            isCurrentUser
              ? 'bg-blue-500/30 text-blue-200'
              : 'bg-blue-500/20 text-blue-300'
          )}
        >
          @{mentionedMember.name}
        </span>
      );
    } else {
      // Not a valid mention, just show as text
      parts.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}
