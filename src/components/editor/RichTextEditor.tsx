'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useCallback } from 'react'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Undo, Redo, Highlighter, Type,
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
  compact?: boolean   // schmalere Toolbar (für Tabellenzeilen)
}

const FONT_FAMILIES = [
  { label: 'Standard', value: '' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Palatino', value: 'Palatino' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
]

const COLORS = [
  '#000000', '#374151', '#6b7280', '#dc2626', '#ea580c',
  '#d97706', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777',
]

export function RichTextEditor({ value, onChange, placeholder = 'Text eingeben…', minHeight = 80, compact = false }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html === '<p></p>' ? '' : html)
    },
    editorProps: {
      attributes: {
        style: `min-height: ${minHeight}px; padding: 8px 10px; outline: none; font-size: 13px; line-height: 1.6; font-family: inherit;`,
      },
    },
  })

  // Externer Wert-Update (z.B. beim Laden)
  useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (value !== current && value !== undefined) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor])

  const btn = useCallback((active: boolean, title: string, onClick: () => void, children: React.ReactNode) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        padding: compact ? '3px 5px' : '4px 7px',
        borderRadius: 5, border: 'none', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--color-primary-light)' : 'transparent',
        color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
        transition: 'background 0.1s',
      }}
    >
      {children}
    </button>
  ), [compact])

  if (!editor) return null
  const iconSize = compact ? 12 : 14

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 10,
      overflow: 'hidden', background: 'var(--surface-card)',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 2, padding: compact ? '4px 6px' : '6px 8px',
        borderBottom: '0.5px solid var(--border)', background: 'var(--surface-page)',
        alignItems: 'center',
      }}>
        {/* Schriftfamilie */}
        {!compact && (
          <select
            value={editor.getAttributes('textStyle').fontFamily ?? ''}
            onChange={e => {
              if (e.target.value) editor.chain().focus().setFontFamily(e.target.value).run()
              else editor.chain().focus().unsetFontFamily().run()
            }}
            style={{
              fontSize: 11, padding: '3px 5px', borderRadius: 5,
              border: '0.5px solid var(--border)', background: 'var(--surface-card)',
              color: 'var(--text-primary)', cursor: 'pointer', marginRight: 4,
            }}
          >
            {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        )}

        <div style={{ display: 'flex', gap: 1 }}>
          {btn(editor.isActive('bold'), 'Fett', () => editor.chain().focus().toggleBold().run(), <Bold style={{ width: iconSize, height: iconSize }} />)}
          {btn(editor.isActive('italic'), 'Kursiv', () => editor.chain().focus().toggleItalic().run(), <Italic style={{ width: iconSize, height: iconSize }} />)}
          {btn(editor.isActive('underline'), 'Unterstrichen', () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon style={{ width: iconSize, height: iconSize }} />)}
          {btn(editor.isActive('strike'), 'Durchgestrichen', () => editor.chain().focus().toggleStrike().run(), <Strikethrough style={{ width: iconSize, height: iconSize }} />)}
        </div>

        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 3px' }} />

        {/* Farbe */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Type style={{ width: iconSize, height: iconSize, color: 'var(--text-muted)' }} />
          <input
            type="color"
            title="Textfarbe"
            value={editor.getAttributes('textStyle').color ?? '#000000'}
            onChange={e => editor.chain().focus().setColor(e.target.value).run()}
            style={{ width: 24, height: 22, border: 'none', padding: 1, cursor: 'pointer', borderRadius: 4, background: 'none' }}
          />
          {btn(editor.isActive('highlight'), 'Hervorheben', () => editor.chain().focus().toggleHighlight().run(),
            <Highlighter style={{ width: iconSize, height: iconSize }} />)}
        </div>

        {!compact && (
          <>
            <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 3px' }} />
            <div style={{ display: 'flex', gap: 1 }}>
              {btn(editor.isActive({ textAlign: 'left' }), 'Links', () => editor.chain().focus().setTextAlign('left').run(), <AlignLeft style={{ width: iconSize, height: iconSize }} />)}
              {btn(editor.isActive({ textAlign: 'center' }), 'Mitte', () => editor.chain().focus().setTextAlign('center').run(), <AlignCenter style={{ width: iconSize, height: iconSize }} />)}
              {btn(editor.isActive({ textAlign: 'right' }), 'Rechts', () => editor.chain().focus().setTextAlign('right').run(), <AlignRight style={{ width: iconSize, height: iconSize }} />)}
              {btn(editor.isActive({ textAlign: 'justify' }), 'Blocksatz', () => editor.chain().focus().setTextAlign('justify').run(), <AlignJustify style={{ width: iconSize, height: iconSize }} />)}
            </div>
            <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 3px' }} />
            <div style={{ display: 'flex', gap: 1 }}>
              {btn(editor.isActive('bulletList'), 'Aufzählung', () => editor.chain().focus().toggleBulletList().run(), <List style={{ width: iconSize, height: iconSize }} />)}
              {btn(editor.isActive('orderedList'), 'Nummeriert', () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered style={{ width: iconSize, height: iconSize }} />)}
            </div>
          </>
        )}

        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 3px' }} />
        <div style={{ display: 'flex', gap: 1 }}>
          {btn(false, 'Rückgängig', () => editor.chain().focus().undo().run(), <Undo style={{ width: iconSize, height: iconSize }} />)}
          {btn(false, 'Wiederholen', () => editor.chain().focus().redo().run(), <Redo style={{ width: iconSize, height: iconSize }} />)}
        </div>
      </div>

      {/* Editor-Bereich */}
      <div style={{ background: 'var(--surface-card)' }}>
        <style>{`
          .ProseMirror p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: var(--text-muted);
            pointer-events: none;
            height: 0;
            font-size: 13px;
          }
          .ProseMirror:focus { outline: none; }
          .ProseMirror ul { list-style: disc; padding-left: 1.4em; }
          .ProseMirror ol { list-style: decimal; padding-left: 1.4em; }
          .ProseMirror h1 { font-size: 1.5em; font-weight: 700; }
          .ProseMirror h2 { font-size: 1.25em; font-weight: 600; }
          .ProseMirror h3 { font-size: 1.1em; font-weight: 600; }
          .ProseMirror mark { background: #fef08a; border-radius: 2px; padding: 0 1px; }
        `}</style>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
