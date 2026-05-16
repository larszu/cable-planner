export default function RoomsAndGroupingPage() {
  return (
    <>
      <h1>Rooms &amp; Grouping</h1>

      <h2>Rooms</h2>
      <p>
        Rooms are <strong>containers</strong> that represent physical locations — a control booth, a stage, a
        rack room, etc. Devices inside a room move with it when you drag the room.
      </p>

      <h2>Creating rooms</h2>
      <ol>
        <li>Find "Room" in the device library sidebar</li>
        <li>Drag it onto the canvas</li>
        <li>Or <strong>double-click</strong> the canvas, type "room", and press Enter</li>
        <li>Double-click the room label to rename it</li>
      </ol>

      <h2>Parenting devices</h2>
      <ul>
        <li><strong>Drag a device onto a room</strong> — the device becomes a child of that room</li>
        <li><strong>Drag a device out of a room</strong> — the device detaches and becomes independent</li>
        <li>Parenting is based on where the <strong>center</strong> of the device lands</li>
      </ul>
      <p>When a device is parented to a room:</p>
      <ul>
        <li>Its position is stored <strong>relative</strong> to the room</li>
        <li>Moving the room moves all its children</li>
        <li>The device stays visually inside the room's dashed border</li>
      </ul>

      <h2>Subrooms</h2>
      <p>
        Rooms can be nested inside other rooms to represent <strong>equipment locations within a physical space</strong> —
        for example, a rack bay or stage box inside a larger studio room.
      </p>
      <ul>
        <li><strong>Drag a room onto another room</strong> — the inner room becomes a subroom of the outer room</li>
        <li><strong>Drag a subroom out</strong> — it detaches and becomes a top-level room again</li>
        <li>Nesting is <strong>arbitrary depth</strong> — subrooms can contain their own subrooms</li>
        <li>A room <strong>cannot be dropped into one of its own descendants</strong> (circular nesting is blocked)</li>
      </ul>
      <p>
        Subrooms are visually distinct from top-level rooms: they default to a <strong>solid border</strong> and
        a slightly more opaque background. This can still be customized via Room Properties.
      </p>
      <p>
        When a parent room is deleted, its subrooms and devices are <strong>un-parented</strong> rather than deleted,
        preserving their content at the correct absolute position on the canvas.
      </p>

      <h2>Resizing rooms</h2>
      <p>
        Select a room to see resize handles on its corners and edges. Drag them to make the room larger or smaller.
        Resize handles snap to other rooms' edges with blue guide lines for precise alignment.
      </p>

      <h2>Room context menu</h2>
      <p>
        <strong>Right-click</strong> a room to open a context menu with two options:
      </p>
      <ul>
        <li><strong>Edit Properties...</strong> — opens the Room Properties editor (see below)</li>
        <li><strong>Lock Room / Unlock Room</strong> — toggles whether the room can be dragged</li>
        <li><strong>Mark as Equipment Rack / Remove Equipment Rack</strong> — toggles rack-style rendering</li>
      </ul>

      <h2>Locking rooms</h2>
      <p>
        Lock a room to <strong>prevent accidental dragging</strong>. Locked rooms show a lock icon on their
        label and cannot be moved until unlocked. Child devices inside a locked room can still be
        repositioned. Toggle the lock from the right-click context menu.
      </p>

      <h2>Room styling</h2>
      <p>
        Open the Room Properties editor from the right-click context menu. You can customize:
      </p>
      <ul>
        <li><strong>Label</strong> — the room's display name</li>
        <li><strong>Label size</strong> — adjustable from 9px to 24px</li>
        <li><strong>Background color</strong> — fill color for the room area</li>
        <li><strong>Border style</strong> — solid, dashed, or dotted</li>
        <li><strong>Border color</strong> — outline color for the room boundary</li>
      </ul>

      <h2>Equipment racks</h2>
      <p>
        Mark a room as an <strong>equipment rack</strong> via the right-click context menu
        or the Room Properties editor. Rack-flagged rooms render with rack-style visuals
        on the schematic and are treated as equipment containers in reports.
      </p>
      <p>
        For dedicated rack elevation drawings — drag-to-rack with snap-to-U, front / rear / side
        views, accessories, face-plate editing, and PDF export — use the dedicated{" "}
        <a href="/racks">Rack Builder</a> on its own page tab. The two features are complementary:
        equipment-rack rooms organize devices by physical container on the schematic, while rack
        pages produce the elevation deliverable.
      </p>

      <h2>Linking a room to a rack</h2>
      <p>
        A room on the schematic can be linked to a rack on a rack page so the rack knows which
        devices belong in it. Open the Room Properties editor (right-click → <strong>Edit
        Properties</strong>) and pick a target rack from the <strong>Linked Rack</strong> dropdown.
      </p>
      <p>Once linked:</p>
      <ul>
        <li>
          The rack header on the rack page shows a <strong>link badge</strong> with the room name —
          click it to jump back to the room on the schematic.
        </li>
        <li>
          The rack page sidebar groups unracked devices by linked room. An{" "}
          <strong>Auto-populate</strong> button proposes placements for every device in the linked
          room in one go.
        </li>
        <li>
          Devices that don&apos;t live in any linked room land in an <strong>Other</strong> group at
          the bottom of the sidebar.
        </li>
      </ul>

      <h2>Snap guides</h2>
      <p>
        When dragging rooms near other rooms, <strong>blue dashed guide lines</strong> appear to help
        you align edges and centers. The same guides appear during room resizing. Devices also snap
        to room edges when dragged near them.
      </p>

      <h2>Deleting rooms</h2>
      <p>
        When you delete a room, its children (devices and subrooms) are <strong>un-parented</strong> (converted to
        absolute positions) rather than deleted. This prevents accidentally losing device configurations.
        Use <strong>Delete Room &amp; Contents</strong> from the context menu to remove a room and everything inside
        it — including nested subrooms at any depth.
      </p>
    </>
  );
}
