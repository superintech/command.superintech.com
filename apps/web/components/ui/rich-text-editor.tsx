'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';
import { Button } from './button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Undo,
  Redo,
  Quote,
  Code,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

function ToolbarButton({
  onClick,
  isActive,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      title={title}
      className={cn(
        'h-8 w-8 p-0',
        isActive && 'bg-gray-200 text-gray-900'
      )}
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-gray-50 p-1">
      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
        title="Highlight"
      >
        <Highlighter className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-6 w-px bg-gray-300" />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-6 w-px bg-gray-300" />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="Align Left"
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="Align Center"
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title="Align Right"
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-6 w-px bg-gray-300" />

      {/* Block formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Quote"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="Code Block"
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={addLink}
        isActive={editor.isActive('link')}
        title="Add Link"
      >
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>

      <div className="mx-1 h-6 w-px bg-gray-300" />

      {/* History */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo (Ctrl+Y)"
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start typing...',
  className,
  minHeight = '150px',
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none focus:outline-none p-3',
          'prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0',
          'prose-blockquote:border-l-2 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic',
          'prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded',
          'prose-pre:bg-gray-900 prose-pre:text-gray-100'
        ),
        style: `min-height: ${minHeight}`,
      },
      handlePaste: (view, event) => {
        // Let TipTap handle paste with HTML preservation
        const html = event.clipboardData?.getData('text/html');
        if (html) {
          // TipTap will automatically handle HTML paste
          return false;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  return (
    <div className={cn('rounded-md border border-input bg-background', className)}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

// Display component for rendering rich text content
export function RichTextDisplay({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        'prose prose-sm prose-invert max-w-none',
        'prose-p:my-1 prose-p:text-white prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-li:text-white',
        'prose-blockquote:border-l-2 prose-blockquote:border-slate-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-300',
        'prose-code:bg-slate-700 prose-code:px-1 prose-code:rounded prose-code:text-white',
        'prose-pre:bg-slate-900 prose-pre:text-slate-100',
        'prose-strong:text-white prose-em:text-white',
        'prose-headings:text-white',
        '[&_a]:!text-blue-400 [&_a]:underline [&_a:hover]:!text-blue-300',
        className
      )}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
