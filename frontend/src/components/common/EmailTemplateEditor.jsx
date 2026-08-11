/**
 * @fileoverview WYSIWYG Email Template Editor
 * @description Rich text editor built on TipTap for creating and editing HTML email templates.
 * Includes a custom toolbar, dark/light mode support, and dynamic variable insertion.
 * Issue: #822
 */
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import PropTypes from 'prop-types';
import { useState, useCallback, useEffect } from 'react';

// MUI Icons for Toolbar
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import CodeIcon from '@mui/icons-material/Code';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';

const AVAILABLE_VARIABLES = [
    { label: 'Employee Name', value: '{{employeeName}}' },
    { label: 'Company Name', value: '{{companyName}}' },
    { label: 'Month', value: '{{month}}' },
    { label: 'Year', value: '{{year}}' },
    { label: 'Net Salary', value: '{{netSalary}}' },
    { label: 'Manager Name', value: '{{managerName}}' },
];

const MenuBar = ({ editor }) => {
    const [showVariables, setShowVariables] = useState(false);

    if (!editor) return null;

    const insertVariable = (variable) => {
        editor.chain().focus().insertContent(`<span class="variable-tag" style="background-color: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-family: monospace;">${variable}</span>&nbsp;`).run();
        setShowVariables(false);
    };

    const btnClass = (isActive) => `p-2 rounded-md transition-colors ${isActive ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`;

    return (
        <div className="border-b border-gray-200 dark:border-slate-700 p-2 flex flex-wrap items-center gap-1 bg-gray-50 dark:bg-slate-900/50 rounded-t-xl sticky top-0 z-10">
            <button onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))} aria-label="Bold"><FormatBoldIcon fontSize="small" /></button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))} aria-label="Italic"><FormatItalicIcon fontSize="small" /></button>
            <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive('underline'))} aria-label="Underline"><FormatUnderlinedIcon fontSize="small" /></button>

            <div className="w-px h-6 bg-gray-300 dark:bg-slate-600 mx-1" />

            <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={btnClass(editor.isActive({ textAlign: 'left' }))} aria-label="Align Left"><FormatAlignLeftIcon fontSize="small" /></button>
            <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={btnClass(editor.isActive({ textAlign: 'center' }))} aria-label="Align Center"><FormatAlignCenterIcon fontSize="small" /></button>
            <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={btnClass(editor.isActive({ textAlign: 'right' }))} aria-label="Align Right"><FormatAlignRightIcon fontSize="small" /></button>

            <div className="w-px h-6 bg-gray-300 dark:bg-slate-600 mx-1" />

            <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))} aria-label="Bullet List"><FormatListBulletedIcon fontSize="small" /></button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))} aria-label="Numbered List"><FormatListNumberedIcon fontSize="small" /></button>
            <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btnClass(editor.isActive('codeBlock'))} aria-label="Code Block"><CodeIcon fontSize="small" /></button>

            <div className="w-px h-6 bg-gray-300 dark:bg-slate-600 mx-1" />

            <input type="color" onInput={event => editor.chain().focus().setColor(event.target.value).run()} value={editor.getAttributes('textStyle').color || '#000000'} className="w-8 h-8 rounded cursor-pointer bg-transparent border border-gray-300 dark:border-slate-600" aria-label="Text Color" />

            <div className="w-px h-6 bg-gray-300 dark:bg-slate-600 mx-1" />

            <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().chain().focus().undo().run()} className={btnClass(false)} aria-label="Undo"><UndoIcon fontSize="small" /></button>
            <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().chain().focus().redo().run()} className={btnClass(false)} aria-label="Redo"><RedoIcon fontSize="small" /></button>

            <div className="flex-1" />

            <div className="relative">
                <button onClick={() => setShowVariables(!showVariables)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white rounded-md transition-colors">
                    <CodeIcon sx={{ fontSize: 14 }} /> Insert Variable
                </button>
                {showVariables && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl z-20 py-1 max-h-60 overflow-y-auto">
                        {AVAILABLE_VARIABLES.map((v) => (
                            <button key={v.value} onClick={() => insertVariable(v.value)} className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                                {v.label} <span className="text-xs text-gray-400 block">{v.value}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

MenuBar.propTypes = { editor: PropTypes.any };

export default function EmailTemplateEditor({ initialContent, onChange, placeholder = 'Start typing your email template...' }) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
            Underline,
            TextStyle,
            Color,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Placeholder.configure({ placeholder }),
        ],
        content: initialContent || '',
        onUpdate: ({ editor }) => {
            if (onChange) onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[300px] p-4 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-b-xl border border-t-0 border-gray-200 dark:border-slate-700',
            },
        },
    });

    useEffect(() => {
        if (editor && initialContent && editor.getHTML() !== initialContent) {
            editor.commands.setContent(initialContent);
        }
    }, [initialContent, editor]);

    return (
        <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
            <MenuBar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    );
}

EmailTemplateEditor.propTypes = {
    initialContent: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
};
