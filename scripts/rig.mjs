// Nova's animation rig, applied by port-avatar.mjs on top of the design's drawing.
//
// The design draws each arm as one rigid piece behind the torso, with the whole body in
// one group (AVATAR.md "Known limit"). That makes emotes like Namaste, Clap or Dab
// impossible: hands can't meet, and arms that swing inward vanish behind the body. This
// adds:
//   .av-fore-l / .av-fore-r   forearms (lower sleeve, cuff, hand, watch, bangles) that
//                             bend at the elbow; a round joint under the arm fills the bend
//   .av-torso                 everything above the waist (arms, torso, head), pivoting at the
//                             waist, so dances can move the hips against the shoulders
// Bringing an arm in front of the body is done at play time (emotes.ts moves the group).
//
// The arm blocks are re-authored from the design's path data. If the design's arms change,
// update them here — the checks below fail loudly rather than producing a broken rig.

const SKIN = 'fill="url(#{{uid}}Skin)"';
const SLEEVE = 'fill="url(#{{uid}}Sleeve)"';
const IF = (v, def, body) => `<sc-if value="{{${v}}}" hint-placeholder-val="{{${def}}}">\n${body}\n</sc-if>`;

const ARM_L = `<g class="av-arm av-arm-l">
<circle cx="68" cy="121" r="4.8" ${SKIN}></circle>
${IF('slvLong', 'true', `<circle cx="67.5" cy="121" r="6.2" ${SLEEVE}></circle>
${IF('slvPuffy', 'false', `<circle cx="66.5" cy="121" r="8.2" ${SLEEVE}></circle>`)}`)}
<path d="M68 72 C63 76 61 88 62 104 L63 122 L73 122 L74 104 C75 92 74 80 72 73 Z" ${SKIN}></path>
${IF('slvLong', 'true', `<path d="M67 70 C61 75 59 88 60 104 L61 122 L74 122 L75 104 C76 92 75 80 73 72 Z" ${SLEEVE}></path>
<path d="M62 116 C65 119.5 69.5 119.5 73.5 116" stroke="{{slvD}}" stroke-width="1" fill="none"></path>
${IF('slvStripe', 'false', `<path d="M60.5 78 L61.4 121 M63 78 L63.7 121" stroke="{{accent}}" stroke-width="1.2"></path>`)}
${IF('slvPuffy', 'false', `<path d="M66 70 C58 76 56 88 57 104 L58 122 L75 122 L76 104 C77 92 76 80 73 72 Z" ${SLEEVE}></path>
<path d="M58 92 C64 94 70 94 76 92 M57.5 108 C64 110 70 110 75.5 108" stroke="{{slvD}}" stroke-width="1.2" fill="none"></path>`)}`)}
${IF('slvShort', 'false', `<path d="M67 70 C61 75 59 86 60 100 L75 100 C76 90 75 80 73 72 Z" ${SLEEVE}></path>
<path d="M60 97 L75 97" stroke="{{slvD}}" stroke-width="1.2"></path>`)}
<g class="av-fore av-fore-l">
<path d="M63 120 C62 134 63 148 64 156 L72 156 C73 148 74 134 73 120 Z" ${SKIN}></path>
${IF('slvLong', 'true', `<path d="M61 120 C60 134 61 148 63 156 L73 156 C74 148 75 134 74 120 Z" ${SLEEVE}></path>
<path d="M62.5 123 C66 121 70 121.5 73.5 124.5 M64 128 C67 127 70 128 72.5 130" stroke="{{slvD}}" stroke-width="1" fill="none"></path>
<rect x="62.5" y="151" width="11" height="6" rx="2" fill="{{slvD}}"></rect>
${IF('slvStripe', 'false', `<path d="M61.4 121 L62 152 M63.7 121 L64.2 152" stroke="{{accent}}" stroke-width="1.2"></path>`)}
${IF('slvPuffy', 'false', `<path d="M58 120 C57 134 58 148 61 156 L74 156 C75 148 76 134 75 120 Z" ${SLEEVE}></path>
<path d="M58 136 C64 138 70 138 75 136" stroke="{{slvD}}" stroke-width="1.2" fill="none"></path>`)}`)}
<path d="M63 157 C61 163 61.5 170 63.5 175 C64.5 178 66 179.6 67.6 179.2 C69.6 179.6 71.6 178 72.6 175 C74 170 74 163 73 157 Z" ${SKIN}></path>
<path d="M63 160 C60.6 163 60.6 167 62.2 169.5" stroke="{{skinD}}" stroke-width="1" fill="none"></path>
<path d="M66 171.5 v6.5 M68.6 172 v6.8 M71.1 171.6 v5.8" stroke="{{skinD}}" stroke-width="0.6" opacity="0.7"></path>
${IF('aWatch', 'false', `<rect x="62.4" y="152.5" width="11.2" height="4" rx="1.4" fill="#1B1F2A"></rect>
<circle cx="68" cy="154.5" r="3" fill="#C9CED8" stroke="#1B1F2A" stroke-width="0.8"></circle>`)}
${IF('aBangles', 'false', `<path d="M62.6 153.5 h10.8 M62.6 155.5 h10.8 M62.8 157.5 h10.4" stroke="url(#{{uid}}Gold)" stroke-width="1.3"></path>
<path d="M62.6 154.5 h10.8" stroke="{{accent}}" stroke-width="0.8"></path>`)}
</g>
</g>`;

const ARM_R = `<g class="av-arm av-arm-r">
<circle cx="132" cy="121" r="4.8" ${SKIN}></circle>
${IF('slvLong', 'true', `<circle cx="132.5" cy="121" r="6.2" ${SLEEVE}></circle>
${IF('slvPuffy', 'false', `<circle cx="133.5" cy="121" r="8.2" ${SLEEVE}></circle>`)}`)}
<path d="M132 72 C137 76 139 88 138 104 L137 122 L127 122 L126 104 C125 92 126 80 128 73 Z" ${SKIN}></path>
${IF('slvLong', 'true', `<path d="M133 70 C139 75 141 88 140 104 L139 122 L126 122 L125 104 C124 92 125 80 127 72 Z" ${SLEEVE}></path>
<path d="M126 116 C130 119.5 134.5 119.5 138.5 116" stroke="{{slvD}}" stroke-width="1" fill="none"></path>
${IF('slvStripe', 'false', `<path d="M139.5 78 L140.1 121 M137 78 L137.8 121" stroke="{{accent}}" stroke-width="1.2"></path>`)}
${IF('slvPuffy', 'false', `<path d="M134 70 C142 76 144 88 143 104 L142 122 L125 122 L124 104 C123 92 124 80 127 72 Z" ${SLEEVE}></path>
<path d="M124 92 C130 94 136 94 142 92 M124.5 108 C130 110 136 110 142.5 108" stroke="{{slvD}}" stroke-width="1.2" fill="none"></path>`)}`)}
${IF('slvShort', 'false', `<path d="M133 70 C139 75 141 86 140 100 L125 100 C124 90 125 80 127 72 Z" ${SLEEVE}></path>
<path d="M125 97 L140 97" stroke="{{slvD}}" stroke-width="1.2"></path>`)}
<g class="av-fore av-fore-r">
<path d="M137 120 C139 132 140 144 139 154 L132 156 C131 146 129 134 127 120 Z" ${SKIN}></path>
${IF('slvLong', 'true', `<path d="M139 120 C141 132 142 144 141 154 L131 156 C130 146 128 134 126 120 Z" ${SLEEVE}></path>
<path d="M126.5 124 C130 121.5 134 121.5 139 124 M127.5 130 C131 128.5 134.5 129 139.5 131" stroke="{{slvD}}" stroke-width="1" fill="none"></path>
<rect x="130.5" y="150" width="11" height="6" rx="2" fill="{{slvD}}" transform="rotate(-6 136 153)"></rect>
${IF('slvStripe', 'false', `<path d="M140.1 121 L140.5 150 M137.8 121 L138.4 151" stroke="{{accent}}" stroke-width="1.2"></path>`)}
${IF('slvPuffy', 'false', `<path d="M142 120 C144 132 145 144 143 155 L130 156 C129 146 126 134 125 120 Z" ${SLEEVE}></path>
<path d="M126 136 C132 138 138 138 144 136" stroke="{{slvD}}" stroke-width="1.2" fill="none"></path>`)}`)}
<path d="M141 155 C143 161 142.5 168 140 173 C138.8 176 137 177.4 135.4 176.8 C133.4 177 131.6 175.2 130.8 172.2 C129.6 167 130 161 131.2 156 Z" ${SKIN}></path>
<path d="M140.6 158 C143 161 143 165 141.6 168" stroke="{{skinD}}" stroke-width="1" fill="none"></path>
<path d="M133.5 169.5 v6 M136 170 v6.4 M138.4 169.4 v5.2" stroke="{{skinD}}" stroke-width="0.6" opacity="0.7"></path>
${IF('aBangles', 'false', `<path d="M130.8 152.5 l10.6 -1.2 M131 154.5 l10.6 -1.2 M131.2 156.5 l10.4 -1.2" stroke="url(#{{uid}}Gold)" stroke-width="1.3"></path>`)}
</g>
</g>`;

/** Index just past the </g> that closes the <g …> starting at `start`. */
function closingG(svg, start) {
  const tag = /<g\b[^>]*>|<\/g>/g;
  tag.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = tag.exec(svg))) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return tag.lastIndex;
  }
  throw new Error('Unbalanced <g> after ' + start);
}

function replaceGroup(svg, open, replacement, mustContain) {
  const start = svg.indexOf(open);
  if (start < 0) throw new Error(`rig: ${open} not found in the design`);
  const end = closingG(svg, start);
  const block = svg.slice(start, end);
  for (const s of mustContain) {
    if (!block.includes(s)) throw new Error(`rig: the design's ${open} changed (missing ${s}) — update scripts/rig.mjs`);
  }
  return svg.slice(0, start) + replacement + svg.slice(end);
}

export function rig(svg) {
  svg = replaceGroup(svg, '<g class="av-arm av-arm-l">', ARM_L, ['M68 72 C63 76', 'M63 120 C62 134', 'M63 157 C61 163', 'aWatch', 'aBangles', 'slvPuffy']);
  svg = replaceGroup(svg, '<g class="av-arm av-arm-r">', ARM_R, ['M132 72 C137 76', 'M137 120 C139 132', 'M141 155 C143 161', 'aBangles', 'slvPuffy']);
  // Waist joint: wrap the upper body (its own transform attribute must stay untouched).
  const upper = '<g transform="rotate(-3 100 138)">';
  const start = svg.indexOf(upper);
  if (start < 0) throw new Error('rig: upper-body group not found');
  const end = closingG(svg, start);
  return svg.slice(0, start) + '<g class="av-torso">' + svg.slice(start, end) + '</g>' + svg.slice(end);
}
