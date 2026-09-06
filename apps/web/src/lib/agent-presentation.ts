import "server-only";
import { strToU8, zipSync } from "fflate";
import type { AgentArtifact, ReviewSlide } from "@cfo/domain";

const xml = (value: string) => value.replace(/[<>&"']/g, (character) => ({
  "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
}[character] ?? character));
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const presentationNs = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const relNs = "http://schemas.openxmlformats.org/package/2006/relationships";
const officeRel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const group = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

function textBox(id: number, name: string, text: string[], x: number, y: number, width: number, height: number, size: number, color: string, bold = false) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square"><a:normAutofit/></a:bodyPr><a:lstStyle/>${text.map((line) => `<a:p><a:pPr><a:spcAft><a:spcPts val="1400"/></a:spcAft></a:pPr><a:r><a:rPr lang="en-US" sz="${size}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr><a:t>${xml(line)}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`).join("")}</p:txBody></p:sp>`;
}

function slideXml(slide: ReviewSlide, index: number, cover: boolean) {
  const background = cover ? "172033" : "F4F6FA";
  return `${declaration}<p:sld ${presentationNs}><p:cSld name="${xml(slide.title)}"><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${background}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${group}
${textBox(2, "Context", ["CFO AGENT REVIEW | SYNTHETIC DATA"], 548640, 365760, 11064240, 500000, 1300, cover ? "79D9B9" : "7B68EE", true)}
${textBox(3, "Title", [slide.title], 548640, 1100000, 11064240, 1200000, 3000, cover ? "FFFFFF" : "172033", true)}
${textBox(4, "Findings", slide.bullets, 640080, 2400000, 10881360, 3500000, 1800, cover ? "D7DFEB" : "172033")}
${textBox(5, "Footer", [`${index + 1} | Local demo output. Review sources and assumptions before use.`], 548640, 6250000, 11064240, 400000, 1000, "667085")}
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

export async function createAgentPresentation(artifact: AgentArtifact): Promise<Uint8Array> {
  // Text-only OOXML avoids image parsers and produces an editable native deck.
  const slides: ReviewSlide[] = [{
    title: artifact.title, bullets: [artifact.summary],
    speakerNotes: artifact.limitations.join("\n"),
  }, ...artifact.slides];
  const files: Record<string, Uint8Array> = {};
  const put = (name: string, content: string) => { files[name] = strToU8(content); };
  put("[Content_Types].xml", `${declaration}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/notesSlides/notesSlide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`).join("")}</Types>`);
  put("_rels/.rels", `${declaration}<Relationships xmlns="${relNs}"><Relationship Id="rId1" Type="${officeRel}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`);
  put("ppt/presentation.xml", `${declaration}<p:presentation ${presentationNs}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rIdNotes"/></p:notesMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join("")}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
  put("ppt/_rels/presentation.xml.rels", `${declaration}<Relationships xmlns="${relNs}"><Relationship Id="rIdMaster" Type="${officeRel}/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rIdNotes" Type="${officeRel}/notesMaster" Target="notesMasters/notesMaster1.xml"/>${slides.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${officeRel}/slide" Target="slides/slide${i + 1}.xml"/>`).join("")}</Relationships>`);
  const colorMap = '<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>';
  put("ppt/slideMasters/slideMaster1.xml", `${declaration}<p:sldMaster ${presentationNs}><p:cSld><p:spTree>${group}</p:spTree></p:cSld>${colorMap}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rIdLayout"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`);
  put("ppt/slideMasters/_rels/slideMaster1.xml.rels", `${declaration}<Relationships xmlns="${relNs}"><Relationship Id="rIdLayout" Type="${officeRel}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rIdTheme" Type="${officeRel}/theme" Target="../theme/theme1.xml"/></Relationships>`);
  put("ppt/slideLayouts/slideLayout1.xml", `${declaration}<p:sldLayout ${presentationNs} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${group}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  put("ppt/slideLayouts/_rels/slideLayout1.xml.rels", `${declaration}<Relationships xmlns="${relNs}"><Relationship Id="rIdMaster" Type="${officeRel}/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`);
  put("ppt/notesMasters/notesMaster1.xml", `${declaration}<p:notesMaster ${presentationNs}><p:cSld><p:spTree>${group}</p:spTree></p:cSld>${colorMap}<p:notesStyle/></p:notesMaster>`);
  put("ppt/notesMasters/_rels/notesMaster1.xml.rels", `${declaration}<Relationships xmlns="${relNs}"><Relationship Id="rIdTheme" Type="${officeRel}/theme" Target="../theme/theme1.xml"/></Relationships>`);
  const colors = { dk1: "172033", lt1: "FFFFFF", dk2: "667085", lt2: "F4F6FA", accent1: "7B68EE", accent2: "49CCF9", accent3: "79D9B9", accent4: "FD71AF", accent5: "FFB08E", accent6: "6856D8", hlink: "0563C1", folHlink: "954F72" };
  put("ppt/theme/theme1.xml", `${declaration}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="CFO"><a:themeElements><a:clrScheme name="CFO">${Object.entries(colors).map(([key, color]) => `<a:${key}><a:srgbClr val="${color}"/></a:${key}>`).join("")}</a:clrScheme><a:fontScheme name="CFO"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="CFO"><a:fillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:fillStyleLst><a:lnStyleLst>${'<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>'.repeat(3)}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${'<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'.repeat(3)}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);
  slides.forEach((slide, index) => {
    const n = index + 1;
    put(`ppt/slides/slide${n}.xml`, slideXml(slide, index, index === 0));
    put(`ppt/slides/_rels/slide${n}.xml.rels`, `${declaration}<Relationships xmlns="${relNs}"><Relationship Id="rIdLayout" Type="${officeRel}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rIdNotes" Type="${officeRel}/notesSlide" Target="../notesSlides/notesSlide${n}.xml"/></Relationships>`);
    put(`ppt/notesSlides/notesSlide${n}.xml`, `${declaration}<p:notes ${presentationNs}><p:cSld><p:spTree>${group}${textBox(2, "Speaker notes", [slide.speakerNotes], 0, 0, 6000000, 6000000, 1200, "172033")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`);
    put(`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`, `${declaration}<Relationships xmlns="${relNs}"><Relationship Id="rIdMaster" Type="${officeRel}/notesMaster" Target="../notesMasters/notesMaster1.xml"/><Relationship Id="rIdSlide" Type="${officeRel}/slide" Target="../slides/slide${n}.xml"/></Relationships>`);
  });
  return zipSync(files);
}
