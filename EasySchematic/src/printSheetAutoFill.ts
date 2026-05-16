import type { PrintSheetPage, PrintViewport, RackData, RackElevationPage } from "./types";
import { getPaperSize, PAGE_MARGIN_IN, TITLE_BLOCK_HEIGHT_IN } from "./printConfig";

const IN_TO_MM = 25.4;

/** Generate default viewports for front + rear + side of a rack, sized to fill the sheet. */
export function autoFillSheetForRack(
  sheet: PrintSheetPage,
  rack: RackData,
  elevPage: RackElevationPage,
): Omit<PrintViewport, "id">[] {
  const paper = getPaperSize(sheet.paperId, sheet.customWidthIn, sheet.customHeightIn);
  const pageW = sheet.orientation === "landscape" ? paper.heightIn * IN_TO_MM : paper.widthIn * IN_TO_MM;
  const pageH = sheet.orientation === "landscape" ? paper.widthIn * IN_TO_MM : paper.heightIn * IN_TO_MM;

  const marginMm = PAGE_MARGIN_IN * IN_TO_MM;
  const titleBlockH = sheet.showTitleBlock ? TITLE_BLOCK_HEIGHT_IN * IN_TO_MM : 0;

  const contentW = pageW - 2 * marginMm;
  const contentH = pageH - 2 * marginMm - titleBlockH;

  const is2Post = rack.rackType === "open-2post";
  const viewCount = is2Post ? 2 : 3; // front + [rear] + side

  const viewW = contentW / viewCount;

  const viewports: Omit<PrintViewport, "id">[] = [
    {
      kind: "rack-front",
      rackRefPageId: elevPage.id,
      rackRefId: rack.id,
      positionMm: { x: marginMm, y: marginMm },
      sizeMm: { w: viewW, h: contentH },
      showLabel: true,
    },
  ];

  if (!is2Post) {
    viewports.push({
      kind: "rack-rear",
      rackRefPageId: elevPage.id,
      rackRefId: rack.id,
      positionMm: { x: marginMm + viewW, y: marginMm },
      sizeMm: { w: viewW, h: contentH },
      showLabel: true,
    });
  }

  viewports.push({
    kind: "rack-side",
    rackRefPageId: elevPage.id,
    rackRefId: rack.id,
    positionMm: { x: marginMm + viewW * (is2Post ? 1 : 2), y: marginMm },
    sizeMm: { w: viewW, h: contentH },
    showLabel: true,
  });

  return viewports;
}
