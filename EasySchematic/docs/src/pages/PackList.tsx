export default function PackListPage() {
  return (
    <>
      <h1>Pack List &amp; Reports</h1>

      <p>
        The <strong>Pack List</strong> generates a bill of materials from your schematic — a summary of every device
        and cable you need. Open it from the <strong>Reports</strong> menu in the menu bar.
      </p>

      <h2>Browsing the pack list</h2>
      <p>
        The pack list dialog has two tabs:
      </p>
      <ul>
        <li><strong>Devices</strong> — every device in your schematic with quantity, manufacturer, model number, model, type, and room</li>
        <li>
          <strong>Cables</strong> — cable counts summarized by cable type, signal type, and route.
          <strong> Adapters</strong> (passive dongles, cable adapters, barrels) appear at the bottom of the
          cables tab with their own section header. Active converters appear in the devices tab instead.
        </li>
      </ul>
      <p>
        Both tabs support a <strong>Group by</strong> toggle — group devices by room, or cables by signal path.
        When grouping is off, identical items are merged into a single row with a combined count.
      </p>
      <p>
        Adapters always appear in the pack list even when <strong>hidden</strong> on the schematic — the pack
        list is the complete bill of materials. Connections marked as <strong>direct-attach</strong> (where the
        adapter plugs directly into a device) are excluded from cable counts since no separate cable is needed.
      </p>

      <h2>Cost tracking</h2>
      <p>
        Devices and cables can have an optional <strong>unit cost</strong> field. Set unit
        cost in the device editor or cable schedule. Costs appear in the pack list and
        can be exported to CSV for budgeting and quoting. Devices flagged
        as <strong>venue-provided</strong> are distinguished in the pack list so you can
        separate house gear from rental gear.
      </p>

      <h2>Cable schedule</h2>
      <p>
        The <strong>Cable Schedule</strong> is a per-connection wiring report available from the same
        Reports menu. It lists every connection in your schematic with:
      </p>
      <ul>
        <li><strong>Cable ID</strong> — editable identifier for each cable</li>
        <li><strong>Source and destination</strong> — device names, port names, and rooms</li>
        <li><strong>Signal type</strong> and <strong>cable type</strong></li>
        <li><strong>Connector types</strong> at each end (with M-M / F-F gender suffixes when both ends share a gender)</li>
        <li><strong>Cable length</strong> — editable per-connection</li>
        <li>
          <strong>Est. length</strong> — auto-calculated from room-to-room distances when both endpoints sit inside
          placed rooms. Use it as a starting point for filling in <em>Cable length</em>, or just rely on it for
          rough budgeting
        </li>
      </ul>
      <p>
        Cable IDs support <strong>fill series</strong> — select multiple cells, type a value with a number
        (e.g., "SDI-001"), and the tool auto-increments for each selected row. This works the same way
        as device auto-numbering.
      </p>
      <p>
        The cable schedule supports the same PDF export, CSV export, and print preview layout as the pack list.
      </p>

      <h2>Patch panel schedule</h2>
      <p>
        The <strong>Patch Panel Schedule</strong> (Reports menu → Patch Panels) is a dedicated wiring report for
        every patch panel in the schematic. Unlike the cable schedule, it lists <strong>every port of every panel</strong>
        — including unconnected ones — so you can see free capacity at a glance.
      </p>
      <p>Each row shows the panel, room, face (Front / Rear), position, connector, gender, and what's on the remote end:</p>
      <ul>
        <li><strong>Remote device</strong>, <strong>port</strong>, and <strong>room</strong> the panel port is connected to (blank for unused ports)</li>
        <li><strong>Cable ID</strong> — same value the cable schedule uses, so the two reports stay in sync</li>
        <li><strong>Cable type</strong> and <strong>signal type</strong></li>
        <li><strong>Cable length</strong> and <strong>Est. length</strong> — same room-derived estimate as the cable schedule</li>
      </ul>
      <p>
        An <strong>occupancy badge</strong> at the top of the report summarizes how many ports each panel has used
        vs. its capacity. Group rows by <strong>Panel</strong>, <strong>Panel Room</strong>, <strong>Signal Type</strong>,
        or <strong>Face</strong> from the Group by dropdown. Like other reports, it supports PDF, CSV, and print preview.
      </p>

      <h2>Owned Gear &amp; pack list quantities</h2>
      <p>
        The <strong>Owned Gear</strong> library tracks an inventory of devices you own. When you build a schematic,
        the pack list compares the devices you've placed against your inventory and reports
        <strong> used vs. needed</strong> counts — so a single document tells you what to pull off the shelf and what
        to rent or buy.
      </p>
      <ul>
        <li>Open the <strong>Owned Gear</strong> tab from the device library sidebar to manage your inventory</li>
        <li>Right-click any template in the device library and choose <strong>Add to Owned Gear</strong> to add it with a quantity</li>
        <li>Edit quantities in place, or delete an entry to drop it from your inventory</li>
        <li><strong>Export</strong> your inventory to a JSON file, or <strong>import</strong> someone else's — useful when several engineers share the same shop</li>
        <li>Matching is done on a stable inventory key (manufacturer + model number + key port specs) so copies of the same template match across schematics even after rename</li>
      </ul>

      <h2>Network report</h2>
      <p>
        The <strong>Network Report</strong> is available from the <strong>Reports</strong> menu.
        It lists all network-addressable ports in your schematic — Ethernet, NDI, Dante, AVB, SRT,
        HDBaseT, AES67, and ST 2110 — with their full network configuration.
      </p>
      <p>Columns include:</p>
      <ul>
        <li><strong>Device name</strong> and <strong>port label</strong></li>
        <li><strong>Room</strong> and <strong>signal type</strong></li>
        <li><strong>Hostname</strong>, <strong>IP address</strong>, <strong>subnet mask</strong>, and <strong>gateway</strong></li>
        <li><strong>VLAN</strong>, <strong>DHCP status</strong>, and <strong>DHCP server</strong> — shows which DHCP server covers each port</li>
        <li><strong>Link speed</strong> and <strong>PoE draw</strong></li>
      </ul>
      <p>
        This is useful for generating IP address schedules and verifying network configuration
        before a show. The network report supports the same PDF export, CSV export, and print
        preview layout as the pack list.
      </p>

      <h2>Power report</h2>
      <p>
        The <strong>Power Report</strong> is available from the <strong>Reports</strong> menu.
        It has two sections:
      </p>
      <ul>
        <li>
          <strong>Devices</strong> — lists every device with power draw specs: model, device type,
          room, power draw (watts), voltage, and quantity. Identical devices in the same room are
          merged into a single row with a combined count.
        </li>
        <li>
          <strong>Distribution</strong> — lists power distribution devices with: label, room,
          capacity (watts), current load, load percentage, and status. Status is calculated from
          load percentage: <strong>OK</strong> when safely within capacity (under 80%),
          {" "}<strong>Warning</strong> when approaching limits (80–100%),
          and <strong>Overloaded</strong> when exceeding capacity.
        </li>
      </ul>
      <p>
        This is useful for planning power requirements and verifying that your distros have
        enough capacity. The power report supports the same PDF export, CSV export, and print
        preview layout as other reports.
      </p>

      <h2>CSV export</h2>
      <p>
        Click <strong>CSV</strong> to download a spreadsheet-friendly file with both device and cable tables.
        Open it in Excel, Google Sheets, or any spreadsheet tool.
      </p>

      <h2>PDF export &amp; print preview</h2>
      <p>
        Click <strong>PDF</strong> to open the print preview. This is a full report layout editor — what you see
        in the preview is what the exported PDF will look like.
      </p>

      <h3>Page setup</h3>
      <ul>
        <li><strong>Paper size</strong> — Letter, Legal, A4, or Tabloid</li>
        <li><strong>Orientation</strong> — Portrait or Landscape</li>
      </ul>

      <h3>Header &amp; footer</h3>
      <p>
        The header and footer are interactive grid editors, just like the title block editor.
        Click a cell in the preview to select it, then use the sidebar to change its content.
      </p>
      <p>Each cell can display:</p>
      <ul>
        <li><strong>Field</strong> — a value from your show info (show name, venue, designer, date, etc.)</li>
        <li><strong>Static text</strong> — any custom text (e.g., "Pack List")</li>
        <li><strong>Logo</strong> — your uploaded logo image</li>
        <li><strong>Page number</strong> — auto-filled "Page X of Y"</li>
      </ul>
      <p>
        Right-click cells for more options: insert or delete rows and columns, merge cells,
        or change cell content type. Drag the borders between cells to resize columns and rows.
      </p>

      <h3>Table columns</h3>
      <p>
        The sidebar has checkboxes for each column in each table. Uncheck a column to hide it
        from the report. Drag the borders between column headers in the preview to resize columns.
      </p>

      <h3>Grouping</h3>
      <p>
        Each table has a <strong>Group by</strong> dropdown. Devices can be grouped by room,
        and cables can be grouped by signal path. Group headers appear as shaded rows in the report.
      </p>

      <h3>Sorting</h3>
      <p>
        Each table has a <strong>Sort by</strong> dropdown — pick any visible column to sort by,
        then toggle ascending/descending with the arrow button.
      </p>

      <h3>Multi-page preview</h3>
      <p>
        When your data spans multiple pages, use the <strong>page navigation arrows</strong> in the
        toolbar to preview each page. The preview respects page margins and shows accurate page breaks.
        When a table continues on the next page, column headers are repeated with
        a "(Cont'd)" label.
      </p>

      <h3>Zoom</h3>
      <p>
        Use the <strong>+</strong> / <strong>&minus;</strong> buttons or <strong>Reset</strong> in
        the toolbar to zoom the preview in or out.
      </p>

      <h2>Saving your layout</h2>
      <p>
        All report layout preferences — paper size, orientation, header/footer layout, column visibility,
        grouping, and sorting — are saved with your schematic file. When you export and re-import a
        schematic, your pack list layout comes with it.
      </p>
    </>
  );
}
