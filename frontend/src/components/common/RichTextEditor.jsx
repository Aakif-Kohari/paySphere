import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';

export const RichTextEditor = ({ content = '', onChange, placeholder = 'Write your announcement here...' }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setMark('link', { href: url }).run();
    }
  };

  const addImage = () => {
    const url = window.prompt('Enter Image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div className="border border-gray-300 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 transition">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-800 text-xs text-gray-700 dark:text-slate-200">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2 py-1 rounded font-bold hover:bg-gray-200 dark:hover:bg-slate-700 ${
            editor.isActive('bold') ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : ''
          }`}
          title="Bold"
        >
          B
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2 py-1 rounded italic font-serif hover:bg-gray-200 dark:hover:bg-slate-700 ${
            editor.isActive('italic') ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : ''
          }`}
          title="Italic"
        >
          I
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`px-2 py-1 rounded underline hover:bg-gray-200 dark:hover:bg-slate-700 ${
            editor.isActive('underline') ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : ''
          }`}
          title="Underline"
        >
          U
        </button>

        <span className="w-px h-4 bg-gray-300 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2 py-1 rounded font-bold hover:bg-gray-200 dark:hover:bg-slate-700 ${
            editor.isActive('heading', { level: 1 }) ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : ''
          }`}
          title="Heading 1"
        >
          H1
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-1 rounded font-bold hover:bg-gray-200 dark:hover:bg-slate-700 ${
            editor.isActive('heading', { level: 2 }) ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : ''
          }`}
          title="Heading 2"
        >
          H2
        </button>

        <span className="w-px h-4 bg-gray-300 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 ${
            editor.isActive('bulletList') ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : ''
          }`}
          title="Bullet List"
        >
          • List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 ${
            editor.isActive('orderedList') ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : ''
          }`}
          title="Numbered List"
        >
          1. List
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 ${
            editor.isActive('blockquote') ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : ''
          }`}
          title="Quote"
        >
          “ ”
        </button>

        <span className="w-px h-4 bg-gray-300 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={addLink}
          className="px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 font-medium"
          title="Add Link"
        >
          🔗 Link
        </button>

        <button
          type="button"
          onClick={addImage}
          className="px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 font-medium"
          title="Embed Image"
        >
          🖼️ Image
        </button>

        <span className="w-px h-4 bg-gray-300 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 ${
            editor.isActive({ textAlign: 'left' }) ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : ''
          }`}
          title="Align Left"
        >
          Left
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 ${
            editor.isActive({ textAlign: 'center' }) ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : ''
          }`}
          title="Align Center"
        >
          Center
        </button>
      </div>

      {/* Editor Output Area */}
      <div className="p-4 min-h-[160px] text-sm text-gray-900 dark:text-white focus:outline-none prose dark:prose-invert max-w-none">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default RichTextEditor;
