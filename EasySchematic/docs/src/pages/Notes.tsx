export default function NotesPage() {
  return (
    <>
      <h1>Notes &amp; Annotations</h1>

      <p>
        Notes let you add rich text annotations directly on the canvas — labels, descriptions, revision notes, or
        anything else you need alongside your signal flow.
      </p>

      <h2>Adding notes</h2>
      <p>
        Drag <strong>Note</strong> from the device library sidebar onto the canvas, just like placing a device.
      </p>

      <h2>Editing</h2>
      <p>
        <strong>Double-click</strong> a note to enter edit mode. A formatting toolbar appears above the note with the
        following options:
      </p>
      <ul>
        <li><strong>Bold</strong>, <strong>Italic</strong>, <strong>Underline</strong> — standard text formatting</li>
        <li><strong>Font size</strong> — Small, Medium, or Large</li>
        <li><strong>Bullet lists</strong> — toggle bulleted list formatting</li>
      </ul>
      <p>Click outside the note to exit edit mode.</p>

      <h2>Indentation</h2>
      <p>
        While editing, press <strong>Tab</strong> to indent a line and <strong>Shift+Tab</strong> to outdent. This works
        with both plain text and bullet lists.
      </p>

      <h2>Resizing</h2>
      <p>
        Select a note (single click) and drag the corner or edge handles to resize it. The text content reflows to fit
        the new dimensions.
      </p>

      <h2>Deleting</h2>
      <p>
        Select the note and press <strong>Delete</strong> or <strong>Backspace</strong>.
      </p>

      <h2>Annotation shapes</h2>
      <p>
        In addition to text notes, you can place <strong>rectangle</strong> and <strong>ellipse</strong> annotation
        shapes on the canvas. Add them from the <strong>Insert</strong> menu
        (Insert → Add Rectangle / Add Ellipse).
      </p>
      <ul>
        <li>Customizable <strong>fill color</strong>, <strong>border color</strong>, and optional <strong>text label</strong></li>
        <li>Resize by dragging the corner or edge handles</li>
        <li>Delete with <strong>Delete</strong> or <strong>Backspace</strong></li>
      </ul>
    </>
  );
}
